import { useState, useEffect, useRef } from "react";
import {
  Clock,
  RefreshCw,
  Rocket,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AppStatus = "running" | "stopped" | "error" | "restarting";

function useUptime(running: boolean) {
  const [secs, setSecs] = useState(0);
  const startRef = useRef(Date.now() - 7_240_000);

  useEffect(() => {
    if (!running) { setSecs(0); return; }
    const id = setInterval(() => setSecs(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function ManageTab() {
  const [appStatus, setAppStatus] = useState<AppStatus>("running");
  const [showShutdownModal, setShowShutdownModal] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [autoScale, setAutoScale]   = useState(true);
  const [isPublic, setIsPublic]     = useState(true);
  const [cpuUsage]  = useState(42);
  const [memUsageMb] = useState(218);
  const memTotal = 512;
  const memPct   = Math.round((memUsageMb / memTotal) * 100);
  const uptime   = useUptime(appStatus === "running");
  const lastDeployed = "Today at 12:45 PM";

  const statusCfg: Record<AppStatus, { color: string; glow: string; label: string; bg: string; border: string }> = {
    running:    { color: "#4ade80", glow: "rgba(74,222,128,0.4)",   label: "Running",    bg: "rgba(74,222,128,0.08)",   border: "rgba(74,222,128,0.2)"   },
    stopped:    { color: "#94a3b8", glow: "rgba(148,163,184,0.3)",  label: "Stopped",    bg: "rgba(148,163,184,0.05)",  border: "rgba(148,163,184,0.15)" },
    error:      { color: "#f87171", glow: "rgba(248,113,113,0.4)",  label: "Error",      bg: "rgba(248,113,113,0.08)",  border: "rgba(248,113,113,0.2)"  },
    restarting: { color: "#fbbf24", glow: "rgba(251,191,36,0.35)",  label: "Restarting…",bg: "rgba(251,191,36,0.07)",  border: "rgba(251,191,36,0.2)"   },
  };
  const sc = statusCfg[appStatus];

  const barColor = (pct: number) =>
    pct > 80 ? "linear-gradient(90deg,#f87171,#ef4444)"
    : pct > 60 ? "linear-gradient(90deg,#fbbf24,#f59e0b)"
    : "linear-gradient(90deg,#4ade80,#34d399)";

  const doRestart = () => {
    setActionPending("restart");
    setAppStatus("restarting");
    setTimeout(() => { setAppStatus("running"); setActionPending(null); }, 3000);
  };

  const doRedeploy = () => {
    setActionPending("redeploy");
    setAppStatus("restarting");
    setTimeout(() => { setAppStatus("running"); setActionPending(null); }, 4500);
  };

  const doShutdown = () => {
    setShowShutdownModal(false);
    setActionPending("shutdown");
    setAppStatus("restarting");
    setTimeout(() => { setAppStatus("stopped"); setActionPending(null); }, 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <style>{`
        @keyframes mgmt-fadein { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes modal-in    { from{opacity:0;transform:scale(0.95) translateY(6px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes spin-slow   { to{transform:rotate(360deg)} }
        .mgmt-card { animation: mgmt-fadein 0.25s ease; }
      `}</style>

      {/* Shutdown confirmation modal */}
      {showShutdownModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowShutdownModal(false); }}
        >
          <div
            className="mx-4 rounded-2xl overflow-hidden"
            style={{
              background: "hsl(222,30%,7%)",
              border: "1px solid rgba(248,113,113,0.25)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
              maxWidth: "380px",
              width: "100%",
              animation: "modal-in 0.22s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)" }}>
                  <XCircle className="h-5 w-5" style={{ color: "#f87171" }} />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold" style={{ color: "rgba(226,232,240,0.95)" }}>Shutdown App?</h3>
                  <p className="text-[11px]" style={{ color: "rgba(100,116,139,0.6)" }}>This action requires confirmation</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} />
                <p className="text-[12px] leading-relaxed" style={{ color: "#fca5a5" }}>
                  <strong>This will stop your app and make it unavailable</strong> to all users until it is restarted or redeployed.
                </p>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-[12px]" style={{ color: "rgba(148,163,184,0.7)" }}>
                Are you sure you want to shut down <span className="font-mono font-semibold" style={{ color: "rgba(226,232,240,0.85)" }}>nura-x-app.replit.app</span>?
              </p>
            </div>
            <div className="flex items-center gap-2.5 px-5 pb-5">
              <button
                onClick={() => setShowShutdownModal(false)}
                className="flex-1 py-2 rounded-lg text-[12.5px] font-medium transition-all duration-150"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(203,213,225,0.8)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                data-testid="button-cancel-shutdown"
              >
                Cancel
              </button>
              <button
                onClick={doShutdown}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12.5px] font-semibold transition-all duration-150"
                style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.35)", color: "#f87171" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.25)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.15)"; }}
                data-testid="button-confirm-shutdown"
              >
                <XCircle className="h-3.5 w-3.5" />
                Yes, shut down
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-[13px] font-semibold" style={{ color: "rgba(226,232,240,0.9)" }}>Manage Application</h2>
        <p className="text-[11px] mt-0.5" style={{ color: "rgba(100,116,139,0.55)" }}>Control and monitor your deployed app</p>
      </div>

      {/* App Status card */}
      <div className="mgmt-card rounded-xl p-4" style={{ background: sc.bg, border: `1px solid ${sc.border}`, transition: "all 0.5s ease" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                background: sc.color,
                boxShadow: `0 0 8px ${sc.glow}`,
                animation: appStatus === "running" ? "pulse 2s ease-in-out infinite" : appStatus === "restarting" ? "spin-slow 1s linear infinite" : "none",
              }}
            />
            <div>
              <p className="text-[13px] font-semibold" style={{ color: sc.color }}>{sc.label}</p>
              <p className="text-[10.5px]" style={{ color: "rgba(100,116,139,0.55)" }}>nura-x-app.replit.app</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10.5px]" style={{ color: "rgba(100,116,139,0.5)" }}>Last deployed</p>
            <p className="text-[11px] font-medium" style={{ color: "rgba(148,163,184,0.7)" }}>{lastDeployed}</p>
          </div>
        </div>
        {appStatus === "running" && (
          <div className="mt-3 flex items-center gap-1.5 text-[10.5px]" style={{ color: "rgba(74,222,128,0.65)" }}>
            <Clock className="h-3 w-3" />
            <span>Uptime: <span className="font-mono font-semibold">{uptime}</span></span>
          </div>
        )}
      </div>

      {/* Resource mini-cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="mgmt-card rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "rgba(100,116,139,0.55)" }}>CPU Usage</p>
          <p className="text-[22px] font-bold leading-none mb-2" style={{ color: cpuUsage > 80 ? "#f87171" : cpuUsage > 60 ? "#fbbf24" : "#a78bfa" }}>
            {cpuUsage}<span className="text-[12px] ml-0.5" style={{ color: "rgba(148,163,184,0.4)" }}>%</span>
          </p>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cpuUsage}%`, background: barColor(cpuUsage) }} />
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "rgba(100,116,139,0.45)" }}>0.5 vCPU allocated</p>
        </div>
        <div className="mgmt-card rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "rgba(100,116,139,0.55)" }}>Memory</p>
          <p className="text-[22px] font-bold leading-none mb-2" style={{ color: memPct > 80 ? "#f87171" : memPct > 60 ? "#fbbf24" : "#4ade80" }}>
            {memUsageMb}<span className="text-[12px] ml-0.5" style={{ color: "rgba(148,163,184,0.4)" }}>MB</span>
          </p>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${memPct}%`, background: barColor(memPct) }} />
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "rgba(100,116,139,0.45)" }}>{memPct}% of {memTotal} MB used</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mgmt-card rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(100,116,139,0.5)" }}>Actions</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={doRestart}
            disabled={!!actionPending || appStatus === "stopped"}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[12.5px] font-semibold transition-all duration-150 w-full"
            style={{
              background: "rgba(124,141,255,0.1)",
              border: "1px solid rgba(124,141,255,0.2)",
              color: actionPending || appStatus === "stopped" ? "rgba(124,141,255,0.35)" : "#a78bfa",
              cursor: actionPending || appStatus === "stopped" ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!actionPending && appStatus !== "stopped") (e.currentTarget as HTMLElement).style.background = "rgba(124,141,255,0.17)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(124,141,255,0.1)"; }}
            data-testid="button-restart-app"
          >
            <RefreshCw className={cn("h-4 w-4", actionPending === "restart" && "animate-spin")} />
            <div className="text-left">
              <p>{actionPending === "restart" ? "Restarting…" : "Restart App"}</p>
              <p className="text-[10px] font-normal" style={{ color: "rgba(124,141,255,0.5)" }}>Reboot without redeployment</p>
            </div>
          </button>

          <button
            onClick={doRedeploy}
            disabled={!!actionPending}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[12.5px] font-semibold transition-all duration-150 w-full"
            style={{
              background: "linear-gradient(135deg,rgba(124,141,255,0.12),rgba(167,139,250,0.12))",
              border: "1px solid rgba(124,141,255,0.22)",
              color: actionPending ? "rgba(167,139,250,0.35)" : "#a78bfa",
              cursor: actionPending ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!actionPending) (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg,rgba(124,141,255,0.2),rgba(167,139,250,0.2))"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg,rgba(124,141,255,0.12),rgba(167,139,250,0.12))"; }}
            data-testid="button-redeploy-app"
          >
            <Rocket className={cn("h-4 w-4", actionPending === "redeploy" && "animate-bounce")} />
            <div className="text-left">
              <p>{actionPending === "redeploy" ? "Redeploying…" : "Redeploy App"}</p>
              <p className="text-[10px] font-normal" style={{ color: "rgba(124,141,255,0.5)" }}>Full rebuild and deployment</p>
            </div>
          </button>

          <button
            onClick={() => setShowShutdownModal(true)}
            disabled={!!actionPending || appStatus === "stopped"}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[12.5px] font-semibold transition-all duration-150 w-full"
            style={{
              background: "rgba(248,113,113,0.07)",
              border: "1px solid rgba(248,113,113,0.2)",
              color: actionPending || appStatus === "stopped" ? "rgba(248,113,113,0.3)" : "#f87171",
              cursor: actionPending || appStatus === "stopped" ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!actionPending && appStatus !== "stopped") (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.13)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.07)"; }}
            data-testid="button-shutdown-app"
          >
            <XCircle className="h-4 w-4" />
            <div className="text-left">
              <p>Shutdown App</p>
              <p className="text-[10px] font-normal" style={{ color: "rgba(248,113,113,0.45)" }}>Stop and take the app offline</p>
            </div>
          </button>
        </div>
      </div>

      {/* Settings toggles */}
      <div className="mgmt-card rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(100,116,139,0.5)" }}>Settings</p>
        {[
          {
            label: "Auto-scaling",
            desc: "Automatically scale resources with demand",
            value: autoScale,
            toggle: () => setAutoScale((v) => !v),
            testId: "toggle-autoscale",
          },
          {
            label: "Public Access",
            desc: "App is accessible to anyone on the internet",
            value: isPublic,
            toggle: () => setIsPublic((v) => !v),
            testId: "toggle-public",
          },
        ].map(({ label, desc, value, toggle, testId }) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium" style={{ color: "rgba(226,232,240,0.85)" }}>{label}</p>
              <p className="text-[10.5px] mt-0.5" style={{ color: "rgba(100,116,139,0.5)" }}>{desc}</p>
            </div>
            <button
              onClick={toggle}
              className="flex-shrink-0 relative w-9 h-5 rounded-full transition-all duration-300"
              style={{
                background: value ? "linear-gradient(135deg,#7c8dff,#a78bfa)" : "rgba(255,255,255,0.1)",
                border: `1px solid ${value ? "rgba(124,141,255,0.4)" : "rgba(255,255,255,0.1)"}`,
              }}
              data-testid={testId}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300"
                style={{
                  background: "#fff",
                  left: value ? "calc(100% - 18px)" : "2px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
