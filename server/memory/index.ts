/**
 * server/memory/index.ts
 *
 * MemorySystem — composition root for the entire memory subsystem.
 *
 * Wires all modules together via explicit dependency injection.
 * No singletons. No global state. Every dependency is passed in.
 * Callers create one MemorySystem per namespace/scope — not one global instance.
 *
 * Public API surface:
 *   system.facts         → FactStore
 *   system.claims        → ClaimStore
 *   system.events        → EventLog
 *   system.retrieval     → RetrievalEngine
 *   system.promotion     → PromotionPipeline
 *   system.contradiction → ContradictionDetector
 *   system.expiration    → ExpirationEngine
 *   system.governance    → GovernanceLayer
 *   system.context       → ContextBuilder
 *   system.replayer      → EventReplayer
 *   system.audit         → AuditLogger
 */

import type { MemorySystemConfig } from "./contracts/types.ts";
import { ChecksumEngine }           from "./infrastructure/checksum.ts";
import { IdGenerator }              from "./infrastructure/id-generator.ts";
import { SystemClock, type Clock }  from "./infrastructure/clock.ts";
import { EventLog }                 from "./events/event-log.ts";
import { EventReplayer }            from "./events/event-replayer.ts";
import { FactStore }                from "./facts/fact-store.ts";
import { FactValidator }            from "./facts/fact-validator.ts";
import { FactIndex }                from "./facts/fact-index.ts";
import { ClaimStore }               from "./claims/claim-store.ts";
import { ClaimValidator }           from "./claims/claim-validator.ts";
import { ClaimIndex }               from "./claims/claim-index.ts";
import { TTLPolicy }                from "./expiration/ttl-policy.ts";
import { FreshnessScorer }          from "./expiration/freshness-scorer.ts";
import { ExpirationEngine }         from "./expiration/expiration-engine.ts";
import { QuarantineStore }          from "./contradiction/quarantine-store.ts";
import { ContradictionDetector }    from "./contradiction/contradiction-detector.ts";
import { EvidenceCollector }        from "./verification/evidence-collector.ts";
import { PromotionValidator }       from "./verification/promotion-validator.ts";
import { PromotionPipeline }        from "./verification/promotion-pipeline.ts";
import { RetrievalFilter }          from "./retrieval/retrieval-filter.ts";
import { RetrievalScorer }          from "./retrieval/retrieval-scorer.ts";
import { RetrievalEngine }          from "./retrieval/retrieval-engine.ts";
import { PolicyEngine }             from "./governance/policy-engine.ts";
import { AuditLogger }              from "./governance/audit-logger.ts";
import { GovernanceLayer }          from "./governance/governance-layer.ts";
import { ContextValidator }         from "./context/context-validator.ts";
import { ContextBuilder }           from "./context/context-builder.ts";

export type { MemorySystemConfig } from "./contracts/types.ts";
export type { VerifiedFact, AgentClaim, Evidence, MemoryEvent, MemoryEventEnvelope,
              PromotionRequest, PromotionResult, RetrievalQuery, RetrievalResult,
              ContextBlock, ContextRequest, GovernanceViolation } from "./contracts/types.ts";
export type { BuiltContext }    from "./context/context-builder.ts";
export type { PromoteOptions }  from "./verification/promotion-pipeline.ts";
export type { EvidenceInput }   from "./verification/evidence-collector.ts";
export type { SweepReport }     from "./expiration/expiration-engine.ts";

export class MemorySystem {
  readonly facts:          FactStore;
  readonly claims:         ClaimStore;
  readonly events:         EventLog;
  readonly retrieval:      RetrievalEngine;
  readonly promotion:      PromotionPipeline;
  readonly contradiction:  ContradictionDetector;
  readonly expiration:     ExpirationEngine;
  readonly governance:     GovernanceLayer;
  readonly context:        ContextBuilder;
  readonly replayer:       EventReplayer;
  readonly audit:          AuditLogger;
  readonly evidence:       EvidenceCollector;
  readonly claimValidator: ClaimValidator;

  private readonly _ids:        IdGenerator;
  private readonly _quarantine: QuarantineStore;

  constructor(config?: MemorySystemConfig, clock?: Clock) {
    const _clock      = clock ?? new SystemClock();
    const _checksum   = new ChecksumEngine();
    const _ids        = new IdGenerator();
    const _ttl        = new TTLPolicy(config);
    this._ids         = _ids;

    // ── Event log (foundation) ────────────────────────────────────────────────
    this.events   = new EventLog(_ids, _checksum, _clock);
    this.replayer = new EventReplayer();

    // ── Stores ────────────────────────────────────────────────────────────────
    this.facts  = new FactStore(this.events, _checksum, _clock);
    this.claims = new ClaimStore(this.events, _checksum, _clock, _ttl);

    // ── Indexes ───────────────────────────────────────────────────────────────
    const factIndex  = new FactIndex(this.facts);
    const claimIndex = new ClaimIndex(this.claims);

    // ── Expiration & quarantine ───────────────────────────────────────────────
    const quarantine   = new QuarantineStore();
    this._quarantine   = quarantine;
    this.expiration    = new ExpirationEngine(this.facts, this.claims, _ttl, this.events, _clock);

    // ── Contradiction ─────────────────────────────────────────────────────────
    this.contradiction = new ContradictionDetector(
      this.facts, this.claims, quarantine, this.events, _ids, _clock
    );

    // ── Verification & promotion ──────────────────────────────────────────────
    this.evidence      = new EvidenceCollector(_checksum, _ids, _clock);
    const factValidator = new FactValidator(_checksum, config?.minPromotionEvidence ?? 1);
    this.claimValidator = new ClaimValidator(_checksum);
    const promoValidator = new PromotionValidator(factValidator, _clock);
    this.promotion     = new PromotionPipeline(
      this.claims, this.facts, this.evidence, promoValidator,
      this.contradiction, this.events, _ids, _clock, _ttl
    );

    // ── Retrieval ─────────────────────────────────────────────────────────────
    const freshness      = new FreshnessScorer(_clock, _ttl);
    const filter         = new RetrievalFilter(quarantine, _ttl, _clock);
    const scorer         = new RetrievalScorer(freshness);
    this.retrieval       = new RetrievalEngine(
      this.facts, this.claims, factIndex, claimIndex, filter, scorer, _clock
    );

    // ── Governance ────────────────────────────────────────────────────────────
    const policy    = new PolicyEngine(config);
    this.audit      = new AuditLogger(this.events, _ids, _clock);
    this.governance = new GovernanceLayer(this.facts, this.claims, policy, this.audit, _clock);

    // ── Context ───────────────────────────────────────────────────────────────
    const ctxValidator = new ContextValidator(_checksum);
    this.context       = new ContextBuilder(this.retrieval, ctxValidator, _checksum, _ids, _clock);
  }

  /** Convenience: start background expiration sweep. Returns stop fn. */
  startExpiration(intervalMs = 60_000): () => void {
    return this.expiration.start(intervalMs);
  }

  /** Convenience: run a full integrity check on the event log. */
  verifyIntegrity(): { valid: boolean; totalEvents: number } {
    const result = this.events.verifyIntegrity();
    return { valid: result.valid, totalEvents: this.events.length };
  }

  /** Generate a prefixed ID using the system ID generator. */
  generateId(prefix?: import("./infrastructure/id-generator.ts").IdPrefix): string {
    return this._ids.generate(prefix);
  }

  /** Number of quarantined (contradicted/invalidated) items. */
  get quarantineSize(): number { return this._quarantine.size; }
}
