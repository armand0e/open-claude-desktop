// Rich text extraction for uploads that are not plain text: PDF (pdfjs),
// plus docx/xlsx/pptx read with a minimal in-repo zip parser (they are zip
// archives of XML). Keeps chat attachments, convert_document, and project
// knowledge uploads on one shared pipeline.

import { inflateRawSync } from "node:zlib";

const MAX_EXTRACT_CHARS = 2_000_000;
const MAX_PDF_PAGES = 300;

export interface ZipEntryLimits {
  maxEntries?: number;
  maxEntryBytes?: number;
  maxTotalBytes?: number;
}

const DEFAULT_ZIP_LIMITS = {
  maxEntries: 10_000,
  maxEntryBytes: 32 * 1024 * 1024,
  maxTotalBytes: 128 * 1024 * 1024,
} as const;

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

// Minimal ZIP central-directory reader: enough for Office documents, which
// use store (0) or deflate (8) compression and never span archives.
export function zipEntries(
  bytes: Uint8Array,
  limits: ZipEntryLimits = {},
): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  const maxEntries = limits.maxEntries ?? DEFAULT_ZIP_LIMITS.maxEntries;
  const maxEntryBytes =
    limits.maxEntryBytes ?? DEFAULT_ZIP_LIMITS.maxEntryBytes;
  const maxTotalBytes =
    limits.maxTotalBytes ?? DEFAULT_ZIP_LIMITS.maxTotalBytes;
  if (
    !Number.isSafeInteger(maxEntries) ||
    maxEntries < 1 ||
    !Number.isSafeInteger(maxEntryBytes) ||
    maxEntryBytes < 1 ||
    !Number.isSafeInteger(maxTotalBytes) ||
    maxTotalBytes < 1
  )
    throw new RangeError("ZIP extraction limits must be positive integers");
  // End-of-central-directory signature scan from the tail.
  if (bytes.length < 22) return entries;
  let eocd = -1;
  const scanFloor = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= scanFloor; offset -= 1) {
    if (
      readUint32(bytes, offset) === 0x06054b50 &&
      // An EOCD-like byte sequence is legal inside the archive comment. It
      // is the real record only when its declared comment reaches EOF.
      offset + 22 + readUint16(bytes, offset + 20) === bytes.length &&
      // Multi-disk archives are deliberately unsupported by this reader.
      readUint16(bytes, offset + 4) === 0 &&
      readUint16(bytes, offset + 6) === 0 &&
      readUint16(bytes, offset + 8) === readUint16(bytes, offset + 10) &&
      readUint32(bytes, offset + 16) + readUint32(bytes, offset + 12) === offset
    ) {
      eocd = offset;
      break;
    }
  }
  if (eocd === -1) return entries;
  const entryCount = readUint16(bytes, eocd + 10);
  if (entryCount > maxEntries)
    throw new RangeError(`ZIP archive has more than ${maxEntries} entries`);
  const centralDirectorySize = readUint32(bytes, eocd + 12);
  let cursor = readUint32(bytes, eocd + 16);
  if (
    cursor > eocd ||
    centralDirectorySize > eocd - cursor ||
    cursor + centralDirectorySize > bytes.length
  )
    return entries;
  const decoder = new TextDecoder("utf-8");
  const seenNames = new Set<string>();
  let totalBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.length) break;
    if (readUint32(bytes, cursor) !== 0x02014b50) break;
    const flags = readUint16(bytes, cursor + 8);
    const method = readUint16(bytes, cursor + 10);
    const compressedSize = readUint32(bytes, cursor + 20);
    const uncompressedSize = readUint32(bytes, cursor + 24);
    const nameLength = readUint16(bytes, cursor + 28);
    const extraLength = readUint16(bytes, cursor + 30);
    const commentLength = readUint16(bytes, cursor + 32);
    const localOffset = readUint32(bytes, cursor + 42);
    const nextCursor = cursor + 46 + nameLength + extraLength + commentLength;
    if (nextCursor > bytes.length || nextCursor > eocd) break;
    const name = decoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    cursor = nextCursor;
    if (name.endsWith("/")) continue;
    if (seenNames.has(name))
      throw new RangeError(`ZIP archive contains a duplicate member: ${name}`);
    seenNames.add(name);
    // Encrypted and ZIP64 members are outside this deliberately small
    // parser. More importantly, never feed attacker-controlled, unbounded
    // output into zlib: Office documents and uploaded plugins are untrusted.
    if (
      (flags & 0x1) !== 0 ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff
    )
      continue;
    if (uncompressedSize > maxEntryBytes)
      throw new RangeError(
        `ZIP member exceeds the ${maxEntryBytes}-byte extraction limit`,
      );
    if (totalBytes + uncompressedSize > maxTotalBytes)
      throw new RangeError(
        `ZIP archive exceeds the ${maxTotalBytes}-byte extraction limit`,
      );
    // The local header repeats name/extra with possibly different extra
    // lengths; the data starts after the local header's own fields.
    if (localOffset + 30 > bytes.length) continue;
    if (readUint32(bytes, localOffset) !== 0x04034b50) continue;
    const localName = readUint16(bytes, localOffset + 26);
    const localExtra = readUint16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localName + localExtra;
    if (dataStart > bytes.length || compressedSize > bytes.length - dataStart)
      continue;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    try {
      const data =
        method === 0
          ? compressed.slice()
          : method === 8
            ? new Uint8Array(
                inflateRawSync(compressed, {
                  // Do not trust a tiny declared size while allowing zlib to
                  // expand all the way to the global member cap. One byte of
                  // headroom distinguishes a corrupt declaration without
                  // turning it into an avoidable decompression bomb.
                  maxOutputLength: Math.min(
                    maxEntryBytes,
                    uncompressedSize + 1,
                  ),
                }),
              )
            : undefined;
      if (!data || data.byteLength !== uncompressedSize) continue;
      totalBytes += data.byteLength;
      entries.set(name, data);
    } catch {
      // A corrupt member simply stays absent.
    }
  }
  return entries;
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function xmlToText(xml: string): string {
  return decodeXmlEntities(
    xml
      .replaceAll(/<\/w:p>|<\/a:p>/g, "\n")
      .replaceAll(/<w:tab[^>]*\/>/g, "\t")
      .replaceAll(/<w:br[^>]*\/>/g, "\n")
      .replaceAll(/<[^>]+>/g, ""),
  )
    .replaceAll(/[ \t]+\n/g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractDocxText(bytes: Uint8Array): string | undefined {
  const entries = zipEntries(bytes);
  const document = entries.get("word/document.xml");
  if (!document) return undefined;
  const text = xmlToText(new TextDecoder("utf-8").decode(document));
  return text || undefined;
}

export function extractPptxText(bytes: Uint8Array): string | undefined {
  const entries = zipEntries(bytes);
  const slides = [...entries.keys()]
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(
      (left, right) =>
        Number(left.match(/\d+/)?.[0] ?? 0) -
        Number(right.match(/\d+/)?.[0] ?? 0),
    );
  if (slides.length === 0) return undefined;
  const decoder = new TextDecoder("utf-8");
  const sections = slides.map((name, index) => {
    const texts = [
      ...decoder
        .decode(entries.get(name)!)
        .matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g),
    ].map((match) => decodeXmlEntities(match[1]));
    return `--- Slide ${index + 1} ---\n${texts.join("\n")}`;
  });
  const combined = sections.join("\n\n").trim();
  return combined || undefined;
}

export function extractXlsxText(bytes: Uint8Array): string | undefined {
  const entries = zipEntries(bytes);
  const decoder = new TextDecoder("utf-8");
  const sharedXml = entries.get("xl/sharedStrings.xml");
  const shared: string[] = sharedXml
    ? [...decoder.decode(sharedXml).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
        (match) =>
          decodeXmlEntities(
            [...match[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)]
              .map((text) => text[1])
              .join(""),
          ),
      )
    : [];
  const sheets = [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort(
      (left, right) =>
        Number(left.match(/\d+/)?.[0] ?? 0) -
        Number(right.match(/\d+/)?.[0] ?? 0),
    );
  if (sheets.length === 0) return undefined;
  const sections = sheets.map((name, index) => {
    const xml = decoder.decode(entries.get(name)!);
    const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) =>
      [...row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)]
        .map((cell) => {
          const attributes = cell[1];
          const value = cell[2].match(/<v>([^<]*)<\/v>/)?.[1];
          const inline = [...cell[2].matchAll(/<t[^>]*>([^<]*)<\/t>/g)]
            .map((match) => match[1])
            .join("");
          if (/t="s"/.test(attributes) && value !== undefined)
            return shared[Number(value)] ?? "";
          // `inline` is always a string, including the empty string for
          // ordinary numeric cells. Nullish coalescing would therefore hide
          // every <v> value that was not a shared string.
          return decodeXmlEntities(inline || value || "");
        })
        .join(", "),
    );
    return `--- Sheet ${index + 1} ---\n${rows.filter(Boolean).join("\n")}`;
  });
  const combined = sections.join("\n\n").trim();
  return combined || undefined;
}

export async function extractPdfText(
  bytes: Uint8Array,
): Promise<string | undefined> {
  // The legacy build carries the polyfills pdf.js needs under Node; text
  // extraction never touches canvas rendering.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  try {
    const pages = Math.min(document.numPages, MAX_PDF_PAGES);
    const sections: string[] = [];
    let total = 0;
    for (
      let index = 1;
      index <= pages && total < MAX_EXTRACT_CHARS;
      index += 1
    ) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replaceAll(/\s+/g, " ")
        .trim();
      page.cleanup();
      if (text) {
        const separatorLength = sections.length > 0 ? 2 : 0;
        const remaining = MAX_EXTRACT_CHARS - total - separatorLength;
        if (remaining <= 0) break;
        const accepted = text.slice(0, remaining);
        sections.push(accepted);
        total += separatorLength + accepted.length;
      }
    }
    const combined = sections.join("\n\n").trim();
    return combined || undefined;
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

// Extraction for formats the plain-text path cannot decode. Returns
// undefined when the format is unsupported or yields no text.
export async function extractRichText(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<string | undefined> {
  const lower = fileName.toLowerCase();
  const isPdf =
    mimeType === "application/pdf" ||
    lower.endsWith(".pdf") ||
    (bytes.length > 4 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46);
  try {
    let text: string | undefined;
    if (isPdf) text = await extractPdfText(bytes);
    else if (lower.endsWith(".docx")) text = extractDocxText(bytes);
    else if (lower.endsWith(".xlsx")) text = extractXlsxText(bytes);
    else if (lower.endsWith(".pptx")) text = extractPptxText(bytes);
    return text ? text.slice(0, MAX_EXTRACT_CHARS) : undefined;
  } catch {
    return undefined;
  }
}
