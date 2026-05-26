import { useState } from "react";
import { Database, RefreshCw, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const RENEWAL_DATE = "Mar 30";

export function DatabasePanel() {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshed(false);
    setTimeout(() => {
      setRefreshing(false);
      setRefreshed(true);
      setTimeout(() => setRefreshed(false), 2000);
    }, 900);
  };

  return (
    <div
      className="absolute inset-0 overflow-y-auto"
      style={{
        background: "rgba(255,255,255,0.008)",
        animation: "db-fadein 0.22s ease",
      }}
    >
      <style>{`
        @keyframes db-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="px-6 py-5 w-full max-w-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-5">
          <h1
            className="text-sm font-semibold"
            style={{ color: "rgba(226,232,240,0.92)" }}
          >
            All Databases
          </h1>
          <button
            onClick={handleRefresh}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-150",
              refreshed
                ? "text-emerald-400"
                : "text-muted-foreground hover:text-foreground"
            )}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.07)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.04)";
            }}
            data-testid="button-db-refresh"
          >
            {refreshed ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <RefreshCw
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              />
            )}
            {refreshed ? "Done" : "Refresh"}
          </button>
        </div>

        {/* Divider */}
        <div
          className="mb-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        />

        {/* Databases Section */}
        <div className="mb-6">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: "rgba(148,163,184,0.45)" }}
          >
            Databases
          </p>

          {/* Database Card */}
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150 group"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.07)";
              (e.currentTarget as HTMLElement).style.border =
                "1px solid rgba(255,255,255,0.14)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.border =
                "1px solid rgba(255,255,255,0.09)";
            }}
            data-testid="button-db-card-development"
          >
            {/* DB Icon */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: "rgba(52,211,153,0.1)",
                border: "1px solid rgba(52,211,153,0.18)",
              }}
            >
              <Database className="h-4 w-4 text-emerald-400" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p
                  className="text-xs font-semibold truncate"
                  style={{ color: "rgba(226,232,240,0.9)" }}
                >
                  Development Database
                </p>
                {/* Status Badge */}
                <span
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide flex-shrink-0"
                  style={{
                    background: "rgba(52,211,153,0.12)",
                    border: "1px solid rgba(52,211,153,0.25)",
                    color: "#34d399",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                    style={{ boxShadow: "0 0 4px rgba(52,211,153,0.7)" }}
                  />
                  Active
                </span>
              </div>
              <p
                className="text-[11px]"
                style={{ color: "rgba(148,163,184,0.6)" }}
              >
                29.06 MB / 20 GB
              </p>
            </div>

            {/* Arrow */}
            <ChevronRight
              className="h-4 w-4 flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
              style={{ color: "rgba(148,163,184,0.4)" }}
            />
          </button>
        </div>

        {/* Info Sections */}
        <div className="space-y-5">
          {/* Billing Period */}
          <div>
            <p
              className="text-xs font-semibold mb-1"
              style={{ color: "rgba(226,232,240,0.85)" }}
            >
              Billing Period
            </p>
            <p
              className="text-[11px]"
              style={{ color: "rgba(148,163,184,0.6)" }}
            >
              Renews monthly, {RENEWAL_DATE}
            </p>
          </div>

          {/* Hours of Compute */}
          <div>
            <p
              className="text-xs font-semibold mb-1"
              style={{ color: "rgba(226,232,240,0.85)" }}
            >
              Hours of Compute Used
            </p>
            <p
              className="text-[11px]"
              style={{ color: "rgba(148,163,184,0.6)" }}
            >
              0 hours
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
