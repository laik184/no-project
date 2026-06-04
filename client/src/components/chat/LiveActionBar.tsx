import { Brain } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import { TOOL_ICON_MAP, TOOL_COLOR_MAP, TOOL_ANIMATION_MAP, TOOL_EMOJI_MAP } from "./tool-maps";

export const LIVE_ACTION_CSS = `
  @keyframes la-spin    { to { transform: rotate(360deg); } }
  @keyframes la-pulse   { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.55; } }
  @keyframes la-bounce  { 0%,100% { transform: translateY(0); } 45% { transform: translateY(-4px); } }
  @keyframes la-flash   { 0%,100% { opacity: 1; } 50% { opacity: 0.12; } }
  @keyframes la-shake   { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-14deg); } 75% { transform: rotate(14deg); } }
  @keyframes la-ping    { 0% { transform: scale(1); opacity: 0.9; } 80%,100% { transform: scale(2); opacity: 0; } }
  @keyframes la-enter   { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes la-think-dot { 0%,80%,100% { transform:scale(0.55); opacity:0.3; } 40% { transform:scale(1); opacity:1; } }
  .la-spin         { animation: la-spin    0.85s linear infinite; }
  .la-pulse        { animation: la-pulse   1.1s ease-in-out infinite; }
  .la-bounce       { animation: la-bounce  0.75s ease-in-out infinite; }
  .la-flash        { animation: la-flash   0.65s ease-in-out infinite; }
  .la-shake        { animation: la-shake   0.45s ease-in-out infinite; }
  .la-enter        { animation: la-enter   0.2s cubic-bezier(0.22,1,0.36,1) both; }
  .la-think-dot-1  { animation: la-think-dot 1.4s ease-in-out 0ms   infinite; }
  .la-think-dot-2  { animation: la-think-dot 1.4s ease-in-out 200ms infinite; }
  .la-think-dot-3  { animation: la-think-dot 1.4s ease-in-out 400ms infinite; }
`;

export function ThinkingBubble() {
  return (
    <div className="la-enter flex items-center gap-2 py-1 px-1" data-testid="thinking-bubble">
      <style>{LIVE_ACTION_CSS}</style>
      <span className="text-[11px] font-semibold" style={{ color: "#94a3b8" }}>Thinking</span>
      <span className="flex items-end gap-[3px] pb-[1px]">
        <span className="la-think-dot-1 w-[4px] h-[4px] rounded-full inline-block" style={{ background: "#3b82f6" }} />
        <span className="la-think-dot-2 w-[4px] h-[4px] rounded-full inline-block" style={{ background: "#3b82f6" }} />
        <span className="la-think-dot-3 w-[4px] h-[4px] rounded-full inline-block" style={{ background: "#3b82f6" }} />
      </span>
      <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.55)" }}>Analyzing request and planning steps</span>
    </div>
  );
}

export function LiveActionBar({ action }: { action: AgentStreamItem }) {
  const tool    = action.tool ?? "analysis.think";
  const isThink = tool === "analysis.think";
  const Icon    = TOOL_ICON_MAP[tool] ?? Brain;
  const color   = TOOL_COLOR_MAP[tool] ?? "#3b82f6";
  const anim    = TOOL_ANIMATION_MAP[tool] ?? "pulse";
  const emoji   = TOOL_EMOJI_MAP[tool] ?? "⚙️";
  const label   = isThink ? "Thinking" : "Working";

  return (
    <div className="la-enter flex items-center gap-2 py-1 px-1" data-testid="live-action-bar">
      <style>{LIVE_ACTION_CSS}</style>
      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.15)", color: "rgba(148,163,184,0.65)" }}>
        {tool}
      </span>
      <span className="text-[11px] font-semibold" style={{ color: "#e5e7eb" }}>{label}</span>
      <span className="flex items-end gap-[3px] pb-[1px]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded-full inline-block"
            style={{ width: 3.5, height: 3.5, background: color, animation: `la-think-dot 1.3s ease-in-out ${i * 180}ms infinite` }} />
        ))}
      </span>
      <span className="text-[11px] leading-none">{emoji}</span>
      <span className="text-[10px]" style={{ color: "#94a3b8" }}>{action.content}</span>
    </div>
  );
}
