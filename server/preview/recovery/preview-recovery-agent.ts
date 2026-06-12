/**
 * preview-recovery-agent.ts — Runtime crash → autonomous chat recovery bridge.
 *
 * This module closes the production recovery gap between preview runtime failures
 * and the agent execution system. A crashed preview process must not only update
 * lifecycle state; it must enqueue a repair run with the terminal logs that caused
 * the crash so the normal Chat → Orchestrator → Agent → Tool path can diagnose,
 * patch, retry, and validate.
 */

import { bus, runtimeManager } from "../../infrastructure/index.ts";
import { chatOrchestrator } from "../../chat/index.ts";
import { lifecycleManager } from "../lifecycle/preview-lifecycle-manager.ts";

type RecoveryEventPayload = Record<string, unknown> & {
  projectId?: number | string;
  code?: number;
  logs?: string[];
  crashLog?: string;
  errorMessage?: string;
};

const RECOVERY_DEDUPE_MS = 30_000;
const MAX_CRASH_LOG_LINES = 80;

let initialized = false;
const inFlight = new Map<number, number>();

function toProjectId(value: unknown): number | null {
  const projectId = typeof value === "number" ? value : Number(value);
  return Number.isInteger(projectId) && projectId > 0 ? projectId : null;
}

function getRecentRuntimeLogs(projectId: number): string[] {
  return runtimeManager.get(projectId)?.logs?.slice(-MAX_CRASH_LOG_LINES) ?? [];
}

function buildCrashLog(projectId: number, payload: RecoveryEventPayload): string {
  const payloadLogs = Array.isArray(payload.logs) ? payload.logs : [];
  const explicitLog = typeof payload.crashLog === "string" ? payload.crashLog : "";
  const runtimeLogs = getRecentRuntimeLogs(projectId);
  const lines = [
    ...payloadLogs,
    ...runtimeLogs,
    ...(explicitLog ? explicitLog.split("\n") : []),
  ]
    .map((line) => String(line).trimEnd())
    .filter(Boolean);

  return lines.slice(-MAX_CRASH_LOG_LINES).join("\n");
}

function shouldStartRecovery(projectId: number): boolean {
  const lastStartedAt = inFlight.get(projectId) ?? 0;
  if (Date.now() - lastStartedAt < RECOVERY_DEDUPE_MS) return false;
  inFlight.set(projectId, Date.now());
  return true;
}

function releaseRecovery(projectId: number): void {
  // Keep the dedupe window intact so a crash loop cannot enqueue unbounded runs.
  setTimeout(() => {
    const lastStartedAt = inFlight.get(projectId) ?? 0;
    if (Date.now() - lastStartedAt >= RECOVERY_DEDUPE_MS) inFlight.delete(projectId);
  }, RECOVERY_DEDUPE_MS).unref?.();
}

function buildRecoveryGoal(projectId: number, payload: RecoveryEventPayload, crashLog: string): string {
  const errorMessage = typeof payload.errorMessage === "string" ? payload.errorMessage : "";
  const exitCode = payload.code ?? "unknown";

  return [
    "Autonomous runtime recovery request.",
    "",
    `Project ID: ${projectId}`,
    `Exit code: ${exitCode}`,
    errorMessage ? `Visible error: ${errorMessage}` : "Visible error: runtime process crashed or preview requested debugging.",
    "",
    "Recovery contract:",
    "1. Read the crash logs below before changing code.",
    "2. Identify the first failure point and root cause.",
    "3. Patch only the root cause.",
    "4. Restart the runtime through the runtime/preview flow.",
    "5. Validate that the preview becomes reachable and visible.",
    "",
    "Recent terminal/runtime logs:",
    "```",
    crashLog || "<no runtime logs captured>",
    "```",
  ].join("\n");
}

async function enqueueRecovery(payload: RecoveryEventPayload): Promise<void> {
  const projectId = toProjectId(payload.projectId);
  if (projectId == null) return;
  if (!shouldStartRecovery(projectId)) return;

  const crashLog = buildCrashLog(projectId, payload);

  try {
    await lifecycleManager.markSelfHealing(projectId);
    await lifecycleManager.markDebugging(projectId);

    await chatOrchestrator.startRun({
      projectId,
      goal: buildRecoveryGoal(projectId, payload, crashLog),
      mode: "auto",
      context: {
        source: "preview-runtime-recovery",
        crashLog,
        exitCode: payload.code ?? null,
        errorMessage: payload.errorMessage ?? null,
      },
    });
  } catch (err) {
    console.error(
      "[preview-recovery-agent] Failed to enqueue recovery run:",
      err instanceof Error ? err.message : err,
    );
    await lifecycleManager.markCrashed(projectId, payload.code ?? null).catch(console.error);
  } finally {
    releaseRecovery(projectId);
  }
}

export function initPreviewRecoveryAgent(): void {
  if (initialized) return;
  initialized = true;

  bus.on("process.crashed", (payload) => {
    void enqueueRecovery(payload as RecoveryEventPayload);
  });

  bus.on("preview.debug_requested" as never, (payload) => {
    void enqueueRecovery(payload as RecoveryEventPayload);
  });

  console.log("[preview-recovery-agent] Initialized.");
}

export const previewRecoveryAgent = { init: initPreviewRecoveryAgent };
