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

function decodePath(input: string): string {
  if (input.includes("\0")) throw new Error("File path contains a null byte");
  let decoded: string;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    throw new Error("File path is not valid URI encoding");
  }
  if (decoded.includes("\0")) throw new Error("File path contains a null byte");
  return path.resolve(decoded);
}

export class FileAccessPolicy {
  private readonly grants: Grant[] = [];

  async grantFile(input: string): Promise<string> {
    const candidate = decodePath(input);
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error("Only regular files can be granted");
    const canonicalPath = await realpath(candidate);
    this.addGrant({ kind: "file", canonicalPath });
    return candidate;
  }

  async grantRoot(input: string): Promise<string> {
    const candidate = decodePath(input);
    const info = await stat(candidate);
    if (!info.isDirectory())
      throw new Error("Only directories can be granted as roots");
    const canonicalPath = await realpath(candidate);
    this.addGrant({ kind: "root", canonicalPath });
    return candidate;
  }

  async requireFile(
    input: string,
    options: { write?: boolean } = {},
  ): Promise<string> {
    const candidate = decodePath(input);
    let canonicalPath: string;
    try {
      canonicalPath = await realpath(candidate);
      const info = await stat(canonicalPath);
      if (!info.isFile()) throw new Error("Path is not a regular file");
    } catch (error) {
      if (!options.write) throw error;
      const canonicalParent = await realpath(path.dirname(candidate));
      canonicalPath = path.join(canonicalParent, path.basename(candidate));
    }
    this.assertGranted(candidate, canonicalPath, false);
    return candidate;
  }

  async requireRoot(input: string): Promise<string> {
    const candidate = decodePath(input);
    const canonicalPath = await realpath(candidate);
    const info = await stat(canonicalPath);
    if (!info.isDirectory()) throw new Error("Path is not a directory");
    this.assertGranted(candidate, canonicalPath, true);
    return candidate;
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
