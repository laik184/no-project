/**
 * server/file-explorer/tests/write.service.test.ts
 * Unit tests for WriteService.
 * Run: node --import tsx/esm --test server/file-explorer/tests/write.service.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs   from 'node:fs';
import path from 'node:path';
import os   from 'node:os';

// ── Test sandbox setup ────────────────────────────────────────────────────────

let sandboxDir: string;

before(() => {
  sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-write-test-'));
  fs.writeFileSync(path.join(sandboxDir, 'existing.ts'), 'const a = 1;\n');
  process.env['AGENT_PROJECT_ROOT'] = sandboxDir;
});

after(() => {
  fs.rmSync(sandboxDir, { recursive: true, force: true });
  delete process.env['AGENT_PROJECT_ROOT'];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WriteService', () => {
  it('writes content to a new file and returns ok:true with serverMtime', async () => {
    const { writeService } = await import('../services/write/index.ts');
    const filePath = path.join(sandboxDir, 'newfile.ts');
    const result   = writeService.saveFile(filePath, 'const hello = "world";\n');
    assert.equal(result.ok, true);
    assert.ok(typeof result.serverMtime === 'number');
    assert.ok(result.serverMtime > 0);
    assert.equal(fs.readFileSync(filePath, 'utf-8'), 'const hello = "world";\n');
  });

  it('overwrites an existing file', async () => {
    const { writeService } = await import('../services/write/index.ts');
    const filePath = path.join(sandboxDir, 'existing.ts');
    const result   = writeService.saveFile(filePath, 'const b = 2;\n');
    assert.equal(result.ok, true);
    assert.equal(fs.readFileSync(filePath, 'utf-8'), 'const b = 2;\n');
  });

  it('detects write conflict when clientMtime diverges from server mtime', async () => {
    const { writeService } = await import('../services/write/index.ts');
    const filePath = path.join(sandboxDir, 'existing.ts');
    const staleClientMtime = Date.now() - 60_000; // 60 seconds in the past
    const result   = writeService.saveFile(filePath, 'const c = 3;\n', staleClientMtime);
    assert.equal(result.ok, false);
    assert.equal(result.conflict, true);
    assert.ok(typeof result.serverMtime === 'number');
  });

  it('accepts write when clientMtime matches within 1 second tolerance', async () => {
    const { writeService } = await import('../services/write/index.ts');
    const filePath = path.join(sandboxDir, 'existing.ts');
    const stat     = fs.statSync(filePath);
    const result   = writeService.saveFile(filePath, 'const d = 4;\n', stat.mtimeMs);
    assert.equal(result.ok, true, 'should accept write when mtime matches');
  });

  it('creates parent directories when they do not exist', async () => {
    const { writeService } = await import('../services/write/index.ts');
    const filePath = path.join(sandboxDir, 'deep', 'nested', 'dir', 'file.ts');
    const result   = writeService.saveFile(filePath, 'export default {};');
    assert.equal(result.ok, true);
    assert.ok(fs.existsSync(filePath));
  });

  it('rejects path traversal attempts', async () => {
    const { writeService } = await import('../services/write/index.ts');
    const result = writeService.saveFile('../../tmp/evil.ts', 'evil');
    assert.equal(result.ok, false);
    assert.ok(result.error, 'should include an error message');
  });
});
