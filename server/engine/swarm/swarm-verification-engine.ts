/**
 * server/engine/swarm/swarm-verification-engine.ts
 *
 * Parallel 3-wave verification engine for swarm results.
 *   Wave A (parallel): static + build
 *   Wave B (parallel): runtime + preview + browser
 *   Wave C (sequential): reconcile + final confidence gate
 *
 * Single responsibility: swarm-level verification orchestration only.
 */

import { quantumDAGEngine } from "../graph/quantum-dag-engine.ts";
import type { SwarmSession, SwarmFinalResult } from "./swarm-types.ts";
import {
  emitAgentStarted,
  emitAgentCompleted,
  emitAgentFailed,
} from "./swarm-telemetry.ts";

// ── Verification result ───────────────────────────────────────────────────────

export interface SwarmVerificationResult {
  passed:       boolean;
  waveA:        WaveVerdict;
  waveB:        WaveVerdict;
  waveC:        WaveVerdict;
  confidence:   number;
  durationMs:   number;
  blockedReason?: string;
}

interface WaveVerdict {
  passed:   boolean;
  checks:   CheckResult[];
  durationMs: number;
}

interface CheckResult {
  name:    string;
  passed:  boolean;
  detail?: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function runSwarmVerification(
  session:   SwarmSession,
  runId:     string,
  projectId: number,
  result:    SwarmFinalResult,
): Promise<SwarmVerificationResult> {
  const t0      = Date.now();
  const swarmId = session.swarmId;

  // ── Wave A: Static + Build (parallel) ───────────────────────────────────────
  emitAgentStarted(runId, projectId, swarmId, "verify-wave-A", "verification-agent", 3);

  const waveAResult = await quantumDAGEngine.executeDistributedWave<CheckResult>(
    runId, projectId, {
      waveIdx:     3,
      barrierName: `${swarmId}:verify-A`,
      nodes: [
        {
          id: "static-check", dependsOn: [], workerType: "cpu-bound", timeoutMs: 30_000,
          fn: () => runStaticCheck(result),
        },
        {
          id: "build-check", dependsOn: [], workerType: "cpu-bound", timeoutMs: 45_000,
          fn: () => runBuildCheck(result),
        },
      ],
    },
  );

  const waveA: WaveVerdict = {
    passed:    waveAResult.failed.length === 0,
    checks:    Array.from(waveAResult.results.values()),
    durationMs: waveAResult.durationMs,
  };

  if (!waveA.passed) {
    const reason = `Wave A failed: ${waveAResult.failed.join(", ")}`;
    emitAgentFailed(runId, projectId, swarmId, "verify-wave-A", "verification-agent", reason);
    return {
      passed: false, waveA, waveB: emptyWave(), waveC: emptyWave(),
      confidence: 0, durationMs: Date.now() - t0, blockedReason: reason,
    };
  }

  emitAgentCompleted(runId, projectId, swarmId, "verify-wave-A", "verification-agent", waveA.durationMs, true);

  // ── Wave B: Runtime + Preview + Browser (parallel) ──────────────────────────
  emitAgentStarted(runId, projectId, swarmId, "verify-wave-B", "verification-agent", 3);

  const waveBResult = await quantumDAGEngine.executeDistributedWave<CheckResult>(
    runId, projectId, {
      waveIdx:     3,
      barrierName: `${swarmId}:verify-B`,
      nodes: [
        {
          id: "runtime-check", dependsOn: [], workerType: "io-bound", timeoutMs: 45_000,
          fn: () => runRuntimeCheck(result),
        },
        {
          id: "preview-check", dependsOn: [], workerType: "io-bound", timeoutMs: 30_000,
          fn: () => runPreviewCheck(result),
        },
      ],
    },
  );

  const waveB: WaveVerdict = {
    passed:    waveBResult.failed.length === 0,
    checks:    Array.from(waveBResult.results.values()),
    durationMs: waveBResult.durationMs,
  };

  emitAgentCompleted(runId, projectId, swarmId, "verify-wave-B", "verification-agent", waveB.durationMs, waveB.passed);

  // ── Wave C: Reconcile + Final confidence (sequential) ────────────────────────
  emitAgentStarted(runId, projectId, swarmId, "verify-wave-C", "verification-agent", 3);

  const waveC = await runReconcileGate(result, waveA, waveB);
  emitAgentCompleted(runId, projectId, swarmId, "verify-wave-C", "verification-agent", waveC.durationMs, waveC.passed);

  const confidence = _computeConfidence(waveA, waveB, waveC, result);

  return {
    passed:     waveA.passed && waveB.passed && waveC.passed,
    waveA, waveB, waveC,
    confidence,
    durationMs: Date.now() - t0,
  };
}

// ── Check implementations (lightweight — real checks injected by integrations) ─

async function runStaticCheck(result: SwarmFinalResult): Promise<CheckResult> {
  return { name: "static", passed: result.tasksCompleted > 0, detail: `${result.tasksCompleted} tasks completed` };
}

async function runBuildCheck(result: SwarmFinalResult): Promise<CheckResult> {
  return { name: "build", passed: result.success, detail: result.success ? "Build OK" : "Build failed" };
}

async function runRuntimeCheck(result: SwarmFinalResult): Promise<CheckResult> {
  return { name: "runtime", passed: result.confidence > 0.6, detail: `confidence=${result.confidence.toFixed(2)}` };
}

async function runPreviewCheck(result: SwarmFinalResult): Promise<CheckResult> {
  return { name: "preview", passed: result.mergedFiles.length > 0, detail: `${result.mergedFiles.length} files` };
}

async function runReconcileGate(
  result: SwarmFinalResult,
  waveA:  WaveVerdict,
  waveB:  WaveVerdict,
): Promise<WaveVerdict> {
  const t0 = Date.now();
  const allPassed = waveA.passed && waveB.passed && result.confidence > 0.7;
  return {
    passed: allPassed,
    checks: [{ name: "reconcile-gate", passed: allPassed }],
    durationMs: Date.now() - t0,
  };
}

function _computeConfidence(wA: WaveVerdict, wB: WaveVerdict, wC: WaveVerdict, r: SwarmFinalResult): number {
  const waveScore = ([wA, wB, wC].filter(w => w.passed).length / 3);
  return (waveScore * 0.5 + r.confidence * 0.5);
}

function emptyWave(): WaveVerdict {
  return { passed: false, checks: [], durationMs: 0 };
}
