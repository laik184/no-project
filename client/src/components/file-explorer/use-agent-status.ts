import { useState } from "react";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

export type AgentId    = "planner" | "executor" | "verifier" | "supervisor" | "browser" | "filesystem";
export type AgentState = "idle" | "running" | "error" | "completed";

export interface AgentStatus {
  id:    AgentId;
  label: string;
  state: AgentState;
  task?: string;
}

const DEFAULT_AGENTS: AgentStatus[] = [
  { id: "planner",    label: "Planner",    state: "idle" },
  { id: "executor",   label: "Executor",   state: "idle" },
  { id: "verifier",   label: "Verifier",   state: "idle" },
  { id: "supervisor", label: "Supervisor", state: "idle" },
  { id: "browser",    label: "Browser",    state: "idle" },
  { id: "filesystem", label: "Filesystem", state: "idle" },
];

function patch(
  prev: AgentStatus[], id: AgentId, state: AgentState, task?: string,
): AgentStatus[] {
  return prev.map(a => a.id === id ? { ...a, state, task } : a);
}

export function useAgentStatus() {
  const [agents, setAgents] = useState<AgentStatus[]>(DEFAULT_AGENTS);

  useRealtimeEvent("agent", (data) => {
    try {
      const d       = data as Record<string, unknown>;
      const agentId = d.agent as AgentId | undefined;
      if (d.type === "agent:start" && agentId) {
        setAgents(p => patch(p, agentId, "running", d.task as string | undefined));
      } else if (d.type === "agent:done" && agentId) {
        setAgents(p => patch(p, agentId, "completed"));
        setTimeout(() => setAgents(p => patch(p, agentId, "idle")), 3000);
      } else if (d.type === "agent:error" && agentId) {
        setAgents(p => patch(p, agentId, "error", d.message as string | undefined));
        setTimeout(() => setAgents(p => patch(p, agentId, "idle")), 5000);
      } else if (d.type === "diff") {
        setAgents(p => patch(p, "executor", "running"));
        setTimeout(() => setAgents(p => patch(p, "executor", "idle")), 2000);
      }
    } catch {}
  });

  useRealtimeEvent("lifecycle", (data) => {
    try {
      const d = data as Record<string, unknown>;
      if (d.event === "run:start") {
        setAgents(p => patch(p, "planner", "running"));
      } else if (d.event === "run:complete") {
        setAgents(DEFAULT_AGENTS);
      } else if (d.event === "run:error") {
        setAgents(p => patch(p, "planner", "error"));
        setTimeout(() => setAgents(DEFAULT_AGENTS), 5000);
      }
    } catch {}
  });

  const activeCount = agents.filter(a => a.state === "running").length;
  const hasError    = agents.some(a => a.state === "error");

  return { agents, activeCount, hasError };
}
