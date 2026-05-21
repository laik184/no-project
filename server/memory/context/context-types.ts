/**
 * server/memory/context/context-types.ts
 *
 * Context-specific type helpers and rendering utilities.
 * Converts memory items into human-readable context blocks for LLM injection.
 * No storage. No state. Pure transformation.
 */

import type { VerifiedFact, AgentClaim, ContextBlock, ContextBlockKind } from "../contracts/types.ts";

// ── Block construction helpers ────────────────────────────────────────────────

export function factToBlock(fact: VerifiedFact, checksum: string): ContextBlock {
  return Object.freeze({
    id:         fact.id,
    kind:       "VERIFIED_FACT" as ContextBlockKind,
    content:    renderFact(fact),
    sourceId:   fact.id,
    confidence: 1.0,
    verifiedAt: fact.verifiedAt,
    checksum,
  });
}

export function claimToBlock(claim: AgentClaim, checksum: string): ContextBlock {
  return Object.freeze({
    id:         claim.id,
    kind:       "UNVERIFIED_CLAIM" as ContextBlockKind,
    content:    renderClaim(claim),
    sourceId:   claim.id,
    confidence: claim.confidence,
    checksum,
  });
}

export function taskToBlock(description: string, id: string, checksum: string): ContextBlock {
  return Object.freeze({
    id,
    kind:       "TASK_CONTEXT" as ContextBlockKind,
    content:    `[TASK]: ${description}`,
    sourceId:   id,
    confidence: 1.0,
    checksum,
  });
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderFact(fact: VerifiedFact): string {
  const expires = fact.expiresAt
    ? ` (expires ${new Date(fact.expiresAt).toISOString()})`
    : "";
  return `[VERIFIED — ${fact.verifier}] ${fact.key}: ${JSON.stringify(fact.value)}${expires}`;
}

function renderClaim(claim: AgentClaim): string {
  const conf = Math.round(claim.confidence * 100);
  return `[CLAIM — UNVERIFIED | confidence=${conf}%] ${claim.claim}`;
}

export function renderContextBlocks(blocks: readonly ContextBlock[]): string {
  const sections: Record<ContextBlockKind, string[]> = {
    VERIFIED_FACT:        [],
    RUNTIME_OBSERVATION:  [],
    TASK_CONTEXT:         [],
    UNVERIFIED_CLAIM:     [],
  };

  for (const block of blocks) {
    sections[block.kind].push(block.content);
  }

  const parts: string[] = [];

  if (sections.VERIFIED_FACT.length > 0) {
    parts.push("=== VERIFIED FACTS ===\n" + sections.VERIFIED_FACT.join("\n"));
  }
  if (sections.RUNTIME_OBSERVATION.length > 0) {
    parts.push("=== RUNTIME OBSERVATIONS ===\n" + sections.RUNTIME_OBSERVATION.join("\n"));
  }
  if (sections.TASK_CONTEXT.length > 0) {
    parts.push("=== TASK CONTEXT ===\n" + sections.TASK_CONTEXT.join("\n"));
  }
  if (sections.UNVERIFIED_CLAIM.length > 0) {
    parts.push(
      "=== UNVERIFIED CLAIMS (DO NOT TREAT AS FACT) ===\n" +
      sections.UNVERIFIED_CLAIM.join("\n")
    );
  }

  return parts.join("\n\n");
}

// ── Provenance serialization ──────────────────────────────────────────────────

export function serializeProvenance(blocks: readonly ContextBlock[]): string {
  return blocks
    .map((b) => `${b.kind}:${b.sourceId}:${b.checksum.slice(0, 8)}`)
    .join("|");
}
