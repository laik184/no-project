import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import type { AgentHandlerDeps, AgentEvent } from "../agent-event-handler";

const toolKey = (tool: string, phase?: string) => `${phase ?? ""}::${tool}`;

function displayTool(rawTool: string): string {
  if (rawTool.startsWith("fs_write") || rawTool === "fs_ensure_file" || rawTool === "fs_append_file") return "file.write";
  if (rawTool.startsWith("fs_read") || rawTool.startsWith("fs_find") || rawTool.startsWith("fs_search") || rawTool.startsWith("fs_scan") || rawTool.includes("entries")) return "file.read";
  if (rawTool.startsWith("fs_create")) return "file.create";
  if (rawTool.startsWith("fs_delete") || rawTool.startsWith("fs_rm")) return "file.delete";
  if (rawTool === "terminal_install_package" || rawTool === "terminal_npm_ci") return "package.install";
  if (rawTool === "terminal_uninstall_package") return "package.remove";
  if (rawTool === "terminal_start_runtime") return "server.start";
  if (rawTool === "terminal_restart_runtime") return "server.restart";
  if (rawTool.startsWith("terminal_") || rawTool.startsWith("run_") || rawTool.startsWith("check_") || rawTool.startsWith("validate_") || rawTool === "run_build" || rawTool === "run_tests" || rawTool === "run_typecheck" || rawTool === "run_lint") return "shell.exec";
  if (rawTool === "browser_screenshot" || rawTool === "browser_element_screenshot") return "screenshot.capture";
  if (rawTool.startsWith("browser_")) return "preview.open";
  if (rawTool.startsWith("git_")) return rawTool.replace(/_/g, ".");
  return rawTool;
}

function getPath(payload: AgentEvent["payload"]): string | undefined {
  return payload?.path ?? payload?.filePath ?? payload?.args?.path ?? payload?.args?.filePath;
}

function getCommand(tool: string, payload: AgentEvent["payload"]): string | undefined {
  return payload?.command ?? payload?.args?.command ?? payload?.args?.script ?? payload?.args?.packageName ?? payload?.args?.packages ?? tool;
}

function getPackageNames(payload: AgentEvent["payload"]): string[] | undefined {
  const value = payload?.packageName ?? payload?.packages ?? payload?.args?.packageName ?? payload?.args?.packages;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) return value.split(/\s+/).filter(Boolean);
  return undefined;
}

export function handleToolEvents(e: AgentEvent, deps: AgentHandlerDeps): void {
  const { inflight, setIsAgentThinking, setIsAgentTyping, setActiveAction, flushGroup } = deps;

  switch (e.eventType) {
    case "agent.tool_call": {
      const rawTool = e.payload?.tool || "tool.call";
      const tool    = displayTool(rawTool);
      const status  = e.payload?.status;
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
        tool: tool as any,
        content: e.payload?.label || getCommand(rawTool, e.payload) || tool.replace(/_/g, " "),
        status: "running",
        meta: {
          ...(getPath(e.payload) ? { file: getPath(e.payload) } : {}),
          ...(getPackageNames(e.payload) ? { packageNames: getPackageNames(e.payload) } : {}),
          ...(e.payload?.args ? { logs: JSON.stringify(e.payload.args, null, 2).slice(0, 600) } : {}),
        },
      };
      inflight.set(toolKey(rawTool, e.phase), item);
      setActiveAction(item);
      break;
    }

    case "shell.output": {
      const { line, runId: evRunId, tool: rawTool } = e.payload ?? {};
      if (evRunId && evRunId !== deps.runId) break;
      if (!line) break;
      const directKey = rawTool ? toolKey(String(rawTool), e.phase) : undefined;
      const entries = directKey && inflight.has(directKey)
        ? [[directKey, inflight.get(directKey)!] as const]
        : Array.from(inflight.entries()).reverse();
      for (const [k, item] of entries) {
        const t = String(item.tool ?? "");
        if (t === "shell.exec" || t === "shell_exec" || t === "console.run" || t.startsWith("package.") || t.startsWith("server.")) {
          const prev = item.meta?.stdout ?? [];
          inflight.set(k, { ...item, meta: { ...item.meta, stdout: [...prev, String(line)].slice(-200) } });
          break;
        }
      }
      break;
    }

    case "tool.completed": {
      const { tool: rawTool, durationMs, exitCode } = e.payload ?? {};
      if (!rawTool) break;
      const key = toolKey(rawTool, e.phase);
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
      const { tool: rawTool, error } = e.payload ?? {};
      if (!rawTool) break;
      const tool = displayTool(rawTool);
      const key = toolKey(rawTool, e.phase);
      const cur = inflight.get(key);
      inflight.set(key, {
        ...(cur ?? { type: "action", tool: tool as any, content: tool }),
        status: "error" as any,
        meta: { ...(cur?.meta ?? {}), logs: String(error || "error") },
      });
      break;
    }
  }
}
