import { EventEmitter } from 'events';
import type {
  VerificationReport,
  VerificationOptions,
  RuntimeHealthState,
  VerificationStage,
  StageResult,
} from './types.ts';

export { VerificationReport, VerificationOptions, RuntimeHealthState };

export const runtimeEventBus = new EventEmitter();

const snapshots = new Map<number, VerificationReport>();
const states    = new Map<number, RuntimeHealthState>();

async function runStage(
  stage: VerificationStage,
  fn:    () => Promise<boolean>,
): Promise<StageResult> {
  const start = Date.now();
  try {
    const passed = await fn();
    return { stage, passed, durationMs: Date.now() - start };
  } catch (err) {
    return { stage, passed: false, durationMs: Date.now() - start, error: String(err) };
  }
}

export async function runVerification(opts: VerificationOptions): Promise<VerificationReport> {
  const start  = Date.now();
  const skip   = new Set<VerificationStage>(opts.skipStages ?? []);
  const stages: StageResult[] = [];

  if (!skip.has('runtime')) {
    stages.push(await runStage('runtime', async () => {
      if (!opts.port) return false;
      const { probePort } = await import('../runtime/health/port-probe.ts');
      return probePort(opts.port, '127.0.0.1', 3_000);
    }));
  }

  if (!skip.has('http') && opts.port) {
    stages.push(await runStage('http', async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${opts.port}/health`, { signal: AbortSignal.timeout(5_000) });
        return res.ok;
      } catch { return false; }
    }));
  }

  const passed = stages.length === 0 || stages.every(s => s.passed);

  const report: VerificationReport = {
    projectId:  opts.projectId,
    passed,
    stages,
    evidence:   {},
    durationMs: Date.now() - start,
    ts:         Date.now(),
  };

  snapshots.set(opts.projectId, report);
  states.set(opts.projectId, {
    projectId: opts.projectId,
    healthy:   passed,
    port:      opts.port,
    lastCheck: Date.now(),
  });

  runtimeEventBus.emit('verification.complete', report);
  return report;
}

export function getOrchestrator() {
  return {
    getSnapshot(projectId: number): VerificationReport | undefined {
      return snapshots.get(projectId);
    },
    getState(projectId: number): RuntimeHealthState | undefined {
      return states.get(projectId);
    },
    evaluateClaim(claim: string): boolean {
      return false;
    },
    recentEvents(): unknown[] {
      return [];
    },
  };
}
