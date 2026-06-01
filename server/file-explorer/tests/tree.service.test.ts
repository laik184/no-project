/**
 * server/file-explorer/tests/tree.service.test.ts
 * Unit tests for TreeService.
 * Run: node --import tsx/esm --test server/file-explorer/tests/tree.service.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs   from 'node:fs';
import path from 'node:path';
import os   from 'node:os';

// ── Test sandbox setup ────────────────────────────────────────────────────────

let sandboxDir: string;

before(() => {
  sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-tree-test-'));
  // Create structure: src/index.ts, src/utils/helpers.ts, README.md
  fs.mkdirSync(path.join(sandboxDir, 'src', 'utils'), { recursive: true });
  fs.writeFileSync(path.join(sandboxDir, 'src', 'index.ts'), 'export {};');
  fs.writeFileSync(path.join(sandboxDir, 'src', 'utils', 'helpers.ts'), 'export const add = (a: number, b: number) => a + b;');
  fs.writeFileSync(path.join(sandboxDir, 'README.md'), '# Test Project');
  // Hidden file — should be excluded by default
  fs.writeFileSync(path.join(sandboxDir, '.env'), 'SECRET=1');
  // node_modules — should be excluded
  fs.mkdirSync(path.join(sandboxDir, 'node_modules', 'some-pkg'), { recursive: true });
  fs.writeFileSync(path.join(sandboxDir, 'node_modules', 'some-pkg', 'index.js'), '');
  process.env['AGENT_PROJECT_ROOT'] = sandboxDir;
});

after(() => {
  fs.rmSync(sandboxDir, { recursive: true, force: true });
  delete process.env['AGENT_PROJECT_ROOT'];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TreeService', () => {
  it('returns ok:true with a non-empty tree for a valid sandbox', async () => {
    const { treeService } = await import('../services/tree/index.ts');
    const result = treeService.getTree(sandboxDir);
    assert.equal(result.ok, true);
    assert.ok(Array.isArray(result.tree));
    assert.ok(result.tree.length > 0, 'tree should have entries');
  });

  it('tree nodes have name and type fields matching RawTreeNode contract', async () => {
    const { treeService } = await import('../services/tree/index.ts');
    const result = treeService.getTree(sandboxDir);
    assert.equal(result.ok, true);
    const readme = result.tree.find(n => n.name === 'README.md');
    assert.ok(readme, 'README.md should be in the tree');
    assert.equal(readme?.type, 'file');
    const src = result.tree.find(n => n.name === 'src');
    assert.ok(src, 'src/ folder should be in the tree');
    assert.equal(src?.type, 'folder');
    assert.ok(Array.isArray(src?.children), 'folder should have children array');
  });

  it('excludes node_modules from the tree', async () => {
    const { treeService } = await import('../services/tree/index.ts');
    const result = treeService.getTree(sandboxDir);
    assert.equal(result.ok, true);
    const nodeModules = result.tree.find(n => n.name === 'node_modules');
    assert.equal(nodeModules, undefined, 'node_modules should be excluded');
  });

  it('excludes hidden files (dot-prefixed) from the tree', async () => {
    const { treeService } = await import('../services/tree/index.ts');
    const result = treeService.getTree(sandboxDir);
    assert.equal(result.ok, true);
    const hidden = result.tree.find(n => n.name.startsWith('.'));
    assert.equal(hidden, undefined, 'hidden files should not appear in tree');
  });

  it('returns ok:false for a non-existent path without throwing', async () => {
    const { treeService } = await import('../services/tree/index.ts');
    const result = treeService.getTree('/tmp/__this_path_does_not_exist_ever__');
    assert.equal(result.ok, false, 'should return ok:false for invalid path');
  });

  it('getStats returns correct file and folder counts', async () => {
    const { treeService } = await import('../services/tree/index.ts');
    const stats = treeService.getStats(sandboxDir);
    assert.equal(stats.ok, true);
    assert.ok(stats.files >= 3, 'should count at least 3 files (index.ts, helpers.ts, README.md)');
    assert.ok(stats.folders >= 2, 'should count at least 2 folders (src, utils)');
  });
});
