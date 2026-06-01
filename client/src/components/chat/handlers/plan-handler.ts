import type { AgentHandlerDeps, AgentEvent } from "../agent-event-handler";
import type { PlanStep } from "../types";

const toolKey = (tool: string, phase?: string) => `${phase ?? ""}::${tool}`;

export function handlePlanEvents(e: AgentEvent, deps: AgentHandlerDeps): void {
  const { inflight, setMessages, setIsAgentThinking, setActiveAction, flushGroup } = deps;

  switch (e.eventType) {
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

    case "plan.created": {
      const { phases, complexity, appType, phaseList, risks } = e.payload ?? {};
      if (phases && Array.isArray(phaseList) && phaseList.length > 0) {
        flushGroup();
        const steps: PlanStep[] = (phaseList as { id: string; title: string }[]).map((p) => ({
          id: p.id, title: p.title, status: "pending" as const,
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
          ? { ...m, plan: { ...m.plan, steps: m.plan.steps.map((s) => s.id === stepId ? { ...s, status } : s) } }
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

    case "phase.started": {
      const key  = toolKey(`phase.${e.phase || "step"}`);
      const item = { type: "action" as const, tool: `phase.${e.phase || "step"}`, content: e.payload?.label || `Phase: ${e.phase || "step"}`, status: "running" as const };
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
  }
}
