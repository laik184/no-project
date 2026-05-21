/**
 * server/runtime-truth/stage-runners.ts
 *
 * StageRunners — individual verification stage implementations.
 * Each method is a pure async function: inputs in, StageResult out.
 * No state. No side effects beyond emitting on the provided bus.
 * Injected dependencies only — independently testable.
 */

import type {
  VerificationOptions,
  StageResult,
  EvidenceItem,
  VerificationStage,
} from "./types.ts";
import type { RuntimeEventBus }           from "./event-bus.ts";
import type { ProcessHealthMonitor }      from "./process-health-monitor.ts";
import type { DependencyIntegrityVerifier } from "./dependency-integrity-verifier.ts";
import type { HTTPHealthVerifier }        from "./http-health-verifier.ts";
import type { PreviewBehaviorVerifier }   from "./preview-behavior-verifier.ts";
import type { RuntimeChecksumEngine }     from "./checksum-engine.ts";
import { verifyTypeScript }               from "../verification/typescript/index.ts";
import type { ImportGraphValidator }      from "../verification/typescript/import-graph-validator.ts";
import type { TSConfigResolver }          from "../verification/typescript/tsconfig-resolver.ts";
import { runtimeManager }                 from "../infrastructure/runtime/runtime-manager.ts";

export interface StageRunnerDeps {
  bus: RuntimeEventBus;
  processMonitor: ProcessHealthMonitor;
  depVerifier: DependencyIntegrityVerifier;
  httpVerifier: HTTPHealthVerifier;
  previewVerifier: PreviewBehaviorVerifier;
  checksumEngine: RuntimeChecksumEngine;
  importValidator: ImportGraphValidator;
  tsconfigResolver: TSConfigResolver;
}

function stageResult(
  stage: VerificationStage, t0: number,
  evidence: readonly EvidenceItem[], passed: boolean, reason: string | null
): StageResult {
  return Object.freeze({
    stage, status: passed ? "PASSED" : "FAILED" as const,
    durationMs: Date.now() - t0, detail: reason ?? "OK",
    evidence: Object.freeze([...evidence]), failureReason: reason,
  });
}

function stageFailed(stage: VerificationStage, t0: number, reason: string): StageResult {
  return Object.freeze({
    stage, status: "FAILED" as const,
    durationMs: Date.now() - t0, detail: reason,
    evidence: [], failureReason: reason,
  });
}

export function stageSkipped(stage: VerificationStage): StageResult {
  return Object.freeze({
    stage, status: "SKIPPED" as const,
    durationMs: 0, detail: "Skipped", evidence: [], failureReason: null,
  });
}

export async function runFilesystem(
  opts: VerificationOptions, deps: StageRunnerDeps
): Promise<StageResult> {
  const t0 = Date.now();
  const evidence = deps.checksumEngine.buildFilesystemEvidence(opts.workspacePath, null);
  return stageResult("filesystem", t0, [evidence], evidence.value, evidence.value ? null : evidence.detail);
}

export async function runImportGraph(
  opts: VerificationOptions, deps: StageRunnerDeps, cid: string
): Promise<StageResult> {
  const t0 = Date.now();
  const config = deps.tsconfigResolver.resolve(opts.workspacePath);
  if (!config) return stageFailed("import_graph", t0, "No tsconfig.json found");

  const result = deps.importValidator.validate(opts.workspacePath, config.absolutePath);
  const passed = result.issues.length === 0;
  const evidence: EvidenceItem[] = [{
    kind: "IMPORT_GRAPH_CLEAN", value: passed,
    detail: passed
      ? `Import graph clean — ${result.filesScanned} files scanned`
      : `${result.issues.length} import issue(s): ${result.issues[0]?.detail ?? ""}`,
    collectedAt: Date.now(), ttlMs: 30_000,
  }];
  deps.bus.emit(passed ? "IMPORT_GRAPH_VALID" : "IMPORT_GRAPH_INVALID", cid, { issues: result.issues.length });
  return stageResult("import_graph", t0, evidence, passed,
    passed ? null : `${result.issues.length} broken import(s). First: ${result.issues[0]?.detail}`);
}

export async function runTypeScript(
  opts: VerificationOptions, deps: StageRunnerDeps, cid: string, signal: AbortSignal
): Promise<StageResult> {
  const t0 = Date.now();
  deps.bus.emit("TS_VERIFICATION_STARTED", cid, {});
  const result = await verifyTypeScript({ workspacePath: opts.workspacePath, signal, skipCache: false });
  const evidence: EvidenceItem[] = [{
    kind: "TSC_EXIT_0", value: result.passed,
    detail: result.passed
      ? "tsc --noEmit exited 0"
      : `tsc failed: ${result.errorCount} error(s). First: ${result.diagnostics[0]?.message ?? "unknown"}`,
    collectedAt: Date.now(), ttlMs: 30_000,
  }];
  deps.bus.emit(result.passed ? "TS_VERIFICATION_PASSED" : "TS_VERIFICATION_FAILED", cid, { errors: result.errorCount });
  return stageResult("typescript", t0, evidence, result.passed, result.failureReason);
}

export async function runDependencies(
  opts: VerificationOptions, deps: StageRunnerDeps, cid: string
): Promise<StageResult> {
  const t0 = Date.now();
  const { report, evidence } = await deps.depVerifier.verify(opts.workspacePath);
  deps.bus.emit(report.intact ? "DEPENDENCIES_VALID" : "DEPENDENCIES_INVALID", cid, { missing: report.missingPackages });
  return stageResult("dependencies", t0, evidence, report.intact,
    report.intact ? null : `Missing: ${report.missingPackages.slice(0, 3).join(", ")}`);
}

export async function runProcessHealth(
  opts: VerificationOptions, deps: StageRunnerDeps, cid: string
): Promise<StageResult> {
  const t0 = Date.now();
  const pid = (() => { try { return runtimeManager.get(opts.projectId)?.pid ?? null; } catch { return null; } })();
  const { report, evidence } = await deps.processMonitor.check({
    projectId: opts.projectId, pid, port: opts.port ?? null,
  });
  const passed = report.alive && !report.inCrashLoop && (opts.port ? report.portOpen : true);
  const reason = passed ? null
    : !report.alive ? `PID ${pid ?? "null"} not alive`
    : report.inCrashLoop ? `Crash loop: ${report.restartCount} restarts`
    : `Port ${opts.port} unreachable`;
  deps.bus.emit(report.alive ? "PROCESS_STARTED" : "PROCESS_CRASHED", cid, { pid, port: opts.port });
  return stageResult("process_health", t0, evidence, passed, reason);
}

export async function runHttpHealth(
  opts: VerificationOptions, deps: StageRunnerDeps, cid: string, signal: AbortSignal
): Promise<StageResult> {
  const t0 = Date.now();
  if (!opts.previewUrl && !opts.port) return stageSkipped("http_health");
  const url = opts.previewUrl ?? `http://localhost:${opts.port}`;
  const { report, evidence } = await deps.httpVerifier.verify(url, { signal });
  deps.bus.emit(report.stable ? "HTTP_HEALTHY" : "HTTP_UNHEALTHY", cid, { url, stable: report.stable });
  return stageResult("http_health", t0, evidence, report.stable,
    report.stable ? null : `Only ${report.consecutiveSuccesses}/${report.requiredSuccesses} consecutive successes`);
}

export async function runPreviewBehavior(
  opts: VerificationOptions, deps: StageRunnerDeps, cid: string, signal: AbortSignal
): Promise<StageResult> {
  const t0 = Date.now();
  if (!opts.previewUrl && !opts.port) return stageSkipped("preview_behavior");
  const url = opts.previewUrl ?? `http://localhost:${opts.port}`;
  const { passed, evidence, detail } = await deps.previewVerifier.verify(url, signal);
  deps.bus.emit(passed ? "PREVIEW_VERIFIED" : "PREVIEW_FAILED", cid, { url });
  return stageResult("preview_behavior", t0, evidence, passed, passed ? null : detail);
}
