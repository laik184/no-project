/**
 * tests/runtime/learning-system.test.ts
 *
 * Adaptive Learning Intelligence System — stress test suite.
 * Tests: learning convergence, retry adaptation, tool adaptation, failure prediction,
 * strategy optimization, rollback prediction, browser learning, loop prevention, governance.
 *
 * Uses Node.js built-in test runner via tsx — no external dependencies.
 */

import { test } from 'node:test';
import assert   from 'node:assert/strict';

// ── Imports ───────────────────────────────────────────────────────────────────

import { learningStore }               from '../../server/agents/executor/learning/learning-store.ts';
import { learningGovernor }            from '../../server/agents/executor/learning/learning-governor.ts';
import { patternLearner }              from '../../server/agents/executor/learning/pattern-learner.ts';
import { failurePredictor }            from '../../server/agents/executor/learning/failure-predictor.ts';
import { toolSelectionEngine }         from '../../server/agents/executor/learning/tool-selection-engine.ts';
import { strategyOptimizer }           from '../../server/agents/executor/learning/strategy-optimizer.ts';
import { scoreExecution, summariseScore } from '../../server/agents/executor/learning/execution-scorer.ts';
import { feedbackLoop }                from '../../server/agents/executor/learning/feedback-loop.ts';
import { workflowLearningEngine }      from '../../server/agents/planner/learning/workflow-learning-engine.ts';
import { uiPatternLearner }            from '../../server/agents/browser/learning/ui-pattern-learner.ts';
import { browserReliabilityEngine }    from '../../server/agents/browser/learning/browser-reliability-engine.ts';
import { adaptationTracer }            from '../../server/agents/executor/telemetry/adaptation-tracer.ts';
import { learningInsights }            from '../../server/agents/executor/telemetry/learning-insights.ts';

// ── Helpers ───────────────────────────────────────────────────────────────────

function reset(): void {
  learningStore.reset();
  learningGovernor.reset();
  feedbackLoop.reset();
  adaptationTracer.reset();
  uiPatternLearner.reset();
  browserReliabilityEngine.reset();
}

// ── Test 1: Learning Store — bounded storage + versioning ─────────────────────

test('learning-store — bounded storage and versioning', () => {
  reset();

  const v0 = learningStore.version();
  learningStore.upsert('tool-reliability', 'npm_build', 0.05);
  learningStore.upsert('tool-reliability', 'npm_build', 0.05);

  const entry = learningStore.get('tool-reliability', 'npm_build');
  assert.ok(entry, 'entry should exist');
  assert.ok(entry.value >= 0.5, 'value should be ≥ 0.5 after positive deltas');
  assert.ok(entry.evidence >= 2, 'evidence should accumulate');
  assert.ok(learningStore.version() > v0, 'version should increment');

  // Bounds check
  for (let i = 0; i < 20; i++) learningStore.upsert('tool-reliability', 'npm_build', 0.5);
  const capped = learningStore.get('tool-reliability', 'npm_build');
  assert.ok(capped!.value <= 1.0, 'value must not exceed 1.0');

  for (let i = 0; i < 20; i++) learningStore.upsert('tool-reliability', 'npm_build', -0.5);
  const floored = learningStore.get('tool-reliability', 'npm_build');
  assert.ok(floored!.value >= 0.0, 'value must not go below 0.0');
});

// ── Test 2: Learning Governor — rate limits ───────────────────────────────────

test('learning-governor — rate limiting and boundary enforcement', () => {
  reset();

  // Should permit with sufficient evidence
  const v1 = learningGovernor.permitUpdate('key1', 0.5, 0.05, 5);
  assert.equal(v1.permitted, true, 'should permit with evidence ≥ 3');

  // Should block with zero evidence
  const v2 = learningGovernor.permitUpdate('key2', 0.5, 0.05, 0);
  assert.equal(v2.permitted, false, 'should block with zero evidence');

  // Delta should be clamped to MAX_CONFIDENCE_DELTA (0.10)
  const v3 = learningGovernor.permitUpdate('key3', 0.5, 0.99, 5);
  assert.ok(v3.permitted, 'should permit large delta');
  assert.ok(Math.abs(v3.actualDelta) <= 0.10, 'delta should be clamped to 0.10');

  // Should block at ceiling
  const v4 = learningGovernor.permitUpdate('key4', 0.95, 0.10, 5);
  assert.equal(v4.permitted, false, 'should block at ceiling 0.95');

  // assertBoundary should throw on forbidden targets
  assert.throws(
    () => learningGovernor.assertBoundary('test-module', 'orchestrator'),
    /HARD STOP/,
    'should throw on orchestrator mutation attempt',
  );

  const stats = learningGovernor.stats();
  assert.ok(stats.totalPermitted >= 2, 'should have permitted entries');
  assert.ok(stats.totalBlocked >= 2, 'should have blocked entries');
});

// ── Test 3: Execution Scorer — quality quantification ─────────────────────────

test('execution-scorer — quality scoring math', () => {
  reset();

  // Perfect run
  const perfect = scoreExecution({
    runId: 'run-perf', totalTasks: 10, successfulTasks: 10, failedTasks: 0,
    totalRetries: 0, recoveryUsed: false, rollbackCount: 0, escalated: false,
    validationsPassed: 5, validationsFailed: 0, parallelWaves: 3, sequentialSteps: 2,
    estimatedDurationMs: 10_000, actualDurationMs: 9_000, taskKinds: ['coding', 'verify'],
  });
  assert.equal(perfect.grade, 'A', 'perfect run should be grade A');
  assert.ok(perfect.executionScore >= 90, 'perfect score ≥ 90');
  assert.equal(perfect.reliabilityScore, 100, 'perfect reliability = 100');

  // Heavily retried run
  const heavy = scoreExecution({
    runId: 'run-heavy', totalTasks: 10, successfulTasks: 6, failedTasks: 4,
    totalRetries: 12, recoveryUsed: true, rollbackCount: 2, escalated: false,
    validationsPassed: 2, validationsFailed: 3, parallelWaves: 0, sequentialSteps: 10,
    estimatedDurationMs: 10_000, actualDurationMs: 40_000, taskKinds: ['terminal'],
  });
  assert.ok(heavy.executionScore < 60, 'heavily-retried run should score < 60');
  assert.ok(heavy.grade === 'D' || heavy.grade === 'F', 'should be D or F');

  // Escalated run
  const escalated = scoreExecution({
    runId: 'run-esc', totalTasks: 5, successfulTasks: 2, failedTasks: 3,
    totalRetries: 5, recoveryUsed: true, rollbackCount: 1, escalated: true,
    validationsPassed: 0, validationsFailed: 2, parallelWaves: 0, sequentialSteps: 5,
    estimatedDurationMs: 5_000, actualDurationMs: 5_000, taskKinds: ['browser'],
  });
  assert.ok(escalated.executionScore < 40, 'escalated run should score < 40');
  assert.ok(summariseScore(escalated).includes('Grade'), 'summarise should include grade');
});

// ── Test 4: Pattern Learner — convergence ─────────────────────────────────────

test('pattern-learner — learning convergence after repeated successes', () => {
  reset();

  const runId   = 'run-conv';
  const toolName = 'write_file';

  // Feed 6 successful outcomes — reliability should converge upward
  for (let i = 0; i < 6; i++) {
    patternLearner.recordOutcome({
      runId, taskId: `t${i}`, toolName, kind: 'filesystem',
      outcome: 'success', retries: 0, recoveryUsed: false, durationMs: 500,
    });
  }

  const reliability = patternLearner.getToolReliability(toolName);
  assert.ok(reliability > 0.55, `reliability should increase after successes, got ${reliability}`);

  // Now feed 4 failures — reliability should drop
  for (let i = 0; i < 4; i++) {
    patternLearner.recordOutcome({
      runId, taskId: `t_f${i}`, toolName, kind: 'filesystem',
      outcome: 'failure', retries: 3, recoveryUsed: true, durationMs: 3000,
    });
  }

  const afterFail = patternLearner.getToolReliability(toolName);
  assert.ok(afterFail < reliability, 'reliability should decrease after failures');

  // Recommendation should reflect low reliability
  const rec = patternLearner.getRecommendedStrategy('filesystem', toolName);
  assert.ok(rec.strategy, 'should produce a strategy');
  assert.ok(typeof rec.rationale === 'string', 'should include rationale');
  assert.ok(rec.riskMultiplier > 0, 'risk multiplier should be positive');
});

// ── Test 5: Failure Predictor — risk assessment ───────────────────────────────

test('failure-predictor — risk scoring and mitigation', () => {
  reset();

  // Seed low reliability for browser_screenshot
  for (let i = 0; i < 5; i++) {
    patternLearner.recordOutcome({
      runId: 'r1', taskId: `t${i}`, toolName: 'browser_screenshot', kind: 'browser',
      outcome: 'failure', retries: 3, recoveryUsed: true, durationMs: 8000,
    });
  }

  const prediction = failurePredictor.predict({
    toolName: 'browser_screenshot',
    kind:     'browser',
    hasDestructiveOps: false,
  });

  assert.ok(typeof prediction.riskScore === 'number', 'riskScore should be a number');
  assert.ok(prediction.riskScore >= 0 && prediction.riskScore <= 100, 'riskScore in [0,100]');
  assert.ok(Array.isArray(prediction.likelyFailures), 'likelyFailures should be array');
  assert.ok(Array.isArray(prediction.recommendedMitigations), 'mitigations should be array');
  assert.equal(typeof prediction.requiresCheckpoint, 'boolean', 'requiresCheckpoint is boolean');
  assert.equal(typeof prediction.requiresValidation, 'boolean', 'requiresValidation is boolean');

  // Destructive ops should require checkpoint
  const dangerous = failurePredictor.predict({
    toolName: 'delete_file', kind: 'filesystem', hasDestructiveOps: true,
  });
  assert.equal(dangerous.requiresCheckpoint, true, 'destructive ops must require checkpoint');

  // Package changes should require checkpoint
  const pkgChange = failurePredictor.predict({
    toolName: 'npm_install', kind: 'terminal', hasPackageChanges: true,
  });
  assert.equal(pkgChange.requiresCheckpoint, true, 'package changes must require checkpoint');
});

// ── Test 6: Tool Selection Engine — adaptive routing ──────────────────────────

test('tool-selection-engine — confidence tracking and adaptation', () => {
  reset();

  const toolName = 'npm_build';

  // Record multiple failed outcomes
  for (let i = 0; i < 5; i++) {
    toolSelectionEngine.recordToolOutcome({
      toolName, kind: 'terminal', subKind: 'build',
      success: false, retries: 3, durationMs: 15_000,
    });
  }

  const confidence = toolSelectionEngine.getToolConfidence(toolName);
  assert.ok(confidence < 0.5, `confidence should drop after failures, got ${confidence}`);

  // selectBestTool should still return a valid tool name (falls back to default)
  const result = toolSelectionEngine.selectBestTool('terminal', 'build', toolName);
  assert.ok(result.toolName, 'should always return a tool name');
  assert.ok(typeof result.confidence === 'number', 'confidence is a number');
  assert.ok(typeof result.wasAdapted === 'boolean', 'wasAdapted is boolean');

  // Unreliable tools list
  const unreliable = toolSelectionEngine.unreliableTools(0.6);
  assert.ok(Array.isArray(unreliable), 'unreliable should be array');
});

// ── Test 7: Strategy Optimizer — strategy learning ────────────────────────────

test('strategy-optimizer — learns and recommends strategies', () => {
  reset();

  // Feed rollback-first successes for terminal kind
  for (let i = 0; i < 5; i++) {
    strategyOptimizer.recordStrategyOutcome({
      strategy: 'rollback-first', kind: 'terminal',
      success: true, retries: 1, durationMs: 3000, rollbackUsed: true,
    });
  }
  // Feed standard failures for terminal
  for (let i = 0; i < 4; i++) {
    strategyOptimizer.recordStrategyOutcome({
      strategy: 'standard', kind: 'terminal',
      success: false, retries: 3, durationMs: 8000, rollbackUsed: false,
    });
  }

  const rec = strategyOptimizer.optimizeStrategy('terminal');
  assert.ok(rec.primary, 'should produce a primary strategy');
  assert.ok(rec.fallback, 'should produce a fallback strategy');
  assert.ok(rec.confidence >= 0 && rec.confidence <= 1, 'confidence in [0,1]');

  const scores = strategyOptimizer.allScoresForKind('terminal');
  assert.ok(scores.length > 0, 'should have scored strategies');

  // scoreStrategy returns a well-formed StrategyScore
  const sc = strategyOptimizer.scoreStrategy('rollback-first', 'terminal');
  assert.ok(sc.score >= 0 && sc.score <= 1, 'score in [0,1]');
  assert.ok(sc.evidence >= 5, 'evidence should be ≥ 5');
});

// ── Test 8: Workflow Learning Engine ─────────────────────────────────────────

test('workflow-learning-engine — workflow optimization hints', () => {
  reset();

  // Record successful parallel workflow
  workflowLearningEngine.recordWorkflowOutcome({
    planId: 'plan-1', taskCount: 12, parallelWaves: 4, totalPhases: 3,
    kinds: ['coding', 'filesystem', 'verify'], success: true,
    totalRetries: 1, durationMs: 20_000, checkpointsHit: 2, rollbacksUsed: 0,
  });

  // Record failed workflow with no parallelism
  workflowLearningEngine.recordWorkflowOutcome({
    planId: 'plan-2', taskCount: 8, parallelWaves: 0, totalPhases: 8,
    kinds: ['browser', 'terminal'], success: false,
    totalRetries: 5, durationMs: 60_000, checkpointsHit: 0, rollbacksUsed: 2,
  });

  const hints = workflowLearningEngine.getOptimizationHints(
    ['browser', 'terminal', 'verify'], 10, 2,
  );
  assert.equal(typeof hints.riskMultiplier, 'number', 'riskMultiplier is a number');
  assert.ok(hints.riskMultiplier >= 0, 'riskMultiplier ≥ 0');
  assert.ok(Array.isArray(hints.suggestCheckpoints), 'suggestCheckpoints is array');
  assert.ok(typeof hints.rationale === 'string', 'rationale is a string');
  assert.ok(hints.recommendedWaveSize >= 2, 'wave size ≥ 2');

  // Risk for kind mix
  const risk = workflowLearningEngine.getKindMixRisk(['browser', 'terminal']);
  assert.ok(risk >= 0 && risk <= 1, 'risk in [0,1]');
});

// ── Test 9: Browser / UI Pattern Learner ─────────────────────────────────────

test('ui-pattern-learner — browser instability learning', () => {
  reset();

  const route = '/dashboard/settings';

  // Record repeated failures on a route
  for (let i = 0; i < 4; i++) {
    uiPatternLearner.recordObservation({
      runId: `r${i}`, route, action: 'navigate',
      success: false, errorText: 'timeout waiting for element', durationMs: 12_000,
    });
  }

  const prediction = uiPatternLearner.predictBrowserFailure(route);
  assert.ok(prediction.probability > 0.5, `failure probability should be high, got ${prediction.probability}`);

  const pattern = uiPatternLearner.getPattern(route);
  assert.equal(pattern.route, route, 'pattern route should match');
  assert.ok(pattern.failureRate > 0.3, 'failureRate should be elevated');
  assert.ok(typeof pattern.recommendation === 'string', 'recommendation is a string');

  // Regression detection
  const report = uiPatternLearner.detectUiRegressionPattern();
  assert.equal(typeof report.regressionDetected, 'boolean', 'regressionDetected is boolean');
  assert.ok(Array.isArray(report.affectedRoutes), 'affectedRoutes is array');
  assert.ok(report.stabilityScore >= 0 && report.stabilityScore <= 100, 'stabilityScore in [0,100]');
});

// ── Test 10: Browser Reliability Engine ──────────────────────────────────────

test('browser-reliability-engine — crash prediction', () => {
  reset();

  // Record several crashes + navigation failures
  for (let i = 0; i < 5; i++) {
    browserReliabilityEngine.recordEvent({
      runId: `r${i}`, eventType: 'crash', durationMs: 0,
    });
  }
  for (let i = 0; i < 4; i++) {
    browserReliabilityEngine.recordEvent({
      runId: `r${i}`, eventType: 'navigation-failure', durationMs: 5000,
    });
  }

  const crash = browserReliabilityEngine.predictCrash('run-test');
  assert.equal(typeof crash.crashLikely, 'boolean', 'crashLikely is boolean');
  assert.ok(crash.probability >= 0 && crash.probability <= 1, 'probability in [0,1]');
  assert.ok(Array.isArray(crash.topReasons), 'topReasons is array');
  assert.ok(typeof crash.mitigation === 'string', 'mitigation is a string');

  const snapshot = browserReliabilityEngine.snapshot();
  assert.ok(snapshot.overallReliability >= 0 && snapshot.overallReliability <= 1, 'reliability in [0,1]');
  assert.ok(['healthy', 'degraded', 'critical'].includes(snapshot.sessionHealthGrade), 'valid grade');
  assert.ok(typeof snapshot.recommendation === 'string', 'recommendation is string');
});

// ── Test 11: Feedback Loop — infinite loop prevention ────────────────────────

test('feedback-loop — governance and cycle rate limiting', () => {
  reset();

  const baseInput = {
    runId: 'run-fb', totalTasks: 5, successfulTasks: 4, failedTasks: 1,
    totalRetries: 2, recoveryUsed: false, rollbackCount: 0, escalated: false,
    validationsPassed: 3, validationsFailed: 0, parallelWaves: 2, sequentialSteps: 3,
    estimatedDurationMs: 10_000, actualDurationMs: 12_000, taskKinds: ['coding', 'verify'],
  };

  const baseRecord = {
    runId:        'run-fb',
    strategy:     'standard' as const,
    taskOutcomes: [
      { runId: 'run-fb', taskId: 't1', toolName: 'write_file',    kind: 'filesystem' as const,
        outcome: 'success' as const, retries: 0, recoveryUsed: false, durationMs: 200 },
      { runId: 'run-fb', taskId: 't2', toolName: 'validate_runtime', kind: 'verify' as const,
        outcome: 'success' as const, retries: 1, recoveryUsed: false, durationMs: 1200 },
    ],
    scoringInput:  baseInput,
    activeKinds:   ['filesystem', 'verify'] as any,
  };

  // First cycle should succeed
  const result1 = feedbackLoop.process(baseRecord);
  assert.ok(result1.score.executionScore >= 0, 'score should exist');

  // Immediate second call should be rate-limited (< MIN_CYCLE_GAP)
  const result2 = feedbackLoop.process({ ...baseRecord, runId: 'run-fb-2' });
  assert.equal(result2.blocked, true, 'rapid second cycle should be blocked');

  const stats = feedbackLoop.stats();
  assert.ok(stats.cyclesThisHour >= 1, 'cycle count should increment');
  assert.ok(stats.maxCyclesHour > 0, 'max cycles should be set');
});

// ── Test 12: Adaptation Tracer — audit trail ──────────────────────────────────

test('adaptation-tracer — audit trail completeness', () => {
  reset();

  // Record various event types
  adaptationTracer.recordToolUpdate('npm_test', 0.70, 0.65, 10, 'test failures detected');
  adaptationTracer.recordStrategyShift('standard', 'rollback-first', 'terminal', 'high retry count', 0.75);
  adaptationTracer.recordBlock('key::test', 'rate limit', 0.05);
  adaptationTracer.recordFeedbackCycle('run-trace', 82, 'B', 5, 42);

  const summary = adaptationTracer.summary();
  assert.ok(summary.totalEvents >= 4, 'should have ≥ 4 events');
  assert.ok(summary.governedCount >= 4, 'all events should be governed');
  assert.ok(summary.blockedCount >= 1, 'blocked event should be recorded');

  // trace() should work
  const trace = adaptationTracer.trace('npm_test');
  assert.ok(trace.includes('npm_test'), 'trace should reference subject');

  // recentReport should be string
  const report = adaptationTracer.recentReport(5);
  assert.ok(typeof report === 'string', 'report should be a string');
  assert.ok(report.length > 0, 'report should be non-empty');
});

// ── Test 13: Learning Governance — no orchestration mutation ─────────────────

test('learning-governor — orchestration boundary hard enforcement', () => {
  reset();

  const forbidden = ['orchestrator', 'dispatcher', 'tool-registry', 'governance'];
  for (const target of forbidden) {
    assert.throws(
      () => learningGovernor.assertBoundary('any-learner', target),
      /HARD STOP/,
      `should block mutation of "${target}"`,
    );
  }

  // Safe targets should not throw
  assert.doesNotThrow(
    () => learningGovernor.assertBoundary('pattern-learner', 'learning-store'),
    'learning-store is a safe target',
  );
  assert.doesNotThrow(
    () => learningGovernor.assertBoundary('feedback-loop', 'execution-scorer'),
    'execution-scorer is a safe target',
  );
});

// ── Test 14: Learning Insights — observability ────────────────────────────────

test('learning-insights — observability report generation', () => {
  reset();

  // Seed some learning data
  for (let i = 0; i < 4; i++) {
    patternLearner.recordOutcome({
      runId: 'r1', taskId: `t${i}`, toolName: 'browser_screenshot', kind: 'browser',
      outcome: 'failure', retries: 3, recoveryUsed: true, durationMs: 5000,
    });
  }

  const report = learningInsights.generateReport();
  assert.ok(typeof report.generatedAt === 'number', 'generatedAt should be a number');
  assert.ok(typeof report.totalInsights === 'number', 'totalInsights should be a number');
  assert.ok(Array.isArray(report.insights), 'insights should be an array');
  assert.ok(report.storeSummary, 'storeSummary should exist');

  // Each insight should have required fields
  for (const insight of report.insights) {
    assert.ok(typeof insight.title === 'string', 'insight.title is string');
    assert.ok(typeof insight.explanation === 'string', 'insight.explanation is string');
    assert.ok(['info', 'warning', 'critical'].includes(insight.severity), 'valid severity');
    assert.ok(Array.isArray(insight.dataPoints), 'dataPoints is array');
  }

  // summaryText is a string
  const text = learningInsights.summaryText();
  assert.ok(typeof text === 'string' && text.length > 0, 'summaryText should be non-empty');

  // explainToolAdaptation returns a string
  const explanation = learningInsights.explainToolAdaptation('browser_screenshot');
  assert.ok(typeof explanation === 'string', 'explanation should be string');
});
