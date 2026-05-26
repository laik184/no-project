/** Shared memory types — moved here from deleted agents/memory/vector/ */

export type MemoryCategory =
  | "decision" | "progress" | "failure" | "architecture" | "run-summary"
  | "pattern"  | "success"  | "fact"    | "runtime";

export interface MemoryEntry {
  id:          string;
  projectId:   number;
  runId?:      string;
  content:     string;
  context?:    string;
  category:    MemoryCategory;
  embedding?:  number[];
  score:       number;
  usedCount:   number;
  lastUsedAt:  number;
  createdAt:   number;
  tags:        string[];
  hint?:       Record<string, unknown>;
}

export interface SearchOptions {
  query:       string;
  projectId:   number;
  topK?:       number;
  limit?:      number;
  minScore?:   number;
  threshold?:  number;
  categories?: MemoryCategory[];
  maxAgeMs?:   number;
}

export interface RankedMemory {
  memory:        MemoryEntry;
  similarity:    number;
  recencyScore:  number;
  usageScore:    number;
  finalScore:    number;
  relevanceNote: string;
}
