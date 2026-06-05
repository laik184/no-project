import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type TimeRange, type DataPoint, TOTAL_MEM_MB, generateData, SkeletonChart } from "./resources-tab-helpers";
import { ResourcesCpuChart } from "./ResourcesCpuChart";
import { ResourcesMemoryChart } from "./ResourcesMemoryChart";

export function ResourcesTab() {
  const [range, setRange]       = useState<TimeRange>("5m");
  const [data, setData]         = useState<DataPoint[]>([]);
  const [loading, setLoading]   = useState(true);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback((r: TimeRange) => {
    setLoading(true);
    setData([]);
    setTimeout(() => {
      setData(generateData(r));
      setLoading(false);
    }, 800);
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  useEffect(() => {
    if (loading) return;
    tickRef.current = setInterval(() => {
      setData((prev) => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        const newCpu = Math.max(5, Math.min(98, last.cpu + (Math.random() - 0.47) * 10 + (Math.random() < 0.06 ? 28 : 0)));
        const newMem = Math.max(80, Math.min(TOTAL_MEM_MB - 10, last.mem + (Math.random() - 0.45) * 14));
        const now = new Date();
        const label = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: range === "5m" ? "2-digit" : undefined });
        return [...prev.slice(1), { time: label, cpu: Math.round(newCpu * 10) / 10, mem: Math.round(newMem) }];
      });
    }, range === "5m" ? 2000 : 5000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [loading, range]);

  const latest = data[data.length - 1];
  const cpuNow = latest?.cpu ?? 0;
  const memNow = latest?.mem ?? 0;
  const isCpuCrit = cpuNow > 80;
  const memPct = Math.round((memNow / TOTAL_MEM_MB) * 100);

  const RANGES: { id: TimeRange; label: string }[] = [
    { id: "5m",  label: "5 min" },
    { id: "1h",  label: "1 hr"  },
    { id: "24h", label: "24 hr" },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="px-2.5 py-2 rounded-lg text-[11px] font-mono" style={{ background: "hsl(222,30%,9%)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
        <p style={{ color: "rgba(148,163,184,0.7)", marginBottom: "4px" }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>{p.name}: <strong>{p.value}{p.dataKey === "cpu" ? "%" : " MB"}</strong></p>
        ))}
      </div>
    );
  };


  return (
    <div className="flex flex-col gap-4 h-full" style={{ minHeight: 0 }}>
      <style>{`
        @keyframes skel-sweep {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes res-fadein {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes crit-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0); }
          50%       { box-shadow: 0 0 0 4px rgba(248,113,113,0.2); }
        }
        .res-card { animation: res-fadein 0.3s ease; }
        .crit-card { animation: crit-pulse 1.8s ease-in-out infinite; }
      `}</style>

      {/* Header row */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-[13px] font-semibold" style={{ color: "rgba(226,232,240,0.9)" }}>Resource Usage</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(100,116,139,0.55)" }}>Live deployment metrics</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Range selector */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className="px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150"
                style={{
                  background: range === r.id ? "rgba(124,141,255,0.15)" : "transparent",
                  color: range === r.id ? "#a78bfa" : "rgba(100,116,139,0.6)",
                  borderRight: "1px solid rgba(255,255,255,0.06)",
                }}
                data-testid={`range-${r.id}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {/* Refresh */}
          <button
            onClick={() => load(range)}
            className="p-1.5 rounded-lg transition-all duration-150"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(148,163,184,0.6)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            title="Refresh"
            data-testid="button-refresh-resources"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="flex gap-3 flex-shrink-0">
        {/* CPU card */}
        <div
          className={cn("res-card flex-1 rounded-xl p-3.5", isCpuCrit && "crit-card")}
          style={{
            background: isCpuCrit ? "rgba(248,113,113,0.07)" : "rgba(124,141,255,0.06)",
            border: `1px solid ${isCpuCrit ? "rgba(248,113,113,0.25)" : "rgba(124,141,255,0.15)"}`,
            transition: "all 0.4s ease",
          }}
          data-testid="card-cpu"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10.5px] font-semibold tracking-wide uppercase" style={{ color: isCpuCrit ? "rgba(248,113,113,0.7)" : "rgba(124,141,255,0.7)" }}>
              CPU
            </span>
            {isCpuCrit && (
              <span className="flex items-center gap-1 text-[9.5px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>
                <AlertTriangle className="h-2.5 w-2.5" /> CRITICAL
              </span>
            )}
          </div>
          {loading ? (
            <div className="h-8 rounded" style={{ background: "rgba(255,255,255,0.06)", animation: "skel-sweep 1.4s ease-in-out infinite" }} />
          ) : (
            <>
              <p className="text-[26px] font-bold leading-none" style={{ color: isCpuCrit ? "#f87171" : "#a78bfa", transition: "color 0.4s" }}>
                {cpuNow}<span className="text-[14px] font-medium ml-0.5" style={{ color: "rgba(148,163,184,0.5)" }}>%</span>
              </p>
              <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${cpuNow}%`,
                    background: isCpuCrit
                      ? "linear-gradient(90deg,#f87171,#ef4444)"
                      : "linear-gradient(90deg,#7c8dff,#a78bfa)",
                  }}
                />
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: isCpuCrit ? "rgba(248,113,113,0.6)" : "rgba(100,116,139,0.5)" }}>
                {isCpuCrit ? "Exceeds 80% threshold" : "0.5 vCPU allocated"}
              </p>
            </>
          )}
        </div>

        {/* Memory card */}
        <div
          className="res-card flex-1 rounded-xl p-3.5"
          style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.12)" }}
          data-testid="card-memory"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10.5px] font-semibold tracking-wide uppercase" style={{ color: "rgba(74,222,128,0.6)" }}>Memory</span>
            <span className="text-[10px]" style={{ color: "rgba(100,116,139,0.5)" }}>{TOTAL_MEM_MB} MB cap</span>
          </div>
          {loading ? (
            <div className="h-8 rounded" style={{ background: "rgba(255,255,255,0.06)", animation: "skel-sweep 1.4s ease-in-out infinite" }} />
          ) : (
            <>
              <p className="text-[26px] font-bold leading-none" style={{ color: "#4ade80" }}>
                {memNow}<span className="text-[14px] font-medium ml-0.5" style={{ color: "rgba(148,163,184,0.5)" }}>MB</span>
              </p>
              <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${memPct}%`,
                    background: memPct > 85 ? "linear-gradient(90deg,#f87171,#ef4444)" : "linear-gradient(90deg,#4ade80,#34d399)",
                  }}
                />
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: "rgba(100,116,139,0.5)" }}>
                {memPct}% of {TOTAL_MEM_MB} MB used
              </p>
            </>
          )}
        </div>
      </div>

      <ResourcesCpuChart data={data} loading={loading} isCpuCrit={isCpuCrit} CustomTooltip={CustomTooltip} />

      <ResourcesMemoryChart data={data} loading={loading} memNow={memNow} CustomTooltip={CustomTooltip} />
    </div>
  );
}
