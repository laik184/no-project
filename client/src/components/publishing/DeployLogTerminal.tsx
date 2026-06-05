interface DeployLogTerminalProps {
  allLogs: string[];
  done: boolean;
  logEndRef: React.RefObject<HTMLDivElement>;
}

export function DeployLogTerminal({ allLogs, done, logEndRef }: DeployLogTerminalProps) {
  return (
    <div
      className="flex-1 mx-5 mb-4 rounded-xl overflow-hidden flex flex-col min-h-0"
      style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.35)" }}
    >
      <div
        className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        {["#f87171", "#fbbf24", "#4ade80"].map((c) => (
          <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.5 }} />
        ))}
        <span className="ml-1 text-[10.5px] font-mono" style={{ color: "rgba(100,116,139,0.55)" }}>
          deployment.log
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2.5 font-mono text-[11px] space-y-0.5" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>
        {allLogs.length === 0 ? (
          <p style={{ color: "rgba(100,116,139,0.4)" }}>Waiting to start…</p>
        ) : (
          allLogs.map((line, i) => (
            <p
              key={i}
              className="log-line leading-relaxed"
              style={{
                color: line.toLowerCase().includes("fail") || line.toLowerCase().includes("error")
                  ? "#fca5a5"
                  : line.toLowerCase().includes("success") || line.toLowerCase().includes("complete") || line.toLowerCase().includes("passed") || line.toLowerCase().includes("ready") || line.toLowerCase().includes("live")
                  ? "#86efac"
                  : "rgba(148,163,184,0.75)",
              }}
            >
              <span style={{ color: "rgba(100,116,139,0.4)", marginRight: "8px" }}>›</span>
              {line}
            </p>
          ))
        )}
        {!done && allLogs.length > 0 && (
          <p className="log-line" style={{ color: "rgba(167,139,250,0.6)" }}>
            <span style={{ marginRight: "8px" }}>›</span>
            <span style={{ animation: "pulse-glow 1.2s ease-in-out infinite" }}>_</span>
          </p>
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
