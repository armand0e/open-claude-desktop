import { describe, expect, it } from "vitest";
import {
  extractDocxText,
  extractPdfText,
  extractRichText,
  extractXlsxText,
} from "../src/main/local-extract";

// Store-method zip builder — enough for Office-document fixtures. The
// production reader ignores CRCs, so zeros are fine here.
function buildZip(files: Array<[string, string]>): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const push = (chunk: Uint8Array, into: Uint8Array[]) => {
    into.push(chunk);
    return chunk.length;
  };
  const uint16 = (value: number) => new Uint8Array([value & 255, value >> 8]);
  const uint32 = (value: number) =>
    new Uint8Array([
      value & 255,
      (value >> 8) & 255,
      (value >> 16) & 255,
      (value >>> 24) & 255,
    ]);
  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const header = [
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0), // store
      uint16(0),
      uint16(0),
      uint32(0), // crc (unchecked)
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
    ];
    const localOffset = offset;
    for (const part of header) offset += push(part, chunks);
    offset += push(nameBytes, chunks);
    offset += push(data, chunks);
    const centralParts = [
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0), // store
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(localOffset),
      nameBytes,
    ];
    central.push(...centralParts);
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const part of central) centralSize += push(part, chunks);
  const eocd = [
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralSize),
    uint32(centralStart),
    uint16(0),
  ];
  for (const part of eocd) push(part, chunks);
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

function buildMinimalPdf(text: string): Uint8Array {
  const stream = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    `<</Length ${stream.length}>>stream\n${stream}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj${object}endobj\n`;
  });
  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const objectOffset of offsets)
    body += `${String(objectOffset).padStart(10, "0")} 00000 n \n`;
  body += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(body);
}

describe("local rich extraction", () => {
  it("extracts docx paragraphs", () => {
    const docx = buildZip([
      [
        "word/document.xml",
        '<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>First paragraph &amp; more.</w:t></w:r></w:p><w:p><w:r><w:t>Second one.</w:t></w:r></w:p></w:body></w:document>',
      ],
    ]);
    const text = extractDocxText(docx);
    expect(text).toContain("First paragraph & more.");
    expect(text).toContain("Second one.");
  });

  it("extracts xlsx cells with shared strings", () => {
    const xlsx = buildZip([
      [
        "xl/sharedStrings.xml",
        "<sst><si><t>Name</t></si><si><t>Score</t></si><si><t>Ada</t></si></sst>",
      ],
      [
        "xl/worksheets/sheet1.xml",
        '<worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row><row><c t="s"><v>2</v></c><c><v>42</v></c></row></sheetData></worksheet>',
      ],
    ]);
    const text = extractXlsxText(xlsx);
    expect(text).toContain("Name, Score");
    expect(text).toContain("Ada, 42");
  });

  it("extracts pdf text through pdfjs", async () => {
    const pdf = buildMinimalPdf("Hello local PDF extraction");
    const text = await extractPdfText(pdf);
    expect(text).toContain("Hello local PDF extraction");
  });

  it("routes by file name and survives garbage", async () => {
    const docx = buildZip([
      [
        "word/document.xml",
        "<w:document><w:p><w:t>Doc</w:t></w:p></w:document>",
      ],
    ]);
    expect(
      await extractRichText(docx, "report.docx", "application/octet-stream"),
    ).toContain("Doc");
    expect(
      await extractRichText(
        new Uint8Array([1, 2, 3, 4]),
        "broken.pdf",
        "application/pdf",
      ),
    ).toBeUndefined();
  });
});
