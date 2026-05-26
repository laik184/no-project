import type { OrchestrationContext, PhaseResult } from '../events/event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { emitPhaseStarted, emitMetric } from '../events/orchestration-events.ts';
import { timed } from '../utils/execution-utils.ts';

export type ExecutionMode = 'simple' | 'standard' | 'complex';

export interface AnalysisResult {
  complexityScore: number;
  executionMode: ExecutionMode;
  estimatedTaskCount: number;
  requiresBrowser: boolean;
  requiresVerification: boolean;
  tags: string[];
}

const COMPLEXITY_KEYWORDS: Record<string, number> = {
  auth: 15, database: 15, api: 10, websocket: 20, realtime: 20,
  payment: 20, dashboard: 10, crud: 8, form: 5, deploy: 15,
  multipage: 12, chart: 8, upload: 10, search: 8, animation: 5,
};

function scoreGoal(goal: string): number {
  const lower = goal.toLowerCase();
  let score = 10;
  for (const [kw, weight] of Object.entries(COMPLEXITY_KEYWORDS)) {
    if (lower.includes(kw)) score += weight;
  }
  score += Math.floor(goal.length / 200) * 5;
  return Math.min(score, 100);
}

function resolveMode(score: number): ExecutionMode {
  if (score < 25) return 'simple';
  if (score < 60) return 'standard';
  return 'complex';
}

function extractTags(goal: string): string[] {
  const lower = goal.toLowerCase();
  return Object.keys(COMPLEXITY_KEYWORDS).filter((kw) => lower.includes(kw));
}

function estimateTasks(mode: ExecutionMode): number {
  const counts: Record<ExecutionMode, number> = { simple: 3, standard: 7, complex: 14 };
  return counts[mode];
}

export async function runAnalyzePhase(ctx: OrchestrationContext): Promise<PhaseResult> {
  emitPhaseStarted(ctx.runId, 'analyze');
  runLogger.log(ctx.runId, 'info', '[analyze-phase] Starting goal analysis');

  const { result, durationMs } = await timed(async (): Promise<AnalysisResult> => {
    const score = scoreGoal(ctx.goal);
    const mode = resolveMode(score);
    const tags = extractTags(ctx.goal);
    return {
      complexityScore: score,
      executionMode: mode,
      estimatedTaskCount: estimateTasks(mode),
      requiresBrowser: score > 30,
      requiresVerification: score > 20,
      tags,
    };
  });

  emitMetric(ctx.runId, 'analyze.complexity', result.complexityScore, 'score');
  runLogger.log(ctx.runId, 'info', `[analyze-phase] Score=${result.complexityScore} mode=${result.executionMode}`, { tags: result.tags });

  return {
    phase: 'analyze',
    success: true,
    durationMs,
    output: result as unknown as Record<string, unknown>,
  };
}
