import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Send,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Globe,
  Smartphone,
  Palette,
  PresentationIcon,
  Gamepad2,
  Cpu,
  Code2,
  Wand2,
  BarChart3,
  ChevronRight,
  Clock,
  Plus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentsButton } from "@/components/agent/AgentsHub";
import type { Project } from "@shared/schema";

const categories = [
  { id: "website", label: "Website", icon: Globe },
  { id: "mobile", label: "Mobile", icon: Smartphone },
  { id: "design", label: "Design", icon: Palette },
  { id: "slides", label: "Slides", icon: PresentationIcon },
  { id: "animation", label: "Animation", icon: Wand2 },
  { id: "game", label: "3D Game", icon: Gamepad2 },
  { id: "data", label: "Data App", icon: BarChart3 },
  { id: "agent", label: "AI Agent", icon: Cpu },
  { id: "api", label: "API / Code", icon: Code2 },
];

const examplePrompts = [
  ["SaaS hero animation", "3D racing game"],
  ["Customer dashboard app", "AI chat assistant", "Real-time analytics"],
  ["Portfolio website", "Mobile expense tracker", "Code review bot"],
];

const PROJECT_COLORS = [
  "from-blue-500/30 to-violet-500/30",
  "from-violet-500/30 to-purple-500/30",
  "from-purple-500/30 to-pink-500/30",
  "from-cyan-500/30 to-blue-500/30",
  "from-emerald-500/30 to-cyan-500/30",
  "from-orange-500/30 to-rose-500/30",
];

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 2) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function frameworkLabel(fw?: string | null): string {
  if (!fw) return "Project";
  const map: Record<string, string> = {
    react: "React App", nextjs: "Next.js", express: "API / Code",
    vite: "Website", nodejs: "Node.js", python: "Python",
    mobile: "Mobile", data: "Data App", agent: "AI Agent",
  };
  return map[fw.toLowerCase()] ?? fw;
}

export default function Home() {
  const [, navigate] = useLocation();
  const [input, setInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [promptSet, setPromptSet] = useState(0);
  const [categoryOffset, setCategoryOffset] = useState(0);
  const visibleCategories = categories.slice(categoryOffset, categoryOffset + 5);

  const { data: projectsData, isLoading: projectsLoading } = useQuery<{ ok: boolean; data: Project[] }>({
    queryKey: ["/api/projects"],
    refetchInterval: 30_000,
  });

  const recentProjects = (projectsData?.data ?? []).slice(0, 4);

  const handlePrevCategories = () => setCategoryOffset((prev) => Math.max(0, prev - 1));
  const handleNextCategories = () => setCategoryOffset((prev) => Math.min(categories.length - 5, prev + 1));
  const handleRefreshPrompts = () => setPromptSet((prev) => (prev + 1) % examplePrompts.length);
  const handlePromptClick = (prompt: string) => setInput(prompt);

  const handleSend = () => {
    if (!input.trim()) return;
    navigate(`/workspace?prompt=${encodeURIComponent(input.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-[hsl(222,30%,7%)] relative">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div
          className="absolute rounded-full"
          style={{ width: 600, height: 600, top: -200, left: "50%", transform: "translateX(-50%)", background: "radial-gradient(circle, rgba(124,141,255,0.055) 0%, transparent 70%)", filter: "blur(40px)" }}
        />
        <div
          className="absolute rounded-full"
          style={{ width: 400, height: 400, bottom: 0, left: "20%", background: "radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 70%)", filter: "blur(60px)" }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-start px-4 pt-16 pb-16 min-h-full">

        {/* Workspace selector */}
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 hover:border-white/15 transition-all duration-200 mb-12"
          data-testid="button-workspace-selector"
        >
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#7c8dff] to-[#a78bfa] flex items-center justify-center text-white text-[9px] font-bold">
            MO
          </div>
          <span className="text-sm font-medium text-foreground">Mohd's Workspace</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {/* Heading */}
        <h1
          className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-6 tracking-tight"
          data-testid="heading-main"
        >
          Hi Mohd, what do you want to make?
        </h1>

        {/* Input box */}
        <div className="w-full max-w-xl">
          <div
            className="rounded-2xl border border-white/10 bg-white/4 transition-all duration-200 focus-within:border-primary/35 focus-within:bg-white/5"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}
          >
            <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
              <div className="flex items-center gap-2">
                {selectedCategory && (() => {
                  const cat = categories.find((c) => c.id === selectedCategory);
                  if (!cat) return null;
                  const Icon = cat.icon;
                  return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-medium flex-shrink-0">
                      <Icon className="h-3 w-3" />
                      <span>{cat.label}</span>
                      <button onClick={() => setSelectedCategory(null)} className="ml-0.5 hover:text-white transition-colors" data-testid="button-remove-category-chip">×</button>
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <AgentsButton size="md" />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200", input.trim() ? "bg-gradient-to-br from-[#7c8dff] to-[#a78bfa] text-white hover:opacity-90" : "bg-white/5 text-muted-foreground/50 cursor-not-allowed")}
                  style={input.trim() ? { boxShadow: "0 0 16px rgba(124,141,255,0.45)" } : {}}
                  data-testid="button-send"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <textarea
              value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; }}
              onKeyDown={handleKeyDown}
              placeholder="Describe your app idea, Agent will bring it to life..."
              rows={1}
              className="w-full bg-transparent px-5 pb-3 pt-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
              style={{ minHeight: 44, maxHeight: 200, resize: "vertical" }}
              data-testid="input-project-description"
            />
          </div>
        </div>

        {/* Example prompts */}
        <div className="mt-4 flex flex-col items-center gap-2 w-full max-w-2xl">
          <button onClick={handleRefreshPrompts} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group" data-testid="button-refresh-prompts">
            <span>Try an example prompt</span>
            <RefreshCw className="h-3 w-3 group-hover:rotate-180 transition-transform duration-300" />
          </button>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {examplePrompts[promptSet].map((prompt) => (
              <button key={prompt} onClick={() => handlePromptClick(prompt)} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-foreground/80 hover:text-foreground hover:bg-white/8 hover:border-white/16 transition-all duration-200" data-testid={`button-prompt-${prompt.toLowerCase().replace(/\s+/g, '-')}`}>
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Category icons */}
        <div className="flex items-center gap-3 mt-5 w-full max-w-2xl justify-center">
          <button onClick={handlePrevCategories} disabled={categoryOffset === 0} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0" data-testid="button-categories-prev">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 flex-1 justify-center">
            {visibleCategories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setSelectedCategory(isSelected ? null : cat.id)} className={cn("flex flex-col items-center gap-2 px-4 py-3 rounded-2xl border transition-all duration-200 group min-w-[70px]", isSelected ? "bg-primary/15 border-primary/35 text-primary" : "bg-white/4 border-white/8 text-muted-foreground hover:text-foreground hover:bg-white/7 hover:border-white/14")} style={isSelected ? { boxShadow: "0 0 16px rgba(124,141,255,0.2)" } : {}} data-testid={`button-category-${cat.id}`}>
                  <Icon className={cn("h-5 w-5 transition-colors", isSelected ? "text-primary" : "group-hover:text-foreground")} />
                  <span className="text-xs font-medium">{cat.label}</span>
                </button>
              );
            })}
          </div>
          <button onClick={handleNextCategories} disabled={categoryOffset >= categories.length - 5} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0" data-testid="button-categories-next">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* ── Recent Projects (live from DB) ─────────────────────── */}
        <div className="mt-12 w-full max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest" data-testid="heading-recent-projects">
              Recent Projects
            </h2>
            <button
              onClick={() => navigate("/apps")}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              data-testid="link-view-all-projects"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {projectsLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm" data-testid="loading-projects">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading projects...
            </div>
          ) : recentProjects.length === 0 ? null : (
            <div className="grid grid-cols-2 gap-3" data-testid="grid-recent-projects">
              {recentProjects.map((project, idx) => (
                <button
                  key={project.id}
                  onClick={() => navigate(`/workspace/${project.id}`)}
                  className="group relative flex flex-col justify-between p-4 rounded-2xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/14 transition-all duration-200 text-left overflow-hidden"
                  style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.2)" }}
                  data-testid={`card-project-${project.id}`}
                >
                  <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br", PROJECT_COLORS[idx % PROJECT_COLORS.length])} />
                  <div className="relative z-10">
                    <div className={cn("w-8 h-8 rounded-xl bg-gradient-to-br mb-3", PROJECT_COLORS[idx % PROJECT_COLORS.length])} />
                    <p className="text-sm font-semibold text-foreground truncate" data-testid={`text-project-name-${project.id}`}>{project.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-project-type-${project.id}`}>{frameworkLabel(project.framework)}</p>
                  </div>
                  <div className="relative z-10 flex items-center gap-1 mt-3 text-xs text-muted-foreground/70">
                    <Clock className="h-3 w-3" />
                    <span data-testid={`text-project-updated-${project.id}`}>{relativeTime(project.updatedAt as unknown as string)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
