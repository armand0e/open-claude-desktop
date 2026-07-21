import { realpath, stat } from "node:fs/promises";
import path from "node:path";

type Grant =
  | { readonly kind: "file"; readonly canonicalPath: string }
  | { readonly kind: "root"; readonly canonicalPath: string };

function comparable(candidate: string): string {
  const normalized = path.normalize(candidate);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(comparable(root), comparable(candidate));
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}

function pathCandidates(input: string): string[] {
  if (input.includes("\0")) throw new Error("File path contains a null byte");
  const raw = path.resolve(input);
  let decoded: string;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    // Native pickers return ordinary filesystem paths. A literal '%' that is
    // not URI syntax is valid in a filename and must remain usable.
    return [raw];
  }
  // Keep this outside the decode error handler. An encoded NUL is invalid
  // input, not a literal-percent filename that should fall back to `raw`.
  if (decoded.includes("\0")) throw new Error("File path contains a null byte");
  const resolved = path.resolve(decoded);
  return comparable(resolved) === comparable(raw) ? [raw] : [raw, resolved];
}

export class FileAccessPolicy {
  private readonly grants: Grant[] = [];

  async grantFile(input: string): Promise<string> {
    for (const candidate of pathCandidates(input)) {
      const info = await stat(candidate).catch(() => null);
      if (!info?.isFile()) continue;
      const canonicalPath = await realpath(candidate);
      this.addGrant({ kind: "file", canonicalPath });
      return canonicalPath;
    }
    throw new Error("Only regular files can be granted");
  }

  async grantRoot(input: string): Promise<string> {
    for (const candidate of pathCandidates(input)) {
      const info = await stat(candidate).catch(() => null);
      if (!info?.isDirectory()) continue;
      const canonicalPath = await realpath(candidate);
      this.addGrant({ kind: "root", canonicalPath });
      return canonicalPath;
    }
    throw new Error("Only directories can be granted as roots");
  }

  async requireFile(
    input: string,
    options: { write?: boolean } = {},
  ): Promise<string> {
    let lastError: unknown = new Error("Path is not a regular file");
    for (const candidate of pathCandidates(input)) {
      try {
        const existing = await stat(candidate).catch(() => null);
        let canonicalPath: string;
        if (existing) {
          if (!existing.isFile()) throw new Error("Path is not a regular file");
          canonicalPath = await realpath(candidate);
        } else {
          if (!options.write) throw new Error("Path does not exist");
          const canonicalParent = await realpath(path.dirname(candidate));
          canonicalPath = path.join(canonicalParent, path.basename(candidate));
        }
        this.assertGranted(candidate, canonicalPath, false);
        return canonicalPath;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async requireRoot(input: string): Promise<string> {
    let lastError: unknown = new Error("Path is not a directory");
    for (const candidate of pathCandidates(input)) {
      try {
        const canonicalPath = await realpath(candidate);
        const info = await stat(canonicalPath);
        if (!info.isDirectory()) throw new Error("Path is not a directory");
        this.assertGranted(candidate, canonicalPath, true);
        return canonicalPath;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private addGrant(grant: Grant): void {
    const duplicate = this.grants.some(
      (candidate) =>
        candidate.kind === grant.kind &&
        comparable(candidate.canonicalPath) === comparable(grant.canonicalPath),
    );
    if (!duplicate) this.grants.push(grant);
  }

  private assertGranted(
    lexicalPath: string,
    canonicalPath: string,
    directory: boolean,
  ): void {
    const granted = this.grants.some((grant) => {
      if (grant.kind === "file") {
        return (
          !directory &&
          comparable(grant.canonicalPath) === comparable(canonicalPath)
        );
      }
      return isPathInside(grant.canonicalPath, canonicalPath);
    });
    if (!granted) {
      throw new Error(
        `File access was not granted by a user picker: ${lexicalPath}`,
      );
    }
  }
}
