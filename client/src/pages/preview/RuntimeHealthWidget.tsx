/**
 * RuntimeHealthWidget.tsx — compact runtime health indicator.
 *
 * Shows: port, uptime, restart count, process status.
 * Sits in the PreviewHeader or BrowserBar.
 * Fades in when a process is running, disappears when idle.
 */

import { useRuntimeHealth } from "@/hooks/useRuntimeHealth";

interface Props {
  projectId?: number;
}

export function RuntimeHealthWidget({ projectId }: Props) {
  const { health } = useRuntimeHealth({ projectId, intervalMs: 5_000 });

  if (!health || !health.healthy) return null;

  return (
    <div
      data-testid="runtime-health-widget"
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            "8px",
        padding:        "3px 10px",
        borderRadius:   "999px",
        background:     "rgba(34,197,94,0.06)",
        border:         "1px solid rgba(34,197,94,0.18)",
        fontSize:       "10px",
        fontFamily:     "ui-monospace, 'SF Mono', Menlo, monospace",
        color:          "rgba(74,222,128,0.85)",
        whiteSpace:     "nowrap",
        transition:     "opacity 0.3s",
        userSelect:     "none",
      }}
      title={`PID ${health.pid ?? "?"} · Port ${health.port ?? "?"} · Uptime ${health.uptimeFmt}`}
    >
      {/* Green pulse dot */}
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: "#4ade80",
        flexShrink: 0,
        boxShadow: "0 0 6px rgba(74,222,128,0.7)",
        animation: "plc-dot-pulse 2s ease-in-out infinite",
      }} />

      {/* Port */}
      {health.port && (
        <span data-testid="runtime-port" style={{ opacity: 0.9 }}>
          :{health.port}
        </span>
      )}

      {/* Separator */}
      <span style={{ opacity: 0.25 }}>·</span>

      {/* Uptime */}
      <span data-testid="runtime-uptime" style={{ opacity: 0.75 }}>
        ↑{health.uptimeFmt}
      </span>

      {/* Restart badge */}
      {health.restartCount > 0 && (
        <>
          <span style={{ opacity: 0.25 }}>·</span>
          <span
            data-testid="runtime-restarts"
            title={`Restarted ${health.restartCount} time(s)`}
            style={{ opacity: 0.6, color: health.restartCount > 2 ? "#fb923c" : "inherit" }}
          >
            ↻{health.restartCount}
          </span>
        </>
      )}
    </div>
  );
}
