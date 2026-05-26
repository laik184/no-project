import React from "react";
import { useAppState } from "@/context/app-state-context";

export default function LogsPanel() {
  const { consoleOutput } = useAppState();

  return (
    <div style={{ fontFamily: "monospace", fontSize: 12, padding: 8, background: "#0b0b0b", color: "#ddd", height: "100%", overflow: "auto" }}>
      <h3 style={{ color: "#9ca3af", marginBottom: 8 }}>Live Logs</h3>
      {consoleOutput.length === 0 && <div style={{ color: "#6b7280" }}>No logs yet...</div>}
      {consoleOutput.map((line, idx) => (
        <div key={idx} style={{ padding: "2px 0", borderBottom: "1px solid #1f2937" }}>{line}</div>
      ))}
    </div>
  );
}
