/**
 * server/engine/reflection/reflection-analyzer.ts
 *
 * Multi-source analysis layer for the Reflection Engine.
 *
 * Single responsibility: gather all context needed for reflection decisions.
 * Reads from: runtimeManager logs, runtimeStore, observationController.
 * Does NOT make decisions — only builds the ReflectionContext.
 *
 * Sources inspected:
 *   1. Runtime process logs (last 60 lines)
 *   2. Runtime process status (running/crashed/stopped)
 *   3. Verification errors passed in from trigger
 *   4. Preview reachability flag
 *   5. Recent tool call names (loop detection feed)
 */

import { runtimeManager }        from "../../infrastructure/runtime/runtime-manager.ts";
import { observationController } from "../../runtime/controllers/observation-controller.ts";
import type { ReflectionContext, ReflectionTrigger } from "./reflection-types.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const LOG_TAIL_LINES    = 60;
const TOOL_HISTORY_MAX  = 5;

// ── Public API ────────────────────────────────────────────────────────────────

export interface AnalyzeInput {
  projectId:    number;
  runId:        string;
  trigger:      ReflectionTrigger;
  verifyErrors?: string[];
  previewDown?:  boolean;
  recentTools?:  string[];
  extraDetails?: Record<string, unknown>;
}

/**
 * Build a ReflectionContext by gathering multi-source runtime data.
 * Never throws — returns best-effort context even if some sources fail.
 */
export function buildReflectionContext(input: AnalyzeInput): ReflectionContext {
  const {
    projectId, runId, trigger,
    verifyErrors  = [],
    previewDown   = false,
    recentTools   = [],
    extraDetails  = {},
  } = input;

  // ── Log tail ──────────────────────────────────────────────────────────────
  let logTail: string[] = [];
  try {
    logTail = runtimeManager.getLogs(projectId, LOG_TAIL_LINES);
  } catch {
    logTail = [];
  }

  // ── Runtime status ────────────────────────────────────────────────────────
  let runtimeStatus = "unknown";
  let port: number | undefined;
  try {
    const entry = runtimeManager.get(projectId);
    runtimeStatus = entry?.status ?? "unknown";
    port = entry?.port;
  } catch {
    runtimeStatus = "unknown";
  }

  // ── Observation state (augment log tail if observation has extra lines) ──
  let finalDetails = extraDetails;
  try {
    if (observationController.isObserving(projectId)) {
      finalDetails = { ...extraDetails, observationActive: true };
    }
  } catch {
    // Non-fatal: observation controller may not be started
  }

  // ── Derive previewDown from runtimeStatus if not explicitly provided ──────
  const effectivePreviewDown =
    previewDown || runtimeStatus === "crashed" || runtimeStatus === "stopped";

  return {
    projectId,
    runId,
    trigger,
    timestamp:     Date.now(),
    logTail,
    verifyErrors,
    previewDown:   effectivePreviewDown,
    runtimeStatus,
    port,
    recentTools:   recentTools.slice(-TOOL_HISTORY_MAX),
    details:       finalDetails,
  };
}

/**
 * Extract the most relevant error lines from a log tail.
 * Filters for lines containing error-signal keywords.
 */
export function extractErrorLines(logTail: string[]): string[] {
  const ERROR_PATTERNS = [
    /error|exception|fail|crash|cannot|undefined|null|enoent|eacces|eperm/i,
  ];
  return logTail
    .filter((l) => ERROR_PATTERNS.some((p) => p.test(l)))
    .slice(-20);
}

/**
 * Extract package names from "Cannot find module" errors in log tail.
 */
export function extractMissingPackages(logTail: string[]): string[] {
  const names: string[] = [];
  for (const line of logTail) {
    const match = /cannot find module ['"]([^'"]+)['"]/i.exec(line);
    if (match?.[1]) {
      const pkg = match[1].replace(/\/.*$/, ""); // strip sub-paths
      if (!names.includes(pkg)) names.push(pkg);
    }
  }
  return names.slice(0, 5);
}
