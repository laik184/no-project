import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import type { AgentHandlerDeps, AgentEvent } from "../agent-event-handler";

const toolKey = (tool: string, phase?: string) => `${phase ?? ""}::${tool}`;

export function handleToolEvents(e: AgentEvent, deps: AgentHandlerDeps): void {
  const { inflight, setIsAgentThinking, setIsAgentTyping, setActiveAction, flushGroup } = deps;

  switch (e.eventType) {
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

    case "shell.output": {
      const { line, runId: evRunId } = e.payload ?? {};
      if (evRunId && evRunId !== deps.runId) break;
      if (!line) break;
      const payloadTool = typeof e.payload?.tool === "string" ? e.payload.tool : undefined;
      const preferredKey = payloadTool ? toolKey(payloadTool, e.phase) : undefined;
      const preferred = preferredKey ? inflight.get(preferredKey) : undefined;
      const entries = preferredKey && preferred
        ? [[preferredKey, preferred] as const]
        : Array.from(inflight.entries()).reverse();

      for (const [k, item] of entries) {
        const t = String(item.tool ?? "");
        if (
          t === payloadTool ||
          t.startsWith("terminal_") ||
          t.startsWith("shell.") ||
          t === "shell_exec" ||
          t === "console.run"
        ) {
          const prev = Array.isArray(item.meta?.stdout) ? item.meta.stdout : [];
          inflight.set(k, { ...item, meta: { ...item.meta, stdout: [...prev, String(line)] } });
          break;
        }
      }
      break;
    }

    case "tool.completed": {
      const { tool, durationMs, exitCode } = e.payload ?? {};
      if (!tool) break;
      const key = toolKey(tool, e.phase);
      const cur = inflight.get(key);
      if (cur) {
        inflight.set(key, {
          ...cur,
          status: "done",
          meta: {
            ...cur.meta,
            ...(durationMs !== undefined ? { durationMs } : {}),
            ...(exitCode  !== undefined ? { exitCode  } : {}),
          },
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
  }
}
