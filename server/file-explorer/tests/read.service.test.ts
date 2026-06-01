/**
 * server/file-explorer/tests/read.service.test.ts
 * Unit tests for ReadService.
 * Run: node --import tsx/esm --test server/file-explorer/tests/read.service.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs   from 'node:fs';
import path from 'node:path';
import os   from 'node:os';

// ── Test sandbox setup ────────────────────────────────────────────────────────

let sandboxDir: string;

before(() => {
  sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-read-test-'));
  fs.writeFileSync(path.join(sandboxDir, 'hello.ts'), 'const x = 42;\n');
  // Write a "binary" file with a null byte
  const binaryBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]);
  fs.writeFileSync(path.join(sandboxDir, 'image.png'), binaryBuf);
  process.env['AGENT_PROJECT_ROOT'] = sandboxDir;
});

after(() => {
  fs.rmSync(sandboxDir, { recursive: true, force: true });
  delete process.env['AGENT_PROJECT_ROOT'];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReadService', () => {
  it('reads a valid UTF-8 text file and returns content', async () => {
    const { readService } = await import('../services/read/index.ts');
    const result = readService.readFile(path.join(sandboxDir, 'hello.ts'));
    assert.equal(result.ok, true);
    assert.ok(result.content?.includes('const x = 42'));
    assert.ok(typeof result.serverMtime === 'number');
    assert.ok(result.modifiedAt?.includes('T'), 'modifiedAt should be ISO string');
    assert.equal(result.encoding, 'utf-8');
  });

  it('returns ok:false for a file that does not exist', async () => {
    const { readService } = await import('../services/read/index.ts');
    const result = readService.readFile(path.join(sandboxDir, '__nonexistent__.ts'));
    assert.equal(result.ok, false);
    assert.ok(result.error, 'should include an error message');
  });

  it('returns ok:false for binary files', async () => {
    const { readService } = await import('../services/read/index.ts');
    const result = readService.readFile(path.join(sandboxDir, 'image.png'));
    assert.equal(result.ok, false);
    assert.ok(result.error?.toLowerCase().includes('binary'), 'should mention binary');
  });

  it('returns ok:false when trying to read a directory', async () => {
    const { readService } = await import('../services/read/index.ts');
    const result = readService.readFile(sandboxDir);
    assert.equal(result.ok, false);
    assert.ok(result.error, 'should include an error message');
  });

  it('rejects path traversal attempts', async () => {
    const { readService } = await import('../services/read/index.ts');
    const result = readService.readFile('../../etc/passwd');
    assert.equal(result.ok, false);
    assert.ok(result.error?.toLowerCase().includes('traversal') || result.error, 'should reject traversal');
  });
});
