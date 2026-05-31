/**
 * agent-event-handler.ts — pure factory for the agent-event switch block.
 *
 * Single responsibility: build the "agent" topic handler for a specific runId.
 * Extracted from useAgentRunner so the coordinator hook stays under 150 lines.
 *
 * This is NOT a hook — it is a plain function called once per runAgent() invocation.
 * All state updates go through the stable setter references passed in.
 */
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import type { ChatMessage, PlanStep } from "./types";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

export interface AgentHandlerDeps {
  runId:             string;
  inflight:          Map<string, AgentStreamItem>;
  setMessages:       Setter<ChatMessage[]>;
  setIsAgentThinking: Setter<boolean>;
  setIsAgentTyping:  Setter<boolean>;
  setActiveAction:   Setter<AgentStreamItem | null>;
  startStream:       () => void;
  pushToken:         (token: string) => void;
  finalizeStream:    () => void;
  flushGroup:        () => void;
}

const toolKey = (tool: string, phase?: string) => `${phase ?? ""}::${tool}`;

export function buildAgentHandler(deps: AgentHandlerDeps): (raw: unknown) => void {
  const {
    runId, inflight,
    setMessages, setIsAgentThinking, setIsAgentTyping, setActiveAction,
    startStream, pushToken, finalizeStream, flushGroup,
  } = deps;

  return (raw: unknown) => {
    try {
      const e = raw as {
        eventType: string;
        phase?:    string;
        agentName?: string;
        payload?:  any;
        runId?:    string;
      };
      if (e.runId !== runId) return;

      switch (e.eventType) {

        // ── Token streaming ────────────────────────────────────────────────
        case "agent.stream.start":
          finalizeStream();
          setIsAgentThinking(false);
          setIsAgentTyping(false);
          setActiveAction(null);
          startStream();
          break;

        case "agent.token": {
          const tok = e.payload?.token as string | undefined;
          if (tok) pushToken(tok);
          break;
        }

        case "agent.stream.end":
          finalizeStream();
          break;

        // ── Thinking / status ──────────────────────────────────────────────
        case "agent.thinking":
          setIsAgentThinking(true);
          setActiveAction({
            type: "action",
            tool: "analysis.think",
            content: e.payload?.text || `Thinking${e.agentName ? ` (${e.agentName})` : ""}…`,
            status: "running",
          });
          break;

        case "agent.retry": {
          const { attempt, maxAttempts, delayMs, error, operation } = e.payload ?? {};
          const delay = delayMs >= 1000 ? `${(delayMs / 1000).toFixed(1)}s` : `${delayMs}ms`;
          setActiveAction({
            type: "action",
            tool: "agent.retry",
            content: `Retrying ${operation || "request"} (attempt ${attempt}/${maxAttempts}) in ${delay} — ${(error || "").slice(0, 80)}`,
            status: "running",
          });
          break;
        }

        // ── Planning ───────────────────────────────────────────────────────
        case "agent.replanning": {
          const { text, continuationCount, maxContinuations, limitReached } = e.payload ?? {};
          setIsAgentThinking(true);
          if (limitReached) {
            flushGroup();
            setMessages((p) => [...p, { role: "agent", content: `⏹ ${text || "Continuation limit reached."}`, time: "just now" }]);
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

        // ── Tool calls ─────────────────────────────────────────────────────
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
          const item: AgentStreamItem = {
            type: "action",
            tool,
            content: e.payload?.label || tool.replace(/_/g, " "),
            status: "running",
            meta: e.payload?.args
              ? { logs: JSON.stringify(e.payload.args, null, 2).slice(0, 600) }
              : undefined,
          };
          inflight.set(toolKey(tool, e.phase), item);
          setActiveAction(item);
          break;
        }

        // ── Shell output — appended to inflight terminal item ──────────────
        case "shell.output": {
          const { line, runId: evRunId } = e.payload ?? {};
          if (evRunId && evRunId !== runId) break;
          if (!line) break;
          // Find an inflight shell item to append the line to
          for (const [k, item] of inflight) {
            const t = String(item.tool ?? "");
            if (t === "shell.exec" || t === "shell_exec" || t === "console.run") {
              const prev = item.meta?.stdout ?? [];
              inflight.set(k, {
                ...item,
                meta: { ...item.meta, stdout: [...prev, String(line)] },
              });
              break;
            }
          }
          break;
        }

        // ── Tool completed / error ─────────────────────────────────────────
        case "tool.completed": {
          const { tool, durationMs, exitCode } = e.payload ?? {};
          if (!tool) break;
          const key = toolKey(tool, e.phase);
          const cur = inflight.get(key);
          if (cur) {
            inflight.set(key, {
              ...cur,
              status: "done",
              meta: { ...cur.meta, ...(durationMs !== undefined ? { durationMs } : {}), ...(exitCode !== undefined ? { exitCode } : {}) },
            });
          }
          break;
        }

        case "tool.error": {
          const { tool, error } = e.payload ?? {};
          if (!tool) break;
          const key = toolKey(tool, e.phase);
          const cur = inflight.get(key);
          inflight.set(key, {
            ...(cur ?? { type: "action", tool, content: tool }),
            status: "error" as any,
            meta: { ...(cur?.meta ?? {}), logs: String(error || "error") },
          });
          break;
        }

        // ── Recovery ───────────────────────────────────────────────────────
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
          setMessages((p) => [...p, {
            role: "agent",
            content: `Server recovered automatically after ${steps} step${steps !== 1 ? "s" : ""} (attempt ${attempt}).\n\n${summary || ""}`.trim(),
            time: "just now",
          }]);
          break;
        }

        case "recovery.failed": {
          const { attempt, maxAttempts, reason } = e.payload ?? {};
          setIsAgentThinking(false);
          setActiveAction(null);
          flushGroup();
          const givingUp = attempt >= maxAttempts;
          const txt = givingUp
            ? `Automatic recovery failed after ${maxAttempts} attempts. Please check the server logs.\n\nLast error: ${reason || "unknown"}`
            : `Recovery attempt ${attempt}/${maxAttempts} failed — will retry after cooldown.\n\nReason: ${reason || "unknown"}`;
          setMessages((p) => [...p, { role: "agent", content: txt, time: "just now" }]);
          break;
        }

        // ── Plan events ────────────────────────────────────────────────────
        case "plan.created": {
          const { phases, complexity, appType, phaseList, risks } = e.payload ?? {};
          if (phases && Array.isArray(phaseList) && phaseList.length > 0) {
            flushGroup();
            const steps: PlanStep[] = (phaseList as { id: string; title: string }[]).map((p) => ({
              id:     p.id,
              title:  p.title,
              status: "pending",
            }));
            setMessages((p) => [...p, {
              role: "plan",
              time: "just now",
              plan: { phases, complexity, appType, steps, risks: Array.isArray(risks) ? risks : [] },
            }]);
          }
          break;
        }

        case "plan.step.update": {
          const { stepId, status } = e.payload ?? {};
          if (!stepId || !status) break;
          setMessages((prev) => prev.map((m) =>
            m.role === "plan"
              ? {
                  ...m,
                  plan: {
                    ...m.plan,
                    steps: m.plan.steps.map((s) =>
                      s.id === stepId ? { ...s, status } : s,
                    ),
                  },
                }
              : m,
          ));
          break;
        }

        case "plan.progress": {
          const { completed, total, currentPhase, percent } = e.payload ?? {};
          if (currentPhase && total > 0) {
            setActiveAction({ type: "action", tool: "plan.phase", content: `Phase ${completed + 1}/${total}: ${currentPhase} (${percent}%)`, status: "running" });
          }
          break;
        }

        // ── Phase events ───────────────────────────────────────────────────
        case "phase.started": {
          const key  = toolKey(`phase.${e.phase || "step"}`);
          const item: AgentStreamItem = { type: "action", tool: `phase.${e.phase || "step"}`, content: e.payload?.label || `Phase: ${e.phase || "step"}`, status: "running" };
          inflight.set(key, item);
          setActiveAction(item);
          break;
        }

        case "phase.completed": {
          const key = toolKey(`phase.${e.phase || "step"}`);
          const cur = inflight.get(key);
          if (cur) inflight.set(key, { ...cur, status: "done", meta: e.payload ? { logs: typeof e.payload === "string" ? e.payload : JSON.stringify(e.payload, null, 2).slice(0, 600) } : cur.meta });
          setActiveAction(null);
          break;
        }

        case "phase.failed": {
          const key = toolKey(`phase.${e.phase || "step"}`);
          const cur = inflight.get(key);
          inflight.set(key, { type: "action", tool: `phase.${e.phase || "step"}`, content: cur?.content || `Phase ${e.phase || ""} failed`, status: "error" as any, meta: { logs: String(e.payload?.error || "failed") } });
          setActiveAction(null);
          break;
        }

        // ── File / diff events ─────────────────────────────────────────────
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
          if (inflight.size > 0) {
            const actions = Array.from(inflight.values());
            inflight.clear();
            setMessages((p) => [...p, { role: "tool_group", time: "just now", actions }]);
          }
          const diff = e.payload?.diff;
          if (diff) setMessages((p) => [...p, { role: "diff", diffs: [diff], time: "just now" }]);
          break;
        }

        // ── Q&A ───────────────────────────────────────────────────────────
        case "agent.question": {
          flushGroup();
          setIsAgentThinking(false);
          setActiveAction(null);
          const { text, options, questionId } = e.payload ?? {};
          if (text && Array.isArray(options) && questionId) {
            setMessages((p) => [...p, { role: "question" as const, time: "just now", question: { text, options, questionId, runId } }]);
          }
          break;
        }

        case "agent.question.answered": {
          const { questionId: answeredId, answer: confirmedAnswer } = e.payload ?? {};
          if (answeredId && confirmedAnswer) {
            setMessages((p) => p.map((m) =>
              m.role === "question" && m.question.questionId === answeredId
                ? { ...m, question: { ...m.question, answered: confirmedAnswer } }
                : m,
            ));
          }
          setIsAgentThinking(true);
          setActiveAction({ type: "action", tool: "analysis.think", content: "Processing answer…", status: "running" });
          break;
        }

        // ── Final message ──────────────────────────────────────────────────
        case "agent.message": {
          finalizeStream();
          flushGroup();
          setIsAgentTyping(false);
          setActiveAction(null);
          const text = typeof e.payload === "string" ? e.payload : (e.payload?.text || JSON.stringify(e.payload));
          if (text) setMessages((p) => [...p, { role: "agent", content: text, time: "just now" }]);
          break;
        }
      }
    } catch { /* malformed SSE payload — skip silently */ }
  };
}
