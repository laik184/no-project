/**
 * Responsibility: Builds and validates memory write transactions — generates
 *                 versioned, checksummed transaction envelopes.
 * Dependencies: none
 * Failure: build() throws on invalid payload; validate() returns error string.
 * Telemetry: none — pure data layer.
 */

import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import type { MemoryTransaction } from "./types/index.ts";

class MemoryTransactionBuilder {
  build(
    projectId:   number,
    runId:       string,
    key:         string,
    payload:     unknown,
    prevVersion: number,
  ): MemoryTransaction {
    const nextVersion = prevVersion + 1;
    const serialized  = JSON.stringify(payload);
    const checksum    = createHash("sha256").update(serialized).digest("hex").slice(0, 16);

    return {
      id:          uuidv4(),
      projectId,
      runId,
      key,
      prevVersion,
      nextVersion,
      checksum,
      payload,
      enqueuedAt:  Date.now(),
      status:      "pending",
    };
  }

  validate(tx: MemoryTransaction): string | null {
    if (!tx.id)                 return "id is required";
    if (tx.projectId < 0)       return "projectId must be non-negative";
    if (!tx.runId?.trim())      return "runId is required";
    if (!tx.key?.trim())        return "key is required";
    if (tx.prevVersion < 0)     return "prevVersion must be non-negative";
    if (tx.nextVersion <= tx.prevVersion) return "nextVersion must be > prevVersion";
    if (!tx.checksum)           return "checksum is required";
    if (tx.payload === undefined) return "payload is required";
    return null;
  }

  verifyChecksum(tx: MemoryTransaction): boolean {
    const expected = createHash("sha256")
      .update(JSON.stringify(tx.payload))
      .digest("hex")
      .slice(0, 16);
    return expected === tx.checksum;
  }
}

export const memoryTransactionBuilder = new MemoryTransactionBuilder();
