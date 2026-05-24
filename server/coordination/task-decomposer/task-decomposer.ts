/**
 * task-decomposer.ts
 *
 * Decomposes a natural-language goal into a set of typed SpecialistTasks
 * with dependency relationships and file scopes.
 *
 * Single responsibility: goal analysis → task list with domain assignment.
 * No execution, no orchestration, no side effects.
 *
 * Dependency model (default ordering):
 *   database(1) → backend(2) → security(3) → frontend(4) → verification(5)
 *   runtime(4)  — parallel with frontend
 *   fullstack   — depends on backend + frontend
 */

import { v4 as uuid }         from "uuid";
import type { SpecialistTask, SpecialistDomain, FileScope }
  from "../contracts/specialist.contracts.ts";
import type { DecomposedPlan } from "../contracts/coordination.contracts.ts";
import { dependencyGraphBuilder } from "./dependency-graph-builder.ts";

// ── Domain detection heuristics ───────────────────────────────────────────────

const DOMAIN_SIGNALS: Record<SpecialistDomain, RegExp> = {
  database:     /\b(database|schema|migration|table|column|query|sql|orm|drizzle|postgres|mongodb|prisma)\b/i,
  backend:      /\b(api|route|endpoint|server|express|controller|service|rest|graphql|auth|backend)\b/i,
  frontend:     /\b(ui|component|page|layout|style|css|tailwind|react|button|modal|form|frontend|client)\b/i,
  security:     /\b(security|auth|jwt|csrf|xss|vulnerability|permission|role|sanitize|encrypt)\b/i,
  runtime:      /\b(runtime|process|environment|deploy|docker|config|port|startup|crash|recovery)\b/i,
  verification: /\b(test|verify|lint|typecheck|type-check|validate|spec|jest|vitest)\b/i,
  fullstack:    /\b(fullstack|full-stack|shared|utility|middleware|integration)\b/i,
};

function detectDomains(goal: string): SpecialistDomain[] {
  const detected: SpecialistDomain[] = [];
  for (const [domain, pattern] of Object.entries(DOMAIN_SIGNALS) as [SpecialistDomain, RegExp][]) {
    if (pattern.test(goal)) detected.push(domain);
  }
  // Always include verification as the final gate
  if (!detected.includes("verification")) detected.push("verification");
  // Default to fullstack if nothing specific is detected
  if (detected.length === 1) detected.unshift("fullstack");
  return detected;
}

// ── Dependency assignment ─────────────────────────────────────────────────────

const DOMAIN_DEPS: Record<SpecialistDomain, SpecialistDomain[]> = {
  database:     [],
  backend:      ["database"],
  security:     ["backend"],
  runtime:      ["backend"],
  frontend:     ["backend"],
  fullstack:    ["backend", "frontend"],
  verification: ["frontend", "security", "runtime"],
};

function buildDependsOn(
  domain:   SpecialistDomain,
  present:  Set<SpecialistDomain>,
  idByDomain: Map<SpecialistDomain, string>,
): string[] {
  return (DOMAIN_DEPS[domain] ?? [])
    .filter(dep => present.has(dep))
    .map(dep => idByDomain.get(dep)!)
    .filter(Boolean);
}

// ── File scope inference ──────────────────────────────────────────────────────

const DOMAIN_FILE_PATTERNS: Record<SpecialistDomain, { write: string[]; read: string[] }> = {
  database:     { write: ["shared/schema.ts", "server/db.ts"],      read: [] },
  backend:      { write: ["server/routes.ts", "server/storage.ts"], read: ["shared/schema.ts"] },
  frontend:     { write: ["client/src/"],                           read: ["shared/schema.ts", "server/routes.ts"] },
  security:     { write: ["server/security/"],                      read: ["server/routes.ts"] },
  runtime:      { write: ["server/infrastructure/"],                read: ["server/"] },
  verification: { write: [],                                        read: ["client/", "server/", "shared/"] },
  fullstack:    { write: ["shared/"],                               read: ["client/", "server/"] },
};

function inferFileScope(domain: SpecialistDomain): FileScope {
  const patterns = DOMAIN_FILE_PATTERNS[domain];
  return {
    exclusiveFiles: patterns.write,
    readonlyFiles:  patterns.read,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export class TaskDecomposer {
  /**
   * Decompose a goal into a parallel execution plan.
   * Returns a DecomposedPlan with tasks + dependency graph + wave assignments.
   */
  decompose(
    goal:      string,
    runId:     string,
    projectId: number,
    context:   Record<string, unknown> = {},
  ): DecomposedPlan {
    const domains   = detectDomains(goal);
    const present   = new Set<SpecialistDomain>(domains);
    const idByDomain = new Map<SpecialistDomain, string>();

    // Assign deterministic IDs (domain + runId fragment)
    for (const domain of domains) {
      idByDomain.set(domain, `${runId}:${domain}:${uuid().slice(0, 8)}`);
    }

    const tasks: SpecialistTask[] = domains.map(domain => ({
      taskId:    idByDomain.get(domain)!,
      runId,
      projectId,
      domain,
      goal,
      priority:  domains.indexOf(domain),
      dependsOn: buildDependsOn(domain, present, idByDomain),
      scope:     inferFileScope(domain),
      context,
      timeoutMs: 60_000,
    }));

    const dependencyGraph = dependencyGraphBuilder.build(tasks);

    return {
      runId,
      projectId,
      goal,
      tasks,
      dependencyGraph,
      estimatedWaves: dependencyGraph.waves.length,
      createdAt: Date.now(),
    };
  }
}

export const taskDecomposer = new TaskDecomposer();
