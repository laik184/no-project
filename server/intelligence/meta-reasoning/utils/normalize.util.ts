import type { MetaReasoningInput } from "../types";

export function normalizeInput(raw: MetaReasoningInput): MetaReasoningInput {
  return {
    decision: (raw.decision ?? "").trim().slice(0, 2000),
    context: (raw.context ?? "").trim().slice(0, 2000),
    outcome: (raw.outcome ?? "").trim().slice(0, 2000),
  };
}

export function normalizeScore(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
}

export function normalizeFlawList(flaws: string[]): string[] {
  return flaws
    .map((f) => f.trim())
    .filter((f) => f.length > 0)
    .map((f) => f.charAt(0).toUpperCase() + f.slice(1));
}

export function normalizeAlternativeList(alts: string[]): string[] {
  return alts
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
    .slice(0, 5);
}

export function normalizeSuggestion(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "No specific improvement identified.";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
