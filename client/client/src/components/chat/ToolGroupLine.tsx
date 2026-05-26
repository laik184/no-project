import { useState } from "react";
import { Brain, ChevronDown, CheckCircle2, ExternalLink, Wrench, BookOpen, Bot, FolderOpen, Copy, Zap, FileText } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import { TOOL_ICON_MAP, TOOL_COLOR_MAP } from "./tool-maps";
import { invokeToolBackend } from "./tool-helpers";

const TOOL_GROUP_STYLES = `
  @keyframes tg-fade-in   { from{opacity:0;transform:translateY(-2px)} to{opacity:1;transform:translateY(0)} }
  @keyframes tg-expand-in { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  .tg-fade-in   { animation: tg-fade-in   0.14s ease-out both; }
  .tg-expand-in { animation: tg-expand-in 0.18s ease-out both; }
`;

interface ToolGroupLineProps {
  actions: AgentStreamItem[];
  onOpenFile?: (path: string) => void;
}

export function ToolGroupLine({ actions, onOpenFile }: ToolGroupLineProps) {
  const [expanded, setExpanded] = useState(false);
  const isSingle = actions.length === 1;

  return (
    <div className="tg-fade-in flex flex-col gap-0" data-testid="tool-group-line">
      <style>{TOOL_GROUP_STYLES}</style>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left group rounded-md px-1 py-0.5 -mx-1 transition-colors hover:bg-white/[0.03]"
        data-testid="button-tool-group-toggle"
      >
        {actions.slice(0, 5).map((action, idx) => {
          const tool  = action.tool ?? "analysis.think";
          const Icon  = TOOL_ICON_MAP[tool] ?? Brain;
          const color = TOOL_COLOR_MAP[tool] ?? "#a78bfa";
          return (
            <Icon key={idx} className="flex-shrink-0 transition-opacity group-hover:opacity-80"
              style={{ width: 13, height: 13, color, strokeWidth: 1.6 }} title={tool} />
          );
        })}
        <span style={{ color: "rgba(100,116,139,0.2)", fontSize: 10, userSelect: "none" }}>·</span>
        <span className="text-[11px] leading-none flex-1 truncate" style={{ color: "rgba(100,116,139,0.6)" }}>
          {isSingle ? actions[0].content : `${actions.length} actions`}
        </span>
        <ChevronDown className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200"
          style={{ width: 11, height: 11, color: "rgba(100,116,139,0.5)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {expanded && (
        <div className="tg-expand-in mt-1.5 rounded-xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
          data-testid="tool-group-detail-panel">
          {actions.map((action, idx) => {
            const tool   = action.tool ?? "analysis.think";
            const Icon   = TOOL_ICON_MAP[tool] ?? Brain;
            const color  = TOOL_COLOR_MAP[tool] ?? "#a78bfa";
            const isLast = idx === actions.length - 1;
            return (
              <div key={idx} className="flex items-start gap-2.5 px-3 py-2.5"
                style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.045)" }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${color}15`, border: `1px solid ${color}28` }}>
                  <Icon style={{ width: 12, height: 12, color, strokeWidth: 1.75 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button"
                          className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded flex-shrink-0 hover:opacity-100 transition-opacity cursor-pointer outline-none focus:ring-1 focus:ring-white/20"
                          style={{ background: `${color}12`, border: `1px solid ${color}25`, color: `${color}bb` }}
                          data-testid={`button-tool-chip-${tool}`} onClick={(e) => e.stopPropagation()}>
                          {tool}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel className="text-xs flex items-center gap-1.5">
                          <Wrench className="h-3 w-3" style={{ color }} /><span className="font-mono">{tool}</span>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs gap-2 cursor-pointer"
                          onClick={() => onOpenFile?.("server/agents/TOOLS.md")} data-testid={`menu-item-tool-docs-${tool}`}>
                          <BookOpen className="h-3.5 w-3.5" /> View tool docs
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs gap-2 cursor-pointer"
                          onClick={() => onOpenFile?.("server/agents/AGENTS.md")} data-testid={`menu-item-agent-inventory-${tool}`}>
                          <Bot className="h-3.5 w-3.5" /> View agents inventory
                        </DropdownMenuItem>
                        {action.meta?.file && (
                          <DropdownMenuItem className="text-xs gap-2 cursor-pointer"
                            onClick={() => onOpenFile?.(action.meta!.file!)} data-testid={`menu-item-open-source-${tool}`}>
                            <FolderOpen className="h-3.5 w-3.5" /> Open source file
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs gap-2 cursor-pointer"
                          onClick={async () => { const r = await invokeToolBackend(tool); if (!r?.ok) console.warn(`[tool ${tool}] invoke failed:`, r?.error); }}
                          data-testid={`menu-item-run-tool-${tool}`}>
                          <Zap className="h-3.5 w-3.5" /> Run via backend
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs gap-2 cursor-pointer"
                          onClick={() => navigator.clipboard?.writeText(tool)} data-testid={`menu-item-copy-tool-${tool}`}>
                          <Copy className="h-3.5 w-3.5" /> Copy tool name
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="text-[11px] font-medium truncate flex-1" style={{ color: "rgba(203,213,225,0.8)" }}>
                      {action.content}
                    </span>
                    <CheckCircle2 className="flex-shrink-0 ml-auto" style={{ width: 12, height: 12, color: "rgba(74,222,128,0.75)" }} />
                  </div>
                  {action.meta?.logs && (
                    <div className="mt-2 rounded-md px-2.5 py-2 text-[9.5px] font-mono leading-relaxed"
                      style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${color}18`, borderLeft: `2px solid ${color}50`, color: "rgba(148,163,184,0.7)", whiteSpace: "pre-wrap" }}>
                      {action.meta.logs}
                    </div>
                  )}
                  {action.meta?.file && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button"
                          className="mt-1.5 flex items-center gap-1 text-[9.5px] font-mono w-full text-left rounded px-1 -mx-1 hover:bg-white/[0.04] transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-white/20"
                          style={{ color: `${color}88` }} data-testid={`button-file-path-${idx}`} onClick={(e) => e.stopPropagation()}>
                          <span>→</span><span className="truncate">{action.meta.file}</span>
                          <ExternalLink className="h-2.5 w-2.5 ml-auto opacity-60 flex-shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel className="text-xs flex items-center gap-1.5">
                          <FileText className="h-3 w-3" style={{ color }} /><span className="font-mono truncate">{action.meta.file}</span>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs gap-2 cursor-pointer"
                          onClick={() => onOpenFile?.(action.meta!.file!)} data-testid={`menu-item-open-file-${idx}`}>
                          <FolderOpen className="h-3.5 w-3.5" /> Open in editor
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs gap-2 cursor-pointer"
                          onClick={() => navigator.clipboard?.writeText(action.meta!.file!)} data-testid={`menu-item-copy-path-${idx}`}>
                          <Copy className="h-3.5 w-3.5" /> Copy path
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
