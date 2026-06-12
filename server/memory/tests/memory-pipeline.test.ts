import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('memory pipeline chunks, filters before vector search, and builds injectable context', async () => {
  const sandboxRoot = await mkdtemp(join(tmpdir(), 'nurax-memory-test-'));
  process.env.AGENT_PROJECT_ROOT = sandboxRoot;

  const { memoryRepository, buildMemoryContext, vectorStore } = await import('../index.ts');

  vectorStore.clear();

  const markdown = 'Architecture decision: retrieved memory must be injected into agent context. '.repeat(80);
  await memoryRepository.save({
    category: 'architecture',
    content: markdown,
    tags: ['reality-test'],
    meta: { contentType: 'markdown', filePath: 'docs/memory.md' },
  });

  await memoryRepository.save({
    category: 'bug',
    content: 'Unrelated terminal failure noise '.repeat(80),
    tags: ['noise'],
    meta: { contentType: 'text' },
  });

  const architectureContext = await buildMemoryContext(
    'agent context injection architecture decision',
    { categories: ['architecture'], limit: 5, minScore: 0.05 },
  );

  assert.ok(vectorStore.size() > 1, 'large markdown memory should be split into multiple vector records');
  assert.ok(architectureContext.totalFound > 0, 'architecture memory should be retrievable');
  assert.ok(
    architectureContext.entries.every((entry) => entry.category === 'architecture'),
    'category filtering must happen inside vector retrieval before top-K truncation',
  );
  assert.match(architectureContext.injection, /Retrieved long-term memory/);
  assert.match(architectureContext.injection, /agent context/);

  vectorStore.clear();
  await rm(sandboxRoot, { recursive: true, force: true });
});
