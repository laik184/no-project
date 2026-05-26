/**
 * useRunReattach — C6 stream recovery hook.
 *
 * Single responsibility: when the user refreshes mid-run, detect the active
 * run and reattach lightweight event handlers so the UI stays live.
 *
 * Full event replay is handled by the RealtimeProvider (Last-Event-ID header).
 * This hook only needs to wire up state + subscriptions for the recovered run.
 *
 * Called exclusively by useAgentRunner. Must not be called elsewhere.
 */
import { useEffect, type MutableRefObject } from "react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import type { ChatMessage } from "@/components/chat/types";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

interface ReattachDeps {
  activeRunId:      string | null;
  currentRunIdRef:  MutableRefObject<string | null>;
  agentStreamRef:   MutableRefObject<{ close: () => void } | null>;
  subscribe:        (topic: string, handler: (data: unknown) => void) => () => void;
  setMessages:      Setter<ChatMessage[]>;
  setIsAgentThinking: Setter<boolean>;
  setIsAgentTyping:   Setter<boolean>;
  setActiveAction:    Setter<AgentStreamItem | null>;
  startStream:      () => void;
  pushToken:        (token: string) => void;
  finalizeStream:   () => void;
}

export function useRunReattach({
  activeRunId,
  currentRunIdRef,
  agentStreamRef,
  subscribe,
  setMessages,
  setIsAgentThinking,
  setIsAgentTyping,
  setActiveAction,
  startStream,
  pushToken,
  finalizeStream,
}: ReattachDeps): void {
  useEffect(() => {
    if (!activeRunId || currentRunIdRef.current) return;

    currentRunIdRef.current = activeRunId;
    setIsAgentThinking(true);
    setActiveAction({
      type: "action",
      tool: "analysis.think",
      content: "↻ Reconnected — agent is still working…",
      status: "running",
    });
    setMessages([{
      role: "agent",
      content: "↻ Reconnected to active run. Events from before the refresh may have been replayed.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);

    const offAgent = subscribe("agent", (raw) => {
      try {
        const e = raw as { eventType: string; runId?: string; payload?: any; agentName?: string };
        if (e.runId !== activeRunId) return;

        switch (e.eventType) {
          case "agent.message": {
            finalizeStream();
            const text = typeof e.payload === "string" ? e.payload : (e.payload?.text || "");
            if (text) setMessages((p) => [...p, { role: "agent", content: text, time: "just now" }]);
            break;
          }
          case "agent.thinking":
            setIsAgentThinking(true);
            setActiveAction({
              type: "action",
              tool: "analysis.think",
              content: e.payload?.text || `Thinking${e.agentName ? ` (${e.agentName})` : ""}…`,
              status: "running",
            });
            break;
          case "agent.tool_call": {
            const tool = e.payload?.tool || "tool.call";
            if (e.payload?.status === "done" || e.payload?.status === "error") break;
            setActiveAction({
              type: "action",
              tool,
              content: e.payload?.label || tool.replace(/_/g, " "),
              status: "running",
            });
            break;
          }
          case "agent.stream.start": startStream(); break;
          case "agent.token":
            if (e.payload?.token) pushToken(e.payload.token as string);
            break;
          case "agent.stream.end": finalizeStream(); break;
        }
      } catch { /* malformed event — skip */ }
    });

    const offLifecycle = subscribe("lifecycle", (raw) => {
      try {
        const e = raw as { status: string; runId?: string };
        if (e.runId !== activeRunId) return;
        if (!["completed", "failed", "cancelled"].includes(e.status)) return;

        finalizeStream();
        agentStreamRef.current?.close();
        agentStreamRef.current  = null;
        currentRunIdRef.current = null;
        setIsAgentThinking(false);
        setIsAgentTyping(false);
        setActiveAction(null);

        const msg =
          e.status === "completed"  ? "Done."
          : e.status === "cancelled" ? "Cancelled."
          : "Run failed — check the console for details.";
        setMessages((p) => [...p, { role: "agent", content: msg, time: "just now" }]);
      } catch { /* malformed event — skip */ }
    });

    agentStreamRef.current = { close: () => { offAgent(); offLifecycle(); } };
    return () => { offAgent(); offLifecycle(); };
  }, [activeRunId, subscribe]); // eslint-disable-line react-hooks/exhaustive-deps
}
