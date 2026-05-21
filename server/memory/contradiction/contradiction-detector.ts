/**
 * server/memory/contradiction/contradiction-detector.ts
 *
 * ContradictionDetector — identifies and quarantines conflicting memory.
 *
 * Detection strategies:
 *   1. Key conflict  — newer fact with same key invalidates older one
 *   2. Claim/fact conflict — runtime evidence contradicts an active claim
 *   3. Duplicate claim — same claim text in same run (self-confirmation loop)
 *
 * All detections emit CONTRADICTION_DETECTED events and quarantine targets.
 * Quarantine is permanent — no un-quarantine path exists (fail-closed).
 */

import type { VerifiedFact, AgentClaim, Namespace } from "../contracts/types.ts";
import type { FactStore } from "../facts/fact-store.ts";
import type { ClaimStore } from "../claims/claim-store.ts";
import type { QuarantineStore } from "./quarantine-store.ts";
import type { EventLog } from "../events/event-log.ts";
import type { IdGenerator } from "../infrastructure/id-generator.ts";
import type { Clock } from "../infrastructure/clock.ts";
import { contradictionDetectedEvent } from "../events/event-types.ts";

export type ContradictionReport = {
  readonly contradictionId: string;
  readonly targetId: string;
  readonly targetType: "fact" | "claim";
  readonly reason: string;
  readonly detectedAt: number;
};

export class ContradictionDetector {
  constructor(
    private readonly _facts:      FactStore,
    private readonly _claims:     ClaimStore,
    private readonly _quarantine: QuarantineStore,
    private readonly _events:     EventLog,
    private readonly _ids:        IdGenerator,
    private readonly _clock:      Clock,
  ) {}

  /**
   * Called when a new fact is written. Checks for older facts on the same key
   * in the same namespace and invalidates them as superseded.
   */
  onFactWritten(newFact: VerifiedFact): readonly ContradictionReport[] {
    const reports: ContradictionReport[] = [];
    for (const existing of this._facts.listNamespace(newFact.namespace)) {
      if (existing.id === newFact.id) continue;
      if (existing.key !== newFact.key) continue;
      if (existing.invalidatedAt) continue;
      if (existing.verifiedAt >= newFact.verifiedAt) continue;

      const contradictionId = this._ids.generate("promo");
      const reason = `superseded by newer fact ${newFact.id} at ${newFact.verifiedAt}`;
      this._facts.invalidate(existing.id, reason, contradictionId);
      this._quarantine.quarantine({
        targetId: existing.id, targetType: "fact", reason,
        quarantinedAt: this._clock.now(), contradictionId,
      });
      this._events.append(contradictionDetectedEvent(existing.id, "fact", reason));
      reports.push({ contradictionId, targetId: existing.id, targetType: "fact", reason, detectedAt: this._clock.now() });
    }
    return Object.freeze(reports);
  }

  /**
   * Called with a runtime evidence result to find claims that contradict it.
   * e.g. runtime says process crashed → claim "server healthy" is contradicted.
   */
  checkClaimsAgainstEvidence(
    factKey: string,
    factValue: unknown,
    namespace: Namespace,
  ): readonly ContradictionReport[] {
    const reports: ContradictionReport[] = [];
    const active = this._claims.listByStatus("unverified", namespace);

    for (const claim of active) {
      if (!this._claimContradictsFactKey(claim, factKey, factValue)) continue;

      const contradictionId = this._ids.generate("promo");
      const reason = `runtime evidence contradicts claim — fact "${factKey}"="${JSON.stringify(factValue)}"`;
      this._claims.markContradicted(claim.id, contradictionId, reason);
      this._quarantine.quarantine({
        targetId: claim.id, targetType: "claim", reason,
        quarantinedAt: this._clock.now(), contradictionId,
      });
      this._events.append(contradictionDetectedEvent(claim.id, "claim", reason));
      reports.push({ contradictionId, targetId: claim.id, targetType: "claim", reason, detectedAt: this._clock.now() });
    }
    return Object.freeze(reports);
  }

  /**
   * Detects self-confirmation loops: same claim text submitted twice in one run.
   */
  detectSelfConfirmation(claim: AgentClaim): boolean {
    const existing = this._claims.listByStatus("unverified", claim.namespace)
      .filter((c) => c.id !== claim.id && c.sourceRunId === claim.sourceRunId);
    return existing.some((c) => c.claim.trim().toLowerCase() === claim.claim.trim().toLowerCase());
  }

  private _claimContradictsFactKey(claim: AgentClaim, factKey: string, factValue: unknown): boolean {
    const text = claim.claim.toLowerCase();
    const key = factKey.toLowerCase();
    // Detect optimistic claims about a failing/crashed key
    if (typeof factValue === "boolean" && factValue === false) {
      const optimistic = ["healthy", "running", "working", "ok", "available", "up", "success"];
      return key.split(/[._-]/).some((part) => text.includes(part)) &&
        optimistic.some((w) => text.includes(w));
    }
    return false;
  }
}
