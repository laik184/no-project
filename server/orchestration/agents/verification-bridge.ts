/**
 * server/orchestration/agents/verification-bridge.ts
 *
 * Verification bridge: dispatches verification requests through the
 * centralized dispatcher rather than executing checks directly.
 * Orchestration-only — no tool execution, no filesystem access.
 */

import { bus } from '../../infrastructure/index.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VerificationCheckType =
  | 'build'
  | 'test'
  | 'typecheck'
  | 'lint'
  | 'runtime'
  | 'custom';

export interface VerificationCheck {
  type:        VerificationCheckType;
  target?:     string;
  args?:       string[];
  timeoutMs?:  number;
}

export interface VerificationRequest {
  runId:      string;
  projectId:  number;
  checks:     VerificationCheck[];
  port?:      number;
  timeoutMs?: number;
}

export interface VerificationResult {
  success:  boolean;
  data?: {
    score:   number;
    summary: string;
    checks:  Array<{ type: string; passed: boolean; output?: string }>;
  };
  error?: string;
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class VerificationBridge {
  async verify(req: VerificationRequest): Promise<VerificationResult> {
    const { runId, projectId, checks, port, timeoutMs = 30_000 } = req;

    bus.emit('agent.event', {
      runId,
      message: `[verification-bridge] Dispatching ${checks.length} check(s) for run ${runId}`,
    } as never);

    // Orchestration-only: emit event for downstream verifier tools to handle.
    // Actual verification is performed by the tool layer, not here.
    return new Promise<VerificationResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[verification-bridge] Timeout after ${timeoutMs}ms for run=${runId}`));
      }, timeoutMs);

      // Emit verification request — a registered tool handler resolves this.
      bus.emit('dag.verify.requested', {
        runId,
        projectId,
        checks,
        port,
        timeoutMs,
        resolve: (result: VerificationResult) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
      } as never);
    });
  }
}

export const verificationBridge = new VerificationBridge();
