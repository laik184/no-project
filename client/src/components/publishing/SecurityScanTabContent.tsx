import { Loader2, Check, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ScanIssue, type IssueSeverity, type SecurityInnerTab, type ScanStatus } from "./security-scan-data";

interface SevCfg {
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
}

interface SecurityScanTabContentProps {
  innerTab: SecurityInnerTab;
  scanStatus: ScanStatus;
  activeIssues: ScanIssue[];
  hiddenIssues: ScanIssue[];
  fixedCount: number;
  sevCfg: Record<IssueSeverity, SevCfg>;
  fixIssue: (id: string) => void;
  hideIssue: (id: string) => void;
  restoreIssue: (id: string) => void;
  runScan: () => void;
  autoScan: boolean;
  setAutoScan: (fn: (v: boolean) => boolean) => void;
  deepScan: boolean;
  setDeepScan: (fn: (v: boolean) => boolean) => void;
  frequency: "manual" | "daily" | "weekly";
  setFrequency: (f: "manual" | "daily" | "weekly") => void;
}

export function SecurityScanTabContent({ innerTab, scanStatus, activeIssues, hiddenIssues, fixedCount, sevCfg, fixIssue, hideIssue, restoreIssue, runScan, autoScan, setAutoScan, deepScan, setDeepScan, frequency, setFrequency }: SecurityScanTabContentProps) {
  return (
    <>
      {/* ACTIVE ISSUES */}
      {innerTab === "active" && (
        <>
          {scanStatus === "idle" && (
            <div className="flex flex-col items-center justify-center h-48 gap-3" style={{ color: "rgba(100,116,139,0.45)" }}>
              <Shield className="h-10 w-10 opacity-20" />
              <p className="text-[13px]">Run a scan to detect vulnerabilities</p>
              <button onClick={runScan} className="px-4 py-2 rounded-lg text-[12px] font-semibold" style={{ background: "linear-gradient(135deg,#7c8dff,#a78bfa)", color: "#fff" }} data-testid="button-run-scan-empty">Start Scan</button>
            </div>
          )}
          {scanStatus === "done" && activeIssues.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: "rgba(74,222,128,0.7)" }}>
              <Check className="h-10 w-10" style={{ color: "rgba(74,222,128,0.5)" }} />
              <p className="text-[13px] font-medium">No vulnerabilities found 🎉</p>
              <p className="text-[11px]" style={{ color: "rgba(100,116,139,0.5)" }}>Your app looks clean!</p>
            </div>
          )}
          {activeIssues.length > 0 && activeIssues.map((issue, idx) => {
            const sc = sevCfg[issue.severity];
            const isCrit = issue.severity === "critical";
            return (
              <div
                key={issue.id}
                className={cn("sec-card rounded-xl p-3.5 transition-all duration-200", isCrit && "crit-card")}
                style={{ background: sc.bg, border: `1px solid ${sc.border}`, animationDelay: `${idx * 80}ms` }}
                data-testid={`issue-card-${issue.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: sc.border, color: sc.color }}>
                        {isCrit && "⚠ "}{sc.label}
                      </span>
                      <span className="text-[12.5px] font-semibold truncate" style={{ color: "rgba(226,232,240,0.9)" }}>{issue.title}</span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed" style={{ color: "rgba(148,163,184,0.65)" }}>{issue.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {issue.fixing ? (
                      <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>
                        <Loader2 className="h-3 w-3 animate-spin" /> Fixing…
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => fixIssue(issue.id)}
                          className="text-[11.5px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150"
                          style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(74,222,128,0.18)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(74,222,128,0.1)"; }}
                          data-testid={`button-fix-${issue.id}`}
                        >Fix</button>
                        <button
                          onClick={() => hideIssue(issue.id)}
                          className="text-[11.5px] font-medium px-2.5 py-1 rounded-lg transition-all duration-150"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(148,163,184,0.55)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                          data-testid={`button-hide-${issue.id}`}
                        >Hide</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {fixedCount > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl" style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
              <Check className="h-3.5 w-3.5" style={{ color: "#4ade80" }} />
              <span className="text-[11.5px]" style={{ color: "rgba(74,222,128,0.8)" }}>{fixedCount} issue{fixedCount > 1 ? "s" : ""} resolved</span>
            </div>
          )}
        </>
      )}

      {/* HIDDEN ISSUES */}
      {innerTab === "hidden" && (
        <>
          {hiddenIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2" style={{ color: "rgba(100,116,139,0.45)" }}>
              <Shield className="h-8 w-8 opacity-20" />
              <p className="text-[12.5px]">No hidden issues</p>
            </div>
          ) : hiddenIssues.map((issue, idx) => {
            const sc = sevCfg[issue.severity];
            return (
              <div
                key={issue.id}
                className="sec-card rounded-xl p-3.5"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", animationDelay: `${idx * 60}ms`, opacity: 0.75 }}
                data-testid={`hidden-issue-${issue.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: sc.border, color: sc.color }}>{sc.label}</span>
                      <span className="text-[12px] font-semibold" style={{ color: "rgba(148,163,184,0.7)" }}>{issue.title}</span>
                    </div>
                    <p className="text-[11px]" style={{ color: "rgba(100,116,139,0.5)" }}>{issue.desc}</p>
                  </div>
                  <button
                    onClick={() => restoreIssue(issue.id)}
                    className="text-[11.5px] font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 transition-all duration-150"
                    style={{ background: "rgba(124,141,255,0.09)", border: "1px solid rgba(124,141,255,0.2)", color: "#a78bfa" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(124,141,255,0.16)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(124,141,255,0.09)"; }}
                    data-testid={`button-restore-${issue.id}`}
                  >Restore</button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* SCAN SETTINGS */}
      {innerTab === "settings" && (
        <div className="space-y-4">
          <div className="rounded-xl p-4 space-y-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(100,116,139,0.5)" }}>Scan Options</p>
            {[
              { label: "Auto Scan", desc: "Automatically scan on every deployment", value: autoScan, set: setAutoScan, testId: "toggle-auto-scan" },
              { label: "Deep Scan", desc: "Include dependency tree and SAST analysis", value: deepScan, set: setDeepScan, testId: "toggle-deep-scan" },
            ].map(({ label, desc, value, set, testId }) => (
              <div key={label} className="flex items-center justify-between gap-4 py-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <p className="text-[12.5px] font-medium" style={{ color: "rgba(226,232,240,0.85)" }}>{label}</p>
                  <p className="text-[10.5px] mt-0.5" style={{ color: "rgba(100,116,139,0.5)" }}>{desc}</p>
                </div>
                <button
                  onClick={() => set((v: boolean) => !v)}
                  className="flex-shrink-0 relative w-9 h-5 rounded-full transition-all duration-300"
                  style={{ background: value ? "linear-gradient(135deg,#7c8dff,#a78bfa)" : "rgba(255,255,255,0.1)", border: `1px solid ${value ? "rgba(124,141,255,0.4)" : "rgba(255,255,255,0.1)"}` }}
                  data-testid={testId}
                >
                  <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300" style={{ background: "#fff", left: value ? "calc(100% - 18px)" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-3" style={{ color: "rgba(100,116,139,0.5)" }}>Scan Frequency</p>
            <div className="flex gap-2">
              {(["manual", "daily", "weekly"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold capitalize transition-all duration-200"
                  style={{ background: frequency === f ? "rgba(124,141,255,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${frequency === f ? "rgba(124,141,255,0.3)" : "rgba(255,255,255,0.07)"}`, color: frequency === f ? "#a78bfa" : "rgba(148,163,184,0.5)" }}
                  data-testid={`freq-${f}`}
                >{f}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
