import { useState, useEffect } from "react";

const CONSOLE_MESSAGES = [
  "console.run() → success",
  "Fixing bug #4821...",
  "Server reset complete",
  "Hot reload triggered",
  "Building modules...",
  "Resolving dependencies...",
  "Compiling TypeScript...",
  "Optimizing bundle...",
  "Syncing filesystem...",
  "Agent writing code...",
  "Running test suite...",
  "Deploying changes...",
  "I am fixing bugs...",
  "Starting dev server...",
  "Watching for changes...",
];

export function ProcessingPulse() {
  const [pulseStatusIndex, setPulseStatusIndex] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setPulseStatusIndex(i => (i + 1) % CONSOLE_MESSAGES.length);
    }, 1800);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)", zIndex: 36,
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "clamp(3px, 0.8vmin, 6px)", pointerEvents: "none",
      userSelect: "none", width: "clamp(44px, 9vmin, 68px)",
    }}>
      <div style={{ animation: "pp-float 3.5s ease-in-out infinite", width: "100%" }}>
        <svg width="100%" height="100%" viewBox="0 0 148 128" fill="none"
          style={{ animation: "pp-glow-ring 2.8s ease-in-out infinite", overflow: "visible", display: "block" }}>
          <line x1="74" y1="10" x2="132" y2="52" stroke="rgba(99,102,241,0.85)" strokeWidth="1.5" strokeDasharray="7 4" style={{ animation: "pp-line-flow 2.2s 0s linear infinite" }} />
          <line x1="132" y1="52" x2="110" y2="114" stroke="rgba(139,92,246,0.85)" strokeWidth="1.5" strokeDasharray="7 4" style={{ animation: "pp-line-flow 2.2s 0.35s linear infinite" }} />
          <line x1="110" y1="114" x2="38" y2="114" stroke="rgba(99,102,241,0.85)" strokeWidth="1.5" strokeDasharray="7 4" style={{ animation: "pp-line-flow 2.2s 0.7s linear infinite" }} />
          <line x1="38" y1="114" x2="16" y2="52" stroke="rgba(139,92,246,0.85)" strokeWidth="1.5" strokeDasharray="7 4" style={{ animation: "pp-line-flow 2.2s 1.05s linear infinite" }} />
          <line x1="16" y1="52" x2="74" y2="10" stroke="rgba(99,102,241,0.85)" strokeWidth="1.5" strokeDasharray="7 4" style={{ animation: "pp-line-flow 2.2s 1.4s linear infinite" }} />
          <line x1="74" y1="10" x2="110" y2="114" stroke="rgba(167,139,250,0.55)" strokeWidth="1" strokeDasharray="5 5" style={{ animation: "pp-line-flow 3.0s 0.6s linear infinite" }} />
          <line x1="132" y1="52" x2="38" y2="114" stroke="rgba(167,139,250,0.55)" strokeWidth="1" strokeDasharray="5 5" style={{ animation: "pp-line-flow 3.0s 1.1s linear infinite" }} />
          <line x1="132" y1="52" x2="16" y2="52" stroke="rgba(167,139,250,0.45)" strokeWidth="1" strokeDasharray="5 5" style={{ animation: "pp-line-flow 3.0s 1.6s linear infinite" }} />
          <line x1="74" y1="10" x2="38" y2="114" stroke="rgba(167,139,250,0.45)" strokeWidth="1" strokeDasharray="5 5" style={{ animation: "pp-line-flow 3.0s 2.1s linear infinite" }} />
          <line x1="16" y1="52" x2="110" y2="114" stroke="rgba(167,139,250,0.40)" strokeWidth="1" strokeDasharray="5 5" style={{ animation: "pp-line-flow 3.0s 2.6s linear infinite" }} />
          <circle cx="74" cy="10" r="10" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.9)" strokeWidth="1.8" style={{ animation: "pp-node-pulse 2s 0s ease-in-out infinite", transformOrigin: "74px 10px" }} />
          <circle cx="74" cy="10" r="4.5" fill="rgba(165,180,252,1)" style={{ filter: "drop-shadow(0 0 5px rgba(99,102,241,0.9))" }} />
          <circle cx="132" cy="52" r="8.5" fill="rgba(139,92,246,0.12)" stroke="rgba(139,92,246,0.88)" strokeWidth="1.8" style={{ animation: "pp-node-pulse 2s 0.4s ease-in-out infinite", transformOrigin: "132px 52px" }} />
          <circle cx="132" cy="52" r="3.8" fill="rgba(196,181,253,1)" style={{ filter: "drop-shadow(0 0 4px rgba(139,92,246,0.9))" }} />
          <circle cx="110" cy="114" r="7.5" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.85)" strokeWidth="1.8" style={{ animation: "pp-node-pulse 2s 0.8s ease-in-out infinite", transformOrigin: "110px 114px" }} />
          <circle cx="110" cy="114" r="3.3" fill="rgba(165,180,252,0.97)" style={{ filter: "drop-shadow(0 0 4px rgba(99,102,241,0.8))" }} />
          <circle cx="38" cy="114" r="7.5" fill="rgba(139,92,246,0.12)" stroke="rgba(139,92,246,0.85)" strokeWidth="1.8" style={{ animation: "pp-node-pulse 2s 1.2s ease-in-out infinite", transformOrigin: "38px 114px" }} />
          <circle cx="38" cy="114" r="3.3" fill="rgba(196,181,253,0.95)" style={{ filter: "drop-shadow(0 0 4px rgba(139,92,246,0.8))" }} />
          <circle cx="16" cy="52" r="8.5" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.88)" strokeWidth="1.8" style={{ animation: "pp-node-pulse 2s 1.6s ease-in-out infinite", transformOrigin: "16px 52px" }} />
          <circle cx="16" cy="52" r="3.8" fill="rgba(165,180,252,1)" style={{ filter: "drop-shadow(0 0 5px rgba(99,102,241,0.9))" }} />
          <circle cx="74" cy="64" r="14" fill="rgba(99,102,241,0.10)" stroke="rgba(99,102,241,0.5)" strokeWidth="1" style={{ animation: "pp-outer-ring 2.4s ease-out infinite", transformOrigin: "74px 64px" }} />
          <circle cx="74" cy="64" r="9" fill="rgba(99,102,241,0.18)" stroke="rgba(99,102,241,0.75)" strokeWidth="1.5" style={{ animation: "pp-node-pulse 2s 0.2s ease-in-out infinite", transformOrigin: "74px 64px" }} />
          <circle cx="74" cy="64" r="4" fill="rgba(165,180,252,1)" style={{ filter: "drop-shadow(0 0 7px rgba(99,102,241,1))" }} />
          <line x1="74" y1="64" x2="74" y2="10" stroke="rgba(99,102,241,0.35)" strokeWidth="1" strokeDasharray="4 4" style={{ animation: "pp-line-flow 1.8s 0.1s linear infinite" }} />
          <line x1="74" y1="64" x2="132" y2="52" stroke="rgba(139,92,246,0.35)" strokeWidth="1" strokeDasharray="4 4" style={{ animation: "pp-line-flow 1.8s 0.5s linear infinite" }} />
          <line x1="74" y1="64" x2="110" y2="114" stroke="rgba(99,102,241,0.35)" strokeWidth="1" strokeDasharray="4 4" style={{ animation: "pp-line-flow 1.8s 0.9s linear infinite" }} />
          <line x1="74" y1="64" x2="38" y2="114" stroke="rgba(139,92,246,0.35)" strokeWidth="1" strokeDasharray="4 4" style={{ animation: "pp-line-flow 1.8s 1.3s linear infinite" }} />
          <line x1="74" y1="64" x2="16" y2="52" stroke="rgba(99,102,241,0.35)" strokeWidth="1" strokeDasharray="4 4" style={{ animation: "pp-line-flow 1.8s 1.7s linear infinite" }} />
        </svg>
      </div>

      <div key={pulseStatusIndex} style={{
        fontSize: "clamp(5px, 1vmin, 7px)", fontWeight: 600,
        color: "rgba(199,210,254,0.95)",
        fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
        letterSpacing: "0.03em", animation: "pp-msg-in 0.28s ease both",
        whiteSpace: "nowrap", background: "rgba(9,10,20,0.65)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        padding: "clamp(1px,0.25vmin,2px) clamp(3px,0.9vmin,5px)",
        borderRadius: 999, border: "1px solid rgba(99,102,241,0.22)",
        boxShadow: "0 0 8px rgba(99,102,241,0.18)",
        maxWidth: "clamp(60px, 18vmin, 110px)", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        ▸ {CONSOLE_MESSAGES[pulseStatusIndex]}
      </div>
    </div>
  );
}
