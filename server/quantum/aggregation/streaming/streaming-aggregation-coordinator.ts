/**
 * streaming/streaming-aggregation-coordinator.ts
 *
 * Top-level coordinator for the 99% Streaming Aggregation System.
 * Wires all 10 modules together: buffer → reducer → conflict resolver →
 * publisher → checkpoint → health monitor → collapse coordinator.
 *
 * Single responsibility: orchestration wiring only — no business logic.
 */

import type {
  StreamingSessionConfig,
  StreamingPathEvent,
  PartialAggregationState,
  StreamingSessionId,
} from "../contracts/aggregation.types.ts";
import type { IStreamingAggregationCoordinator } from "../contracts/aggregation.interfaces.ts";

import { partialBuffer }       from "../buffers/partial-aggregation-buffer.ts";
import { conflictResolver }    from "../reconciliation/streaming-conflict-resolver.ts";
import { resultPublisher }     from "./incremental-result-publisher.ts";
import { replayManager }       from "./aggregation-replay-manager.ts";
import { checkpointStore }     from "../checkpoints/aggregation-checkpoint-store.ts";
import { collapseCoordinator, CollapseError } from "../lifecycle/final-collapse-coordinator.ts";
import { registerSession, touchArrival, deregisterSession } from "../lifecycle/aggregation-health-monitor.ts";
import { openBarrier, clearBarrier } from "../reconciliation/reconciliation-barrier.ts";
import { initMachine, tryTransition, destroyMachine } from "./streaming-state-machine.ts";
import { emitSessionStarted, emitSessionClosed, emitPathCompleted } from "../telemetry/aggregation-telemetry.ts";
import { fireOpen, fireClose, fireFail, firePartial } from "../lifecycle/aggregation-lifecycle.ts";
import { recordSessionCount }  from "../telemetry/streaming-metrics.ts";

// ── Session timeout registry ──────────────────────────────────────────────────

const _timeouts = new Map<StreamingSessionId, ReturnType<typeof setTimeout>>();

// ── StreamingAggregationCoordinator ──────────────────────────────────────────

export class StreamingAggregationCoordinator implements IStreamingAggregationCoordinator {
  private readonly _configs = new Map<StreamingSessionId, StreamingSessionConfig>();

  // ── Start session ─────────────────────────────────────────────────────────

  startSession(cfg: StreamingSessionConfig): void {
    this._configs.set(cfg.sessionId, cfg);

    // 1. State machine
    initMachine(cfg.sessionId);

    // 2. Buffer init
    partialBuffer.initSession(cfg);

    // 3. Barrier
    openBarrier(cfg.sessionId);

    // 4. Replay manager context
    replayManager.registerContext(cfg.sessionId, cfg.runId, cfg.projectId);

    // 5. Health monitor
    registerSession(cfg.sessionId, cfg.runId, cfg.projectId);

    // 6. Telemetry
    emitSessionStarted(cfg);
    recordSessionCount(1);
    fireOpen(cfg);

    // 7. Timeout guard
    const tid = setTimeout(() => {
      this._handleTimeout(cfg.sessionId);
    }, cfg.timeoutMs);
    _timeouts.set(cfg.sessionId, tid);
  }

  // ── Report path (main hot path) ───────────────────────────────────────────

  reportPath(event: StreamingPathEvent): void {
    const cfg = this._configs.get(event.sessionId);
    if (!cfg) return;

    tryTransition(event.sessionId, "reducing");
    touchArrival(event.sessionId);

    // 1. Buffer → reduce
    const state = partialBuffer.push(event);

    // 2. Emit path completed telemetry
    emitPathCompleted(event.sessionId, event.runId, event.projectId,
                      event.pathId, event.success, event.verificationPassed);

    // 3. Detect conflicts against prior successful paths
    const priorEvents = state.eventLog.slice(0, -1).filter(e => e.success);
    for (const prior of priorEvents) {
      const conflict = conflictResolver.detect(prior, event);
      if (conflict) {
        partialBuffer.incrementConflicts(event.sessionId, false);
        resultPublisher.publishConflict(conflict);
        const resolved = conflictResolver.resolve(conflict);
        if (resolved.resolved) {
          partialBuffer.incrementConflicts(event.sessionId, true);
        }
      }
    }

    // 4. Checkpoint every N arrivals
    if (state.arrivedPaths % cfg.checkpointIntervalMs === 0) {
      checkpointStore.checkpoint(state);
    }

    // 5. Publish partial result
    tryTransition(event.sessionId, "publishing");
    resultPublisher.publishPartial(state);
    firePartial(state);

    // 6. Check for early collapse (≥92% confidence)
    if (state.topConfidence >= cfg.earlyCollapseThreshold) {
      this._collapse(event.sessionId, cfg, "early_collapse");
      return;
    }

    // 7. Final collapse when all paths arrived
    if (state.arrivedPaths >= state.totalPaths) {
      this._collapse(event.sessionId, cfg, "complete");
    }
  }

  // ── Get state ─────────────────────────────────────────────────────────────

  getState(sessionId: StreamingSessionId): PartialAggregationState | undefined {
    return partialBuffer.getState(sessionId);
  }

  // ── Close session ─────────────────────────────────────────────────────────

  closeSession(sessionId: StreamingSessionId): void {
    this._cleanup(sessionId);
    emitSessionClosed(sessionId, "", 0);
    recordSessionCount(-1);
  }

  // ── Internal collapse ─────────────────────────────────────────────────────

  private _collapse(
    sessionId: StreamingSessionId,
    cfg:       StreamingSessionConfig,
    _reason:   string,
  ): void {
    tryTransition(sessionId, "reconciling");
    conflictResolver.resolveAll(sessionId);
    tryTransition(sessionId, "collapsing");

    try {
      const result = collapseCoordinator.collapse(sessionId, cfg);
      tryTransition(sessionId, "collapsed");
      resultPublisher.publishCollapse(result);
      fireClose(result);
      this._cleanup(sessionId);
    } catch (err) {
      tryTransition(sessionId, "failed");
      const reason = err instanceof CollapseError ? err.message : String(err);
      resultPublisher.publishFailure(sessionId, cfg.runId, cfg.projectId, reason);
      fireFail(sessionId, reason);
      this._attemptReplay(sessionId, cfg);
    }
  }

  private _handleTimeout(sessionId: StreamingSessionId): void {
    const cfg = this._configs.get(sessionId);
    if (!cfg) return;
    this._collapse(sessionId, cfg, "timeout");
  }

  private _attemptReplay(sessionId: StreamingSessionId, cfg: StreamingSessionConfig): void {
    if (!cfg.replayEnabled || !replayManager.canReplay(sessionId)) return;
    const checkpoint = replayManager.findBestCheckpoint(sessionId);
    if (!checkpoint) return;

    tryTransition(sessionId, "replaying");
    replayManager.startReplay(sessionId, checkpoint).then(rebuilt => {
      // Restore buffer state and retry collapse
      partialBuffer.initSession(cfg);
      for (const ev of rebuilt.eventLog) partialBuffer.push(ev);
      this._collapse(sessionId, cfg, "replay_retry");
    }).catch(() => {
      fireFail(sessionId, "Replay failed — cannot recover");
    });
  }

  private _cleanup(sessionId: StreamingSessionId): void {
    const tid = _timeouts.get(sessionId);
    if (tid) { clearTimeout(tid); _timeouts.delete(sessionId); }
    deregisterSession(sessionId);
    checkpointStore.prune(sessionId, 3);
  }
}

export const streamingCoordinator = new StreamingAggregationCoordinator();
