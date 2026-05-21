/**
 * server/memory/contradiction/quarantine-store.ts
 *
 * QuarantineStore — holds references to contradicted/invalidated memory items.
 * Retrieval modules check here before returning any item.
 * Append-only. Items never leave quarantine once entered.
 * No EventLog dependency — stays lightweight and always-available.
 */

export type QuarantineEntry = {
  readonly targetId: string;
  readonly targetType: "fact" | "claim";
  readonly reason: string;
  readonly quarantinedAt: number;
  readonly contradictionId: string;
};

export class QuarantineStore {
  private readonly _entries = new Map<string, QuarantineEntry>();

  quarantine(entry: QuarantineEntry): void {
    if (!this._entries.has(entry.targetId)) {
      this._entries.set(entry.targetId, Object.freeze(entry));
    }
  }

  isQuarantined(targetId: string): boolean {
    return this._entries.has(targetId);
  }

  getEntry(targetId: string): QuarantineEntry | undefined {
    return this._entries.get(targetId);
  }

  listAll(): readonly QuarantineEntry[] {
    return Object.freeze([...this._entries.values()]);
  }

  listByType(targetType: "fact" | "claim"): readonly QuarantineEntry[] {
    return [...this._entries.values()].filter((e) => e.targetType === targetType);
  }

  get size(): number { return this._entries.size; }
}
