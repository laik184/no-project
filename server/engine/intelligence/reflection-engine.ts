/**
 * reflection-engine.ts
 *
 * Phase 6: Post-execution reflection.
 * Analyzes run outcomes, scores strategies, and generates lessons.
 * Output feeds into the memory engine and affects future planning.
 */

const BASE_URL = process.env.LLM_BASE_URL
  ?? process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL
  ?? "https://openrouter.ai/api/v1";
const API_KEY  = () =>
  process.env.OPENROUTER_API_KEY ?? process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ?? "";
const MODEL    = process.env.REFLECT_MODEL ?? process.env.LLM_MODEL ?? "openai/gpt-4o-mini";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OutcomeType = "success" | "partial" | "failure" | "timeout" | "blocked";

export interface RunContext {
  goal:        string;
  outcome:     OutcomeType;
  agentsUsed:  string[];
  steps:       number;
  durationMs:  number;
  errors:      string[];
  keyActions:  string[];
  confidence:  number;
  projectId:   number;
  runId:       string;
}

export interface ReflectionResult {
  lessons:          string[];        // generalizable learnings
  whatWorked:       string[];        // successful sub-strategies
  whatFailed:       string[];        // failed sub-strategies
  rootCause?:       string;          // for failures
  nextStrategy:     string;          // recommendation for next attempt
  shouldRetry:      boolean;
  retryModification?: string;        // what to change on retry
  memoryEntries:    string[];        // entries to store in memory
  score:            number;          // 0.0–1.0 execution quality score
  confidence:       number;          // confidence in the reflection itself
}

// ── Deterministic reflection (no LLM) ────────────────────────────────────────

function deterministicReflect(ctx: RunContext): ReflectionResult {
  const isSuccess = ctx.outcome === "success";
  const lessons   = isSuccess
    ? [`Goal completed: "${ctx.goal.slice(0, 60)}" in ${ctx.steps} steps`]
    : [`Goal failed: "${ctx.goal.slice(0, 60)}" after ${ctx.steps} steps`];

  const rootCause = ctx.errors.length > 0
    ? `Primary error: ${ctx.errors[0].slice(0, 100)}`
    : undefined;

  const score = isSuccess ? ctx.confidence
    : Math.max(0, ctx.confidence - 0.3);

  const shouldRetry = !isSuccess && ctx.errors.length > 0
    && !ctx.errors.some(e => /syntax|permission|not found/i.test(e));

  return {
    lessons,
    whatWorked:        ctx.keyActions.filter(a => isSuccess),
    whatFailed:        ctx.errors.slice(0, 3),
    rootCause,
    nextStrategy:      isSuccess ? "Continue with current approach" : "Fix errors and retry",
    shouldRetry,
    retryModification: shouldRetry ? "Address root cause before retrying" : undefined,
    memoryEntries:     lessons,
    score,
    confidence:        0.65,
  };
}

// ── LLM reflection ────────────────────────────────────────────────────────────

async function llmReflect(ctx: RunContext): Promise<ReflectionResult> {
  const prompt = `You are an AI execution analyst. Reflect on this run and return JSON only.

Run data:
- Goal: "${ctx.goal}"
- Outcome: ${ctx.outcome}
- Steps: ${ctx.steps}
- Duration: ${(ctx.durationMs / 1000).toFixed(1)}s
- Agents: ${ctx.agentsUsed.join(", ")}
- Confidence: ${ctx.confidence}
- Key actions: ${ctx.keyActions.slice(0, 5).join("; ")}
- Errors: ${ctx.errors.slice(0, 3).join("; ")}

Return JSON:
{
  "lessons": ["<generalizable lesson>"],
  "whatWorked": ["<what succeeded>"],
  "whatFailed": ["<what failed>"],
  "rootCause": "<primary failure reason or null>",
  "nextStrategy": "<recommendation>",
  "shouldRetry": <true|false>,
  "retryModification": "<what to change or null>",
  "score": <0.0-1.0>,
  "confidence": <0.0-1.0>
}`;

  const key = API_KEY();
  if (!key) throw new Error("No API key");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens:  512,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw  = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<ReflectionResult>;

  return {
    lessons:           parsed.lessons       ?? [],
    whatWorked:        parsed.whatWorked    ?? [],
    whatFailed:        parsed.whatFailed    ?? [],
    rootCause:         parsed.rootCause,
    nextStrategy:      parsed.nextStrategy  ?? "Continue",
    shouldRetry:       parsed.shouldRetry   ?? false,
    retryModification: parsed.retryModification,
    memoryEntries:     (parsed.lessons ?? []).concat(parsed.whatWorked ?? []).slice(0, 5),
    score:             parsed.score         ?? 0.5,
    confidence:        parsed.confidence    ?? 0.7,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function reflect(ctx: RunContext): Promise<ReflectionResult> {
  try {
    const result = await llmReflect(ctx);
    console.log(`[reflection] Run ${ctx.runId.slice(0, 8)} — score=${result.score.toFixed(2)} retry=${result.shouldRetry}`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[reflection] LLM unavailable (${msg}) — using deterministic reflection`);
    return deterministicReflect(ctx);
  }
}
