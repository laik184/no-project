import { Activity, Loader2, RefreshCw } from "lucide-react";
import { useRecoveryDiagnostics, useResetRecovery } from "@/hooks/use-checkpoints";

export function DiagnosticsPanel() {
  const { data, isLoading } = useRecoveryDiagnostics();
  const reset = useResetRecovery();
  const d = data?.diagnostics;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-1.5">
          <Activity style={{ width: 11, height: 11, color: "#7c8dff" }} />
          <span className="text-[10.5px] font-semibold" style={{ color: "rgba(203,213,225,0.8)" }}>Recovery Status</span>
        </div>
        {d?.circuitOpen && (
          <button
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9.5px] font-medium transition-all hover:bg-white/8"
            style={{ border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}
            data-testid="button-reset-recovery"
          >
            <RefreshCw style={{ width: 9, height: 9 }} />
            Reset circuit
          </button>
        )}
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "rgba(148,163,184,0.4)" }} />
        </div>
      ) : d ? (
        <div className="px-3 py-2.5 grid grid-cols-3 gap-2">
          {[
            { label: "Lock",    value: d.locked               ? "Locked" : "Free",   color: d.locked               ? "#fbbf24" : "#4ade80" },
            { label: "Fails",   value: String(d.consecutiveFailures),                  color: d.consecutiveFailures > 0 ? "#f87171" : "#4ade80" },
            { label: "Circuit", value: d.circuitOpen          ? "Open"   : "Closed", color: d.circuitOpen          ? "#f87171" : "#4ade80" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(148,163,184,0.4)" }}>{label}</p>
              <span className="text-[11px] font-semibold" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-3 py-3 text-[10px] text-center" style={{ color: "rgba(148,163,184,0.4)" }}>Unavailable</p>
      )}
    </div>
  );
}
