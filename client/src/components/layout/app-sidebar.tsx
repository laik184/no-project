import { useState } from "react";
import { useLocation } from "wouter";
import { useImportModal } from "@/context/import-modal-context";
import { LifecycleOrb } from "@/components/ui/LifecycleOrb";
import { useLifecycle } from "@/context/lifecycle-context";
import {
  Home,
  FolderOpen,
  Layers,
  BarChart3,
  ChevronDown,
  Download,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NavItem } from "./sidebar-nav-item";

const mainNav = [
  { title: "Home", icon: Home, url: "/" },
  { title: "My Apps", icon: FolderOpen, url: "/apps" },
  { title: "Integrations", icon: Layers, url: "/integrations" },
  { title: "Usage", icon: BarChart3, url: "/usage" },
];

const aiNav = [
  { title: "Framework", icon: LayoutTemplate, url: "/frameworks" },
  { title: "Docs", icon: BookOpen, url: "#" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(true);
  const [aiExpanded, setAiExpanded] = useState(true);
  const [location, navigate] = useLocation();
  const { openImport } = useImportModal();
  const { label, dynamicDescription, isActive, state } = useLifecycle();

  return (
    <>
    <style>{`
      @keyframes sweep-down {
        0%   { background-position: 0% 0%; }
        100% { background-position: 0% 200%; }
      }
      @keyframes sweep-up {
        0%   { background-position: 0% 200%; }
        100% { background-position: 0% 0%; }
      }
      @keyframes bar-flash {
        0%,100% { opacity: 1; }
        50%      { opacity: .25; }
      }
      .lifecycle-bar-active {
        animation: sweep-down 1.8s linear infinite;
      }
      .lifecycle-bar-fast {
        animation: sweep-down 0.9s linear infinite;
      }
      .lifecycle-bar-flash {
        animation: bar-flash 0.7s ease-in-out infinite;
      }
    `}</style>
    <div
      className={cn("relative flex flex-col h-screen border-r border-white/6 transition-all duration-300 ease-in-out flex-shrink-0", "bg-[hsl(222,30%,7%)]", collapsed ? "w-[60px]" : "w-[220px]")}
      style={{ minWidth: collapsed ? 60 : 220 }}
    >
      {/* ── Replit-style left-edge sweep bar ── */}
      {(() => {
        const barColor = state === "thinking"  ? ["#6c8fff","#a78bfa","#6c8fff","transparent"]
                       : state === "planning"  ? ["#7c8dff","#4f63ff","#7c8dff","transparent"]
                       : state === "delegating"? ["#a78bfa","#7c8dff","#a78bfa","transparent"]
                       : state === "working"   ? ["#c084fc","#7c8dff","#c084fc","transparent"]
                       : state === "writing"   ? ["#34d399","#6ee7b7","#34d399","transparent"]
                       : state === "editing"   ? ["#6ee7b7","#34d399","#6ee7b7","transparent"]
                       : state === "testing"   ? ["#fbbf24","#f59e0b","#fbbf24","transparent"]
                       : state === "verifying" ? ["#f59e0b","#fbbf24","#f59e0b","transparent"]
                       : state === "deploying" ? ["#22c55e","#4ade80","#22c55e","transparent"]
                       : state === "completed" ? ["#4ade80","#22c55e","#4ade80","transparent"]
                       : state === "failed"    ? ["#f87171","#ef4444","#f87171","transparent"]
                       : state === "cancelled" ? ["#6b7280","#9ca3af","#6b7280","transparent"]
                       : null;
        const barClass = state === "working" || state === "deploying" ? "lifecycle-bar-fast"
                       : state === "testing" ? "lifecycle-bar-flash"
                       : state !== "idle" ? "lifecycle-bar-active"
                       : "";
        const visible = state !== "idle";
        return (
          <div
            className={barClass}
            style={{
              position:   "absolute",
              left:       0,
              top:        0,
              bottom:     0,
              width:      2,
              zIndex:     50,
              opacity:    visible ? 1 : 0,
              transition: "opacity 0.5s ease",
              borderRadius: "0 2px 2px 0",
              background: barColor
                ? `linear-gradient(to bottom, ${barColor.join(", ")})`
                : "transparent",
              backgroundSize: "100% 200%",
              boxShadow: visible && barColor ? `2px 0 10px ${barColor[0]}80` : "none",
            }}
          />
        );
      })()}

      <div className="orb" style={{ width: 200, height: 200, top: -60, left: -80, background: "radial-gradient(circle, rgba(124,141,255,0.06) 0%, transparent 70%)" }} />

      <div className={cn("flex items-center h-14 px-3 border-b border-white/6 flex-shrink-0", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 animate-fade-in-up min-w-0">
            <LifecycleOrb size={28} />
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-wide gradient-text">NURA X</div>
              <div className="text-[10px] leading-none truncate" style={{
                color: isActive ? "#a78bfa" : state === "completed" ? "#22c55e" : state === "failed" ? "#ef4444" : state === "cancelled" ? "#6b7280" : "#64748b",
                transition: "color 0.4s ease",
              }}>
                {state === "idle" ? "AI Agent" : label}
              </div>
            </div>
          </div>
        )}
        {collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div data-testid="lifecycle-orb-collapsed">
                <LifecycleOrb size={28} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="glass border-white/10 text-foreground ml-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold">{state === "idle" ? "NURA X" : label}</span>
                {dynamicDescription && state !== "idle" && (
                  <span className="text-[10px] text-muted-foreground">{dynamicDescription}</span>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        <button onClick={() => setCollapsed(!collapsed)} className={cn("flex-shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200", collapsed && "mt-0")} data-testid="button-sidebar-collapse">
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className={cn("px-2 pt-3 pb-2 space-y-1.5 flex-shrink-0", collapsed && "flex flex-col items-center")}>
        {!collapsed && (
          <button onClick={openImport} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 text-sm font-medium transition-all duration-200" data-testid="button-import">
            <Download className="h-4 w-4" />
            Import
          </button>
        )}
      </div>

      <div className="mx-3 h-px bg-white/5 flex-shrink-0" />

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {mainNav.map((item) => <NavItem key={item.title} item={item} collapsed={collapsed} active={location === item.url} />)}

        {!collapsed ? (
          <Collapsible open={aiExpanded} onOpenChange={setAiExpanded}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors mt-3" data-testid="button-ai-section-toggle">
                <span>AI Tools</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", aiExpanded && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 mt-1">
                {aiNav.map((item) => <NavItem key={item.title} item={item} collapsed={collapsed} active={location === item.url} />)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div className="mt-3 pt-3 border-t border-white/5 space-y-0.5">
            {aiNav.map((item) => <NavItem key={item.title} item={item} collapsed={collapsed} active={location === item.url} />)}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-white/6 p-2 space-y-1.5">
        {!collapsed && (
          <div className="mx-1 p-3 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/15 mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">Starter Plan</span>
              <span className="text-[10px] text-muted-foreground">58% used</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-[58%] bg-gradient-to-r from-[#7c8dff] to-[#a78bfa] rounded-full" />
            </div>
          </div>
        )}

        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
               <button onClick={() => navigate("/settings")} className={cn("w-full flex justify-center p-2 rounded-xl transition-colors", location === "/settings" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/5")} data-testid="button-settings-collapsed" aria-current={location === "/settings" ? "page" : undefined}>
                <Settings className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="glass border-white/10 text-foreground ml-2">Settings</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Button onClick={() => navigate("/upgrade")} className="w-full h-9 text-sm font-semibold bg-gradient-to-r from-[#7c8dff] to-[#a78bfa] hover:from-[#6b7ef0] hover:to-[#9575f0] border-0 text-white rounded-xl transition-all duration-200" style={{ boxShadow: "0 0 20px rgba(124,141,255,0.3)" }} data-testid="button-upgrade">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Upgrade
            </Button>
             <button onClick={() => navigate("/settings")} className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors", location === "/settings" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/5")} data-testid="button-settings-expanded" aria-current={location === "/settings" ? "page" : undefined}>
              <Settings className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs font-medium">Settings</span>
            </button>
          </>
        )}
      </div>
    </div>

    </>
  );
}
