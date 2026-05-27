import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { LoopDetectionResult, LoopRiskLevel } from '../types/supervisor.types.ts';

interface PhaseEvent {
  phase: OrchestrationPhase;
  success: boolean;
  ts: number;
}

const LOOP_WINDOW_MS = 5 * 60 * 1_000; // 5 minutes
const runHistory = new Map<string, PhaseEvent[]>();

function trimWindow(events: PhaseEvent[]): PhaseEvent[] {
  const cutoff = Date.now() - LOOP_WINDOW_MS;
  return events.filter((e) => e.ts >= cutoff);
}

function computeRisk(consecutive: number, total: number): LoopRiskLevel {
  if (consecutive >= 5 || total >= 8) return 'critical';
  if (consecutive >= 3 || total >= 5) return 'high';
  if (consecutive >= 2 || total >= 3) return 'medium';
  if (consecutive >= 1 || total >= 2) return 'low';
  return 'none';
}

export const loopDetector = {
  record(runId: string, phase: OrchestrationPhase, success: boolean): void {
    if (!runHistory.has(runId)) runHistory.set(runId, []);
    const events = trimWindow(runHistory.get(runId)!);
    events.push({ phase, success, ts: Date.now() });
    runHistory.set(runId, events);
  },

  detect(runId: string, phase: OrchestrationPhase): LoopDetectionResult {
    const events = trimWindow(runHistory.get(runId) ?? []);
    const phaseFailures = events.filter((e) => e.phase === phase && !e.success);

    let consecutive = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].phase === phase && !events[i].success) consecutive++;
      else break;
    }

    const risk = computeRisk(consecutive, phaseFailures.length);
    const detected = risk !== 'none';

    return {
      detected,
      risk,
      pattern:     detected ? `Phase "${phase}" failing repeatedly` : undefined,
      occurrences: phaseFailures.length,
    };
  },

  detectGlobal(runId: string): LoopDetectionResult {
    const events = trimWindow(runHistory.get(runId) ?? []);
    const failures = events.filter((e) => !e.success);

    let maxConsecutive = 0;
    let current = 0;
    for (const e of events) {
      if (!e.success) { current++; maxConsecutive = Math.max(maxConsecutive, current); }
      else current = 0;
    }

    const risk = computeRisk(maxConsecutive, failures.length);
    return {
      detected:    risk !== 'none',
      risk,
      pattern:     risk !== 'none' ? `Global failure pattern (${failures.length} failures in window)` : undefined,
      occurrences: failures.length,
    };
  },

  clearRun(runId: string): void {
    runHistory.delete(runId);
  },
};
