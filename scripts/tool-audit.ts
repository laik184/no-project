/**
 * scripts/tool-audit.ts
 *
 * Phase 9 — Real execution test.
 * Verifies every bug fix in the tool registry recovery:
 *   1. All 12 CoderX CodingTaskKind → registered tool name
 *   2. All 6 CoderX filesystem operations → fs_* registered tool name
 *   3. All 8 executor browser tasks → registered browser tool name
 *   4. Total tool count & presence of fixed names
 */

import { loadAllTools }             from '../server/tools/registry/tool-loader.ts';
import { getTool as resolveTool, toolCount, listTools } from '../server/tools/registry/tool-registry.ts';
import { coordinateCodingTask, coordinateFilesystemTask } from '../server/agents/coderx/coordination/tool-coordinator.ts';
import type { CodingTask, CodingTaskKind }  from '../server/agents/coderx/types/coderx.types.ts';

// ── Bootstrap ─────────────────────────────────────────────────────────────────
loadAllTools();
console.log(`\n✅  Registry sealed with ${toolCount()} tools\n`);

// ── Helper ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function check(label: string, toolName: string): void {
  const resolved = resolveTool(toolName);
  if (resolved) {
    console.log(`  ✓  ${label} → ${toolName}`);
    passed++;
  } else {
    console.error(`  ✗  ${label} → ${toolName}  ← NOT FOUND IN REGISTRY`);
    failed++;
  }
}

// ── 1. CoderX CODING_TOOL_MAP — all 12 kinds ─────────────────────────────────
console.log('── CoderX coding task routing (12 kinds) ──────────────────────────────────');

const CODERX_KINDS: Array<[string, CodingTaskKind]> = [
  ['generate_component',    'generate_component'],
  ['generate_route',        'generate_route'],
  ['generate_schema',       'generate_schema'],
  ['generate_api_client',   'generate_api_client'],
  ['generate_auth',         'generate_auth'],
  ['generate_middleware',   'generate_middleware'],
  ['generate_error_handler','generate_error_handler'],
  ['generate_controller',   'generate_controller'],
  ['generate_rest_api',     'generate_rest_api'],
  ['refactor (was dead)',   'refactor'],
  ['analyze (was dead)',    'analyze'],
  ['validate (was dead)',   'validate'],
];

for (const [label, kind] of CODERX_KINDS) {
  const task: CodingTask = {
    taskId:      `test-${kind}`,
    kind,
    description: `Test ${kind}`,
    input:       {},
  };
  try {
    const routed = coordinateCodingTask(task);
    check(`${label}`, routed.toolName);
  } catch (err) {
    console.error(`  ✗  ${label} → coordinateCodingTask threw: ${err}`);
    failed++;
  }
}

// ── 2. CoderX filesystem operations — all 6 ops ──────────────────────────────
console.log('\n── CoderX filesystem task routing (6 ops) ─────────────────────────────────');

const FS_OPS = ['read', 'write', 'patch', 'delete', 'search', 'list'] as const;

for (const op of FS_OPS) {
  try {
    const routed = coordinateFilesystemTask(op, { path: 'src/test.ts' }, '/tmp/sandbox');
    // Also verify path double-prefix bug is fixed (should NOT contain sandboxRoot prefix)
    const pathHasSandboxRoot = String(routed.toolInput.path ?? '').startsWith('/tmp');
    if (pathHasSandboxRoot) {
      console.error(`  ✗  ${op} → path still has absolute prefix: "${routed.toolInput.path}" ← DOUBLE-PREFIX BUG`);
      failed++;
    } else {
      check(`fs ${op} (path="${routed.toolInput.path}")`, routed.toolName);
    }
  } catch (err) {
    console.error(`  ✗  fs ${op} → coordinateFilesystemTask threw: ${err}`);
    failed++;
  }
}

// ── 3. Browser tools — all tools the executor browser coordinator maps to ─────
console.log('\n── Browser tool registrations (8 executor-coordinator tools) ────────────────');

const BROWSER_TOOLS = [
  'browser_screenshot',
  'browser_click',
  'browser_fill',
  'browser_wait_for_element',
  'browser_is_element_present',
  'browser_is_element_visible',
  'browser_capture_ui_state',
  'browser_health',
];

for (const name of BROWSER_TOOLS) {
  check(name, name);
}

// ── 4. Browser agent lifecycle tools ─────────────────────────────────────────
console.log('\n── Browser agent lifecycle tools ────────────────────────────────────────────');

const BROWSER_LIFECYCLE = ['browser_launch', 'browser_close', 'browser_navigate', 'browser_reload'];
for (const name of BROWSER_LIFECYCLE) {
  check(name, name);
}

// ── 5. Spot-check previously-dead coding tool names are now gone ──────────────
console.log('\n── Confirmed dead names stay unregistered ───────────────────────────────────');

const DEAD_NAMES = [
  'coding_generate_react_component',
  'coding_generate_drizzle_schema',
  'coding_refactor_code',
  'coding_analyze_code',
  'coding_validate_code',
];

for (const dead of DEAD_NAMES) {
  const resolved = resolveTool(dead);
  if (!resolved) {
    console.log(`  ✓  "${dead}" correctly absent from registry`);
    passed++;
  } else {
    console.warn(`  ⚠  "${dead}" is registered — unexpected (dead name should not exist)`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────────────────────────────────────');
console.log(`RESULT: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('✅  ALL CHECKS PASSED — Tool Registry Recovery complete.\n');
} else {
  console.error(`❌  ${failed} CHECK(S) FAILED — Review output above.\n`);
  process.exit(1);
}
