import { useState } from "react";
import { ChevronRight, ChevronDown, Cpu } from "lucide-react";
import { useAgentStatus, AgentStatus } from "./use-agent-status";

const STATE_COLOR: Record<string, string> = {
  idle:      "#2e2e2e",
  running:   "#60a5fa",
  error:     "#f87171",
  completed: "#34d399",
};

const STATE_LABEL: Record<string, string> = {
  idle:      "idle",
  running:   "active",
  error:     "error",
  completed: "done",
};

function AgentRow({ agent }: { agent: AgentStatus }) {
  const color    = STATE_COLOR[agent.state] ?? "#2e2e2e";
  const isActive = agent.state === "running";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      height: 18, paddingLeft: 16, paddingRight: 8,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        flexShrink: 0, background: color,
        ...(isActive ? { animation: "rfe-pulse 1s ease infinite" } : {}),
      }} />
      <span style={{
        fontSize: 11, flex: 1,
        color: isActive ? "#b4b4b4" : "#3a3a3a",
      }}>
        {agent.label}
      </span>
      <span style={{ fontSize: 9, color, letterSpacing: ".03em" }}>
        {STATE_LABEL[agent.state]}
      </span>
    </div>
  );
}

export function AgentStatusPanel() {
  const { agents, activeCount, hasError } = useAgentStatus();
  const [collapsed, setCollapsed]         = useState(true);

  const dotColor  = hasError ? "#f87171" : activeCount > 0 ? "#60a5fa" : "#2a2a2a";
  const isPulsing = activeCount > 0;

  return (
    <div style={{ flexShrink: 0, borderTop: "1px solid #1a1a1a" }}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 6px", height: 22, cursor: "pointer", userSelect: "none",
        }}
        onClick={() => setCollapsed(v => !v)}
        data-testid="section-agent-status"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {collapsed
            ? <ChevronRight style={{ width: 9, height: 9, color: "#3e3e3e" }} />
            : <ChevronDown  style={{ width: 9, height: 9, color: "#3e3e3e" }} />}
          <Cpu style={{ width: 9, height: 9, color: "#3e3e3e" }} />
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#3e3e3e",
            textTransform: "uppercase", letterSpacing: ".08em",
          }}>
            Agents
          </span>
          {activeCount > 0 && (
            <span style={{ fontSize: 9, color: "#60a5fa", marginLeft: 2 }}>
              {activeCount} active
            </span>
          )}
        </div>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: dotColor, display: "inline-block", flexShrink: 0,
          ...(isPulsing ? { animation: "rfe-pulse 1s ease infinite" } : {}),
        }} />
      </div>
      {!collapsed && (
        <div style={{ paddingBottom: 4 }}>
          {agents.map(agent => <AgentRow key={agent.id} agent={agent} />)}
        </div>
      )}
    </div>
  );
}
