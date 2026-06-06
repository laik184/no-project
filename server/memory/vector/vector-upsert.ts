/**
 * server/memory/vector/vector-upsert.ts
 * Upsert and delete operations on the shared VectorStore.
 */

import { vectorStore } from './vector-store.ts';

export interface UpsertInput {
  id:       string;
  vector:   number[];
  metadata: Record<string, unknown>;
}

export function upsertVector(input: UpsertInput): void {
  vectorStore.add(input.id, input.vector, input.metadata);
}

export function deleteVector(id: string): boolean {
  return vectorStore.delete(id);
}
