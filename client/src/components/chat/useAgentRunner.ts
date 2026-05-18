import { useState, useRef, useCallback, useEffect } from "react";
import { getAgentMode } from "@/hooks/useAgentMode";
import { useToast } from "@/hooks/use-toast";
import { TokenBuffer } from "@/streaming/token-buffer";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import type { ChatMessage } from "./types";
import { useRealtime } from "@/realtime/realtime-provider";
import { useRunRecovery } from "@/realtime/useRunRecovery";

export function useAgentRunner() {
  const { toast } = useToast();
  const { subscribe } = useRealtime();

  // C6: look up the active run for this project on mount so we can reattach
  // handlers if the user refreshed mid-run.
  const projectId = Number(window.localStorage.getItem("nura.projectId") || "1") || 1;
  const { activeRunId } = useRunRecovery(projectId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [activeAction, setActiveAction] = useState<AgentStreamItem | null>(null);

  // Stores cleanup fn for the active run's subscriptions (replaces EventSource ref)
  const agentStreamRef    = useRef<{ close: () => void } | null>(null);
  const currentRunIdRef   = useRef<string | null>(null);
  const thinkingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const checkpointCountRef = useRef(0);
  // ── Streaming token refs ──────────────────────────────────────────────────
  const tokenBufRef    = useRef<TokenBuffer | null>(null);
  const isStreamingRef = useRef(false);

  const finalizeStream = () => {
    if (isStreamingRef.current) {
      tokenBufRef.current?.destroy();
      tokenBufRef.current = null;
      isStreamingRef.current = false;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "agent" && (last as { isStreaming?: boolean }).isStreaming) {
          return [...prev.slice(0, -1), { ...last, isStreaming: false }];
        }
        return prev;
      });
    }
  };

  const stopAgent = () => {
    thinkingTimersRef.current.forEach(clearTimeout);
    thinkingTimersRef.current = [];
    finalizeStream();
    if (agentStreamRef.current) {
      try { agentStreamRef.current.close(); } catch { }
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
  };

  const handleAnswer = useCallback(async (questionId: string, runId: string, answer: string) => {
    try {
      await fetch("/api/chat/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, questionId, answer }),
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

  const runAgent = async (msg: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      const alreadyHas = prev.length > 0 && last.role === "user" && (last as { role: "user"; content: string; time: string }).content === msg;
      if (alreadyHas) return prev;
      return [...prev, { role: "user", content: msg, time: "just now" }];
    });
    setIsAgentThinking(true);
    setActiveAction({ type: "action", tool: "analysis.think", content: "Connecting to agent…", status: "running" });

    const projectId = Number(window.localStorage.getItem("nura.projectId") || "1") || 1;
    const mode = getAgentMode();

    let runId: string;
    try {
      const r = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-project-id": String(projectId) },
        body: JSON.stringify({ projectId, goal: msg, mode }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
      runId = j.data?.runId || j.data?.id;
      if (!runId) throw new Error("server did not return runId");
    } catch (e: any) {
      setIsAgentThinking(false);
      setActiveAction(null);
      setMessages((prev) => [...prev, {
        role: "agent",
        content: `⚠️ Couldn't reach the agent backend: \`${e?.message || e}\`.\n\nMake sure the API server is running and that \`OPENROUTER_API_KEY\` is set in Secrets.`,
        time: "just now",
      }]);
      return;
    }

    currentRunIdRef.current = runId;

    const inflight = new Map<string, AgentStreamItem>();
    const toolKey = (tool: string, phase?: string) => `${phase || ""}::${tool}`;
    const flushGroup = () => {
      if (inflight.size === 0) return;
      const actions = Array.from(inflight.values());
      inflight.clear();
      setMessages((prev) => [...prev, { role: "tool_group", time: "just now", actions }]);
    };

    // ── Subscribe to agent events for this run ──────────────────────────────
    const offAgent = subscribe("agent", (data) => {
      try {
        const e = data as { eventType: string; phase?: string; agentName?: string; payload?: any; runId?: string };
        if (e.runId !== runId) return; // client-side runId filter
        switch (e.eventType) {
          // ── Token streaming events ─────────────────────────────────────
          case "agent.stream.start": {
            finalizeStream();
            isStreamingRef.current = true;
            setIsAgentThinking(false);
            setIsAgentTyping(false);
            setActiveAction(null);
            setMessages((prev) => [...prev, { role: "agent", content: "", isStreaming: true, time: "just now" }]);
            tokenBufRef.current = new TokenBuffer((chunk) => {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "agent" && (last as { isStreaming?: boolean }).isStreaming) {
                  return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
                }
                return prev;
              });
            });
            break;
          }
          case "agent.token": {
            const token = e.payload?.token as string | undefined;
            if (token && tokenBufRef.current) tokenBufRef.current.push(token);
            break;
          }
          case "agent.stream.end": {
            finalizeStream();
            break;
          }
          case "agent.thinking":
            setIsAgentThinking(true);
            setActiveAction({ type: "action", tool: "analysis.think", content: e.payload?.text || `Thinking${e.agentName ? ` (${e.agentName})` : ""}…`, status: "running" });
            break;
          case "agent.retry": {
            const { attempt, maxAttempts, delayMs, error, operation } = e.payload ?? {};
            const delayLabel = delayMs >= 1000 ? `${(delayMs / 1000).toFixed(1)}s` : `${delayMs}ms`;
            setActiveAction({ type: "action", tool: "agent.retry", content: `Retrying ${operation || "request"} (attempt ${attempt}/${maxAttempts}) in ${delayLabel} — ${(error || "").slice(0, 80)}`, status: "running" });
            break;
          }
          case "agent.replanning": {
            const { text, continuationCount, maxContinuations, limitReached } = e.payload ?? {};
            setIsAgentThinking(true);
            if (limitReached) {
              flushGroup();
              setMessages((prev) => [...prev, { role: "agent", content: `⏹ ${text || "Continuation limit reached."}`, time: "just now" }]);
              setActiveAction(null);
            } else {
              setActiveAction({ type: "action", tool: "plan.replan", content: text || `Re-planning (${continuationCount}/${maxContinuations})…`, status: "running" });
            }
            break;
          }
          case "agent.context_compressed": {
            const { originalMessageCount, compressedMessageCount, continuationCount } = e.payload ?? {};
            setActiveAction({ type: "action", tool: "plan.compress", content: `Context compressed: ${originalMessageCount} → ${compressedMessageCount} messages (run ${continuationCount})`, status: "running" });
            break;
          }
          case "agent.continuation": {
            const { text, continuationCount, maxContinuations } = e.payload ?? {};
            setActiveAction({ type: "action", tool: "plan.continue", content: text || `Continuation ${continuationCount}/${maxContinuations}…`, status: "running" });
            break;
          }
          case "agent.tool_call": {
            const tool   = e.payload?.tool   || "tool.call";
            const status = e.payload?.status;
            if (tool === "task_complete" && status === "running") {
              flushGroup();
              setIsAgentTyping(true);
              setIsAgentThinking(false);
              setActiveAction(null);
              break;
            }
            if (status === "done" || status === "error") break;
            const item: AgentStreamItem = { type: "action", tool, content: e.payload?.label || tool.replace(/_/g, " "), status: "running", meta: e.payload?.args ? { logs: JSON.stringify(e.payload.args, null, 2).slice(0, 600) } : undefined };
            inflight.set(toolKey(tool, e.phase), item);
            setActiveAction(item);
            break;
          }
          case "recovery.started": {
            const { attempt, maxAttempts, errorType } = e.payload ?? {};
            flushGroup();
            setIsAgentThinking(true);
            setActiveAction({ type: "action", tool: "recovery.start", content: `Self-healing: detected ${errorType || "crash"} — recovery attempt ${attempt}/${maxAttempts}`, status: "running" });
            break;
          }
          case "recovery.completed": {
            const { attempt, steps, summary } = e.payload ?? {};
            setIsAgentThinking(false);
            setActiveAction(null);
            flushGroup();
            setMessages((prev) => [...prev, { role: "agent", content: `Server recovered automatically after ${steps} step${steps !== 1 ? "s" : ""} (attempt ${attempt}).\n\n${summary || ""}`.trim(), time: "just now" }]);
            break;
          }
          case "recovery.failed": {
            const { attempt, maxAttempts, reason } = e.payload ?? {};
            setIsAgentThinking(false);
            setActiveAction(null);
            flushGroup();
            const isGivingUp = attempt >= maxAttempts;
            const msg2 = isGivingUp
              ? `Automatic recovery failed after ${maxAttempts} attempts. Please check the server logs and fix the issue manually.\n\nLast error: ${reason || "unknown"}`
              : `Recovery attempt ${attempt}/${maxAttempts} failed — will retry after cooldown.\n\nReason: ${reason || "unknown"}`;
            setMessages((prev) => [...prev, { role: "agent", content: msg2, time: "just now" }]);
            break;
          }
          case "plan.created": {
            const { phases, complexity, appType, phaseList, risks } = e.payload ?? {};
            if (phases && Array.isArray(phaseList) && phaseList.length > 0) {
              flushGroup();
              const lines = (phaseList as { id: string; title: string }[])
                .map((p, i) => `${i + 1}. ${p.title}`)
                .join("\n");
              const header = `**Execution Plan** · ${phases} phase${phases !== 1 ? "s" : ""} · ${complexity ?? ""}${appType ? ` · ${appType}` : ""}`;
              const riskLine = Array.isArray(risks) && risks.length ? `\n⚠ ${(risks as string[]).join(", ")}` : "";
              setMessages((prev) => [...prev, { role: "agent", content: `${header}\n\n${lines}${riskLine}`, time: "just now" }]);
            }
            break;
          }
          case "plan.progress": {
            const { completed, total, currentPhase, percent } = e.payload ?? {};
            if (currentPhase && total > 0) {
              setActiveAction({ type: "action", tool: "plan.phase", content: `Phase ${completed + 1}/${total}: ${currentPhase} (${percent}%)`, status: "running" });
            }
            break;
          }
          case "phase.started": {
            const tool2 = `phase.${e.phase || "step"}`;
            const item2: AgentStreamItem = { type: "action", tool: tool2, content: e.payload?.label || `Phase: ${e.phase || "step"}`, status: "running" };
            inflight.set(toolKey(tool2), item2);
            setActiveAction(item2);
            break;
          }
          case "phase.completed": {
            const tool2 = `phase.${e.phase || "step"}`;
            const cur = inflight.get(toolKey(tool2));
            if (cur) inflight.set(toolKey(tool2), { ...cur, status: "done", meta: e.payload ? { logs: typeof e.payload === "string" ? e.payload : JSON.stringify(e.payload, null, 2).slice(0, 600) } : cur.meta });
            setActiveAction(null);
            break;
          }
          case "phase.failed": {
            const tool2 = `phase.${e.phase || "step"}`;
            const cur = inflight.get(toolKey(tool2));
            inflight.set(toolKey(tool2), { type: "action", tool: tool2, content: cur?.content || `Phase ${e.phase || ""} failed`, status: "error", meta: { logs: String(e.payload?.error || "failed") } });
            setActiveAction(null);
            break;
          }
          case "file.written": {
            const path = e.payload?.path || "(file)";
            inflight.set(`file::${path}`, { type: "action", tool: "file_write", content: `Wrote ${path}`, status: "done", meta: { file: path } });
            break;
          }
          case "diff.queued": {
            const path = e.payload?.path || e.payload?.filePath || "(patch)";
            inflight.set(`diff::${path}::${Date.now()}`, { type: "action", tool: "patch.queue", content: `Queued patch for ${path}`, status: "done", meta: { file: path } });
            break;
          }
          case "file.diff": {
            if (inflight.size > 0) { const actions = Array.from(inflight.values()); inflight.clear(); setMessages((prev) => [...prev, { role: "tool_group", time: "just now", actions }]); }
            const diff = e.payload?.diff;
            if (diff) setMessages((prev) => [...prev, { role: "diff", diffs: [diff], time: "just now" }]);
            break;
          }
          case "agent.question": {
            flushGroup();
            setIsAgentThinking(false);
            setActiveAction(null);
            const { text, options, questionId } = e.payload ?? {};
            if (text && Array.isArray(options) && questionId)
              setMessages((prev) => [...prev, { role: "question" as const, time: "just now", question: { text, options, questionId, runId: currentRunIdRef.current ?? "" } }]);
            break;
          }
          case "agent.question.answered": {
            const { questionId: answeredId, answer: confirmedAnswer } = e.payload ?? {};
            if (answeredId && confirmedAnswer) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.role === "question" && m.question.questionId === answeredId
                    ? { ...m, question: { ...m.question, answered: confirmedAnswer } }
                    : m,
                ),
              );
            }
            setIsAgentThinking(true);
            setActiveAction({ type: "action", tool: "analysis.think", content: "Processing answer…", status: "running" });
            break;
          }
          case "agent.message": {
            finalizeStream();
            flushGroup();
            setIsAgentTyping(false);
            setActiveAction(null);
            const text = typeof e.payload === "string" ? e.payload : (e.payload?.text || JSON.stringify(e.payload));
            if (text) setMessages((prev) => [...prev, { role: "agent", content: text, time: "just now" }]);
            break;
          }
        }
      } catch { }
    });

    // ── Checkpoint toasts ────────────────────────────────────────────────────
    const offCheckpoint = subscribe("checkpoint", (data) => {
      try {
        const e = data as { eventType: string; trigger?: string; checkpointId?: string; runId?: string };
        if (e.runId && e.runId !== runId) return;
        if (e.eventType === "stable") {
          toast({
            description: `Safety snapshot saved${e.trigger ? ` (${e.trigger.replace(/_/g, " ")})` : ""}`,
            duration: 2500,
          });
        }
      } catch { }
    });

    // ── Lifecycle — run completion ────────────────────────────────────────────
    const offLifecycle = subscribe("lifecycle", (data) => {
      try {
        const e = data as { status: string; runId?: string };
        if (e.runId !== runId) return;
        if (e.status === "completed" || e.status === "failed" || e.status === "cancelled") {
          finalizeStream();
          flushGroup();
          // Unsubscribe all handlers for this run
          agentStreamRef.current?.close();
          agentStreamRef.current = null;
          currentRunIdRef.current = null;
          setIsAgentThinking(false);
          setIsAgentTyping(false);
          setActiveAction(null);
          checkpointCountRef.current += 1;
          const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const summary = e.status === "completed" ? `Done — finished **"${msg}"**.` : e.status === "cancelled" ? `Cancelled.` : `Run failed. Check the console for details.`;
          setMessages((prev) => [
            ...prev,
            { role: "agent", content: summary, time: "just now" },
            ...(e.status === "completed" ? [{ role: "checkpoint" as const, time: timeStr, checkpoint: { checkpointId: `cp-${Date.now()}`, label: msg.length > 60 ? msg.slice(0, 60) + "…" : msg, description: `After: ${msg.length > 40 ? msg.slice(0, 40) + "…" : msg}`, time: timeStr, filesChanged: 0 } }] : []),
          ]);
        }
      } catch { }
    });

    // Bundle all unsubscribers — called by stopAgent() or lifecycle completion
    agentStreamRef.current = {
      close: () => { offAgent(); offCheckpoint(); offLifecycle(); },
    };
  };

  // ── C6: Recovery on page refresh ─────────────────────────────────────────
  // If the user refreshed while an agent run was in progress, re-attach a
  // lightweight set of event handlers so the UI stays live.
  // Full event replay is handled by the replay cache + Last-Event-ID on the
  // SSE connection (RealtimeProvider), so we only need state + subscriptions.
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

    const offAgent = subscribe("agent", (data) => {
      try {
        const e = data as { eventType: string; runId?: string; payload?: any; agentName?: string };
        if (e.runId !== activeRunId) return;
        switch (e.eventType) {
          case "agent.message": {
            finalizeStream();
            const text = typeof e.payload === "string" ? e.payload : (e.payload?.text || "");
            if (text) setMessages((prev) => [...prev, { role: "agent", content: text, time: "just now" }]);
            break;
          }
          case "agent.thinking":
            setIsAgentThinking(true);
            setActiveAction({ type: "action", tool: "analysis.think", content: e.payload?.text || `Thinking${e.agentName ? ` (${e.agentName})` : ""}…`, status: "running" });
            break;
          case "agent.tool_call": {
            const tool = e.payload?.tool || "tool.call";
            if (e.payload?.status === "done" || e.payload?.status === "error") break;
            setActiveAction({ type: "action", tool, content: e.payload?.label || tool.replace(/_/g, " "), status: "running" });
            break;
          }
          case "agent.stream.start":
            isStreamingRef.current = true;
            setIsAgentTyping(false);
            setIsAgentThinking(false);
            setActiveAction(null);
            setMessages((prev) => [...prev, { role: "agent", content: "", isStreaming: true, time: "just now" }]);
            tokenBufRef.current = new TokenBuffer((chunk) => {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "agent" && (last as { isStreaming?: boolean }).isStreaming) {
                  return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
                }
                return prev;
              });
            });
            break;
          case "agent.token":
            if (e.payload?.token && tokenBufRef.current) tokenBufRef.current.push(e.payload.token as string);
            break;
          case "agent.stream.end":
            finalizeStream();
            break;
        }
      } catch { }
    });

    const offLifecycle = subscribe("lifecycle", (data) => {
      try {
        const e = data as { status: string; runId?: string };
        if (e.runId !== activeRunId) return;
        if (["completed", "failed", "cancelled"].includes(e.status)) {
          finalizeStream();
          agentStreamRef.current?.close();
          agentStreamRef.current = null;
          currentRunIdRef.current = null;
          setIsAgentThinking(false);
          setIsAgentTyping(false);
          setActiveAction(null);
          const summary = e.status === "completed"
            ? "Done."
            : e.status === "cancelled"
            ? "Cancelled."
            : "Run failed — check the console for details.";
          setMessages((prev) => [...prev, { role: "agent", content: summary, time: "just now" }]);
        }
      } catch { }
    });

    agentStreamRef.current = { close: () => { offAgent(); offLifecycle(); } };
    return () => { offAgent(); offLifecycle(); };
  }, [activeRunId, subscribe]);

  return { messages, setMessages, isAgentThinking, isAgentTyping, activeAction, setActiveAction, runAgent, stopAgent, handleAnswer };
}
