/**
 * server/agents/core/pipeline/index.ts — STUB
 * Pipeline agent was removed.
 */

export interface PipelineInput {
  requestId:           string;
  input:               string;
  sessionId?:          string;
  context?:            Record<string, unknown>;
  allowDestructive?:   boolean;
  maxFeedbackAttempts?: number;
}

export interface PipelineResult {
  success:        boolean;
  finalPhase:     string;
  totalDurationMs: number;
  error?:         string;
  phases:         Array<{
    phase:      string;
    success:    boolean;
    durationMs: number;
    error?:     string;
    data?:      unknown;
  }>;
}

export async function executePipeline(input: PipelineInput): Promise<PipelineResult> {
  console.warn("[pipeline] executePipeline called but pipeline agent was removed — returning stub");
  return {
    success:        false,
    finalPhase:     "stub",
    totalDurationMs: 0,
    error:          "Pipeline agent removed.",
    phases:         [{
      phase:      "stub",
      success:    false,
      durationMs: 0,
      error:      "Pipeline agent removed.",
    }],
  };
}
