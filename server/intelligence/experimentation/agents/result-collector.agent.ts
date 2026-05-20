import type { ExecutionResult } from "../types";
import type { RawExecutionResult } from "./execution-controller.agent";
import type { Variant } from "../types";

export interface ResultCollectorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  results?: ExecutionResult[];
}

function buildNote(raw: RawExecutionResult, variant: Variant): string {
  const parts: string[] = [];
  if (!raw.success) parts.push("execution failed");
  if (raw.latencyMs > 3000) parts.push("high latency");
  if (raw.latencyMs < 500) parts.push("very fast");
  if (raw.accuracyScore > 0.85) parts.push("high accuracy");
  if (raw.accuracyScore < 0.6) parts.push("low accuracy");
  parts.push(`strategy: ${variant.strategy}`);
  return parts.join("; ");
}

export function collectResults(
  rawResults: RawExecutionResult[],
  variants: Variant[]
): ResultCollectorOutput {
  const logs: string[] = [];
  try {
    logs.push(`[result-collector] structuring ${rawResults.length} raw result(s)`);

    const variantMap = new Map<string, Variant>(variants.map((v) => [v.id, v]));

    const results: ExecutionResult[] = rawResults.map((raw) => {
      const variant = variantMap.get(raw.variantId);
      if (!variant) throw new Error(`No variant found for id=${raw.variantId}`);

      const result: ExecutionResult = {
        variantId: raw.variantId,
        success: raw.success,
        latencyMs: raw.latencyMs,
        accuracyScore: raw.accuracyScore,
        rawScore: raw.rawScore,
        notes: buildNote(raw, variant),
      };

      logs.push(`[result-collector] ${raw.variantId}: rawScore=${raw.rawScore} notes="${result.notes}"`);
      return result;
    });

    const successCount = results.filter((r) => r.success).length;
    logs.push(`[result-collector] collected ${results.length} result(s), ${successCount} successful`);

    return { success: true, logs, results };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[result-collector] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
