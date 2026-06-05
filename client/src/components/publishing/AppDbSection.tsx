import { Database, Eye, EyeOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const INPUT_BASE = "w-full px-3 py-2 rounded-lg text-[12.5px] outline-none transition-all duration-150 font-mono";
const INPUT_STYLE = { background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(226,232,240,0.9)" };

interface AppDbSectionProps {
  dbStatus: "connected" | "error";
  dbUrl: string;
  dbVisible: boolean;
  setDbVisible: (fn: (v: boolean) => boolean) => void;
}

export function AppDbSection({ dbStatus, dbUrl, dbVisible, setDbVisible }: AppDbSectionProps) {
  const SECTION = "rounded-xl p-4 space-y-3 flex-shrink-0";
  const SECTION_STYLE = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" };
  const LABEL = "text-[10px] font-semibold uppercase tracking-wide";

  return (
    <div className={cn(SECTION, "set-section")} style={SECTION_STYLE}>
      <div className="flex items-center gap-2 mb-1">
        <Database className="h-3.5 w-3.5" style={{ color: dbStatus === "connected" ? "rgba(74,222,128,0.7)" : "rgba(248,113,113,0.7)" }} />
        <p className={LABEL} style={{ color: dbStatus === "connected" ? "rgba(74,222,128,0.7)" : "rgba(248,113,113,0.7)" }}>Production Database</p>
        <span className="ml-auto flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full font-semibold" style={{
          background: dbStatus === "connected" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
          border: `1px solid ${dbStatus === "connected" ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
          color: dbStatus === "connected" ? "#4ade80" : "#f87171",
        }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: dbStatus === "connected" ? "#4ade80" : "#f87171" }} />
          {dbStatus === "connected" ? "Connected" : "Error"}
        </span>
      </div>
      <div className="mt-2">
        <label className="text-[11px] font-medium block mb-1.5" style={{ color: "rgba(148,163,184,0.6)" }}>Database URL</label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={dbVisible ? "text" : "password"}
              value={dbUrl}
              readOnly
              className={cn(INPUT_BASE, "pr-9")}
              style={INPUT_STYLE}
              data-testid="input-db-url"
            />
            <button
              onClick={() => setDbVisible((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors duration-150"
              style={{ color: "rgba(100,116,139,0.5)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.8)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(100,116,139,0.5)"; }}
              title={dbVisible ? "Hide" : "Show"}
              data-testid="toggle-db-url-visibility"
            >
              {dbVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <button
            className="px-3 py-2 rounded-lg text-[11.5px] font-medium flex-shrink-0 flex items-center gap-1.5 transition-all duration-150"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(148,163,184,0.7)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            data-testid="button-reconnect-db"
          >
            <RefreshCw className="h-3 w-3" />
            Reconnect
          </button>
        </div>
      </div>
    </div>
  );
}
