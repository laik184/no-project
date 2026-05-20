/**
 * context-partitioner.ts
 *
 * Partitions the full run context into role-specific slices.
 * Each agent gets only what it needs — reducing hallucination surface.
 */

import {
  ROLE_ALLOWED_TOOLS, ROLE_TOKEN_BUDGETS,
} from "./supervisor-types.ts";
import type {
  AgentRole, ContextPartition, ContextSection, TaskAssignment,
} from "./supervisor-types.ts";

const APPROX_CHARS_PER_TOKEN = 4;

function approxTokens(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * APPROX_CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 4) + " ...";
}

// ── Section builders per role ─────────────────────────────────────────────────

interface FullContext {
  goal:        string;
  projectId:   number;
  runId:       string;
  codeFiles?:  Array<{ path: string; content: string }>;
  errorLogs?:  string[];
  runtimeInfo?:string;
  prevSummary?:string;
  memoryHints?:string[];
  planOutput?:  string;
  buildOutput?: string;
}

export function partitionContext(
  role:    AgentRole,
  full:    FullContext,
  expiresIn: number = 300_000,
): ContextPartition {
  const budget   = ROLE_TOKEN_BUDGETS[role];
  const sections: ContextSection[] = [];
  let   used     = 0;

  function addSection(name: string, content: string, maxTokens?: number): void {
    const cap  = maxTokens ?? (budget - used);
    const text = truncateToTokens(content, cap);
    const tok  = approxTokens(text);
    sections.push({ name, content: text, tokens: tok });
    used += tok;
  }

  // Goal is universal
  addSection("goal", full.goal, 200);

  switch (role) {
    case "planner":
      if (full.prevSummary) addSection("previous-summary",  full.prevSummary, 800);
      if (full.memoryHints) addSection("memory-hints", full.memoryHints.join("\n"), 600);
      break;

    case "builder":
      if (full.planOutput) addSection("plan",         full.planOutput, 2_000);
      if (full.codeFiles)  {
        const top = full.codeFiles.slice(0, 5);
        addSection("relevant-files", top.map(f => `// ${f.path}\n${f.content}`).join("\n\n"), 8_000);
      }
      if (full.memoryHints) addSection("memory-patterns", full.memoryHints.join("\n"), 400);
      break;

    case "runtime":
      if (full.runtimeInfo) addSection("runtime-state", full.runtimeInfo, 600);
      if (full.errorLogs)   addSection("error-logs",    full.errorLogs.slice(-30).join("\n"), 800);
      break;

    case "verification":
      if (full.buildOutput) addSection("build-output", full.buildOutput, 800);
      if (full.runtimeInfo) addSection("runtime-state", full.runtimeInfo, 400);
      if (full.errorLogs)   addSection("error-logs",    full.errorLogs.slice(-20).join("\n"), 600);
      break;

    case "recovery":
      if (full.errorLogs)   addSection("error-logs",    full.errorLogs.slice(-50).join("\n"), 2_000);
      if (full.runtimeInfo) addSection("runtime-state", full.runtimeInfo, 400);
      if (full.codeFiles) {
        const relevant = full.codeFiles.slice(0, 4);
        addSection("relevant-files", relevant.map(f => `// ${f.path}\n${f.content}`).join("\n\n"), 4_000);
      }
      if (full.memoryHints) addSection("past-fixes", full.memoryHints.join("\n"), 600);
      break;

    case "memory":
      if (full.prevSummary) addSection("session-summary", full.prevSummary, 1_000);
      if (full.buildOutput) addSection("build-output", full.buildOutput, 400);
      break;

    case "review":
      if (full.codeFiles) {
        const top = full.codeFiles.slice(0, 6);
        addSection("code-for-review", top.map(f => `// ${f.path}\n${f.content}`).join("\n\n"), 4_000);
      }
      if (full.planOutput)  addSection("plan", full.planOutput, 800);
      break;
  }

  return {
    role,
    goal:         full.goal,
    projectId:    full.projectId,
    runId:        full.runId,
    allowedTools: ROLE_ALLOWED_TOOLS[role],
    tokenBudget:  budget,
    sections,
    expiresAt:    Date.now() + expiresIn,
  };
}

/** Rebuild context from a TaskAssignment (for agent internal use). */
export function buildSystemPrompt(partition: ContextPartition): string {
  const lines: string[] = [
    `You are the ${partition.role.toUpperCase()} agent in NURA X.`,
    `Allowed tools: ${partition.allowedTools.join(", ")}.`,
    `Token budget: ${partition.tokenBudget}.`,
    "",
  ];

  for (const sec of partition.sections) {
    lines.push(`## ${sec.name.toUpperCase()}`);
    lines.push(sec.content);
    lines.push("");
  }

  return lines.join("\n");
}
