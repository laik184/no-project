/**
 * IQ 2000 — Console · RuntimeBadge
 *
 * Animated pill that shows the current runtime state of a project.
 * Pulses on active states, shows static color on terminal states.
 */

import React from "react";
import type { RuntimeState } from "@/types/console";

interface Props {
  state:   RuntimeState;
  message?: string;
}

interface StateConfig {
  label:  string;
  color:  string;
  bg:     string;
  pulse?: boolean;
  dot?:   string;
}

const STATE_CONFIG: Record<RuntimeState, StateConfig> = {
  idle:         { label: "idle",         color: "rgba(255,255,255,0.3)",  bg: "rgba(255,255,255,0.04)" },
  starting:     { label: "starting…",   color: "#4d9de0",                bg: "rgba(77,157,224,0.12)",  pulse: true },
  installing:   { label: "installing…", color: "#ffd93d",                bg: "rgba(255,217,61,0.12)",  pulse: true },
  compiling:    { label: "compiling…",  color: "#c77dff",                bg: "rgba(199,125,255,0.12)", pulse: true },
  ready:        { label: "ready",        color: "#6bcb77",                bg: "rgba(107,203,119,0.12)", dot: "#6bcb77" },
  restarting:   { label: "restarting…", color: "#4d9de0",                bg: "rgba(77,157,224,0.12)",  pulse: true },
  reconnecting: { label: "reconnecting…",color: "#4cc9f0",               bg: "rgba(76,201,240,0.12)",  pulse: true },
  crashed:      { label: "crashed",      color: "#ff5555",                bg: "rgba(255,85,85,0.12)",   dot: "#ff5555" },
  recovering:   { label: "AI fixing…",  color: "#ffd93d",                bg: "rgba(255,217,61,0.12)",  pulse: true },
  recovered:    { label: "recovered",    color: "#6bcb77",                bg: "rgba(107,203,119,0.12)", dot: "#6bcb77" },
  warning:      { label: "warning",      color: "#ffd93d",                bg: "rgba(255,217,61,0.12)",  dot: "#ffd93d" },
  failed:       { label: "failed",       color: "#ff5555",                bg: "rgba(255,85,85,0.12)",   dot: "#ff5555" },
};

export function RuntimeBadge({ state, message }: Props) {
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG.idle;

  return (
    <div
      className="flex items-center gap-1.5"
      title={message || cfg.label}
      style={{ transition: "all 0.3s ease" }}
    >
      {/* Dot indicator */}
      {cfg.dot ? (
        <span
          className="inline-block rounded-full flex-shrink-0"
          style={{
            width: 6, height: 6,
            background: cfg.dot,
            boxShadow:  `0 0 5px ${cfg.dot}`,
          }}
        />
      ) : cfg.pulse ? (
        <span className="relative flex-shrink-0" style={{ width: 6, height: 6 }}>
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: cfg.color, opacity: 0.6 }}
          />
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: cfg.color }}
          />
        </span>
      ) : (
        <span
          className="inline-block rounded-full flex-shrink-0"
          style={{ width: 6, height: 6, background: cfg.color, opacity: 0.4 }}
        />
      )}

      {/* Label */}
      <span
        className="text-[10px] font-medium px-1.5 py-px rounded-full select-none"
        style={{ color: cfg.color, background: cfg.bg }}
      >
        {cfg.label}
      </span>
    </div>
  );
}
