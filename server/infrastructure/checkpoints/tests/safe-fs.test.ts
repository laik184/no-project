/**
 * safe-fs.test.ts
 * Unit tests for safeWriteFile and safeDeleteFile.
 *
 * Verifies: atomic writes, backup creation, directory creation,
 * delete-with-backup, idempotent deletes, and directory removal.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { safeWriteFile, safeDeleteFile } from "../safe-fs.util.ts";

const makeTmpDir = () =>
  fs.mkdtemp(path.join(os.tmpdir(), "nura-safe-fs-test-"));

// ── safeWriteFile ─────────────────────────────────────────────────────────────

describe("safeWriteFile", () => {
  test("creates file and parent dirs when they do not exist", async () => {
    const dir = await makeTmpDir();
    try {
      const filePath = path.join(dir, "nested", "sub", "file.ts");
      const result = await safeWriteFile(filePath, "hello world");

      assert.equal(result.ok, true);
      assert.equal(result.backupPath, null, "no backup for a new file");

      const content = await fs.readFile(filePath, "utf-8");
      assert.equal(content, "hello world");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("backs up existing file before overwriting", async () => {
    const dir = await makeTmpDir();
    try {
      const filePath = path.join(dir, "existing.ts");
      await fs.writeFile(filePath, "original content");

      const result = await safeWriteFile(filePath, "new content");

      assert.equal(result.ok, true);
      assert.ok(result.backupPath, "backup path must be set");
      assert.ok(result.backupPath!.endsWith(".bak"), "backup has .bak suffix");

      const backupContent = await fs.readFile(result.backupPath!, "utf-8");
      assert.equal(backupContent, "original content", "backup preserves old content");

      const current = await fs.readFile(filePath, "utf-8");
      assert.equal(current, "new content", "file has new content");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("leaves no .nura_tmp file after successful write", async () => {
    const dir = await makeTmpDir();
    try {
      await safeWriteFile(path.join(dir, "clean.ts"), "content");
      const entries = await fs.readdir(dir);
      const tmpFiles = entries.filter((e) => e.endsWith(".nura_tmp"));
      assert.equal(tmpFiles.length, 0, "temp file must be cleaned up");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("returns ok=true and correct content for empty string", async () => {
    const dir = await makeTmpDir();
    try {
      const filePath = path.join(dir, "empty.ts");
      const result = await safeWriteFile(filePath, "");
      assert.equal(result.ok, true);
      const content = await fs.readFile(filePath, "utf-8");
      assert.equal(content, "");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

// ── safeDeleteFile ────────────────────────────────────────────────────────────

describe("safeDeleteFile", () => {
  test("backs up and removes a file", async () => {
    const dir = await makeTmpDir();
    try {
      const filePath = path.join(dir, "target.ts");
      await fs.writeFile(filePath, "to be deleted");

      const result = await safeDeleteFile(filePath);

      assert.equal(result.ok, true);
      assert.equal(result.wasFile, true);
      assert.ok(result.backupPath, "should produce a backup");

      await assert.rejects(
        () => fs.access(filePath),
        "original file must be gone",
      );

      const backup = await fs.readFile(result.backupPath!, "utf-8");
      assert.equal(backup, "to be deleted", "backup preserves content");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("returns ok=true when target does not exist (idempotent)", async () => {
    const result = await safeDeleteFile(
      "/tmp/nura-test-does-not-exist-xyzzy.ts",
    );
    assert.equal(result.ok, true);
    assert.equal(result.wasFile, false);
    assert.equal(result.backupPath, null);
  });

  test("removes a directory recursively without backup", async () => {
    const dir = await makeTmpDir();
    try {
      const subDir = path.join(dir, "subdir");
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(subDir, "a.ts"), "child file");

      const result = await safeDeleteFile(subDir);

      assert.equal(result.ok, true);
      assert.equal(result.wasFile, false, "isDirectory → wasFile=false");
      assert.equal(result.backupPath, null, "directories are not backed up");

      await assert.rejects(
        () => fs.access(subDir),
        "directory must be removed",
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
