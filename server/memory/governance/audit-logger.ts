/**
 * server/memory/governance/audit-logger.ts
 *
 * AuditLogger — records governance decisions and violations to the EventLog.
 * Thin wrapper around EventLog that emits GOVERNANCE_VIOLATION events.
 * Does NOT make policy decisions — only records them.
 */

import type { GovernanceViolation, GovernanceViolationType, Namespace } from "../contracts/types.ts";
import type { EventLog } from "../events/event-log.ts";
import type { IdGenerator } from "../infrastructure/id-generator.ts";
import type { Clock } from "../infrastructure/clock.ts";
import { governanceViolationEvent } from "../events/event-types.ts";

export class AuditLogger {
  private readonly _violations: GovernanceViolation[] = [];

  constructor(
    private readonly _events: EventLog,
    private readonly _ids: IdGenerator,
    private readonly _clock: Clock,
  ) {}

  recordViolation(
    type: GovernanceViolationType,
    targetId: string,
    namespace: Namespace,
    detail: string,
    blocked: boolean,
  ): GovernanceViolation {
    const violation: GovernanceViolation = Object.freeze({
      id:          this._ids.generate("gov"),
      type,
      targetId,
      namespace,
      detectedAt:  this._clock.now(),
      detail,
      blocked,
    });

    this._violations.push(violation);
    this._events.append(governanceViolationEvent(type, targetId, detail));
    return violation;
  }

  listViolations(namespace?: Namespace): readonly GovernanceViolation[] {
    if (!namespace) return Object.freeze([...this._violations]);
    return this._violations.filter((v) => v.namespace === namespace);
  }

  listByType(type: GovernanceViolationType): readonly GovernanceViolation[] {
    return this._violations.filter((v) => v.type === type);
  }

  violationCount(namespace?: Namespace): number {
    return this.listViolations(namespace).length;
  }

  blockedCount(namespace?: Namespace): number {
    return this.listViolations(namespace).filter((v) => v.blocked).length;
  }
}
