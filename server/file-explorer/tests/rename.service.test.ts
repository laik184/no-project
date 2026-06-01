/**
 * server/file-explorer/tests/rename.service.test.ts
 * Unit tests for RenameService.
 * Run: node --import tsx/esm --test server/file-explorer/tests/rename.service.test.ts
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs   from 'node:fs';
import path from 'node:path';
import os   from 'node:os';

// ── Test sandbox setup ────────────────────────────────────────────────────────

let sandboxDir: string;

before(() => {
  sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-rename-test-'));
  process.env['AGENT_PROJECT_ROOT'] = sandboxDir;
});

beforeEach(() => {
  // Reset sandbox to a known state before each test
  fs.readdirSync(sandboxDir).forEach(f =>
    fs.rmSync(path.join(sandboxDir, f), { recursive: true, force: true })
  );
  fs.writeFileSync(path.join(sandboxDir, 'original.ts'), 'const x = 1;\n');
  fs.mkdirSync(path.join(sandboxDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(sandboxDir, 'src', 'index.ts'), 'export {};');
});

after(() => {
  fs.rmSync(sandboxDir, { recursive: true, force: true });
  delete process.env['AGENT_PROJECT_ROOT'];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RenameService', () => {
  it('renames a file to a new name within the same directory', async () => {
    const { renameService } = await import('../services/rename/index.ts');
    const oldPath = path.join(sandboxDir, 'original.ts');
    const newPath = path.join(sandboxDir, 'renamed.ts');
    const result  = renameService.rename(oldPath, newPath);
    assert.equal(result.ok, true);
    assert.ok(!fs.existsSync(oldPath), 'old path should no longer exist');
    assert.ok(fs.existsSync(newPath), 'new path should exist');
    assert.equal(fs.readFileSync(newPath, 'utf-8'), 'const x = 1;\n');
  });

  it('renames a directory', async () => {
    const { renameService } = await import('../services/rename/index.ts');
    const oldPath = path.join(sandboxDir, 'src');
    const newPath = path.join(sandboxDir, 'lib');
    const result  = renameService.rename(oldPath, newPath);
    assert.equal(result.ok, true);
    assert.ok(!fs.existsSync(oldPath), 'src/ should be gone');
    assert.ok(fs.existsSync(path.join(newPath, 'index.ts')), 'lib/index.ts should exist');
  });

  it('returns ok:false when source does not exist', async () => {
    const { renameService } = await import('../services/rename/index.ts');
    const result = renameService.rename(
      path.join(sandboxDir, '__no_such_file__.ts'),
      path.join(sandboxDir, 'dest.ts'),
    );
    assert.equal(result.ok, false);
    assert.ok(result.error, 'should include an error message');
  });

  it('returns ok:false when destination already exists', async () => {
    const { renameService } = await import('../services/rename/index.ts');
    fs.writeFileSync(path.join(sandboxDir, 'existing-dest.ts'), 'const y = 2;\n');
    const result = renameService.rename(
      path.join(sandboxDir, 'original.ts'),
      path.join(sandboxDir, 'existing-dest.ts'),
    );
    assert.equal(result.ok, false);
    assert.ok(result.error, 'should include an error message');
  });

  it('moves a file to a different directory', async () => {
    const { renameService } = await import('../services/rename/index.ts');
    const oldPath = path.join(sandboxDir, 'original.ts');
    const newPath = path.join(sandboxDir, 'src', 'original.ts');
    const result  = renameService.rename(oldPath, newPath);
    assert.equal(result.ok, true);
    assert.ok(!fs.existsSync(oldPath));
    assert.ok(fs.existsSync(newPath));
  });

  it('rejects path traversal in oldPath', async () => {
    const { renameService } = await import('../services/rename/index.ts');
    const result = renameService.rename('../../etc/passwd', path.join(sandboxDir, 'safe.ts'));
    assert.equal(result.ok, false);
    assert.ok(result.error, 'should include an error message');
  });

  it('rejects path traversal in newPath', async () => {
    const { renameService } = await import('../services/rename/index.ts');
    const result = renameService.rename(
      path.join(sandboxDir, 'original.ts'),
      '../../tmp/evil.ts',
    );
    assert.equal(result.ok, false);
    assert.ok(result.error, 'should include an error message');
  });
});
