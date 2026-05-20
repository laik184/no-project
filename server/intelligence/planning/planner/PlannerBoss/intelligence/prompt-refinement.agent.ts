import type { RefinedPrompt, UserGoal } from "../types.ts";

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "is", "it", "in", "on", "at",
  "to", "of", "for", "with", "by", "from", "as", "that", "this", "i",
  "we", "you", "me", "my", "our", "please", "can", "could", "would",
  "should", "need", "want", "make", "build", "add", "give", "show",
]);

const CONSTRAINT_PATTERNS: ReadonlyArray<RegExp> = [
  /\bno\s+\w+\b/gi,
  /\bwithout\s+\w+\b/gi,
  /\bmust\s+(not|avoid)\s+\w+\b/gi,
  /\bonly\s+use\s+\w+\b/gi,
  /\bdo\s+not\s+\w+\b/gi,
];

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractKeywords(normalized: string): readonly string[] {
  const words = normalized
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      unique.push(w);
    }
  }
  return Object.freeze(unique);
}

function extractConstraints(raw: string): readonly string[] {
  const found: string[] = [];
  for (const pattern of CONSTRAINT_PATTERNS) {
    const matches = raw.match(pattern) ?? [];
    found.push(...matches);
  }
  return Object.freeze([...new Set(found.map((c) => c.trim().toLowerCase()))]);
}

function inferIntent(keywords: readonly string[]): string {
  if (keywords.includes("generate") || keywords.includes("create") || keywords.includes("build")) {
    return "GENERATE";
  }
  if (keywords.includes("fix") || keywords.includes("debug") || keywords.includes("repair")) {
    return "FIX";
  }
  if (keywords.includes("analyze") || keywords.includes("review") || keywords.includes("audit")) {
    return "ANALYZE";
  }
  if (keywords.includes("refactor") || keywords.includes("optimize") || keywords.includes("improve")) {
    return "REFACTOR";
  }
  if (keywords.includes("deploy") || keywords.includes("publish") || keywords.includes("release")) {
    return "DEPLOY";
  }
  return "GENERAL";
}

function scoreAmbiguity(keywords: readonly string[], constraints: readonly string[]): number {
  if (keywords.length === 0) return 1.0;
  const base = Math.max(0, 1 - keywords.length * 0.08);
  const constraintBonus = constraints.length > 0 ? -0.1 : 0;
  return parseFloat(Math.min(1, Math.max(0, base + constraintBonus)).toFixed(2));
}

export function refinePrompt(goal: Readonly<UserGoal>): Readonly<RefinedPrompt> {
  const normalized = normalize(goal.rawInput);
  const keywords = extractKeywords(normalized);
  const constraints = extractConstraints(goal.rawInput);
  const intent = inferIntent(keywords);
  const ambiguityScore = scoreAmbiguity(keywords, constraints);

  return Object.freeze({
    normalized,
    keywords,
    constraints,
    intent,
    ambiguityScore,
  });
}
