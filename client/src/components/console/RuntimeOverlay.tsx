/**
 * IQ 2000 — Console · RuntimeOverlay
 *
 * Full-panel overlay that appears on crashed / recovering / failed states.
 * Shows appropriate messaging and a recovery animation.
 * Fades out automatically on recovery.
 */

import React from "react";
import type { RuntimeState } from "@/types/console";

interface Props {
  state:    RuntimeState;
  message?: string;
  onDismiss?: () => void;
}

interface OverlayConfig {
  icon:    string;
  title:   string;
  body:    string;
  color:   string;
  bg:      string;
  border:  string;
  animate: boolean;
}

const CONFIGS: Partial<Record<RuntimeState, OverlayConfig>> = {
  crashed: {
    icon:    "✕",
    title:   "Process crashed",
    body:    "The runtime exited unexpectedly. The AI agent may attempt recovery.",
    color:   "#ff5555",
    bg:      "rgba(255,85,85,0.06)",
    border:  "rgba(255,85,85,0.2)",
    animate: false,
  },
  recovering: {
    icon:    "⟳",
    title:   "AI fixing runtime…",
    body:    "The agent detected a crash and is attempting to self-heal.",
    color:   "#ffd93d",
    bg:      "rgba(255,217,61,0.06)",
    border:  "rgba(255,217,61,0.2)",
    animate: true,
  },
  failed: {
    icon:    "✕",
    title:   "Runtime failed",
    body:    "The process could not start. Check the logs above for details.",
    color:   "#ff5555",
    bg:      "rgba(255,85,85,0.06)",
    border:  "rgba(255,85,85,0.2)",
    animate: false,
  },
};

const SHOW_STATES = new Set<RuntimeState>(["crashed", "recovering", "failed"]);

export function RuntimeOverlay({ state, message, onDismiss }: Props) {
  if (!SHOW_STATES.has(state)) return null;

  const cfg = CONFIGS[state];
  if (!cfg) return null;

  return (
    <div
      className="mx-3 my-2 rounded-lg p-3 flex items-start gap-3 flex-shrink-0"
      style={{
        background:   cfg.bg,
        border:       `1px solid ${cfg.border}`,
        transition:   "all 0.3s ease",
      }}
    >
      {/* Icon */}
      <span
        className={`text-lg flex-shrink-0 leading-none mt-0.5 ${cfg.animate ? "animate-spin" : ""}`}
        style={{ color: cfg.color }}
      >
        {cfg.icon}
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold mb-0.5" style={{ color: cfg.color }}>
          {cfg.title}
        </p>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
          {message || cfg.body}
        </p>
      </div>

      {/* Dismiss button (only for terminal states) */}
      {!cfg.animate && onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-[10px] px-2 py-1 rounded hover:bg-white/10 transition-colors"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          dismiss
        </button>
      )}
    </div>
  );
}
