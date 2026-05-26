/**
 * useAgentRunner — coordinator hook for the chat agent lifecycle.
 *
 * Single responsibility: orchestrate the run lifecycle — start a run,
 * wire up event subscriptions, handle answers, and expose clean state.
 *
 * Heavy logic is delegated to focused sub-hooks and a pure factory:
 *   useTokenStream       → RAF-buffered streaming state
 *   useRunReattach       → C6 recovery on page refresh
 *   buildAgentHandler    → full agent-event switch block (per-run)
 */
import { useState, useRef, useCallback } from "react";
import { getAgentMode } from "@/hooks/useAgentMode";
import { useToast } from "@/hooks/use-toast";
import { useTokenStream } from "@/hooks/useTokenStream";
import { useRunReattach } from "@/hooks/useRunReattach";
import { buildAgentHandler } from "./agent-event-handler";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import type { ChatMessage } from "./types";
import { useRealtime } from "@/realtime/realtime-provider";
import { useRunRecovery } from "@/realtime/useRunRecovery";

export function useAgentRunner() {
  const { toast }     = useToast();
  const { subscribe } = useRealtime();

  const projectId = Number(window.localStorage.getItem("nura.projectId") || "1") || 1;
  const { activeRunId } = useRunRecovery(projectId);

  // ── Core state ────────────────────────────────────────────────────────────
  const [messages,          setMessages]          = useState<ChatMessage[]>([]);
  const [isAgentThinking,   setIsAgentThinking]   = useState(false);
  const [isAgentTyping,     setIsAgentTyping]     = useState(false);
  const [activeAction,      setActiveAction]      = useState<AgentStreamItem | null>(null);

  // ── Stable refs ───────────────────────────────────────────────────────────
  const agentStreamRef   = useRef<{ close: () => void } | null>(null);
  const currentRunIdRef  = useRef<string | null>(null);

  // ── Token streaming (extracted sub-hook) ──────────────────────────────────
  const { startStream, pushToken, finalizeStream } = useTokenStream(setMessages);

  // ── C6: Page-refresh recovery (extracted sub-hook) ────────────────────────
  useRunReattach({
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
  });

  // ── Stop / cancel ─────────────────────────────────────────────────────────
  const stopAgent = useCallback(() => {
    finalizeStream();
    if (agentStreamRef.current) {
      try { agentStreamRef.current.close(); } catch { /* ignore */ }
      agentStreamRef.current = null;
    }
    if (currentRunIdRef.current) {
      const rid = currentRunIdRef.current;
      currentRunIdRef.current = null;
      fetch(`/api/run/${rid}/cancel`, { method: "POST" }).catch(() => {});
    }
    setIsAgentThinking(false);
    setIsAgentTyping(false);
    setActiveAction(null);
  }, [finalizeStream]);

  // ── Answer a clarification question ───────────────────────────────────────
  const handleAnswer = useCallback(async (questionId: string, runId: string, answer: string) => {
    try {
      await fetch("/api/chat/answer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ runId, questionId, answer }),
      });
    } catch (e) {
      console.warn("[question] failed to POST answer:", e);
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "question" && m.question.questionId === questionId
          ? { ...m, question: { ...m.question, answered: answer } }
          : m,
      ),
    );
  }, []);

  // ── Start a new agent run ─────────────────────────────────────────────────
  const runAgent = async (msg: string) => {
    // Deduplicate back-to-back identical user messages
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (prev.length > 0 && last.role === "user" && (last as { content: string }).content === msg) return prev;
      return [...prev, { role: "user", content: msg, time: "just now" }];
    });
    setIsAgentThinking(true);
    setActiveAction({ type: "action", tool: "analysis.think", content: "Connecting to agent…", status: "running" });

    const mode = getAgentMode();

    // POST /api/run — get back a runId
    let runId: string;
    try {
      const r = await fetch("/api/run", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-project-id": String(projectId) },
        body:    JSON.stringify({ projectId, goal: msg, mode }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
      runId = j.data?.runId || j.data?.id;
      if (!runId) throw new Error("server did not return runId");
    } catch (e: any) {
      setIsAgentThinking(false);
      setActiveAction(null);
      setMessages((prev) => [...prev, {
        role:    "agent",
        content: `⚠️ Couldn't reach the agent backend: \`${e?.message || e}\`.\n\nMake sure the API server is running and that \`OPENROUTER_API_KEY\` is set in Secrets.`,
        time:    "just now",
      }]);
      return;
    }

    currentRunIdRef.current = runId;

    // Per-run tool accumulator — cleared when group is flushed to messages
    const inflight = new Map<string, AgentStreamItem>();
    const flushGroup = () => {
      if (inflight.size === 0) return;
      const actions = Array.from(inflight.values());
      inflight.clear();
      setMessages((p) => [...p, { role: "tool_group", time: "just now", actions }]);
    };

    // Subscribe to all three topics for this run
    const offAgent = subscribe("agent", buildAgentHandler({
      runId, inflight,
      setMessages, setIsAgentThinking, setIsAgentTyping, setActiveAction,
      startStream, pushToken, finalizeStream, flushGroup,
    }));

    const offCheckpoint = subscribe("checkpoint", (raw) => {
      try {
        const e = raw as { eventType: string; trigger?: string; runId?: string };
        if (e.runId && e.runId !== runId) return;
        if (e.eventType === "stable") {
          toast({
            description: `Safety snapshot saved${e.trigger ? ` (${e.trigger.replace(/_/g, " ")})` : ""}`,
            duration: 2500,
          });
        }
      } catch { /* skip */ }
    });

    const offLifecycle = subscribe("lifecycle", (raw) => {
      try {
        const e = raw as { status: string; runId?: string };
        if (e.runId !== runId) return;
        if (!["completed", "failed", "cancelled"].includes(e.status)) return;

        finalizeStream();
        flushGroup();
        agentStreamRef.current?.close();
        agentStreamRef.current  = null;
        currentRunIdRef.current = null;
        setIsAgentThinking(false);
        setIsAgentTyping(false);
        setActiveAction(null);

        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const summary =
          e.status === "completed"  ? `Done — finished **"${msg}"**.`
          : e.status === "cancelled" ? "Cancelled."
          : "Run failed. Check the console for details.";

        setMessages((p) => [
          ...p,
          { role: "agent", content: summary, time: "just now" },
          ...(e.status === "completed" ? [{
            role: "checkpoint" as const,
            time: timeStr,
            checkpoint: {
              checkpointId: `cp-${Date.now()}`,
              label:        msg.length > 60 ? msg.slice(0, 60) + "…" : msg,
              description:  `After: ${msg.length > 40 ? msg.slice(0, 40) + "…" : msg}`,
              time:         timeStr,
              filesChanged: 0,
            },
          }] : []),
        ]);
      } catch { /* skip */ }
    });

    // Bundle all unsubscribers — called by stopAgent() or on lifecycle completion
    agentStreamRef.current = {
      close: () => { offAgent(); offCheckpoint(); offLifecycle(); },
    };
  };

  return {
    messages,
    setMessages,
    isAgentThinking,
    isAgentTyping,
    activeAction,
    setActiveAction,
    runAgent,
    stopAgent,
    handleAnswer,
  };
}
