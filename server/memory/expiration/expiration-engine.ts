/**
 * server/memory/expiration/expiration-engine.ts
 *
 * ExpirationEngine — periodic sweep that expires stale claims and facts.
 * Emits EXPIRATION_TRIGGERED events. Never deletes — only marks status.
 * Operates as a background sweep; callers can also trigger manually.
 * Returns a sweep report for observability.
 */

import type { VerifiedFact, AgentClaim } from "../contracts/types.ts";
import type { FactStore } from "../facts/fact-store.ts";
import type { ClaimStore } from "../claims/claim-store.ts";
import type { TTLPolicy } from "./ttl-policy.ts";
import type { EventLog } from "../events/event-log.ts";
import type { Clock } from "../infrastructure/clock.ts";
import { expirationTriggeredEvent } from "../events/event-types.ts";

export type SweepReport = {
  readonly expiredFacts:  number;
  readonly expiredClaims: number;
  readonly sweptAt:       number;
  readonly durationMs:    number;
};

export class ExpirationEngine {
  private _timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly _facts:  FactStore,
    private readonly _claims: ClaimStore,
    private readonly _ttl:    TTLPolicy,
    private readonly _events: EventLog,
    private readonly _clock:  Clock,
  ) {}

  /** Run a single sweep immediately. Returns what was expired. */
  sweep(): SweepReport {
    const t0  = this._clock.now();
    const now = t0;
    let expiredFacts  = 0;
    let expiredClaims = 0;

    // ── Expire facts ─────────────────────────────────────────────────────────
    for (const fact of this._facts.listAll()) {
      if (this._shouldExpireFact(fact, now)) {
        const result = this._facts.invalidate(fact.id, "TTL elapsed");
        if (result) {
          this._events.append(expirationTriggeredEvent(fact.id, "fact"));
          expiredFacts++;
        }
      }
    }

    // ── Expire claims ─────────────────────────────────────────────────────────
    for (const claim of this._claims.listByStatus("unverified")) {
      if (this._shouldExpireClaim(claim, now)) {
        const ok = this._claims.markExpired(claim.id, "TTL elapsed");
        if (ok) {
          this._events.append(expirationTriggeredEvent(claim.id, "claim"));
          expiredClaims++;
        }
      }
    }

    return Object.freeze({
      expiredFacts,
      expiredClaims,
      sweptAt:    now,
      durationMs: this._clock.now() - t0,
    });
  }

  /** Start background sweeping every intervalMs. Returns stop function. */
  start(intervalMs = 60_000): () => void {
    if (this._timer) this.stop();
    this._timer = setInterval(() => this.sweep(), intervalMs);
    return () => this.stop();
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  get isRunning(): boolean { return this._timer !== null; }

  private _shouldExpireFact(fact: VerifiedFact, now: number): boolean {
    if (fact.invalidatedAt) return false;
    return this._ttl.isFactExpired(fact, now);
  }

  private _shouldExpireClaim(claim: AgentClaim, now: number): boolean {
    if (claim.verificationStatus !== "unverified") return false;
    return this._ttl.isClaimExpired(claim, now);
  }
}
