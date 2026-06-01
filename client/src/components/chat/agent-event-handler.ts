/**
 * agent-event-handler.ts — dispatcher that routes SSE events to focused sub-handlers.
 *
 * Sub-handlers (in handlers/):
 *   stream-handler   → streaming, thinking, retry, replanning
 *   tool-handler     → tool_call, shell.output, tool.completed/error
 *   plan-handler     → recovery, plan, phase, file, diff events
 *   message-handler  → Q&A, agent.message, run lifecycle
 */
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import type { ChatMessage } from "./types";
import { handleStreamEvents  } from "./handlers/stream-handler";
import { handleToolEvents    } from "./handlers/tool-handler";
import { handlePlanEvents    } from "./handlers/plan-handler";
import { handleMessageEvents } from "./handlers/message-handler";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

export interface AgentHandlerDeps {
  runId:              string;
  inflight:           Map<string, AgentStreamItem>;
  setMessages:        Setter<ChatMessage[]>;
  setIsAgentThinking: Setter<boolean>;
  setIsAgentTyping:   Setter<boolean>;
  setActiveAction:    Setter<AgentStreamItem | null>;
  startStream:        () => void;
  pushToken:          (token: string) => void;
  finalizeStream:     () => void;
  flushGroup:         () => void;
}

export interface AgentEvent {
  eventType:  string;
  phase?:     string;
  agentName?: string;
  payload?:   any;
  runId?:     string;
  type?:      string;
  error?:     string;
}

export function buildAgentHandler(deps: AgentHandlerDeps): (raw: unknown) => void {
  return (raw: unknown) => {
    try {
      const e = raw as AgentEvent;
      if (e.runId !== deps.runId) return;
      handleStreamEvents(e, deps);
      handleToolEvents(e, deps);
      handlePlanEvents(e, deps);
      handleMessageEvents(e, deps);
    } catch { /* malformed SSE payload — skip silently */ }
  };
}
