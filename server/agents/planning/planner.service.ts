/**
 * planner.service.ts
 *
 * Calls the LLM to generate a structured execution plan from a user goal.
 * Single responsibility: goal → raw LLM JSON → validated ExecutionPlan.
 */

import type { ExecutionPlan, PlannerInput } from "./planner.types.ts";
import { PLANNER_SYSTEM_PROMPT, buildPlannerUserPrompt } from "./planner.prompts.ts";
import { validatePlan, fallbackPlan } from "./planner.validators.ts";

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const PLANNER_MODEL = "openai/gpt-4o-mini";

async function callPlannerLLM(
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("No OpenRouter API key found — cannot generate plan.");
  }

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.REPLIT_DEV_DOMAIN || "https://nura-x.replit.app",
      "X-Title": "NURA X Planner",
    },
    body: JSON.stringify({
      model: PLANNER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Planner LLM error (${response.status}): ${text}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Planner LLM returned empty response");
  return content;
}

export async function generatePlan(input: PlannerInput): Promise<ExecutionPlan> {
  const userPrompt = buildPlannerUserPrompt(input.goal, input.projectId);

  let rawOutput: string;
  try {
    rawOutput = await callPlannerLLM(PLANNER_SYSTEM_PROMPT, userPrompt, input.signal);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[planner] LLM call failed — using fallback plan: ${msg}`);
    return fallbackPlan(input.goal, input.runId, input.projectId);
  }

  return validatePlan(rawOutput, input.goal, input.runId, input.projectId);
}

// ─── Planning heuristic ───────────────────────────────────────────────────────

/**
 * Action verbs that signal discrete work units.
 * Each verb found adds weight toward "needs planning".
 */
const ACTION_VERBS: readonly string[] = [
  "build", "create", "make", "implement", "setup", "set up",
  "add", "integrate", "connect", "configure", "deploy", "generate",
  "develop", "design", "write", "install", "migrate",
];

/**
 * System components — each is a non-trivial, independent work unit.
 * Two or more → planning is required.
 */
const SYSTEM_COMPONENTS: readonly string[] = [
  "auth", "authentication", "login", "signup", "sign up", "register",
  "database", "schema", "migration", "orm", "model",
  "payment", "stripe", "billing", "subscription",
  "dashboard", "admin", "panel", "analytics",
  "api", "rest", "graphql", "endpoint", "route", "crud",
  "frontend", "ui", "interface", "component", "page",
  "backend", "server", "service",
  "email", "notification", "webhook",
  "deploy", "docker", "container", "ci", "cd", "pipeline",
  "test", "testing", "coverage", "spec",
  "realtime", "real-time", "websocket", "socket", "live",
  "cache", "redis", "queue", "worker",
  "file upload", "storage", "s3", "cdn",
  "search", "elasticsearch", "algolia",
  "role", "permission", "rbac", "access control",
];

/**
 * Determine whether a goal should be decomposed by the Planner Agent
 * or sent directly to the tool-loop for immediate execution.
 *
 * Decision criteria (any one triggers planning):
 *   1. Two or more distinct system components detected
 *   2. Multiple action verbs + at least one component (multi-step workflow)
 *   3. Word count >= 30 (long goals are implicitly complex)
 *   4. Two or more "and" conjunctions + at least one component
 */
export function needsPlanning(goal: string): boolean {
  const words = goal.trim().split(/\s+/).length;
  const lower = goal.toLowerCase();

  // Very short goals are never complex enough to need planning
  if (words < 8) return false;

  const componentCount = SYSTEM_COMPONENTS.filter((c) => lower.includes(c)).length;
  const verbCount = ACTION_VERBS.filter((v) => lower.includes(v)).length;

  // Two or more distinct system components → always plan
  if (componentCount >= 2) return true;

  // Multiple discrete actions + at least one component
  if (verbCount >= 3 && componentCount >= 1) return true;

  // Long description → likely multi-step
  if (words >= 30) return true;

  // "X and Y and Z" pattern with at least one system component
  const andCount = (lower.match(/\band\b/g) || []).length;
  if (andCount >= 2 && componentCount >= 1) return true;

  return false;
}
