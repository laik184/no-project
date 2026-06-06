/**
 * server/memory/vector/vector-store.ts
 * In-memory vector store with JSON serialisation support.
 */

export interface VectorRecord {
  id:       string;
  vector:   number[];
  metadata: Record<string, unknown>;
}

export class VectorStore {
  private readonly records = new Map<string, VectorRecord>();

  add(id: string, vector: number[], metadata: Record<string, unknown> = {}): void {
    this.records.set(id, { id, vector, metadata });
  }

  get(id: string): VectorRecord | undefined {
    return this.records.get(id);
  }

  delete(id: string): boolean {
    return this.records.delete(id);
  }

  getAll(): VectorRecord[] {
    return Array.from(this.records.values());
  }

  has(id: string): boolean {
    return this.records.has(id);
  }

  size(): number {
    return this.records.size;
  }

  clear(): void {
    this.records.clear();
  }

  toJSON(): VectorRecord[] {
    return this.getAll();
  }

  loadFromJSON(records: VectorRecord[]): void {
    this.records.clear();
    for (const r of records) this.records.set(r.id, r);
  }
}

export const vectorStore = new VectorStore();
