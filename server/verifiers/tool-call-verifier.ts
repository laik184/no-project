/**
 * server/verifiers/tool-call-verifier.ts
 * Validates tool call arguments before execution.
 * Single responsibility: validate tool args. Never executes tools.
 */

import { toolOrchestrator } from "../tools/orchestrator.ts";
import type { VerifierResult } from "./types.ts";

export interface PendingToolCall {
  id:        string;
  name:      string;
  arguments: string;   // raw JSON from LLM
}

export async function runToolCallVerifier(
  calls: PendingToolCall[],
): Promise<VerifierResult> {
  if (calls.length === 0) {
    return {
      verifier: "tool_call",
      status:   "skipped",
      message:  "No tool calls to verify.",
      blocksExecution: false,
    };
  }

  const issues: string[] = [];

  for (const call of calls) {
    // 1. Known tool?
    if (!toolOrchestrator.has(call.name)) {
      issues.push(`Unknown tool: "${call.name}"`);
      continue;
    }

    // 2. Valid JSON args?
    if (call.arguments && call.arguments.trim() !== "") {
      try {
        JSON.parse(call.arguments);
      } catch {
        issues.push(`Tool "${call.name}" has malformed JSON arguments`);
      }
    }
  }

  if (issues.length === 0) {
    return {
      verifier: "tool_call",
      status:   "passed",
      message:  `All ${calls.length} tool call(s) are valid.`,
      blocksExecution: false,
    };
  }

  return {
    verifier: "tool_call",
    status:   "failed",
    message:  `${issues.length} tool call issue(s): ${issues[0]}`,
    detail:   issues.join("; "),
    blocksExecution: true,
  };
}
