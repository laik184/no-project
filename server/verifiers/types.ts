/**
 * server/verifiers/types.ts
 * Shared types for the verifier layer. No logic, no side effects.
 */

export type VerifierName =
  | "file"
  | "dependency"
  | "runtime"
  | "tool_call"
  | "build"
  | "preview";

export type VerifierStatus = "passed" | "failed" | "skipped" | "warning";

export interface VerifierResult {
  verifier: VerifierName;
  status: VerifierStatus;
  message: string;
  detail?: string;
  blocksExecution: boolean;
}

export interface VerifierReport {
  runId: string;
  projectId: number;
  results: VerifierResult[];
  blocked: boolean;
  blockReasons: string[];
  elapsedMs: number;
}
