/**
 * useAgentRunner — coordinator hook for the chat agent lifecycle.
 *
 * Delegates to focused modules:
 *   submitRun              → POST /api/run, return runId
 *   buildCheckpointSubscription / buildLifecycleSubscription → per-run SSE handlers
 *   buildAgentHandler      → agent event switch block
 *   useTokenStream         → RAF-buffered streaming state
 *   useRunReattach         → C6 recovery on page refresh
 */
import { useState, useRef, useCallback } from "react";
import { getAgentMode   } from "@/hooks/useAgentMode";
import { useToast       } from "@/hooks/use-toast";
import { useTokenStream } from "@/hooks/useTokenStream";
import { useRunReattach } from "@/hooks/useRunReattach";
import { useRealtime    } from "@/realtime/realtime-provider";
import { useRunRecovery } from "@/realtime/useRunRecovery";
import { buildAgentHandler } from "./agent-event-handler";
import { submitRun         } from "./submitRun";
import { buildCheckpointSubscription, buildLifecycleSubscription } from "./buildSubscriptions";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import type { ChatMessage     } from "./types";

export function useAgentRunner() {
  const { toast }     = useToast();
  const { subscribe } = useRealtime();

  const projectId = Number(window.localStorage.getItem("nura.projectId") || "1") || 1;
  const { activeRunId } = useRunRecovery(projectId);

  const [messages,        setMessages]        = useState<ChatMessage[]>([]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [isAgentTyping,   setIsAgentTyping]   = useState(false);
  const [activeAction,    setActiveAction]    = useState<AgentStreamItem | null>(null);

  const agentStreamRef  = useRef<{ close: () => void } | null>(null);
  const currentRunIdRef = useRef<string | null>(null);

  const { startStream, pushToken, finalizeStream } = useTokenStream(setMessages);

  useRunReattach({
    activeRunId, currentRunIdRef, agentStreamRef, subscribe,
    setMessages, setIsAgentThinking, setIsAgentTyping, setActiveAction,
    startStream, pushToken, finalizeStream,
  });

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

  const handleAnswer = useCallback(async (questionId: string, runId: string, answer: string) => {
    try {
      await fetch(`/api/questions/${encodeURIComponent(questionId)}/answer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
    } catch (e) { console.warn("[question] failed to POST answer:", e); }
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "question" && m.question.questionId === questionId
          ? { ...m, question: { ...m.question, answered: answer } }
          : m,
      ),
    );
  }, []);

  const runAgent = async (msg: string) => {
    const runStartMs = Date.now();

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (prev.length > 0 && last.role === "user" && (last as { content: string }).content === msg) return prev;
      return [...prev, { role: "user", content: msg, time: "just now" }];
    });
    setIsAgentThinking(true);
    setActiveAction({ type: "action", tool: "analysis.think", content: "Connecting to agent…", status: "running" });

    const agentMode = getAgentMode();
    const runMode   = agentMode === "power" ? "planned" : agentMode === "lite" ? "direct" : "auto";

    let runId: string;
    try {
      runId = await submitRun(projectId, msg, runMode);
    } catch (e: any) {
      setIsAgentThinking(false);
      setActiveAction(null);
      setMessages((prev) => [...prev, {
        role: "agent", time: "just now",
        content: `⚠️ Couldn't reach the agent backend: \`${e?.message || e}\`.\n\nMake sure the API server is running and that \`OPENROUTER_API_KEY\` is set in Secrets.`,
      }]);
      return;
    }

    currentRunIdRef.current = runId;
    const inflight = new Map<string, AgentStreamItem>();
    const flushGroup = () => {
      if (inflight.size === 0) return;
      const actions = Array.from(inflight.values());
      inflight.clear();
      setMessages((p) => [...p, { role: "tool_group", time: "just now", actions }]);
    };

    const checkpointDataRef    = { current: null as Parameters<typeof buildLifecycleSubscription>[0]["checkpointDataRef"]["current"] };
    const lifecycleCompletedRef = { current: false };

    const offAgent = subscribe("agent", buildAgentHandler({
      runId, inflight,
      setMessages, setIsAgentThinking, setIsAgentTyping, setActiveAction,
      startStream, pushToken, finalizeStream, flushGroup,
    }));

    const offCheckpoint = subscribe("checkpoint", buildCheckpointSubscription({
      runId, msg, lifecycleCompletedRef, checkpointDataRef, setMessages, toast,
    }));

    const offLifecycle = subscribe("lifecycle", buildLifecycleSubscription({
      runId, msg, runStartMs,
      checkpointDataRef, lifecycleCompletedRef,
      setMessages, setIsAgentThinking, setIsAgentTyping, setActiveAction,
      finalizeStream, flushGroup, agentStreamRef, currentRunIdRef,
    }));

    agentStreamRef.current = { close: () => { offAgent(); offCheckpoint(); offLifecycle(); } };
  };

  return { messages, setMessages, isAgentThinking, isAgentTyping, activeAction, setActiveAction, runAgent, stopAgent, handleAnswer };
}
