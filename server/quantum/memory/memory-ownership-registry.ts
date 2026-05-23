/**
 * memory-ownership-registry.ts
 *
 * Tracks and validates write ownership for every memory lane and file path.
 *
 * Single responsibility: issue, verify, and revoke ownership tokens.
 *
 * Ownership model:
 *   - Every write request must claim ownership before the policy engine passes it.
 *   - Ownership is scoped to (ownerId, runId, filePath, queueKey).
 *   - Tokens expire after a configurable TTL.
 *   - "system" runId is always allowed (for startup/admin writes).
 */

import { v4 as uuid } from "uuid";
import type { QueueKey } from "./memory-types.ts";
import type { OwnershipToken, OwnershipClaim } from "./queue.types.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_TOKEN_TTL_MS = 5 * 60 * 1_000;   // 5 minutes
const SYSTEM_OWNER_IDS     = new Set(["system", "memory-store", "orchestration", "agent-runner"]);

// ── Verification result ───────────────────────────────────────────────────────

export interface OwnershipVerification {
  valid:  boolean;
  reason: string;
}

// ── Registry ──────────────────────────────────────────────────────────────────

class MemoryOwnershipRegistry {
  /** token key = `${ownerId}::${runId}::${filePath}::${queueKey}` */
  private readonly _tokens = new Map<string, OwnershipToken>();

  // ── Claim ─────────────────────────────────────────────────────────────────

  /**
   * Claim write ownership. Returns the issued token.
   * Callers should call this before enqueuing a write.
   */
  claim(input: OwnershipClaim): OwnershipToken {
    const tokenId  = uuid();
    const issuedAt = Date.now();
    const token: OwnershipToken = {
      tokenId,
      ownerId:   input.ownerId,
      runId:     input.runId,
      filePath:  input.filePath,
      queueKey:  input.queueKey,
      issuedAt,
      expiresAt: issuedAt + (input.ttlMs ?? DEFAULT_TOKEN_TTL_MS),
    };

    this._tokens.set(this._key(input.ownerId, input.runId, input.filePath, input.queueKey), token);
    return token;
  }

  // ── Verify ────────────────────────────────────────────────────────────────

  /**
   * Verify that (ownerId, runId) have a valid ownership token for filePath + queueKey.
   * System-level owners bypass token requirement.
   */
  verify(
    ownerId:  string,
    runId:    string,
    filePath: string,
    queueKey: QueueKey,
  ): OwnershipVerification {
    // System owners are always trusted
    if (runId === "system" || SYSTEM_OWNER_IDS.has(ownerId)) {
      return { valid: true, reason: "system owner — bypass allowed" };
    }

    const token = this._tokens.get(this._key(ownerId, runId, filePath, queueKey));

    if (!token) {
      return {
        valid:  false,
        reason: `No ownership token for ownerId="${ownerId}" runId="${runId}" file="${filePath}"`,
      };
    }

    if (Date.now() > token.expiresAt) {
      this._tokens.delete(this._key(ownerId, runId, filePath, queueKey));
      return { valid: false, reason: `Ownership token expired for ownerId="${ownerId}"` };
    }

    return { valid: true, reason: "valid ownership token" };
  }

  // ── Revoke ────────────────────────────────────────────────────────────────

  revoke(ownerId: string, runId: string, filePath: string, queueKey: QueueKey): void {
    this._tokens.delete(this._key(ownerId, runId, filePath, queueKey));
  }

  /** Revoke all tokens for a completed or failed run. */
  revokeRun(runId: string): number {
    let count = 0;
    for (const [key, token] of this._tokens) {
      if (token.runId === runId) {
        this._tokens.delete(key);
        count++;
      }
    }
    return count;
  }

  // ── Expired cleanup ───────────────────────────────────────────────────────

  sweepExpired(): number {
    const now = Date.now();
    let   swept = 0;
    for (const [key, token] of this._tokens) {
      if (now > token.expiresAt) {
        this._tokens.delete(key);
        swept++;
      }
    }
    return swept;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  activeCount(): number { return this._tokens.size; }

  // ── Private ───────────────────────────────────────────────────────────────

  private _key(
    ownerId:  string,
    runId:    string,
    filePath: string,
    queueKey: QueueKey,
  ): string {
    return `${ownerId}::${runId}::${filePath}::${queueKey}`;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const memoryOwnershipRegistry = new MemoryOwnershipRegistry();
