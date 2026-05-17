import React, { useState } from "react";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

export default function LogsPanel() {
  const [logs, setLogs] = useState<string[]>([]);

  useRealtimeEvent("console", (data) => {
    try {
      const e = data as { line?: string; text?: string };
      const line = e.line ?? e.text ?? JSON.stringify(data);
      setLogs((prev) => [...prev.slice(-499), line]);
    } catch {
      setLogs((prev) => [...prev.slice(-499), String(data)]);
    }
  });

  return (
    <div style={{ fontFamily: "monospace", fontSize: 12, padding: 8, background: "#0b0b0b", color: "#ddd", height: "100%", overflow: "auto" }}>
      <h3 style={{ color: "#9ca3af", marginBottom: 8 }}>Live Logs</h3>
      {logs.length === 0 && <div style={{ color: "#6b7280" }}>No logs yet...</div>}
      {logs.map((line, idx) => (
        <div key={idx} style={{ padding: "2px 0", borderBottom: "1px solid #1f2937" }}>{line}</div>
      ))}
    </div>
  );
}
