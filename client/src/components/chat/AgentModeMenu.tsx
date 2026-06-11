import { useState, useRef, useEffect } from "react";
import type { AgentMode } from "@/hooks/useAgentMode";

const MODES: Array<{ id: AgentMode; label: string; description: string; badge?: string }> = [
  { id: "lite",    label: "Lite",    description: "Lightweight and fast. Great for quick fixes, small edits, and simple tasks." },
  { id: "economy", label: "Economy", description: "Cost-optimized models for everyday tasks. Delivers a strong balance of speed and quality. Best mode for most builds." },
  { id: "power",   label: "Power",   badge: "Core", description: "High-performance models for complex tasks, advanced reasoning, and large-scale rewrites." },
];

function DotsGrid({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      {[2.5, 6, 9.5].flatMap((x) =>
        [2.5, 6, 9.5].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="currentColor" />
        ))
      )}
    </svg>
  );
}

interface AgentModeMenuProps {
  mode:     AgentMode;
  onSelect: (mode: AgentMode) => void;
}

export function AgentModeMenu({ mode, onSelect }: AgentModeMenuProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const handler = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setShow(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [show]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setShow((v) => !v)}
        className="flex items-center gap-1 px-1.5 h-6 rounded-md text-[11px] font-medium transition-colors hover:bg-white/6"
        style={{ color: "#94A3B8", border: "1px solid rgba(255,255,255,0.08)" }}
        data-testid="button-mode-selector"
      >
        <DotsGrid size={10} />
        <span>{MODES.find((m) => m.id === mode)?.label ?? mode}</span>
      </button>

      {show && (
        <div
          className="absolute bottom-full right-0 mb-2 z-50 flex flex-col justify-between"
          style={{
            width: 220,
            height: 72,
            background: "#0D1117",
            border: "1px solid #1E2D3D",
            borderRadius: 10,
            boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
            overflow: "hidden",
            padding: "8px 10px 8px 10px",
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold" style={{ color: "#94A3B8" }}>Agent modes</span>
            <div className="flex items-center gap-1">
              <span className="text-[9px]" style={{ color: "#475569" }}>Cycle</span>
              {["Ctrl", "Shift", "I"].map((k) => (
                <span key={k} className="text-[8px] px-1 rounded"
                  style={{ background: "#1A2230", border: "1px solid #263244", color: "#64748B", fontFamily: "monospace" }}>
                  {k}
                </span>
              ))}
            </div>
          </div>

          {/* Mode pills */}
          <div className="flex items-center gap-1.5">
            {MODES.map((m) => {
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => { onSelect(m.id); setShow(false); }}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg text-[10.5px] font-medium transition-all"
                  style={{
                    height: 30,
                    background: isActive ? "#1A3050" : "#111827",
                    border: `1px solid ${isActive ? "#2563EB" : "#1E2D3D"}`,
                    color:  isActive ? "#E5E7EB" : "#64748B",
                  }}
                >
                  <DotsGrid size={8} />
                  <span>{m.label}</span>
                  {m.badge && (
                    <span className="text-[8px] font-bold px-1 py-0.5 rounded-sm flex items-center gap-0.5"
                      style={{ background: "#7C3AED", color: "#E9D5FF" }}>
                      + {m.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
