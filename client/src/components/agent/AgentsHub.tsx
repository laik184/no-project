import { useState, useEffect, useRef } from "react";
import { Bot, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentMode, type AgentMode } from "@/hooks/useAgentMode";

const MODE_DESCRIPTIONS: Record<AgentMode, string> = {
  lite: "Lightweight and fast. Best for simple tasks, quick edits, and low-cost completions.",
  economy: "Cost-optimized models for everyday tasks. Delivers a strong balance of speed and quality. Best mode for most builds.",
  power: "Maximum capability models. Best for complex reasoning, architecture design, and hard bugs. Requires Core.",
};

interface AgentsHubProps {
  open: boolean;
  onClose: () => void;
}

export function AgentsHub({ open, onClose }: AgentsHubProps) {
  const [activeMode, setActiveMode] = useAgentMode();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "I") {
        const order: AgentMode[] = ["lite", "economy", "power"];
        setActiveMode((prev) => {
          const idx = order.indexOf(prev);
          return order[(idx + 1) % order.length];
        });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open && !visible) return null;

  return (
    <div
      className="flex flex-col"
      style={{
        width: "300px",
        background: "rgba(24,24,32,0.98)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: "14px",
        boxShadow: "0 -4px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,141,255,0.06)",
        transform: visible ? "scale(1) translateY(0)" : "scale(0.96) translateY(6px)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.22s cubic-bezier(0.34,1.4,0.64,1), opacity 0.2s ease",
        pointerEvents: visible ? "auto" : "none",
        overflow: "hidden",
      }}
    >
      {/* Top glow line */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(124,141,255,0.45) 40%, rgba(167,139,250,0.45) 60%, transparent)" }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.88)" }}>
          Agent modes
        </span>
        {/* Keyboard shortcut hint */}
        <div className="flex items-center gap-1">
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Cycle</span>
          {["Ctrl", "Shift", "I"].map((k) => (
            <span
              key={k}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.4,
              }}
            >
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Mode selector row */}
      <div className="flex items-center gap-1.5 px-3 pb-3">
        {/* Lite */}
        <button
          onClick={() => setActiveMode("lite")}
          data-testid="mode-lite"
          className="flex-1 py-2 rounded-xl text-[13px] font-medium transition-all duration-180"
          style={{
            background: activeMode === "lite" ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.05)",
            border: activeMode === "lite" ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.07)",
            color: activeMode === "lite" ? "#c4b5fd" : "rgba(255,255,255,0.5)",
            boxShadow: activeMode === "lite" ? "0 0 12px rgba(99,102,241,0.18)" : "none",
          }}
        >
          Lite
        </button>

        {/* Economy */}
        <button
          onClick={() => setActiveMode("economy")}
          data-testid="mode-economy"
          className="flex-1 py-2 rounded-xl text-[13px] font-medium transition-all duration-180"
          style={{
            background: activeMode === "economy" ? "rgba(30,33,60,0.95)" : "rgba(255,255,255,0.05)",
            border: activeMode === "economy" ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(255,255,255,0.07)",
            color: activeMode === "economy" ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.5)",
            boxShadow: activeMode === "economy" ? "inset 0 0 20px rgba(99,102,241,0.08), 0 0 12px rgba(99,102,241,0.15)" : "none",
          }}
        >
          Economy
        </button>

        {/* Power + Core badge */}
        <button
          onClick={() => setActiveMode("power")}
          data-testid="mode-power"
          className="flex-1 py-2 rounded-xl text-[13px] font-medium transition-all duration-180 flex items-center justify-center gap-1.5"
          style={{
            background: activeMode === "power" ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.05)",
            border: activeMode === "power" ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.07)",
            color: activeMode === "power" ? "#c4b5fd" : "rgba(255,255,255,0.5)",
            boxShadow: activeMode === "power" ? "0 0 12px rgba(99,102,241,0.18)" : "none",
          }}
        >
          Power
          <span
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
            style={{
              background: "rgba(239,68,68,0.18)",
              border: "1px solid rgba(239,68,68,0.35)",
              color: "#f87171",
            }}
          >
            <Zap className="w-2 h-2" style={{ fill: "#f87171" }} />
            Core
          </span>
        </button>
      </div>

      {/* Description */}
      <div
        className="px-4 pb-4 text-[12px] leading-relaxed"
        style={{ color: "rgba(255,255,255,0.38)" }}
      >
        {MODE_DESCRIPTIONS[activeMode]}
      </div>
    </div>
  );
}

interface AgentsButtonProps {
  className?: string;
  size?: "sm" | "md";
}

export function AgentsButton({ className, size = "md" }: AgentsButtonProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-testid="button-agents-hub-open"
        className={cn(
          "flex items-center justify-center rounded-xl transition-all duration-200",
          size === "md" ? "w-8 h-8" : "w-6 h-6",
          className
        )}
        style={{
          background: open || hovered
            ? "linear-gradient(135deg, rgba(124,141,255,0.2), rgba(167,139,250,0.2))"
            : "rgba(255,255,255,0.06)",
          border: open || hovered
            ? "1px solid rgba(124,141,255,0.45)"
            : "1px solid rgba(255,255,255,0.08)",
          boxShadow: open || hovered ? "0 0 14px rgba(124,141,255,0.3)" : "none",
        }}
      >
        <Bot
          className={size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"}
          style={{ color: open || hovered ? "#a5b4fc" : "rgba(255,255,255,0.5)" }}
        />
      </button>

      {/* Tooltip — only when closed and hovered */}
      {!open && (
        <div
          className="absolute bottom-full left-1/2 mb-2 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap pointer-events-none transition-all duration-150"
          style={{
            background: "rgba(10,10,28,0.95)",
            border: "1px solid rgba(124,141,255,0.25)",
            color: "#a5b4fc",
            opacity: hovered ? 1 : 0,
            transform: `translateX(-50%) translateY(${hovered ? "0px" : "4px"})`,
          }}
        >
          Agent modes
        </div>
      )}

      {/* Panel — anchored above the button, right-aligned */}
      <div
        className="absolute z-50"
        style={{
          bottom: "calc(100% + 8px)",
          right: 0,
        }}
      >
        <AgentsHub open={open} onClose={() => setOpen(false)} />
      </div>
    </div>
  );
}
