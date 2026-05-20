/**
 * hallucination-detector.ts
 *
 * Detects three classes of hallucination:
 * 1. Repetition loops — agent repeating the same output
 * 2. Ungrounded claims — assertions without evidence in context
 * 3. Tool fabrication — invoking tools with invented arguments
 */

import type { AgentRole, HallucinationReport } from "./supervisor-types.ts";

// ── Repetition detector ────────────────────────────────────────────────────────

const SIMILARITY_THRESHOLD = 0.85;

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 300);
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(" "));
  const setB = new Set(b.split(" "));
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function detectRepetition(outputs: string[]): {
  isRepeating: boolean;
  repeatCount: number;
  repeatedPair?: [number, number];
} {
  if (outputs.length < 2) return { isRepeating: false, repeatCount: 0 };

  const recent = outputs.slice(-5).map(normalizeText);

  for (let i = 0; i < recent.length; i++) {
    for (let j = i + 1; j < recent.length; j++) {
      const sim = jaccardSimilarity(recent[i], recent[j]);
      if (sim >= SIMILARITY_THRESHOLD) {
        return {
          isRepeating:  true,
          repeatCount:  outputs.length - i,
          repeatedPair: [i, j],
        };
      }
    }
  }

  return { isRepeating: false, repeatCount: 0 };
}

// ── Ungrounded claim detector ─────────────────────────────────────────────────

const UNGROUNDED_PATTERNS: RegExp[] = [
  /the (database|server|file|api) (is|was) (successfully|already|now)/i,
  /i have (created|written|fixed|deployed|installed)/i,
  /everything (is|works|should work) (now|fine|correctly)/i,
  /the (error|bug|issue) (has been|is) (fixed|resolved)/i,
  /it (is|should be) working (now|correctly)/i,
  /i (already|just) (ran|executed|installed|wrote)/i,
];

const EVIDENCE_MARKERS = [
  /output:|result:|log:|✓|✗|error:|warning:|→|←/i,
  /\d+\.\d+\.\d+/,  // version numbers = evidence
  /\d{3,}/,         // large numbers suggest real data
];

export function detectUngroundedClaims(output: string): string[] {
  const claims: string[] = [];

  for (const pattern of UNGROUNDED_PATTERNS) {
    const match = output.match(pattern);
    if (!match) continue;

    // Check if there's supporting evidence nearby
    const surroundingText = output.slice(
      Math.max(0, output.indexOf(match[0]) - 200),
      output.indexOf(match[0]) + 200,
    );

    const hasEvidence = EVIDENCE_MARKERS.some(m => m.test(surroundingText));
    if (!hasEvidence) {
      claims.push(match[0].slice(0, 80));
    }
  }

  return [...new Set(claims)];
}

// ── Tool fabrication detector ─────────────────────────────────────────────────

export function detectToolFabrication(
  toolCalls: Array<{ name: string; arguments: string }>,
  allowedTools: string[],
): string[] {
  const fabricated: string[] = [];
  for (const call of toolCalls) {
    if (!allowedTools.includes(call.name)) {
      fabricated.push(`Attempted to call unauthorized tool: "${call.name}"`);
    }
    // Check for obviously invented file paths
    try {
      const args = JSON.parse(call.arguments);
      if (args.path && typeof args.path === "string") {
        if (args.path.includes("{{") || args.path.includes("<example>")) {
          fabricated.push(`Fabricated path in tool call "${call.name}": ${args.path}`);
        }
      }
    } catch { /* ignore parse errors */ }
  }
  return fabricated;
}

// ── Aggregated report ─────────────────────────────────────────────────────────

export function buildHallucinationReport(
  agentRole:    AgentRole,
  outputs:      string[],
  latestOutput: string,
  toolCalls:    Array<{ name: string; arguments: string }>,
  allowedTools: string[],
): HallucinationReport {
  const repetition   = detectRepetition(outputs);
  const ungrounded   = detectUngroundedClaims(latestOutput);
  const fabricated   = detectToolFabrication(toolCalls, allowedTools);

  const allClaims    = [...ungrounded, ...fabricated];
  const confidence   = 1.0 - Math.min(0.9,
    (repetition.isRepeating ? 0.4 : 0) +
    (ungrounded.length * 0.1)          +
    (fabricated.length * 0.2),
  );

  const recommendation: HallucinationReport["recommendation"] =
    repetition.repeatCount >= 3 || fabricated.length > 0 ? "halt"
    : ungrounded.length >= 2                              ? "inject-warning"
    : "continue";

  return {
    agentRole,
    isRepeating:      repetition.isRepeating,
    repeatCount:      repetition.repeatCount,
    ungroundedClaims: allClaims,
    confidence,
    recommendation,
  };
}
