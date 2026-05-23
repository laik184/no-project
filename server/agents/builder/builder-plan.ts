/**
 * builder-plan.ts
 *
 * Build plan construction — extracted from builder-agent.ts (Phase 1 split).
 *
 * Single responsibility: translate a BuildRequest into a deterministic BuildPlan.
 * No execution, no telemetry emission, no agent dispatch here.
 */

import type { BuildRequest, BuildPlan, BuildTask, BuildPhase } from "./types.ts";

// ── Plan builder ──────────────────────────────────────────────────────────────

/**
 * Translate a BuildRequest into a deterministic parallel wave BuildPlan.
 * Scaffold is always first. Backend + frontend + (optional) database run in parallel.
 * Config runs last after backend and frontend complete.
 */
export function buildPlan(req: BuildRequest): BuildPlan {
  const { runId, projectId, goal, framework, features = [] } = req;
  const tasks:  BuildTask[]  = [];
  const phases: BuildPhase[] = ["scaffold", "dependencies", "backend", "frontend", "config"];

  // Wave 0: scaffold (always first, critical)
  tasks.push({
    id:        "scaffold",
    phase:     "scaffold",
    goal:      `Scaffold project structure for: ${goal}`,
    tools:     ["write_file", "list_dir"],
    dependsOn: [],
    critical:  true,
    timeoutMs: 60_000,
  });

  // Wave 1a: dependencies (after scaffold)
  tasks.push({
    id:        "dependencies",
    phase:     "dependencies",
    goal:      `Install and configure dependencies for ${framework ?? "the project"}`,
    tools:     ["install_package", "write_file"],
    dependsOn: ["scaffold"],
    critical:  true,
    timeoutMs: 90_000,
  });

  // Wave 1b: backend (parallel with frontend — after scaffold)
  tasks.push({
    id:        "backend",
    phase:     "backend",
    goal:      `Generate backend API routes and server logic for: ${goal}`,
    tools:     ["write_file", "read_file", "shell_exec"],
    dependsOn: ["scaffold"],
    critical:  true,
    timeoutMs: 120_000,
  });

  // Wave 1c: frontend (parallel with backend — after scaffold)
  tasks.push({
    id:        "frontend",
    phase:     "frontend",
    goal:      `Generate frontend components and UI for: ${goal}`,
    tools:     ["write_file", "read_file"],
    dependsOn: ["scaffold"],
    critical:  true,
    timeoutMs: 120_000,
  });

  // Optional: database feature (parallel wave with backend/frontend)
  if (features.includes("database") || goal.toLowerCase().includes("database")) {
    tasks.push({
      id:        "database",
      phase:     "database",
      goal:      "Generate database schema and migration files",
      tools:     ["write_file", "shell_exec"],
      dependsOn: ["scaffold"],
      critical:  false,
      timeoutMs: 60_000,
    });
    phases.splice(2, 0, "database");
  }

  // Wave 2: config (after backend + frontend)
  tasks.push({
    id:        "config",
    phase:     "config",
    goal:      "Generate environment configuration and build settings",
    tools:     ["write_file"],
    dependsOn: ["backend", "frontend"],
    critical:  false,
    timeoutMs: 30_000,
  });

  const parallelGroups = [
    ["scaffold"],
    [
      "dependencies",
      "backend",
      "frontend",
      ...(phases.includes("database") ? ["database"] : []),
    ],
    ["config"],
  ];

  const estimatedMs = tasks.reduce((acc, t) => acc + t.timeoutMs, 0) / parallelGroups.length;

  return { runId, projectId, goal, tasks, phases, estimatedMs, parallelGroups };
}
