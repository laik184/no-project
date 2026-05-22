/**
 * server/agents/core/tool-loop/classifiers/tool-call-classifier.ts
 *
 * Classifies each tool call as PARALLEL_SAFE, SERIAL_REQUIRED, or
 * EXCLUSIVE_RESOURCE and extracts the resource keys it mutates.
 *
 * Classification rules
 * ────────────────────
 * PARALLEL_SAFE      — pure reads, no shared-state side effects
 * SERIAL_REQUIRED    — any mutation (file write, process, package, git, db, deploy)
 * EXCLUSIVE_RESOURCE — terminal tools that must run last and in isolation
 */

import type { ClassifiedCall, ExecutionClass, LockType } from "../types/parallel-execution.types.ts";

// ── Classification sets ───────────────────────────────────────────────────────

export const PARALLEL_SAFE_TOOLS: ReadonlySet<string> = new Set([
  // file reads
  "file_list", "file_read", "file_search",
  // env reads
  "env_read",
  // git read
  "git_status",
  // server observation
  "server_logs",
  // preview reads
  "preview_url",
  // network reads
  "network_fetch", "network_port_check", "network_dns_lookup",
  // deploy reads
  "deploy_status", "deploy_typecheck",
  // testing
  "test_lint", "test_run", "test_coverage",
  // browser
  "browser_navigate", "browser_click", "browser_fill",
  // memory / agent cognition
  "memory_read", "agent_think", "agent_emit_event", "agent_wait",
  // audits
  "auth_audit", "package_audit", "detect_missing_packages",
  // db reads
  "db_query",
]);

export const EXCLUSIVE_TOOLS: ReadonlySet<string> = new Set([
  "agent_fail",
]);

// ── Classifier ────────────────────────────────────────────────────────────────

function resolveClass(name: string): ExecutionClass {
  if (EXCLUSIVE_TOOLS.has(name))     return "EXCLUSIVE_RESOURCE";
  if (PARALLEL_SAFE_TOOLS.has(name)) return "PARALLEL_SAFE";
  return "SERIAL_REQUIRED";
}

function extractResourceKeys(name: string, args: string): string[] {
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(args || "{}"); } catch { /* invalid JSON — no keys */ }

  const keys: string[] = [];

  // File mutations → lock by normalized path
  if (["file_write", "file_delete", "file_replace"].includes(name)) {
    const path = (parsed.path ?? parsed.filePath) as string | undefined;
    if (path) keys.push(`FILE:${path}`);
  }

  // Package mutations → shared package lock per project
  if (["package_install", "package_uninstall"].includes(name)) {
    const pid = (parsed.projectId ?? "global") as string;
    keys.push(`PACKAGE:${pid}`);
  }

  // Server / runtime mutations → runtime lock per project
  if (["server_start", "server_stop", "server_restart"].includes(name)) {
    const pid = (parsed.projectId ?? "global") as string;
    keys.push(`RUNTIME:${pid}`);
  }

  // Git write operations → repo lock
  const GIT_WRITE = new Set(["git_add", "git_commit", "git_clone", "git_push", "git_pull"]);
  if (GIT_WRITE.has(name)) {
    const dir = (parsed.dir ?? parsed.repoPath ?? "global") as string;
    keys.push(`GIT:${dir}`);
  }

  return keys;
}

export function classifyToolCalls(
  calls: Array<{ callId: string; name: string; args: string }>,
): ClassifiedCall[] {
  return calls.map((call) => ({
    callId:         call.callId,
    name:           call.name,
    args:           call.args,
    executionClass: resolveClass(call.name),
    resourceKeys:   extractResourceKeys(call.name, call.args),
  }));
}

export function lockTypeFromKey(key: string): LockType {
  if (key.startsWith("FILE:"))    return "FILE_LOCK";
  if (key.startsWith("RUNTIME:")) return "RUNTIME_LOCK";
  if (key.startsWith("PACKAGE:")) return "PACKAGE_LOCK";
  return "PROCESS_LOCK";
}
