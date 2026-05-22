/**
 * reflection-memory-bridge.ts
 *
 * Bridges the reflection engine's output into the memory pipeline.
 * When reflection produces root cause analysis, fix patterns, or
 * postmortem learnings — they are classified and persisted as
 * REFLECTION memory entries with high promotion priority.
 *
 * Single responsibility: reflection → memory observation.
 * No orchestration logic. No LLM calls.
 */

import { observe }          from "../pipeline/memory-pipeline.ts";
import { memoryTelemetry }  from "../telemetry/memory-telemetry.ts";
import { bus }              from "../../infrastructure/events/bus.ts";

// ── Reflection input types ─────────────────────────────────────────────────────

export interface ReflectionOutput {
  runId:       string;
  projectId:   number;
  goal:        string;
  rootCause?:  string;
  fixStrategy? :string;
  lessons?:    string[];
  retryLoop?:  boolean;
  score?:      number;
  success:     boolean;
}

// ── Core bridge function ───────────────────────────────────────────────────────

export async function persistReflectionMemory(output: ReflectionOutput): Promise<void> {
  const { runId, projectId, goal, rootCause, fixStrategy, lessons, success, score } = output;

  const writes: Promise<void>[] = [];

  // 1. Root cause analysis → failure memory
  if (rootCause) {
    writes.push(
      observe({
        content:   `Root cause analysis for: "${goal.slice(0, 120)}"\n${rootCause.slice(0, 500)}`,
        projectId,
        runId,
        hint:      { success: false, fromReflection: true },
      }).then(() => {}),
    );
  }

  // 2. Fix strategy → procedural memory (if successful)
  if (fixStrategy) {
    writes.push(
      observe({
        content:   `Fix strategy for: "${goal.slice(0, 120)}"\n${fixStrategy.slice(0, 500)}`,
        projectId,
        runId,
        hint:      { success, fromReflection: true },
      }).then(() => {}),
    );
  }

  // 3. Lessons learned → semantic/reflection memory
  for (const lesson of (lessons ?? []).slice(0, 5)) {
    if (lesson.trim().length < 20) continue;
    writes.push(
      observe({
        content:   `Lesson from run "${goal.slice(0, 80)}": ${lesson.slice(0, 400)}`,
        projectId,
        runId,
        hint:      { fromReflection: true, success },
      }).then(() => {}),
    );
  }

  // 4. If retry loop detected — high-value failure pattern
  if (output.retryLoop) {
    writes.push(
      observe({
        content:   `Retry loop detected for: "${goal.slice(0, 120)}" — agent repeated same failing approach. Avoid this pattern.`,
        projectId,
        runId,
        hint:      { success: false, fromReflection: true },
      }).then(() => {}),
    );
  }

  await Promise.allSettled(writes);

  // Emit telemetry
  bus.emit("agent.event" as any, {
    runId, projectId,
    phase:     "memory.reflection",
    agentName: "reflection-memory-bridge",
    eventType: "memory.reflection.persisted",
    payload:   {
      goal: goal.slice(0, 100),
      rootCause: !!rootCause,
      fixStrategy: !!fixStrategy,
      lessonCount: lessons?.length ?? 0,
      score,
    },
    ts: Date.now(),
  });

  console.log(`[reflection-memory-bridge] Persisted reflection for run=${runId.slice(0,8)} proj=${projectId}`);
}

// ── Bus listener ───────────────────────────────────────────────────────────────

let _initialized = false;

export function initReflectionMemoryBridge(): void {
  if (_initialized) return;
  _initialized = true;

  // Listen for reflection agent completion events
  bus.on("agent.event" as any, (ev: any) => {
    if (ev?.eventType !== "reflection.agent.completed" || !ev.projectId) return;
    if (!ev.runId) return;

    const p = ev.payload ?? {};
    persistReflectionMemory({
      runId:       ev.runId,
      projectId:   ev.projectId,
      goal:        p.goal         ?? "",
      rootCause:   p.rootCause    ?? p.analysis ?? undefined,
      fixStrategy: p.fixStrategy  ?? p.suggestion ?? undefined,
      lessons:     Array.isArray(p.lessons) ? p.lessons : [],
      retryLoop:   Boolean(p.retryLoop),
      score:       typeof p.score === "number" ? p.score : undefined,
      success:     Boolean(p.success ?? p.outcome === "success"),
    }).catch(err =>
      memoryTelemetry.failed({
        operation: "reflection-persist",
        projectId: ev.projectId,
        reason:    (err as Error).message,
        runId:     ev.runId,
      }),
    );
  });

  console.log("[reflection-memory-bridge] Initialized — wired to reflection.agent.completed events");
}
