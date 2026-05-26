import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useImportModal } from "@/context/import-modal-context";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
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
  Cpu,
  LayoutTemplate,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

interface NavItemProps {
  item: { title: string; icon: React.ElementType; url: string };
  collapsed: boolean;
  active: boolean;
}

function NavItem({ item, collapsed, active }: NavItemProps) {
  const Icon = item.icon;

  const inner = (
    <Link href={item.url}>
      <div
        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group relative",
          active
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
        )}
      >
        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full neon-glow-blue" />}
        <Icon className={cn("flex-shrink-0 transition-all duration-200", collapsed ? "h-5 w-5" : "h-4 w-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        {!collapsed && <span className="text-sm font-medium truncate">{item.title}</span>}
        {active && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary neon-glow-blue" />}
      </div>
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" className="ml-2 glass border-white/10 text-foreground">{item.title}</TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(true);
  const [aiExpanded, setAiExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [location] = useLocation();
  const { openImport } = useImportModal();

  return (
    <>
    <div
      className={cn("relative flex flex-col h-screen border-r border-white/6 transition-all duration-300 ease-in-out flex-shrink-0", "bg-[hsl(222,30%,7%)]", collapsed ? "w-[60px]" : "w-[220px]")}
      style={{ minWidth: collapsed ? 60 : 220 }}
    >
      <div className="orb" style={{ width: 200, height: 200, top: -60, left: -80, background: "radial-gradient(circle, rgba(124,141,255,0.06) 0%, transparent 70%)" }} />

      <div className={cn("flex items-center h-14 px-3 border-b border-white/6 flex-shrink-0", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 animate-fade-in-up">
            <div className="relative">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7c8dff] to-[#a78bfa] flex items-center justify-center shadow-lg" style={{ boxShadow: "0 0 12px rgba(124,141,255,0.5)" }}>
                <Cpu className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide gradient-text">NURA X</div>
              <div className="text-[10px] text-muted-foreground leading-none">AI Agent</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7c8dff] to-[#a78bfa] flex items-center justify-center" style={{ boxShadow: "0 0 12px rgba(124,141,255,0.5)" }}>
            <Cpu className="h-3.5 w-3.5 text-white" />
          </div>
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
              <button onClick={() => setShowSettings(true)} className="w-full flex justify-center p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors" data-testid="button-settings-collapsed">
                <Settings className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="glass border-white/10 text-foreground ml-2">Settings</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Button className="w-full h-9 text-sm font-semibold bg-gradient-to-r from-[#7c8dff] to-[#a78bfa] hover:from-[#6b7ef0] hover:to-[#9575f0] border-0 text-white rounded-xl transition-all duration-200" style={{ boxShadow: "0 0 20px rgba(124,141,255,0.3)" }} data-testid="button-upgrade">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Upgrade
            </Button>
            <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors" data-testid="button-settings-expanded">
              <Settings className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs font-medium">Settings</span>
            </button>
          </>
        )}
      </div>
    </div>

    <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
