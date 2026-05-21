/**
 * server/memory/events/event-log.ts
 *
 * EventLog — append-only, hash-chained memory event store.
 * Every write produces a tamper-evident envelope.
 * Integrity can be verified in O(n). State can be replayed from scratch.
 * No external dependencies. Inject via DI — never instantiate globally.
 */

import type { MemoryEvent, MemoryEventEnvelope, MemoryEventKind } from "../contracts/types.ts";
import type { ChecksumEngine } from "../infrastructure/checksum.ts";
import type { IdGenerator } from "../infrastructure/id-generator.ts";
import type { Clock } from "../infrastructure/clock.ts";
import { GENESIS_HASH } from "../infrastructure/checksum.ts";

export class EventLog {
  private readonly _entries: MemoryEventEnvelope[] = [];
  private _seq = 0;

  constructor(
    private readonly _ids: IdGenerator,
    private readonly _checksum: ChecksumEngine,
    private readonly _clock: Clock,
  ) {}

  append(payload: MemoryEvent): MemoryEventEnvelope {
    const previous = this._entries[this._entries.length - 1];
    const previousHash = previous?.hash ?? GENESIS_HASH;
    const id        = this._ids.generate("evnt");
    const timestamp = this._clock.now();
    const sequenceNo = ++this._seq;

    const envelope: MemoryEventEnvelope = Object.freeze({
      id,
      sequenceNo,
      timestamp,
      previousHash,
      hash: this._checksum.chain(previousHash, { id, sequenceNo, timestamp, payload }),
      payload,
    });

    this._entries.push(envelope);
    return envelope;
  }

  /** Returns ALL events in insertion order. */
  getAll(): readonly MemoryEventEnvelope[] {
    return Object.freeze([...this._entries]);
  }

  /** Returns events with sequenceNo > after (exclusive). */
  getSince(afterSeq: number): readonly MemoryEventEnvelope[] {
    return this._entries.filter((e) => e.sequenceNo > afterSeq);
  }

  /** Returns events matching the given kind(s). */
  filter(...kinds: MemoryEventKind[]): readonly MemoryEventEnvelope[] {
    const set = new Set<string>(kinds);
    return this._entries.filter((e) => set.has(e.payload.kind));
  }

  /** Returns the last N events. */
  tail(n: number): readonly MemoryEventEnvelope[] {
    return this._entries.slice(-n);
  }

  get length(): number { return this._entries.length; }
  get latestSeq(): number { return this._seq; }

  /**
   * Verifies the full hash chain.
   * Returns { valid: true } or { valid: false, brokenAt: sequenceNo }.
   */
  verifyIntegrity(): { valid: true } | { valid: false; brokenAt: number } {
    let expectedPrev = GENESIS_HASH;

    for (const envelope of this._entries) {
      if (envelope.previousHash !== expectedPrev) {
        return { valid: false, brokenAt: envelope.sequenceNo };
      }
      const expectedHash = this._checksum.chain(envelope.previousHash, {
        id: envelope.id,
        sequenceNo: envelope.sequenceNo,
        timestamp: envelope.timestamp,
        payload: envelope.payload,
      });
      if (envelope.hash !== expectedHash) {
        return { valid: false, brokenAt: envelope.sequenceNo };
      }
      expectedPrev = envelope.hash;
    }
    return { valid: true };
  }
}
