/**
 * server/agents/memory/vector/vector-types.ts — STUB
 */

export type MemoryCategory = "decision" | "progress" | "failure" | "architecture" | "run-summary";

export interface MemoryEntry {
  id:         string;
  projectId:  number;
  runId?:     string;
  content:    string;
  category:   MemoryCategory;
  embedding?: number[];
  createdAt:  number;
  hint?:      Record<string, unknown>;
}

export interface SearchOptions {
  query:      string;
  projectId:  number;
  limit?:     number;
  threshold?: number;
}

export interface RankedMemory extends MemoryEntry {
  score:   number;
  matched: boolean;
}
