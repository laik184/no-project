import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, ArrowLeft, Smartphone, Globe, Server, Apple, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function LogoSplash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"enter" | "glow" | "pulse" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("glow"), 200);
    const t2 = setTimeout(() => setPhase("pulse"), 800);
    const t3 = setTimeout(() => setPhase("exit"), 1500);
    const t4 = setTimeout(() => onDone(), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onDone]);

  const isVisible = phase !== "exit";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: "hsl(222,30%,7%)",
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: isVisible ? "all" : "none",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(124,141,255,0.13) 0%, rgba(167,139,250,0.07) 40%, transparent 70%)",
          opacity: phase === "glow" || phase === "pulse" ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 240, height: 240,
          border: "1px solid rgba(124,141,255,0.12)",
          opacity: phase === "pulse" ? 1 : 0,
          transform: phase === "pulse" ? "scale(1)" : "scale(0.6)",
          transition: "all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 180, height: 180,
          border: "1px solid rgba(167,139,250,0.16)",
          opacity: phase === "pulse" ? 1 : 0,
          transform: phase === "pulse" ? "scale(1)" : "scale(0.6)",
          transition: "all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s",
        }}
      />
      <div
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
          opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
          transform: phase === "enter" ? "scale(0.72) translateY(16px)" : phase === "exit" ? "scale(1.08) translateY(-6px)" : "scale(1) translateY(0)",
          transition: phase === "enter" ? "none" : phase === "exit" ? "all 0.5s cubic-bezier(0.4, 0, 1, 1)" : "all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div
          style={{
            width: 80, height: 80, borderRadius: 24,
            background: "linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: phase === "glow" || phase === "pulse"
              ? "0 0 50px rgba(124,141,255,0.65), 0 0 100px rgba(167,139,250,0.35), 0 0 180px rgba(124,141,255,0.15)"
              : "0 0 20px rgba(124,141,255,0.3)",
            transition: "box-shadow 0.8s ease",
          }}
        >
          <Sparkles style={{ width: 36, height: 36, color: "white" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span
            style={{
              fontSize: 32, fontWeight: 700, letterSpacing: "0.18em",
              background: "linear-gradient(135deg, #e0e4ff 0%, #c4b5fd 50%, #a78bfa 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}
          >
            NURA X
          </span>
          <span style={{ fontSize: 10, color: "rgba(148,163,184,0.7)", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            AI Workspace
          </span>
        </div>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8,
            opacity: phase === "glow" || phase === "pulse" ? 1 : 0,
            transition: "opacity 0.5s ease 0.3s", marginTop: 4,
          }}
        >
          <span style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="animate-bounce"
                style={{
                  width: 4, height: 4, borderRadius: "50%",
                  background: "rgba(124,141,255,0.7)", display: "inline-block",
                  animationDelay: `${i * 150}ms`,
                }}
              />
            ))}
          </span>
          <span style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", letterSpacing: "0.02em" }}>
            Initializing your AI workspace...
          </span>
        </div>
      </div>
    </div>
  );
}

type View = "categories" | "frameworks" | "setup";
type CategoryId = "android" | "ios" | "website" | "backend";

interface Framework {
  name: string;
  description: string;
  icon: string;
  lang: string;
}

interface Category {
  id: CategoryId;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  glow: string;
  frameworks: Framework[];
}

const categories: Category[] = [
  {
    id: "android",
    title: "Android",
    description: "Build native and cross-platform Android apps",
    icon: Smartphone,
    color: "from-green-500/20 to-emerald-600/10",
    glow: "rgba(34,197,94,0.15)",
    frameworks: [
      { name: "Native Android", icon: "🤖", lang: "Java / Kotlin", description: "Build fully native Android apps using Java or Kotlin with the full Android SDK." },
      { name: "Flutter", icon: "💙", lang: "Dart", description: "Google's UI toolkit for building natively compiled apps from a single codebase." },
      { name: "React Native", icon: "⚛️", lang: "JavaScript / TypeScript", description: "Build mobile apps using React with native platform capabilities." },
      { name: "Kotlin Multiplatform", icon: "🟣", lang: "Kotlin", description: "Share business logic across Android, iOS, and other platforms with Kotlin." },
    ],
  },
  {
    id: "ios",
    title: "iOS",
    description: "Create apps for iPhone, iPad and Apple ecosystem",
    icon: Apple,
    color: "from-blue-500/20 to-sky-600/10",
    glow: "rgba(59,130,246,0.15)",
    frameworks: [
      { name: "Swift (Native iOS)", icon: "🦅", lang: "Swift", description: "Apple's powerful language for building native iOS and macOS applications." },
      { name: "SwiftUI", icon: "🎨", lang: "Swift", description: "Declare your UI across all Apple platforms with Swift's modern framework." },
      { name: "Flutter", icon: "💙", lang: "Dart", description: "Build beautiful natively compiled iOS apps from a single Dart codebase." },
      { name: "React Native", icon: "⚛️", lang: "JavaScript / TypeScript", description: "Use React to build iOS apps that feel truly native on Apple devices." },
    ],
  },
  {
    id: "website",
    title: "Website",
    description: "Build modern web apps and static sites",
    icon: Globe,
    color: "from-violet-500/20 to-purple-600/10",
    glow: "rgba(139,92,246,0.15)",
    frameworks: [
      { name: "HTML / CSS / JS", icon: "🌐", lang: "Vanilla", description: "The foundation of the web — pure HTML, CSS, and JavaScript without any framework." },
      { name: "React.js", icon: "⚛️", lang: "JavaScript / TypeScript", description: "A declarative, component-based library for building fast user interfaces." },
      { name: "Next.js", icon: "▲", lang: "TypeScript", description: "The React framework for production — SSR, SSG, API routes and more out of the box." },
      { name: "Vue.js", icon: "💚", lang: "JavaScript / TypeScript", description: "A progressive JavaScript framework that is approachable, performant and versatile." },
      { name: "Angular", icon: "🔴", lang: "TypeScript", description: "A platform and framework for building single-page client applications using TypeScript." },
    ],
  },
  {
    id: "backend",
    title: "Backend",
    description: "Power your apps with robust server-side logic",
    icon: Server,
    color: "from-orange-500/20 to-amber-600/10",
    glow: "rgba(249,115,22,0.15)",
    frameworks: [
      { name: "Node.js (Express)", icon: "💚", lang: "JavaScript / TypeScript", description: "Minimal and flexible Node.js web application framework for fast APIs." },
      { name: "NestJS", icon: "🐱", lang: "TypeScript", description: "A progressive Node.js framework for building efficient, scalable server-side apps." },
      { name: "Django", icon: "🎸", lang: "Python", description: "High-level Python web framework that encourages rapid development and clean design." },
      { name: "Flask", icon: "🔷", lang: "Python", description: "A lightweight WSGI web application framework — simple, fast and extensible." },
      { name: "Spring Boot", icon: "🍃", lang: "Java / Kotlin", description: "Opinionated Spring-based framework for production-ready Java/Kotlin microservices." },
    ],
  },
];

export default function DeveloperFrameworks() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<View>("categories");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<Framework | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectName, setProjectName] = useState("");
  const [showSplash, setShowSplash] = useState(false);

  function handleCreateProject() {
    setShowSplash(true);
  }

  const filteredFrameworks = selectedCategory?.frameworks.filter((fw) =>
    fw.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fw.description.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  function goToCategory(cat: Category) {
    setSelectedCategory(cat);
    setSearchQuery("");
    setView("frameworks");
  }

  function goToSetup(fw: Framework) {
    setSelectedFramework(fw);
    setProjectName("");
    setView("setup");
  }

  function goBack() {
    if (view === "setup") {
      setView("frameworks");
      setSelectedFramework(null);
    } else if (view === "frameworks") {
      setView("categories");
      setSelectedCategory(null);
      setSearchQuery("");
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {showSplash && <LogoSplash onDone={() => navigate("/workspace")} />}
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/6 flex-shrink-0">
        {view !== "categories" && (
          <button
            onClick={goBack}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200 flex-shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={() => { setView("categories"); setSelectedCategory(null); setSearchQuery(""); }}
            className={cn("hover:text-foreground transition-colors", view === "categories" && "text-foreground font-medium")}
            data-testid="breadcrumb-framework"
          >
            Framework
          </button>
          {selectedCategory && (
            <>
              <ChevronRight className="h-3 w-3" />
              <button
                onClick={() => { setView("frameworks"); setSelectedFramework(null); }}
                className={cn("hover:text-foreground transition-colors", view === "frameworks" && "text-foreground font-medium")}
                data-testid="breadcrumb-category"
              >
                {selectedCategory.title}
              </button>
            </>
          )}
          {selectedFramework && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">{selectedFramework.name}</span>
            </>
          )}
        </div>

        {view === "frameworks" && (
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search frameworks..."
              className="pl-8 w-52 h-8 text-sm bg-white/5 border-white/10 rounded-lg focus:border-primary/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-frameworks"
            />
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* ── CATEGORIES VIEW ── */}
        {view === "categories" && (
          <div className="max-w-3xl mx-auto animate-fade-in-up">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="heading-frameworks">
                What do you want to build?
              </h1>
              <p className="text-sm text-muted-foreground">
                Choose a platform to get started
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => goToCategory(cat)}
                    className={cn(
                      "group relative text-left p-6 rounded-2xl border border-white/8 bg-gradient-to-br transition-all duration-300 cursor-pointer overflow-hidden",
                      cat.color,
                      "hover:border-white/20 hover:scale-[1.02]"
                    )}
                    style={{ boxShadow: `0 0 0 transparent`, ["--glow" as string]: cat.glow }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${cat.glow}`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 transparent";
                    }}
                    data-testid={`card-category-${cat.id}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2.5 rounded-xl bg-white/8 border border-white/10 group-hover:bg-white/12 transition-colors">
                        <Icon className="h-5 w-5 text-foreground" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-200 mt-1" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground mb-1">{cat.title}</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">{cat.description}</p>
                    <div className="mt-3 text-xs text-muted-foreground">
                      {cat.frameworks.length} frameworks available
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── FRAMEWORKS VIEW ── */}
        {view === "frameworks" && selectedCategory && (
          <div className="max-w-3xl mx-auto animate-fade-in-up">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-foreground mb-1">
                {selectedCategory.title} Frameworks
              </h1>
              <p className="text-sm text-muted-foreground">
                Select a framework to get started
              </p>
            </div>

            {filteredFrameworks.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No frameworks match "{searchQuery}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredFrameworks.map((fw) => (
                  <button
                    key={fw.name}
                    onClick={() => goToSetup(fw)}
                    className="group text-left p-5 rounded-2xl border border-white/8 bg-[hsl(220,25%,10%)] hover:border-white/20 hover:bg-white/5 transition-all duration-200 cursor-pointer"
                    data-testid={`card-framework-${fw.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-2xl flex-shrink-0">{fw.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-sm font-semibold text-foreground">{fw.name}</h3>
                          <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/8 rounded-md px-2 py-0.5 ml-2 flex-shrink-0">
                            {fw.lang}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {fw.description}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <span className="text-xs text-primary group-hover:text-primary font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        Select <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SETUP VIEW ── */}
        {view === "setup" && selectedFramework && selectedCategory && (
          <div className="max-w-lg mx-auto animate-fade-in-up">
            <div className="p-8 rounded-2xl border border-white/8 bg-[hsl(220,25%,10%)]">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">{selectedFramework.icon}</span>
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    Start with {selectedFramework.name}
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedCategory.title} · {selectedFramework.lang}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                {selectedFramework.description}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block" htmlFor="project-name">
                    Project name
                  </label>
                  <Input
                    id="project-name"
                    placeholder={`my-${selectedFramework.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-app`}
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="bg-white/5 border-white/10 rounded-xl focus:border-primary/50 h-10"
                    data-testid="input-project-name"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">
                    Template
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Blank", "Starter Kit"].map((t) => (
                      <button
                        key={t}
                        className="p-3 rounded-xl border border-white/8 bg-white/3 hover:border-primary/40 hover:bg-primary/5 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 text-left"
                        data-testid={`button-template-${t.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCreateProject}
                className="w-full mt-6 h-10 text-sm font-semibold bg-gradient-to-r from-[#7c8dff] to-[#a78bfa] hover:from-[#6b7ef0] hover:to-[#9575f0] border-0 text-white rounded-xl transition-all duration-200"
                style={{ boxShadow: "0 0 20px rgba(124,141,255,0.25)" }}
                data-testid="button-create-project"
              >
                Create Project
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
