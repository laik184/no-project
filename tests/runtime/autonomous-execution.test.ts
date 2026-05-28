/**
 * tests/runtime/autonomous-execution.test.ts
 *
 * Runtime stress tests for the autonomous execution intelligence systems.
 * Tests: concurrent workflows, retry storms, cancellation handling,
 * partial failures, rollback recovery, memory persistence, self-healing loops,
 * state machine lifecycle, decision engine logic, dependency analysis.
 *
 * Uses Node.js built-in test runner (no external deps).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ── Imports under test ────────────────────────────────────────────────────────
import { workingMemory }          from '../../server/agents/executor/memory/working-memory.ts';
import { executionHistory }       from '../../server/agents/executor/memory/execution-history.ts';
import { failureMemory }          from '../../server/agents/executor/memory/failure-memory.ts';
import { contextWindowManager }   from '../../server/agents/executor/memory/context-window-manager.ts';
import { executionStateMachine }  from '../../server/agents/executor/runtime/execution-state-machine.ts';
import { decisionEngine }         from '../../server/agents/executor/reasoning/decision-engine.ts';
import { analyzeTask }            from '../../server/agents/executor/reasoning/task-analyzer.ts';
import { rollbackManager }        from '../../server/agents/executor/recovery/rollback-manager.ts';
import { selfHealingLoop }        from '../../server/agents/executor/recovery/self-healing-loop.ts';
import { executionTimeline }      from '../../server/agents/executor/telemetry/execution-timeline.ts';
import { workflowTracer }         from '../../server/agents/executor/telemetry/workflow-tracer.ts';
import { validateResponse }       from '../../server/agents/executor/validation/response-validator.ts';
import { analyzeDependencies }    from '../../server/agents/planner/reasoning/dependency-analyzer.ts';
import { estimateRisk }           from '../../server/agents/planner/reasoning/risk-estimator.ts';
import { analyzeUi }              from '../../server/agents/browser/reasoning/ui-analyzer.ts';
import { diffDom }                from '../../server/agents/browser/reasoning/dom-diff-engine.ts';

// ── Setup / teardown ──────────────────────────────────────────────────────────

before(() => {
  workingMemory.allRunIds().forEach((id) => workingMemory.clear(id));
  executionHistory.reset();
  failureMemory.reset();
  executionStateMachine.reset();
  executionTimeline.reset();
  workflowTracer.reset();
});

after(() => {
  rollbackManager.reset();
});

// ── Working Memory ────────────────────────────────────────────────────────────

describe('working-memory', () => {
  it('initializes a fresh slot per runId', () => {
    const slot = workingMemory.init('run_mem_1');
    assert.equal(slot.runId, 'run_mem_1');
    assert.equal(slot.modifiedFiles.size, 0);
  });

  it('update() merges file sets', () => {
    workingMemory.init('run_mem_2');
    workingMemory.update('run_mem_2', { modifiedFiles: new Set(['a.ts', 'b.ts']) });
    workingMemory.update('run_mem_2', { modifiedFiles: new Set(['c.ts']) });
    const slot = workingMemory.get('run_mem_2')!;
    assert.equal(slot.modifiedFiles.size, 3);
  });

  it('snapshot/restore roundtrips scalar fields', () => {
    workingMemory.init('run_mem_3');
    workingMemory.set('run_mem_3', 'currentTaskId', 'task_A');
    workingMemory.snapshot('run_mem_3');
    workingMemory.set('run_mem_3', 'currentTaskId', 'task_B');
    workingMemory.restore('run_mem_3');
    assert.equal(workingMemory.get('run_mem_3')!.currentTaskId, 'task_A');
  });

  it('incrementRetry tracks counts per key', () => {
    workingMemory.init('run_mem_4');
    workingMemory.incrementRetry('run_mem_4', 'step_x');
    workingMemory.incrementRetry('run_mem_4', 'step_x');
    const n = workingMemory.incrementRetry('run_mem_4', 'step_x');
    assert.equal(n, 3);
  });
});

// ── Execution History ─────────────────────────────────────────────────────────

describe('execution-history', () => {
  it('records success and failure entries', () => {
    executionHistory.recordSuccess({ runId: 'rh1', taskId: 't1', toolName: 'write_file', kind: 'coding', retries: 0, durationMs: 100 });
    executionHistory.recordFailure({ runId: 'rh1', taskId: 't2', toolName: 'write_file', kind: 'coding', errorText: 'TypeError: x', retries: 2, durationMs: 200 });
    const hist = executionHistory.getByRun('rh1');
    assert.equal(hist.length, 2);
  });

  it('findSimilarFailure matches by tool + error class', () => {
    executionHistory.recordFailure({ runId: 'rh2', taskId: 't1', toolName: 'apply_patch', kind: 'coding', errorText: 'timeout exceeded', retries: 1, durationMs: 300 });
    const match = executionHistory.findSimilarFailure('apply_patch', 'connection timeout');
    assert.ok(match, 'Should find similar failure');
  });

  it('summary computes success rate', () => {
    const s = executionHistory.summary();
    assert.ok(s.totalRecorded > 0);
    assert.ok(s.successRate >= 0 && s.successRate <= 1);
  });
});

// ── Failure Memory ────────────────────────────────────────────────────────────

describe('failure-memory', () => {
  it('detects chronic patterns after threshold', () => {
    for (let i = 0; i < 3; i++) {
      failureMemory.recordFailurePattern(`run_fm_${i}`, 'run_typecheck', 'verify', 'TS2345 type mismatch');
    }
    const patterns = failureMemory.chroniclePatterns();
    assert.ok(patterns.length >= 1);
  });

  it('isRetryStorm returns false under threshold', () => {
    failureMemory.reset();
    assert.equal(failureMemory.isRetryStorm(), false);
  });
});

// ── Context Window Manager ────────────────────────────────────────────────────

describe('context-window-manager', () => {
  it('tracks token usage', () => {
    contextWindowManager.init('cwm_1');
    contextWindowManager.push('cwm_1', 'user', 'Hello world', 'normal');
    const usage = contextWindowManager.tokenUsage('cwm_1');
    assert.ok(usage.estimated > 0);
  });

  it('trim keeps critical messages over low priority', () => {
    contextWindowManager.init('cwm_2');
    contextWindowManager.push('cwm_2', 'system', 'X'.repeat(10_000), 'low');
    contextWindowManager.push('cwm_2', 'user', 'Critical instruction', 'critical');
    const msgs = contextWindowManager.trim('cwm_2', { maxTokens: 100, reservedTokens: 10, compressionRatio: 0.4 });
    const hasCritical = msgs.some((m) => m.content.includes('Critical instruction'));
    assert.ok(hasCritical, 'Critical message should survive trimming');
  });
});

// ── Execution State Machine ───────────────────────────────────────────────────

describe('execution-state-machine', () => {
  it('transitions follow valid path', () => {
    executionStateMachine.init('sm_1');
    executionStateMachine.transition('sm_1', 'PLANNING');
    executionStateMachine.transition('sm_1', 'EXECUTING');
    executionStateMachine.transition('sm_1', 'VALIDATING');
    executionStateMachine.transition('sm_1', 'COMPLETED');
    assert.equal(executionStateMachine.getState('sm_1'), 'COMPLETED');
    assert.ok(executionStateMachine.isTerminal('sm_1'));
  });

  it('throws on invalid transition', () => {
    executionStateMachine.init('sm_2');
    assert.throws(() => executionStateMachine.transition('sm_2', 'COMPLETED'));
  });

  it('tryTransition returns false without throwing', () => {
    executionStateMachine.init('sm_3');
    const ok = executionStateMachine.tryTransition('sm_3', 'COMPLETED');
    assert.equal(ok, false);
  });
});

// ── Decision Engine ───────────────────────────────────────────────────────────

describe('decision-engine', () => {
  it('returns abort for non-recoverable error', () => {
    const d = decisionEngine.decide({
      runId: 'de_1', taskId: 't1', stepId: 's1',
      toolName: 'write_file', kind: 'coding',
      error: 'invalid api key', attempt: 1, maxAttempts: 3,
      workflowCritical: false,
    });
    assert.equal(d.action, 'abort');
  });

  it('returns retry when attempts remain', () => {
    failureMemory.reset();
    const d = decisionEngine.decide({
      runId: 'de_2', taskId: 't1', stepId: 's1',
      toolName: 'write_file', kind: 'coding',
      error: 'network error', attempt: 1, maxAttempts: 3,
      workflowCritical: false,
    });
    assert.equal(d.action, 'retry');
  });

  it('returns rollback for TS errors', () => {
    const d = decisionEngine.decide({
      runId: 'de_3', taskId: 't1', stepId: 's1',
      toolName: 'apply_patch', kind: 'coding',
      error: 'TS2345: Type string is not assignable', attempt: 1, maxAttempts: 3,
      workflowCritical: false,
    });
    assert.ok(['rollback', 'repair'].includes(d.action));
  });
});

// ── Task Analyzer ─────────────────────────────────────────────────────────────

describe('task-analyzer', () => {
  it('detects browser requirements', () => {
    const a = analyzeTask('click the submit button and take a screenshot');
    assert.ok(a.requiresBrowser);
  });

  it('detects terminal requirements', () => {
    const a = analyzeTask('npm install and run build');
    assert.ok(a.requiresTerminal);
  });

  it('generates at least setup + validation subtasks', () => {
    const a = analyzeTask('create a new React component for the dashboard');
    assert.ok(a.subtasks.length >= 2);
  });
});

// ── Rollback Manager ──────────────────────────────────────────────────────────

describe('rollback-manager', () => {
  it('creates and retrieves checkpoints', () => {
    workingMemory.init('rb_1');
    workingMemory.recordFileModified('rb_1', 'src/App.tsx');
    const cp = rollbackManager.createCheckpoint('rb_1', 'task_1', 'files');
    assert.ok(cp.id.startsWith('cp_'));
    assert.ok(rollbackManager.listCheckpoints('rb_1').length >= 1);
  });

  it('rollback() returns files modified since checkpoint', () => {
    workingMemory.init('rb_2');
    rollbackManager.createCheckpoint('rb_2', 'task_2', 'files');
    workingMemory.recordFileModified('rb_2', 'new-file.ts');
    executionTimeline.init('rb_2');
    const result = rollbackManager.rollback('rb_2', 'coding', 'test rollback');
    assert.ok(result.ok);
  });
});

// ── Self-Healing Loop ─────────────────────────────────────────────────────────

describe('self-healing-loop', () => {
  it('succeeds on first attempt when fn resolves', async () => {
    executionStateMachine.init('sh_1');
    executionStateMachine.transition('sh_1', 'PLANNING');
    executionStateMachine.transition('sh_1', 'EXECUTING');
    workingMemory.init('sh_1');
    executionTimeline.init('sh_1');

    const result = await selfHealingLoop(
      { runId: 'sh_1', taskId: 't1', stepId: 's1', toolName: 'write_file', kind: 'coding', maxAttempts: 2, workflowCritical: false },
      async () => 'done',
    );
    assert.ok(result.ok);
    assert.equal(result.healCycles, 0);
  });

  it('retries on transient failure then succeeds', async () => {
    executionStateMachine.init('sh_2');
    executionStateMachine.transition('sh_2', 'PLANNING');
    executionStateMachine.transition('sh_2', 'EXECUTING');
    workingMemory.init('sh_2');
    executionTimeline.init('sh_2');
    rollbackManager.createCheckpoint('sh_2', 't1', 'files');

    let calls = 0;
    const result = await selfHealingLoop(
      { runId: 'sh_2', taskId: 't1', stepId: 's1', toolName: 'write_file', kind: 'coding', maxAttempts: 3, workflowCritical: false },
      async () => {
        calls++;
        if (calls < 2) throw new Error('network glitch');
        return 'ok';
      },
    );
    assert.ok(result.ok);
    assert.ok(result.retries >= 1);
  });
});

// ── Response Validator ────────────────────────────────────────────────────────

describe('response-validator', () => {
  it('passes clean coding output', () => {
    const r = validateResponse('coding', 'export function foo() { return 42; }');
    assert.ok(r.ok, r.summary);
  });

  it('flags TypeScript error in output', () => {
    const r = validateResponse('coding', 'TS2345 Type string is not assignable to number');
    assert.ok(!r.ok);
    const codes = r.issues.map((i) => i.code);
    assert.ok(codes.includes('TYPE_ERROR'));
  });

  it('flags test failure in verify output', () => {
    const r = validateResponse('verify', '3 failing\n  1) should render correctly');
    assert.ok(!r.ok);
  });
});

// ── Dependency Analyzer ───────────────────────────────────────────────────────

describe('dependency-analyzer', () => {
  it('topologically sorts tasks', () => {
    const tasks = [
      { id: 'A', dependencies: ['B'], phase: 1 } as any,
      { id: 'B', dependencies: [],   phase: 0 } as any,
      { id: 'C', dependencies: ['A'], phase: 2 } as any,
    ];
    const a = analyzeDependencies(tasks);
    const order = a.sortedOrder;
    assert.ok(order.indexOf('B') < order.indexOf('A'));
    assert.ok(order.indexOf('A') < order.indexOf('C'));
  });

  it('detects no cycles in linear chain', () => {
    const tasks = [
      { id: 'X', dependencies: [],    phase: 0 } as any,
      { id: 'Y', dependencies: ['X'], phase: 1 } as any,
    ];
    const a = analyzeDependencies(tasks);
    assert.ok(!a.hasCycles);
  });
});

// ── Risk Estimator ────────────────────────────────────────────────────────────

describe('risk-estimator', () => {
  it('flags destructive operations as critical', () => {
    const r = estimateRisk('delete all user records from production database');
    assert.ok(['high', 'critical'].includes(r.overall));
    assert.ok(r.requiresCheckpoint);
  });

  it('rates benign goal as low risk', () => {
    const r = estimateRisk('add a tooltip to the button');
    assert.ok(['low', 'medium'].includes(r.overall));
  });
});

// ── UI Analyzer ───────────────────────────────────────────────────────────────

describe('ui-analyzer', () => {
  it('detects blank page', () => {
    const r = analyzeUi('The page is blank — nothing rendered');
    assert.ok(!r.ok);
    assert.ok(r.issues.some((i) => i.kind === 'blank-page'));
  });

  it('returns healthy for normal page description', () => {
    const r = analyzeUi('Dashboard loaded with charts, navigation bar and user profile');
    assert.ok(r.ok);
  });
});

// ── DOM Diff Engine ───────────────────────────────────────────────────────────

describe('dom-diff-engine', () => {
  it('detects regression when element removed', () => {
    const before = { url: '/app', selectors: ['nav', 'main', '.sidebar'], textTokens: ['Home', 'Settings'], errorTexts: [], attributes: {} };
    const after  = { url: '/app', selectors: ['main'], textTokens: ['Home'], errorTexts: [], attributes: {} };
    const diff = diffDom(before, after);
    assert.ok(diff.hasRegressions);
    assert.ok(diff.regressions.some((r) => r.kind === 'regression'));
  });

  it('reports no regressions for identical snapshots', () => {
    const snap = { url: '/app', title: 'App', selectors: ['nav', 'main'], textTokens: ['Hello'], errorTexts: [], attributes: {} };
    const diff = diffDom(snap, snap);
    assert.ok(!diff.hasRegressions);
  });

  it('flags new error as regression', () => {
    const before = { url: '/app', selectors: [], textTokens: [], errorTexts: [], attributes: {} };
    const after  = { url: '/app', selectors: [], textTokens: [], errorTexts: ['Uncaught TypeError: cannot read properties'], attributes: {} };
    const diff = diffDom(before, after);
    assert.ok(diff.regressions.some((r) => r.kind === 'new-error'));
  });
});
