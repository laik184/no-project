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
  @keyframes la-glow-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(167,139,250,0); } 50% { box-shadow: 0 0 12px 2px rgba(167,139,250,0.22); } }
  @keyframes la-think-dot { 0%,80%,100% { transform:scale(0.55); opacity:0.3; } 40% { transform:scale(1); opacity:1; } }
  .la-spin         { animation: la-spin    0.85s linear infinite; }
  .la-pulse        { animation: la-pulse   1.1s ease-in-out infinite; }
  .la-bounce       { animation: la-bounce  0.75s ease-in-out infinite; }
  .la-flash        { animation: la-flash   0.65s ease-in-out infinite; }
  .la-shake        { animation: la-shake   0.45s ease-in-out infinite; }
  .la-enter        { animation: la-enter   0.2s cubic-bezier(0.22,1,0.36,1) both; }
  .la-glow-pulse   { animation: la-glow-pulse 1.8s ease-in-out infinite; }
  .la-think-dot-1  { animation: la-think-dot 1.4s ease-in-out 0ms   infinite; }
  .la-think-dot-2  { animation: la-think-dot 1.4s ease-in-out 200ms infinite; }
  .la-think-dot-3  { animation: la-think-dot 1.4s ease-in-out 400ms infinite; }
`;

export function ThinkingBubble() {
  return (
    <div className="la-enter flex gap-2 items-start" data-testid="thinking-bubble">
      <style>{LIVE_ACTION_CSS}</style>
      <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center la-glow-pulse mt-0.5"
        style={{ background: "linear-gradient(135deg, #a78bfa 0%, #7c8dff 100%)" }}>
        <Brain className="h-3.5 w-3.5 text-white la-pulse" />
      </div>
      <div className="flex flex-col gap-1.5 px-3.5 py-2.5 rounded-2xl rounded-tl-sm"
        style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)", minWidth: 120 }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: "rgba(167,139,250,0.95)" }}>Thinking</span>
          <span className="flex items-end gap-[3px] pb-[1px]">
            <span className="la-think-dot-1 w-[4px] h-[4px] rounded-full inline-block" style={{ background: "#a78bfa" }} />
            <span className="la-think-dot-2 w-[4px] h-[4px] rounded-full inline-block" style={{ background: "#a78bfa" }} />
            <span className="la-think-dot-3 w-[4px] h-[4px] rounded-full inline-block" style={{ background: "#a78bfa" }} />
          </span>
        </div>
        <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.55)" }}>Analyzing request and planning steps</span>
      </div>
    </div>
  );
}

export function LiveActionBar({ action }: { action: AgentStreamItem }) {
  const tool    = action.tool ?? "analysis.think";
  const isThink = tool === "analysis.think";
  const Icon    = TOOL_ICON_MAP[tool] ?? Brain;
  const color   = TOOL_COLOR_MAP[tool] ?? "#a78bfa";
  const anim    = TOOL_ANIMATION_MAP[tool] ?? "pulse";
  const emoji   = TOOL_EMOJI_MAP[tool] ?? "⚙️";
  const label   = isThink ? "Thinking" : "Working";

  return (
    <div className="la-enter flex gap-2 items-start" data-testid="live-action-bar">
      <style>{LIVE_ACTION_CSS}</style>
      <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5"
        style={{ background: `${color}22`, border: `1px solid ${color}40` }}>
        {anim === "ping" && (
          <span className="absolute rounded-full"
            style={{ width: 18, height: 18, background: color, opacity: 0.18, animation: "la-ping 1.1s ease-out infinite" }} />
        )}
        <Icon className={`la-${anim} flex-shrink-0`} style={{ width: 12, height: 12, color, strokeWidth: 1.75 }} />
      </div>
      <div className="flex flex-col gap-1 px-3.5 py-2.5 rounded-2xl rounded-tl-sm"
        style={{ background: `${color}0d`, border: `1px solid ${color}28`, minWidth: 140 }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: `${color}18`, border: `1px solid ${color}30`, color: `${color}dd` }}>{tool}</span>
          <span className="text-[11px] font-semibold" style={{ color: "rgba(226,232,240,0.9)" }}>{label}</span>
          <span className="flex items-end gap-[3px] pb-[1px]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="rounded-full inline-block"
                style={{ width: 3.5, height: 3.5, background: color, animation: `la-think-dot 1.3s ease-in-out ${i * 180}ms infinite` }} />
            ))}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] leading-none">{emoji}</span>
          <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.6)" }}>{action.content}</span>
        </div>
      </div>
    </div>
  );
}
