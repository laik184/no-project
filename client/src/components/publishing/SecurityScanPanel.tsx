import { useState, useRef, useEffect } from "react";
import {
  Shield,
  X,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ScanStatus = "idle" | "scanning" | "done";
type IssueSeverity = "critical" | "medium" | "low";
type IssueState = "active" | "hidden" | "fixed";
type SecurityInnerTab = "active" | "hidden" | "settings";

interface ScanIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  desc: string;
  state: IssueState;
  fixing: boolean;
}

const SEED_ISSUES: ScanIssue[] = [
  { id: "i1", severity: "critical", title: "SQL Injection Vulnerability",        desc: "User input passed directly into database query without sanitisation.",   state: "active", fixing: false },
  { id: "i2", severity: "critical", title: "Exposed API Secret in Bundle",       desc: "STRIPE_SECRET_KEY detected in client-side JavaScript bundle.",            state: "active", fixing: false },
  { id: "i3", severity: "medium",   title: "Missing Content-Security-Policy",    desc: "No CSP header is set, allowing potential XSS attacks.",                  state: "active", fixing: false },
  { id: "i4", severity: "medium",   title: "Outdated Dependency (axios 0.21)",   desc: "axios@0.21.1 has known SSRF vulnerability — upgrade to ≥1.6.0.",         state: "active", fixing: false },
  { id: "i5", severity: "low",      title: "HTTP Strict Transport Security Off", desc: "HSTS header not present. Connections may fall back to plain HTTP.",       state: "active", fixing: false },
  { id: "i6", severity: "low",      title: "X-Frame-Options Not Set",            desc: "App may be embeddable in iframes, enabling clickjacking.",                state: "active", fixing: false },
];

export function SecurityScanPanel({ onClose }: { onClose: () => void }) {
  const [scanStatus, setScanStatus]  = useState<ScanStatus>("idle");
  const [scanPct, setScanPct]        = useState(0);
  const [issues, setIssues]          = useState<ScanIssue[]>([]);
  const [innerTab, setInnerTab]      = useState<SecurityInnerTab>("active");
  const [autoScan, setAutoScan]      = useState(false);
  const [deepScan, setDeepScan]      = useState(true);
  const [frequency, setFrequency]    = useState<"manual" | "daily" | "weekly">("manual");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runScan = () => {
    if (scanStatus === "scanning") return;
    setScanStatus("scanning");
    setScanPct(0);
    setIssues([]);
    setInnerTab("active");

    let pct = 0;
    const step = () => {
      pct += Math.random() * 12 + 5;
      if (pct >= 100) {
        pct = 100;
        setScanPct(100);
        setIssues(SEED_ISSUES.map((i) => ({ ...i, state: "active", fixing: false })));
        setScanStatus("done");
        return;
      }
      setScanPct(Math.min(pct, 100));
      const milestone = Math.floor(pct / (100 / SEED_ISSUES.length));
      setIssues((prev) => {
        const next = SEED_ISSUES.slice(0, milestone + 1).map((seed) => {
          const existing = prev.find((p) => p.id === seed.id);
          return existing ?? { ...seed, state: "active" as IssueState, fixing: false };
        });
        return next;
      });
      timerRef.current = setTimeout(step, 300 + Math.random() * 250);
    };
    timerRef.current = setTimeout(step, 200);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const hideIssue    = (id: string) => setIssues((prev) => prev.map((i) => i.id === id ? { ...i, state: "hidden"  } : i));
  const restoreIssue = (id: string) => setIssues((prev) => prev.map((i) => i.id === id ? { ...i, state: "active"  } : i));
  const fixIssue = (id: string) => {
    setIssues((prev) => prev.map((i) => i.id === id ? { ...i, fixing: true } : i));
    setTimeout(() => setIssues((prev) => prev.map((i) => i.id === id ? { ...i, fixing: false, state: "fixed" } : i)), 1800);
  };

  const activeIssues = issues.filter((i) => i.state === "active");
  const hiddenIssues = issues.filter((i) => i.state === "hidden");
  const fixedCount   = issues.filter((i) => i.state === "fixed").length;

  const sevCfg: Record<IssueSeverity, { label: string; color: string; bg: string; border: string; glow: string }> = {
    critical: { label: "Critical", color: "#f87171", bg: "rgba(248,113,113,0.1)",  border: "rgba(248,113,113,0.35)", glow: "rgba(248,113,113,0.2)" },
    medium:   { label: "Medium",   color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.25)",  glow: ""                        },
    low:      { label: "Low",      color: "#7c8dff", bg: "rgba(124,141,255,0.08)", border: "rgba(124,141,255,0.2)",  glow: ""                        },
  };

  const INNER_TABS: { id: SecurityInnerTab; label: string }[] = [
    { id: "active",   label: `Active Issues${activeIssues.length ? ` (${activeIssues.length})` : ""}` },
    { id: "hidden",   label: `Hidden${hiddenIssues.length ? ` (${hiddenIssues.length})` : ""}`          },
    { id: "settings", label: "Scan Settings"                                                             },
  ];

  return (
    <div
      className="absolute inset-0 flex flex-col z-20"
      style={{ background: "hsl(222,30%,5%)", animation: "overlay-slidein 0.3s cubic-bezier(0.22,1,0.36,1)" }}
    >
      <style>{`
        @keyframes overlay-slidein { from{transform:translateY(100%);opacity:0.6} to{transform:translateY(0);opacity:1} }
        @keyframes sec-fadein  { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes crit-pulse  {
          0%,100% { box-shadow: 0 0 0 0 rgba(248,113,113,0.0), inset 0 0 0 1px rgba(248,113,113,0.35); }
          50%     { box-shadow: 0 0 14px 3px rgba(248,113,113,0.22), inset 0 0 0 1px rgba(248,113,113,0.6); }
        }
        @keyframes scan-bar    { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
        @keyframes dot-bounce  { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }
        .sec-card   { animation: sec-fadein 0.3s ease both; }
        .crit-card  { animation: crit-pulse 2s ease-in-out infinite; }
        .dot1 { animation: dot-bounce 1.2s ease-in-out 0s   infinite; }
        .dot2 { animation: dot-bounce 1.2s ease-in-out 0.2s infinite; }
        .dot3 { animation: dot-bounce 1.2s ease-in-out 0.4s infinite; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <Shield className="h-3.5 w-3.5" style={{ color: "rgba(148,163,184,0.55)" }} />
          <div>
            <span className="text-xs font-semibold tracking-wide" style={{ color: "rgba(226,232,240,0.85)" }}>Security Scan</span>
            <span className="ml-2 text-[10.5px]" style={{ color: "rgba(100,116,139,0.5)" }}>Analyze your app for vulnerabilities</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scanStatus === "idle" && (
            <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(100,116,139,0.6)" }}>Not started</span>
          )}
          {scanStatus === "scanning" && (
            <span className="flex items-center gap-1.5 text-[10.5px] px-2.5 py-1 rounded-full font-semibold" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
              <span className="dot1 inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#fbbf24" }} />
              <span className="dot2 inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#fbbf24" }} />
              <span className="dot3 inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#fbbf24" }} />
              Scanning…
            </span>
          )}
          {scanStatus === "done" && (
            <span className="flex items-center gap-1.5 text-[10.5px] px-2.5 py-1 rounded-full font-semibold" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80" }}>
              <Check className="h-3 w-3" />
              Scan complete
            </span>
          )}
          <button
            onClick={runScan}
            disabled={scanStatus === "scanning"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150"
            style={{
              background: "linear-gradient(135deg,#7c8dff,#a78bfa)",
              color: "#fff",
              opacity: scanStatus === "scanning" ? 0.5 : 1,
              cursor: scanStatus === "scanning" ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (scanStatus !== "scanning") (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = scanStatus === "scanning" ? "0.5" : "1"; }}
            data-testid="button-run-scan"
          >
            <Shield className="h-3.5 w-3.5" />
            {scanStatus === "scanning" ? "Scanning…" : "Run Scan"}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-all duration-150"
            style={{ color: "rgba(148,163,184,0.5)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            data-testid="button-close-security"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar (during scan) */}
      {scanStatus === "scanning" && (
        <div className="flex-shrink-0 px-5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px]" style={{ color: "rgba(100,116,139,0.6)" }}>Scanning dependencies, secrets, headers…</span>
            <span className="text-[10.5px] font-mono font-semibold" style={{ color: "rgba(251,191,36,0.8)" }}>{Math.round(scanPct)}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${scanPct}%`,
                background: "linear-gradient(90deg,#7c8dff,#fbbf24,#f87171)",
                backgroundSize: "200% 100%",
                animation: "scan-bar 1.8s linear infinite",
              }}
            />
          </div>
        </div>
      )}

      {/* Summary row (after done) */}
      {scanStatus === "done" && (
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { label: "Critical", count: issues.filter((i) => i.severity === "critical" && i.state !== "fixed").length, color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
            { label: "Medium",   count: issues.filter((i) => i.severity === "medium"   && i.state !== "fixed").length, color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"  },
            { label: "Low",      count: issues.filter((i) => i.severity === "low"      && i.state !== "fixed").length, color: "#7c8dff", bg: "rgba(124,141,255,0.08)", border: "rgba(124,141,255,0.2)" },
            { label: "Fixed",    count: fixedCount,                                                                     color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)"  },
          ].map(({ label, count, color, bg, border }) => (
            <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: bg, border: `1px solid ${border}`, color }}>
              <span className="text-[15px] font-bold leading-none">{count}</span>
              <span style={{ color: "rgba(148,163,184,0.55)", fontWeight: 400 }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Inner tab bar */}
      <div className="flex items-center gap-0 px-5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        {INNER_TABS.map((t) => {
          const active = innerTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setInnerTab(t.id)}
              className="relative px-3.5 py-2.5 text-[12px] font-medium transition-colors duration-150"
              style={{ color: active ? "rgba(226,232,240,0.95)" : "rgba(100,116,139,0.6)" }}
              data-testid={`sec-tab-${t.id}`}
            >
              {t.label}
              {active && <span className="absolute bottom-0 left-0 right-0 h-px rounded-full" style={{ background: "linear-gradient(90deg,#7c8dff,#a78bfa)" }} />}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.07) transparent" }}>

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

            {(scanStatus === "scanning" || scanStatus === "done") && activeIssues.length === 0 && scanStatus === "done" && (
              <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: "rgba(74,222,128,0.7)" }}>
                <Check className="h-10 w-10" style={{ color: "rgba(74,222,128,0.5)" }} />
                <p className="text-[13px] font-medium">No vulnerabilities found 🎉</p>
                <p className="text-[11px]" style={{ color: "rgba(100,116,139,0.5)" }}>Your app looks clean!</p>
              </div>
            )}

            {activeIssues.map((issue, idx) => {
              const sc = sevCfg[issue.severity];
              const isCrit = issue.severity === "critical";
              return (
                <div
                  key={issue.id}
                  className={cn("sec-card rounded-xl p-3.5 transition-all duration-200", isCrit && "crit-card")}
                  style={{
                    background: sc.bg,
                    border: `1px solid ${sc.border}`,
                    animationDelay: `${idx * 80}ms`,
                  }}
                  data-testid={`issue-card-${issue.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ background: sc.border, color: sc.color }}
                        >
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
                          >
                            Fix
                          </button>
                          <button
                            onClick={() => hideIssue(issue.id)}
                            className="text-[11.5px] font-medium px-2.5 py-1 rounded-lg transition-all duration-150"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(148,163,184,0.55)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                            data-testid={`button-hide-${issue.id}`}
                          >
                            Hide
                          </button>
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
                    >
                      Restore
                    </button>
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
                    style={{
                      background: value ? "linear-gradient(135deg,#7c8dff,#a78bfa)" : "rgba(255,255,255,0.1)",
                      border: `1px solid ${value ? "rgba(124,141,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                    }}
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
                    style={{
                      background: frequency === f ? "rgba(124,141,255,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${frequency === f ? "rgba(124,141,255,0.3)" : "rgba(255,255,255,0.07)"}`,
                      color: frequency === f ? "#a78bfa" : "rgba(148,163,184,0.5)",
                    }}
                    data-testid={`freq-${f}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
