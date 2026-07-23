import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronDown,
  ArrowUp,
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
  FolderOpen,
  Plus,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
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

function relativeTime(dateValue?: string | Date | null): string {
  if (!dateValue) return "Updated recently";

  const dateStr = dateValue instanceof Date ? dateValue.toISOString() : dateValue;
  const timestamp = new Date(dateStr).getTime();
  if (!Number.isFinite(timestamp)) return "Updated recently";

  const diff = Math.max(0, Date.now() - timestamp);
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

type HomeUser = {
  name?: string | null;
  displayName?: string | null;
  firstName?: string | null;
};

type ProjectsResponse = {
  ok: boolean;
  data: Project[];
  user?: HomeUser | null;
};

function getUserName(user?: HomeUser | null): string | null {
  const name = user?.displayName ?? user?.name ?? user?.firstName;
  const trimmedName = name?.trim();
  return trimmedName ? trimmedName : null;
}

function getInitials(name: string | null): string {
  if (!name) return "YW";

  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "YW";
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

  const {
    data: projectsData,
    error: projectsError,
    isError: projectsFailed,
    isLoading: projectsLoading,
    refetch: refetchProjects,
  } = useQuery<ProjectsResponse>({
    queryKey: ["/api/projects"],
    refetchInterval: 30_000,
    select: (response) => {
      if (!response || !Array.isArray(response.data)) {
        throw new Error("The projects response was not in the expected format.");
      }
      return response;
    },
  });

  const recentProjects = (projectsData?.data ?? []).slice(0, 4);
  const userName = getUserName(projectsData?.user);
  const initials = useMemo(() => getInitials(userName), [userName]);
  const greeting = userName ? `Hi ${userName}, what do you want to make?` : "Hi there, what do you want to make?";
  const workspaceName = userName ? `${userName}'s Workspace` : "Your Workspace";

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
    <main className="flex-1 flex flex-col overflow-auto bg-[hsl(222,30%,7%)] relative" aria-labelledby="heading-main">
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
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 mb-12"
          data-testid="button-workspace-selector"
        >
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#7c8dff] to-[#a78bfa] flex items-center justify-center text-white text-[9px] font-bold">
            {initials}
          </div>
          <span className="text-sm font-medium text-foreground">{workspaceName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        {/* Heading */}
        <h1
          className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-6 tracking-tight"
          data-testid="heading-main"
        >
          {greeting}
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
                   <button
                     type="button"
                     onClick={() => setSelectedCategory(null)}
                     className="ml-0.5 rounded-sm hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                     aria-label={`Remove ${cat.label} category`}
                     data-testid="button-remove-category-chip"
                   >
                     ×
                   </button>
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  type="button"
                  aria-label="Start building from this description"
                  className={cn(
                    "rounded-lg flex items-center justify-center transition-all duration-200",
                    input.trim() ? "text-white hover:opacity-90 active:scale-95" : "text-muted-foreground/30 cursor-not-allowed"
                  )}
                  style={{
                    width: 25, height: 25,
                    ...(input.trim()
                      ? { background: "linear-gradient(135deg, #3B82F6, #2563EB)", boxShadow: "0 0 10px rgba(59,130,246,0.35)" }
                      : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" })
                  }}
                  data-testid="button-send"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
              </div>
            </div>
            <textarea
              value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; }}
              onKeyDown={handleKeyDown}
              placeholder="Describe your app idea, Agent will bring it to life..."
              id="project-description"
              aria-label="Describe your app idea"
              aria-describedby="project-description-help"
              rows={1}
              className="w-full bg-transparent px-5 pb-3 pt-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 leading-relaxed"
              style={{ minHeight: 44, maxHeight: 200, resize: "vertical" }}
              data-testid="input-project-description"
            />
            <span id="project-description-help" className="sr-only">
              Press Enter to start, or Shift plus Enter for a new line.
            </span>
          </div>
        </div>

        {/* Example prompts */}
        <div className="mt-4 flex flex-col items-center gap-2 w-full max-w-2xl">
           <button type="button" onClick={handleRefreshPrompts} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded transition-colors group" data-testid="button-refresh-prompts">
            <span>Try an example prompt</span>
            <RefreshCw className="h-3 w-3 group-hover:rotate-180 transition-transform duration-300" />
          </button>
          <div className="flex flex-wrap items-center justify-center gap-2">
             {examplePrompts[promptSet].map((prompt) => (
               <button type="button" key={prompt} onClick={() => handlePromptClick(prompt)} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-foreground/80 hover:text-foreground hover:bg-white/8 hover:border-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200" data-testid={`button-prompt-${prompt.toLowerCase().replace(/\s+/g, '-')}`}>
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Category icons */}
        <div className="flex items-center gap-2 mt-5 w-full max-w-2xl justify-center" aria-label="Project categories">
           <button type="button" onClick={handlePrevCategories} disabled={categoryOffset === 0} aria-label="Show previous project categories" className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0" data-testid="button-categories-prev">
            <ArrowLeft className="h-4 w-4" />
          </button>
           <div className="flex items-center gap-2 flex-1 justify-start sm:justify-center overflow-x-auto no-scrollbar py-1 px-1" role="group" aria-label="Choose a project category">
            {visibleCategories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button type="button" key={cat.id} onClick={() => setSelectedCategory(isSelected ? null : cat.id)} aria-pressed={isSelected} aria-label={`${isSelected ? "Remove" : "Choose"} ${cat.label} category`} className={cn("flex flex-col items-center gap-2 px-3 sm:px-4 py-3 rounded-2xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group min-w-[70px]", isSelected ? "bg-primary/15 border-primary/35 text-primary" : "bg-white/4 border-white/8 text-muted-foreground hover:text-foreground hover:bg-white/7 hover:border-white/14")} style={isSelected ? { boxShadow: "0 0 16px rgba(124,141,255,0.2)" } : {}} data-testid={`button-category-${cat.id}`}>
                  <Icon className={cn("h-5 w-5 transition-colors", isSelected ? "text-primary" : "group-hover:text-foreground")} />
                  <span className="text-xs font-medium">{cat.label}</span>
                </button>
              );
            })}
          </div>
           <button type="button" onClick={handleNextCategories} disabled={categoryOffset >= categories.length - 5} aria-label="Show more project categories" className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0" data-testid="button-categories-next">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* ── Recent Projects (live from DB) ─────────────────────── */}
        <section className="mt-12 w-full max-w-2xl" aria-labelledby="heading-recent-projects" aria-live="polite">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest" data-testid="heading-recent-projects">
              Recent Projects
            </h2>
            <button
              type="button"
              onClick={() => navigate("/apps")}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded transition-colors"
              data-testid="link-view-all-projects"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {projectsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="loading-projects" aria-label="Loading recent projects">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="min-h-[148px] p-4 rounded-2xl border border-white/8 bg-white/3" aria-hidden="true">
                  <Skeleton className="w-8 h-8 rounded-xl mb-3 bg-white/10" />
                  <Skeleton className="h-4 w-3/4 mb-2 bg-white/10" />
                  <Skeleton className="h-3 w-1/3 mb-7 bg-white/10" />
                  <Skeleton className="h-3 w-1/4 bg-white/10" />
                </div>
              ))}
              <span className="sr-only">Loading recent projects</span>
            </div>
          ) : projectsFailed ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-5 py-7 text-center" role="alert" data-testid="error-projects">
              <AlertCircle className="mx-auto h-7 w-7 text-red-300 mb-3" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">We couldn’t load your projects</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Your projects are still safe. Check your connection and try again.
              </p>
              <button
                type="button"
                onClick={() => void refetchProjects()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-foreground hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid="button-retry-projects"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Try again
              </button>
              {projectsError instanceof Error && (
                <span className="sr-only">Error details: {projectsError.message}</span>
              )}
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-5 py-9 text-center" data-testid="empty-projects">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FolderOpen className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Your next project starts here</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Describe an idea above and NURA X will turn it into a working project.
              </p>
              <button
                type="button"
                onClick={() => document.getElementById("project-description")?.focus()}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#7c8dff] to-[#a78bfa] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,141,255,0.2)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid="button-create-first-project"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create your first project
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/80">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Try one of the example prompts above if you need inspiration.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="grid-recent-projects">
              {recentProjects.map((project, idx) => (
                <button
                  key={project.id}
                  onClick={() => navigate(`/workspace/${project.id}`)}
                  aria-label={`Open project ${project.name}`}
                  className="group relative flex min-h-[148px] flex-col justify-between p-4 rounded-2xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(222,30%,7%)] transition-all duration-200 text-left overflow-hidden"
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
                    <span data-testid={`text-project-updated-${project.id}`}>{relativeTime(project.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
