import { useState } from "react";
import { Brain, ChevronDown, CheckCircle2, ExternalLink, Wrench, BookOpen, Bot, FolderOpen, Copy, Zap, FileText, Loader2, XCircle } from "lucide-react";
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

function StatusIcon({ status }: { status: AgentStreamItem["status"] }) {
  if (status === "running") return <Loader2 className="animate-spin flex-shrink-0" style={{ width: 11, height: 11, color: "#3b82f6" }} />;
  if ((status as string) === "error") return <XCircle className="flex-shrink-0" style={{ width: 11, height: 11, color: "#ef4444" }} />;
  return <CheckCircle2 className="flex-shrink-0" style={{ width: 11, height: 11, color: "#22c55e" }} />;
}

export function ToolGroupLine({ actions, onOpenFile }: ToolGroupLineProps) {
  const [expanded, setExpanded] = useState(false);
  const isSingle = actions.length === 1;

  return (
    <div className="tg-fade-in flex flex-col gap-0" data-testid="tool-group-line">
      <style>{TOOL_GROUP_STYLES}</style>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left group rounded-md px-1.5 py-1 -mx-1 transition-colors hover:bg-white/[0.03]"
        data-testid="button-tool-group-toggle"
      >
        {/* Icon wells */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {actions.slice(0, 4).map((action, idx) => {
            const tool  = action.tool ?? "analysis.think";
            const Icon  = TOOL_ICON_MAP[tool] ?? Brain;
            const color = TOOL_COLOR_MAP[tool] ?? "#3b82f6";
            return (
              <div key={idx}
                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
                <Icon style={{ width: 10, height: 10, color, strokeWidth: 1.75 }} title={tool} />
              </div>
            );
          })}
        </div>

        <span className="text-[11px] leading-none flex-1 truncate" style={{ color: "rgba(148,163,184,0.65)" }}>
          {isSingle ? actions[0].content : `${actions.length} actions`}
        </span>

        {isSingle && <StatusIcon status={actions[0].status} />}

        <ChevronDown
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200"
          style={{
            width: 11, height: 11,
            color: "rgba(100,116,139,0.5)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }} />
      </button>

      {expanded && (
        <div
          className="tg-expand-in mt-1.5 rounded-lg overflow-hidden"
          style={{ background: "#111827", border: "1px solid #1f2937" }}
          data-testid="tool-group-detail-panel">
          {actions.map((action, idx) => {
            const tool   = action.tool ?? "analysis.think";
            const Icon   = TOOL_ICON_MAP[tool] ?? Brain;
            const color  = TOOL_COLOR_MAP[tool] ?? "#3b82f6";
            const isLast = idx === actions.length - 1;
            return (
              <div key={idx} className="flex items-start gap-2.5 px-3 py-2.5"
                style={{ borderBottom: isLast ? "none" : "1px solid #1f2937" }}>
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
                  <Icon style={{ width: 11, height: 11, color, strokeWidth: 1.75 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button"
                          className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded flex-shrink-0 transition-opacity cursor-pointer outline-none focus:ring-1 focus:ring-white/20"
                          style={{ background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.15)", color: "rgba(148,163,184,0.7)" }}
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
                    <span className="text-[11px] font-medium truncate flex-1" style={{ color: "rgba(203,213,225,0.85)" }}>
                      {action.content}
                    </span>
                    <StatusIcon status={action.status} />
                  </div>
                  {action.meta?.logs && (
                    <div className="mt-1.5 rounded-md px-2.5 py-2 text-[9.5px] font-mono leading-relaxed"
                      style={{ background: "#0b0f14", border: "1px solid #1f2937", borderLeft: `2px solid ${color}40`, color: "rgba(148,163,184,0.7)", whiteSpace: "pre-wrap" }}>
                      {action.meta.logs}
                    </div>
                  )}
                  {action.meta?.file && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button"
                          className="mt-1.5 flex items-center gap-1 text-[9.5px] font-mono w-full text-left rounded px-1 -mx-1 hover:bg-white/[0.04] transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-white/20"
                          style={{ color: "rgba(100,116,139,0.6)" }} data-testid={`button-file-path-${idx}`} onClick={(e) => e.stopPropagation()}>
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
