/**
 * server/agents/debugger/debugger-agent.ts
 * Diagnoses failures and generates recovery strategies.
 * Single responsibility: failure → diagnosis + strategy. No tool execution.
 * Communicates via typed AgentMessage contracts.
 */

import { v4 as uuidv4 }  from "uuid";
import { bus }           from "../../infrastructure/events/bus.ts";
import type { AgentMessage, DebugRequest, DebugResponse } from "../contracts/types.ts";

// ── Diagnosis rules ───────────────────────────────────────────────────────────

interface DiagnosisRule {
  pattern:    RegExp;
  diagnosis:  string;
  strategy:   string;
  actions:    string[];
  confidence: number;
}

const RULES: DiagnosisRule[] = [
  {
    pattern:    /cannot find module|module not found/i,
    diagnosis:  "Missing or misspelled module import",
    strategy:   "fix_imports",
    actions:    ["Check the import path spelling", "Verify the package is in package.json", "Run npm install"],
    confidence: 0.92,
  },
  {
    pattern:    /type\s+error|is not assignable|property .* does not exist/i,
    diagnosis:  "TypeScript type mismatch",
    strategy:   "fix_types",
    actions:    ["Read the full TS error message", "Fix the type annotation or cast", "Run tsc --noEmit to verify"],
    confidence: 0.88,
  },
  {
    pattern:    /eaddrinuse|address already in use/i,
    diagnosis:  "Port already occupied by another process",
    strategy:   "restart_runtime",
    actions:    ["Kill the existing process on that port", "Restart the dev server with run_server"],
    confidence: 0.95,
  },
  {
    pattern:    /undefined is not a function|cannot read prop/i,
    diagnosis:  "Null/undefined dereference at runtime",
    strategy:   "add_null_check",
    actions:    ["Find the null dereference location", "Add optional chaining or null guard", "Test the fix"],
    confidence: 0.85,
  },
  {
    pattern:    /syntax error|unexpected token|unexpected end/i,
    diagnosis:  "JavaScript/TypeScript syntax error",
    strategy:   "fix_syntax",
    actions:    ["Read the exact syntax error location", "Fix missing bracket, comma, or semicolon"],
    confidence: 0.93,
  },
  {
    pattern:    /enoent|no such file or directory/i,
    diagnosis:  "File or directory does not exist",
    strategy:   "create_missing_file",
    actions:    ["Verify the expected file path", "Create the missing file or fix the reference"],
    confidence: 0.90,
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

export async function handleDebugRequest(
  message: AgentMessage<DebugRequest>,
): Promise<AgentMessage<DebugResponse>> {
  const { runId, projectId, payload } = message;
  const response = diagnoseFailure(payload.error, payload.context);

  bus.emit("agent.event", {
    runId, eventType: "debugger.diagnosis.completed" as any, phase: "debug",
    ts: Date.now(),
    payload: { strategy: response.strategy, confidence: response.confidence },
  });

  return {
    messageId:     uuidv4(),
    type:          "debug.response",
    from:          "debugger",
    to:            message.from,
    runId, projectId,
    payload:       response,
    ts:            Date.now(),
    correlationId: message.messageId,
  };
}

export function diagnoseFailure(error: string, context: string): DebugResponse {
  for (const rule of RULES) {
    if (rule.pattern.test(error) || rule.pattern.test(context)) {
      return {
        diagnosis:  rule.diagnosis,
        strategy:   rule.strategy,
        actions:    rule.actions,
        confidence: rule.confidence,
      };
    }
  }

  return {
    diagnosis:  "Unknown failure — manual investigation required",
    strategy:   "investigate",
    actions:    ["Read the full error output carefully", "Check recent file changes", "Try rolling back to last checkpoint"],
    confidence: 0.3,
  };
}
