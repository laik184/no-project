/**
 * server/runtime-truth/state-store.ts
 *
 * RuntimeStateStore — single source of truth for runtime health state.
 * Coordinates the state machine with the event bus.
 * Versioned snapshots prevent stale-state overwrites.
 * All mutations go through this store — no direct state machine calls elsewhere.
 */

import { randomUUID } from "crypto";
import { RuntimeStateMachine } from "./state-machine.ts";
import { RuntimeEventBus } from "./event-bus.ts";
import type {
  RuntimeHealthState,
  RuntimeSnapshot,
  StageResult,
  EvidenceItem,
  RuntimeChecksums,
} from "./types.ts";

const EMPTY_CHECKSUMS: RuntimeChecksums = {
  workspaceChecksum: "",
  tsconfigHash: "",
  packageLockHash: "",
  nodeModulesHash: "",
};

export class RuntimeStateStore {
  private readonly _machine: RuntimeStateMachine;
  private readonly _bus: RuntimeEventBus;
  private _lastSnapshot: RuntimeSnapshot | null = null;
  private _snapshots: RuntimeSnapshot[] = [];
  private readonly _maxSnapshots = 50;

  constructor(machine: RuntimeStateMachine, bus: RuntimeEventBus) {
    this._machine = machine;
    this._bus = bus;
  }

  get state(): RuntimeHealthState { return this._machine.state; }
  get version(): number { return this._machine.version; }
  get lastSnapshot(): RuntimeSnapshot | null { return this._lastSnapshot; }

  transitionTo(
    next: RuntimeHealthState,
    reason: string,
    correlationId: string
  ): boolean {
    const record = this._machine.tryTransition(next, reason);
    if (!record) return false;

    this._bus.emit("STATE_TRANSITIONED", correlationId, {
      from: record.from,
      to: record.to,
      version: record.version,
      reason,
    });
    return true;
  }

  forceTransition(
    next: RuntimeHealthState,
    reason: string,
    correlationId: string
  ): void {
    this._machine.forceState(next, reason);
    this._bus.emit("STATE_TRANSITIONED", correlationId, {
      forced: true,
      to: next,
      reason,
    });
  }

  buildAndStoreSnapshot(opts: {
    projectId: number;
    stages: readonly StageResult[];
    evidence: readonly EvidenceItem[];
    checksums?: RuntimeChecksums;
    passed: boolean;
    failedStage: import("./types.ts").VerificationStage | null;
  }): RuntimeSnapshot {
    const snapshot: RuntimeSnapshot = Object.freeze({
      snapshotId: randomUUID(),
      timestamp: Date.now(),
      state: this._machine.state,
      stateVersion: this._machine.version,
      projectId: opts.projectId,
      stages: Object.freeze([...opts.stages]),
      evidence: Object.freeze([...opts.evidence]),
      checksums: opts.checksums ?? EMPTY_CHECKSUMS,
      passed: opts.passed,
      failedStage: opts.failedStage,
    });

    this._lastSnapshot = snapshot;
    this._snapshots.push(snapshot);
    if (this._snapshots.length > this._maxSnapshots) {
      this._snapshots.shift();
    }

    return snapshot;
  }

  snapshotHistory(): ReadonlyArray<RuntimeSnapshot> {
    return Object.freeze([...this._snapshots]);
  }

  lastVerifiedAt(): number | null {
    for (let i = this._snapshots.length - 1; i >= 0; i--) {
      if (this._snapshots[i].passed) return this._snapshots[i].timestamp;
    }
    return null;
  }

  reset(correlationId: string): void {
    this._machine.reset();
    this._lastSnapshot = null;
    this._bus.emit("STATE_TRANSITIONED", correlationId, {
      reset: true,
      to: "UNKNOWN",
    });
  }
}
