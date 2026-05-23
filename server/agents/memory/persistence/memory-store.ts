/**
 * memory-store.ts — canonical re-export barrel.
 *
 * Import from here for a single stable import path.
 *
 * Split into bounded contexts:
 *   memory-store-core.ts      — ensureMemoryDir + context.md + architecture.md
 *   memory-store-json.ts      — run-history.jsonl + decisions.json + failures.json
 *   memory-store-markdown.ts  — progress.md + decisions.md + failed-attempts.md
 */

export * from "./memory-store-core.ts";
export * from "./memory-store-json.ts";
export * from "./memory-store-markdown.ts";
