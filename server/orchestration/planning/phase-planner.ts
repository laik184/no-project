/**
 * server/orchestration/planning/phase-planner.ts
 *
 * Creates execution phases for a workflow based on goal intent and agent type.
 * Pure planning — no dispatch, no tool execution, no filesystem access.
 */

import type { OrchestrationRequest, Phase, AgentType } from '../types/orchestration.types.ts';
import { newPhaseId } from '../utils/orchestration-utils.ts';
import type { WorkflowIntent } from './workflow-planner.ts';

// ── Phase factory ─────────────────────────────────────────────────────────────

function makePhase(
  name:      string,
  agentType: AgentType,
  input:     Record<string, unknown>,
  optional:  boolean = false,
  dependsOn: string[] = [],
): Phase {
  return Object.freeze({
    phaseId: newPhaseId(),
    name,
    agentType,
    input,
    optional,
    dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
  });
}

// ── Intent-based phase builder ────────────────────────────────────────────────

export function buildPhases(
  req:          OrchestrationRequest,
  intent:       WorkflowIntent,
  primaryAgent: AgentType,
): Phase[] {
  const baseInput: Record<string, unknown> = {
    goal:        req.goal,
    projectId:   req.projectId,
    sandboxRoot: req.sandboxRoot,
    runId:       req.runId,
    context:     req.context ?? {},
  };

  switch (intent) {
    case 'build_feature':
    case 'add_api':
    case 'generate_ui':
      return buildStandardPhases(baseInput, primaryAgent);

    case 'fix_bug':
      return buildBugFixPhases(baseInput);

    case 'refactor':
      return buildRefactorPhases(baseInput);

    case 'verify_runtime':
      return buildVerifyPhases(baseInput);

    default:
      return buildStandardPhases(baseInput, primaryAgent);
  }
}

// ── Phase templates ───────────────────────────────────────────────────────────

function buildStandardPhases(
  baseInput:    Record<string, unknown>,
  primaryAgent: AgentType,
): Phase[] {
  const planPhase = makePhase('plan', 'planner', { ...baseInput, mode: 'plan' });
  const execPhase = makePhase('execute', primaryAgent, { ...baseInput, mode: 'execute' }, false, [planPhase.phaseId]);
  const verifyPhase = makePhase('verify', 'verifier', { ...baseInput, mode: 'verify' }, true, [execPhase.phaseId]);
  return [planPhase, execPhase, verifyPhase];
}

function buildBugFixPhases(baseInput: Record<string, unknown>): Phase[] {
  const analyzePhase = makePhase('analyze', 'planner',   { ...baseInput, mode: 'analyze_bug' });
  const fixPhase     = makePhase('fix',     'executor',  { ...baseInput, mode: 'fix' }, false, [analyzePhase.phaseId]);
  const verifyPhase  = makePhase('verify',  'verifier',  { ...baseInput, mode: 'verify_fix' }, false, [fixPhase.phaseId]);
  return [analyzePhase, fixPhase, verifyPhase];
}

function buildRefactorPhases(baseInput: Record<string, unknown>): Phase[] {
  const analyzePhase  = makePhase('analyze',  'planner',  { ...baseInput, mode: 'analyze_refactor' });
  const refactorPhase = makePhase('refactor', 'executor', { ...baseInput, mode: 'refactor' }, false, [analyzePhase.phaseId]);
  const verifyPhase   = makePhase('verify',   'verifier', { ...baseInput, mode: 'verify_refactor' }, true, [refactorPhase.phaseId]);
  return [analyzePhase, refactorPhase, verifyPhase];
}

function buildVerifyPhases(baseInput: Record<string, unknown>): Phase[] {
  const verifyPhase  = makePhase('verify',  'verifier',  { ...baseInput, mode: 'verify' });
  const reportPhase  = makePhase('report',  'supervisor', { ...baseInput, mode: 'report' }, true, [verifyPhase.phaseId]);
  return [verifyPhase, reportPhase];
}
