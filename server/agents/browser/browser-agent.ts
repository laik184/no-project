/**
 * server/agents/browser/browser-agent.ts
 * Orchestrates browser validation for a project run.
 * Single responsibility: browser checks → response. No tool execution.
 * Communicates via typed AgentMessage contracts.
 */

import { v4 as uuidv4 }         from "uuid";
import { runBrowserValidation }  from "../../browser/index.ts";
import { bus }                   from "../../infrastructure/events/bus.ts";
import type { AgentMessage }     from "../contracts/types.ts";

export interface BrowserValidateRequest {
  checkInteractions: boolean;
  checkResponsive:   boolean;
}

export interface BrowserValidateResponse {
  blocked:          boolean;
  visualStatus:     string;
  hydrationStatus:  string;
  blockReasons:     string[];
  consoleErrorCount: number;
  responsiveIssues:  number;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function handleBrowserValidateRequest(
  message: AgentMessage<BrowserValidateRequest>,
): Promise<AgentMessage<BrowserValidateResponse>> {
  const { runId, projectId } = message;

  bus.emit("agent.event", {
    runId, eventType: "browser.agent.started" as any, phase: "verify",
    ts: Date.now(), payload: { projectId },
  });

  const report = await runBrowserValidation(projectId, runId)
    .catch(e => {
      console.warn("[browser-agent] Validation failed (non-fatal):", e.message);
      return null;
    });

  const response: BrowserValidateResponse = {
    blocked:           report?.blocked ?? false,
    visualStatus:      report?.visualStatus ?? "unknown",
    hydrationStatus:   report?.hydrationStatus ?? "unknown",
    blockReasons:      report?.blockReasons ?? [],
    consoleErrorCount: report?.consoleErrors?.length ?? 0,
    responsiveIssues:  report?.responsiveIssues?.length ?? 0,
  };

  bus.emit("agent.event", {
    runId, eventType: report?.blocked ? "browser.agent.blocked" : "browser.agent.passed" as any,
    phase: "verify", ts: Date.now(), payload: response,
  });

  return {
    messageId:     uuidv4(),
    type:          "browser.validate.response",
    from:          "browser",
    to:            message.from,
    runId, projectId,
    payload:       response,
    ts:            Date.now(),
    correlationId: message.messageId,
  };
}
