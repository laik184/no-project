/**
 * complexity-scorer.ts
 *
 * LLM-backed complexity scoring that replaces heuristic needsPlanning().
 * Falls back to deterministic scoring if LLM is unavailable.
 */

import { analyzeGoal }     from "./task-analyzer.ts";
import { detectDependencies } from "./dependency-detector.ts";
import { estimateRisk }    from "./risk-estimator.ts";
import type {
  ComplexityScore, ExecutionMode, GoalAnalysis, PlanningResult,
} from "./planning-types.ts";

const LLM_BASE_URL = process.env.LLM_BASE_URL
  ?? process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL
  ?? "https://openrouter.ai/api/v1";
const API_KEY      = () =>
  process.env.OPENROUTER_API_KEY ?? process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ?? "";
const SCORE_MODEL  = process.env.COMPLEXITY_SCORE_MODEL
  ?? process.env.LLM_MODEL
  ?? "openai/gpt-4o-mini";

// ── Deterministic fallback ────────────────────────────────────────────────────

function deterministicScore(analysis: GoalAnalysis): ComplexityScore {
  const base = Math.min(1.0,
    (analysis.wordCount / 60) * 0.25 +
    (analysis.components.length / 5) * 0.35 +
    (analysis.actionVerbs.length / 6) * 0.20 +
    (analysis.estimatedFiles / 15) * 0.20,
  );

  const suggestedMode: ExecutionMode =
    base < 0.25 ? "direct"
    : base < 0.50 ? "planned"
    : base < 0.75 ? "pipeline"
    : "multi-agent";

  return {
    score:          base,
    confidence:     0.65,
    suggestedMode,
    estimatedSteps: Math.max(1, Math.round(base * 20)),
    reasoning:      `Deterministic: ${analysis.components.length} components, ${analysis.wordCount} words`,
    factors: {
      wordCount:       analysis.wordCount / 60,
      componentCount:  analysis.components.length / 5,
      actionVerbCount: analysis.actionVerbs.length / 6,
      fileEstimate:    analysis.estimatedFiles / 15,
    },
  };
}

// ── LLM scorer ────────────────────────────────────────────────────────────────

async function llmScore(goal: string, analysis: GoalAnalysis): Promise<ComplexityScore> {
  const systemPrompt = `You are a software task complexity analyzer.
Given a goal, return JSON only with:
{
  "score": <0.0–1.0>,
  "confidence": <0.0–1.0>,
  "suggestedMode": <"direct"|"planned"|"pipeline"|"multi-agent">,
  "estimatedSteps": <integer>,
  "reasoning": "<1 sentence>",
  "factors": { "scope": <0–1>, "dependencies": <0–1>, "risk": <0–1>, "ambiguity": <0–1> }
}
Rules: score < 0.25 → direct, 0.25–0.5 → planned, 0.5–0.75 → pipeline, > 0.75 → multi-agent.`;

  const userPrompt = `Goal: "${goal}"
Components detected: ${analysis.components.map(c => c.type).join(", ") || "none"}
Word count: ${analysis.wordCount}
Action verbs: ${analysis.actionVerbs.join(", ")}`;

  const key = API_KEY();
  if (!key) throw new Error("No API key");

  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: SCORE_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.0,
      max_tokens:  256,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw  = json.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as ComplexityScore;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function scoreComplexity(goal: string): Promise<PlanningResult> {
  const analysis = analyzeGoal(goal);
  const deps     = detectDependencies(analysis.components);
  const risk     = estimateRisk(analysis);

  let complexity: ComplexityScore;
  try {
    complexity = await llmScore(goal, analysis);
  } catch {
    complexity = deterministicScore(analysis);
  }

  return {
    analysis,
    complexity,
    risk,
    dependencies:        deps,
    executionMode:       complexity.suggestedMode,
    shouldUseMultiAgent: complexity.suggestedMode === "multi-agent",
    shouldUsePlanner:    complexity.score >= 0.25,
  };
}

/** Drop-in replacement for old heuristic needsPlanning(). */
export async function needsPlanning(goal: string): Promise<boolean> {
  try {
    const result = await scoreComplexity(goal);
    return result.shouldUsePlanner;
  } catch {
    return goal.split(/\s+/).length > 15;
  }
}
