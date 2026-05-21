/**
 * server/memory/context/context-builder.ts
 *
 * ContextBuilder — deterministic, provenance-tracked context assembly.
 *
 * Assembly priority (spec §8):
 *   1. VERIFIED_FACTS
 *   2. RECENT_RUNTIME_OBSERVATIONS (from facts with runtime verifiers)
 *   3. ACTIVE_TASK_CONTEXT
 *   4. UNVERIFIED_CLAIMS (explicitly labeled [CLAIM — UNVERIFIED])
 *
 * Every injected block is:
 *   - Checksummed at assembly time
 *   - Tagged with provenance (sourceId + kind)
 *   - Validated before output
 *
 * INVARIANT: contradicted/expired items NEVER appear in context.
 * INVARIANT: unverified claims are ALWAYS labeled.
 */

import type { ContextBlock, ContextRequest } from "../contracts/types.ts";
import type { RetrievalEngine } from "../retrieval/retrieval-engine.ts";
import type { ContextValidator } from "./context-validator.ts";
import type { ChecksumEngine } from "../infrastructure/checksum.ts";
import type { IdGenerator } from "../infrastructure/id-generator.ts";
import type { Clock } from "../infrastructure/clock.ts";
import {
  factToBlock, claimToBlock, taskToBlock,
  renderContextBlocks, serializeProvenance,
} from "./context-types.ts";

export type BuiltContext = {
  readonly blocks:      readonly ContextBlock[];
  readonly rendered:    string;
  readonly provenance:  string;
  readonly valid:       boolean;
  readonly warnings:    readonly string[];
  readonly builtAt:     number;
};

const RUNTIME_VERIFIERS = ["http-health-check", "tsc-process-runner", "filesystem-check", "process-monitor"];
const DEFAULT_MAX_BLOCKS = 30;

export class ContextBuilder {
  constructor(
    private readonly _retrieval:  RetrievalEngine,
    private readonly _validator:  ContextValidator,
    private readonly _checksum:   ChecksumEngine,
    private readonly _ids:        IdGenerator,
    private readonly _clock:      Clock,
  ) {}

  build(request: ContextRequest): BuiltContext {
    const maxBlocks = request.maxBlocks ?? DEFAULT_MAX_BLOCKS;
    const blocks: ContextBlock[] = [];

    // ── 1. Verified facts ─────────────────────────────────────────────────────
    const factResult = this._retrieval.retrieve({ namespace: request.namespace, limit: Math.ceil(maxBlocks * 0.5) });
    for (const { item } of factResult.facts) {
      if (RUNTIME_VERIFIERS.includes(item.verifier)) continue; // defer to section 2
      const checksum = this._checksum.compute({ content: this._renderFactContent(item), sourceId: item.id, kind: "VERIFIED_FACT" });
      blocks.push(factToBlock(item, checksum));
    }

    // ── 2. Runtime observations (facts from runtime verifiers) ────────────────
    for (const { item } of factResult.facts) {
      if (!RUNTIME_VERIFIERS.includes(item.verifier)) continue;
      const checksum = this._checksum.compute({ content: this._renderFactContent(item), sourceId: item.id, kind: "VERIFIED_FACT" });
      blocks.push({ ...factToBlock(item, checksum), kind: "RUNTIME_OBSERVATION" });
    }

    // ── 3. Task context ───────────────────────────────────────────────────────
    if (request.taskDescription) {
      const taskId = this._ids.generate("ctx");
      const content = `[TASK]: ${request.taskDescription}`;
      const checksum = this._checksum.compute({ content, sourceId: taskId, kind: "TASK_CONTEXT" });
      blocks.push(taskToBlock(request.taskDescription, taskId, checksum));
    }

    // ── 4. Unverified claims (only if requested + labeled) ────────────────────
    if (request.includeUnverified !== false) {
      const claimResult = this._retrieval.retrieveTopClaims(request.namespace, Math.floor(maxBlocks * 0.2));
      for (const { item } of claimResult.claims) {
        const content = `[CLAIM — UNVERIFIED | confidence=${Math.round(item.confidence * 100)}%] ${item.claim}`;
        const checksum = this._checksum.compute({ content, sourceId: item.id, kind: "UNVERIFIED_CLAIM" });
        blocks.push(claimToBlock(item, checksum));
      }
    }

    const trimmed = blocks.slice(0, maxBlocks);
    const report  = this._validator.validate(trimmed);
    const validBlocks = trimmed.filter((b) => !report.invalidBlocks.includes(b.id));

    return Object.freeze({
      blocks:     Object.freeze(validBlocks),
      rendered:   renderContextBlocks(validBlocks),
      provenance: serializeProvenance(validBlocks),
      valid:      report.valid,
      warnings:   report.warnings,
      builtAt:    this._clock.now(),
    });
  }

  private _renderFactContent(item: { key: string; value: unknown; verifier: string; expiresAt?: number }): string {
    const expires = item.expiresAt ? ` (expires ${new Date(item.expiresAt).toISOString()})` : "";
    return `[VERIFIED — ${item.verifier}] ${item.key}: ${JSON.stringify(item.value)}${expires}`;
  }
}
