import type { VerificationPhase, VerificationStatus } from './verifier-types.ts';

export interface PhaseProgressEvent {
  runId:      string;
  phase:      VerificationPhase;
  status:     VerificationStatus;
  durationMs: number;
  errors:     string[];
}

interface RunProgress {
  runId:    string;
  phases:   PhaseProgressEvent[];
  status:   VerificationStatus;
  start:    number;
}

class VerificationMonitor {
  private readonly runs = new Map<string, RunProgress>();

  onRunStart(runId: string): void {
    this.runs.set(runId, { runId, phases: [], status: 'running', start: Date.now() });
    if (this.runs.size > 100) {
      const oldest = [...this.runs.keys()].slice(0, 50);
      oldest.forEach((k) => this.runs.delete(k));
    }
  }

  onPhaseComplete(event: PhaseProgressEvent): void {
    const run = this.runs.get(event.runId);
    if (run) run.phases.push(event);
  }

  onRunComplete(runId: string, status: VerificationStatus): void {
    const run = this.runs.get(runId);
    if (run) run.status = status;
  }

  getProgress(runId: string): RunProgress | undefined {
    return this.runs.get(runId);
  }
}

export const verificationMonitor = new VerificationMonitor();
