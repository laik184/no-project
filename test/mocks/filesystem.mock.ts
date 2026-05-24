/**
 * test/mocks/filesystem.mock.ts
 *
 * In-memory filesystem mock for tests that exercise file operations.
 * Avoids touching the real disk — deterministic, fast, teardown-safe.
 */

import { vi } from "vitest";

export type VirtualFile = {
  content: string;
  mtime:   number;
};

export class VirtualFilesystem {
  private readonly _files = new Map<string, VirtualFile>();
  private readonly _dirs  = new Set<string>();

  /** Stage a file before the test runs. */
  seed(path: string, content = ""): void {
    this._files.set(path, { content, mtime: Date.now() });
    this._ensureParentDirs(path);
  }

  has(path: string): boolean { return this._files.has(path) || this._dirs.has(path); }
  read(path: string): string {
    const f = this._files.get(path);
    if (!f) throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
    return f.content;
  }
  write(path: string, content: string): void {
    this._files.set(path, { content, mtime: Date.now() });
    this._ensureParentDirs(path);
  }
  delete(path: string): void { this._files.delete(path); this._dirs.delete(path); }
  ls(dir: string): string[] {
    return [...this._files.keys(), ...this._dirs.values()]
      .filter(p => p.startsWith(dir + "/") && !p.slice(dir.length + 1).includes("/"))
      .map(p => p.slice(dir.length + 1));
  }
  reset(): void { this._files.clear(); this._dirs.clear(); }

  /** Build an fs/promises-compatible mock from this virtual FS. */
  toFsMock() {
    const vfs = this;
    return {
      mkdir: vi.fn(async (path: string) => { vfs._dirs.add(String(path)); }),
      rm:    vi.fn(async (path: string) => { vfs.delete(String(path)); }),
      readFile: vi.fn(async (path: string) => vfs.read(String(path))),
      writeFile: vi.fn(async (path: string, data: string) => { vfs.write(String(path), data); }),
      access: vi.fn(async (path: string) => {
        if (!vfs.has(String(path))) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }),
      stat: vi.fn(async (path: string) => {
        if (!vfs.has(String(path))) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        return { isDirectory: () => vfs._dirs.has(String(path)), mtime: new Date() };
      }),
    };
  }

  private _ensureParentDirs(filePath: string): void {
    const parts = filePath.split("/");
    for (let i = 1; i < parts.length; i++) {
      this._dirs.add(parts.slice(0, i).join("/"));
    }
  }
}

export function createVirtualFs(): VirtualFilesystem {
  return new VirtualFilesystem();
}
