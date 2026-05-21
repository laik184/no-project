/**
 * server/hallucination/hallucination-gate.ts
 * Aggregates all hallucination signals and decides whether to block execution.
 * Single responsibility: produce HallucinationReport. Emits telemetry events.
 */

import { detectFakeDependencies }  from "./fake-dependency-detector.ts";
import { detectNonexistentFiles }  from "./nonexistent-file-detector.ts";
import { detectFakeCompletion }    from "./fake-completion-detector.ts";
import { detectRepeatedStrategy }  from "./repeated-strategy-detector.ts";
import { bus }                     from "../infrastructure/events/bus.ts";
import type { HallucinationReport, HallucinationSignal } from "./types.ts";

const BLOCK_THRESHOLD = 0.75;  // block if any signal confidence ≥ this

export interface HallucinationGateInput {
  projectId:    number;
  runId:        string;
  messages:     unknown[];
  proposedCode: string;
}

export async function runHallucinationGate(
  input: HallucinationGateInput,
): Promise<HallucinationReport> {
  const { projectId, runId, messages, proposedCode } = input;

  const [depSignals, fileSignals] = await Promise.all([
    detectFakeDependencies(proposedCode),
    detectNonexistentFiles(projectId, proposedCode),
  ]);

  const completionSignals = detectFakeCompletion(messages as any);
  const strategySignals   = detectRepeatedStrategy(messages as any);

  const signals: HallucinationSignal[] = [
    ...depSignals,
    ...fileSignals,
    ...completionSignals,
    ...strategySignals,
  ];

  const overallConfidence = signals.length > 0
    ? Math.max(...signals.map(s => s.confidence))
    : 0;

  const shouldBlock   = overallConfidence >= BLOCK_THRESHOLD;
  const recommendation = shouldBlock
    ? `High hallucination confidence (${(overallConfidence * 100).toFixed(0)}%). Trigger reflection and change strategy.`
    : signals.length > 0
      ? `Low-confidence signals detected. Proceed with caution.`
      : "No hallucination signals detected.";

  const report: HallucinationReport = {
    runId, signals, overallConfidence, shouldBlock, recommendation,
  };

  if (signals.length > 0) {
    bus.emit("agent.event", {
      runId,
      eventType: "hallucination.detected" as any,
      phase:     "tool-loop",
      ts:        Date.now(),
      payload:   { signalCount: signals.length, overallConfidence, shouldBlock },
    });
  }

  return report;
}
