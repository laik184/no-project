import { useEffect, useState } from "react";

export type AgentMode = "lite" | "economy" | "power";

const KEY = "nura.agent.mode";
const EVT = "nura.agent.mode.changed";

function read(): AgentMode {
  if (typeof window === "undefined") return "economy";
  const v = window.localStorage.getItem(KEY) as AgentMode | null;
  return v === "lite" || v === "economy" || v === "power" ? v : "economy";
}

export function getAgentMode(): AgentMode {
  return read();
}

export function setAgentMode(m: AgentMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, m);
  window.dispatchEvent(new CustomEvent(EVT, { detail: m }));
}

export function useAgentMode(): [AgentMode, (m: AgentMode) => void] {
  const [mode, setMode] = useState<AgentMode>(() => read());
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<AgentMode>).detail;
      if (detail) setMode(detail);
      else setMode(read());
    };
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const update = (m: AgentMode) => setAgentMode(m);
  return [mode, update];
}
