import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  Globe,
  Lock,
  Check,
  Search,
  Code2,
  Server,
  Terminal,
  Database,
  Cpu,
  Gamepad2,
  BarChart3,
  Smartphone,
  Wand2,
  PresentationIcon,
  FileText,
  Braces,
  ArrowRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const languages = [
  {
    id: "nodejs",
    label: "Node.js",
    icon: "🟢",
    desc: "JavaScript runtime",
    color: "from-green-500/20 to-emerald-500/10",
    border: "border-green-500/20",
  },
  {
    id: "python",
    label: "Python",
    icon: "🐍",
    desc: "General purpose",
    color: "from-blue-500/20 to-cyan-500/10",
    border: "border-blue-500/20",
  },
  {
    id: "html",
    label: "HTML/CSS/JS",
    icon: "🌐",
    desc: "Static web page",
    color: "from-orange-500/20 to-amber-500/10",
    border: "border-orange-500/20",
  },
  {
    id: "react",
    label: "React",
    icon: "⚛️",
    desc: "UI library",
    color: "from-cyan-500/20 to-blue-500/10",
    border: "border-cyan-500/20",
  },
  {
    id: "typescript",
    label: "TypeScript",
    icon: "🔷",
    desc: "Typed JavaScript",
    color: "from-blue-600/20 to-indigo-500/10",
    border: "border-blue-600/20",
  },
  {
    id: "go",
    label: "Go",
    icon: "🔵",
    desc: "Fast compiled language",
    color: "from-sky-500/20 to-blue-500/10",
    border: "border-sky-500/20",
  },
  {
    id: "rust",
    label: "Rust",
    icon: "🦀",
    desc: "Systems language",
    color: "from-orange-600/20 to-red-500/10",
    border: "border-orange-600/20",
  },
  {
    id: "java",
    label: "Java",
    icon: "☕",
    desc: "Enterprise language",
    color: "from-red-500/20 to-orange-500/10",
    border: "border-red-500/20",
  },
  {
    id: "cpp",
    label: "C++",
    icon: "⚙️",
    desc: "Systems & performance",
    color: "from-violet-500/20 to-purple-500/10",
    border: "border-violet-500/20",
  },
  {
    id: "ruby",
    label: "Ruby",
    icon: "💎",
    desc: "Elegant scripting",
    color: "from-red-400/20 to-rose-500/10",
    border: "border-red-400/20",
  },
  {
    id: "php",
    label: "PHP",
    icon: "🐘",
    desc: "Web backend",
    color: "from-indigo-400/20 to-blue-500/10",
    border: "border-indigo-400/20",
  },
  {
    id: "bash",
    label: "Bash",
    icon: "💻",
    desc: "Shell scripting",
    color: "from-gray-500/20 to-zinc-500/10",
    border: "border-gray-500/20",
  },
];

const owners = ["xzygeu058", "my-org", "team-project"];

export default function CreateProject() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLang, setSelectedLang] = useState("nodejs");
  const [privacy, setPrivacy] = useState("private");
  const [owner, setOwner] = useState(owners[0]);
  const [langSearch, setLangSearch] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const filteredLangs = languages.filter(
    (l) =>
      langSearch.trim() === "" ||
      l.label.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.desc.toLowerCase().includes(langSearch.toLowerCase())
  );

  const selectedLangObj = languages.find((l) => l.id === selectedLang);

  return (
    <div
      className="flex-1 flex flex-col overflow-auto text-white"
      style={{ background: "hsl(222,30%,7%)" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 w-full border-b border-white/[0.07]"
        style={{ background: "hsl(222,30%,7%)" }}
      >
        <div className="flex h-14 items-center px-4 gap-3">
          <button
            data-testid="button-back"
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-2xl">

          {/* Title */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Code2 className="w-5 h-5 text-white/70" />
              </div>
              <h1 className="text-2xl font-semibold text-white" data-testid="heading-create-project">
                Create a Repl
              </h1>
            </div>
            <p className="text-sm text-muted-foreground ml-12">
              Start a new project from scratch with your preferred language.
            </p>
          </div>

          <div className="h-px bg-white/[0.07] mb-8" />

          <div className="space-y-7">

            {/* Owner + Title row */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Title
              </label>
              <div className="flex items-center gap-0 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)" }}>
                {/* Owner picker */}
                <div className="flex items-center gap-2 px-3 py-3 border-r border-white/10 flex-shrink-0">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {owner[0].toUpperCase()}
                  </div>
                  <select
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    data-testid="select-owner"
                    className="bg-transparent text-sm text-white outline-none cursor-pointer pr-1"
                  >
                    {owners.map((o) => (
                      <option key={o} value={o} style={{ background: "hsl(222,30%,10%)" }}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-muted-foreground px-1 text-sm select-none">/</span>

                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="my-awesome-project"
                  data-testid="input-title"
                  className="flex-1 px-3 py-3 bg-transparent text-sm text-white placeholder:text-muted-foreground/40 outline-none"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Description <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this project do?"
                data-testid="input-description"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-muted-foreground/40 outline-none transition-all duration-150"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(124,141,255,0.5)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,141,255,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Language / Template */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Language / Template
              </label>

              {/* Search */}
              <div
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-3"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={langSearch}
                  onChange={(e) => setLangSearch(e.target.value)}
                  placeholder="Search languages…"
                  data-testid="input-lang-search"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-muted-foreground/50 outline-none"
                />
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredLangs.map((lang) => {
                  const active = selectedLang === lang.id;
                  return (
                    <button
                      key={lang.id}
                      onClick={() => setSelectedLang(lang.id)}
                      data-testid={`lang-${lang.id}`}
                      className={cn(
                        "relative flex items-center gap-3 p-3.5 rounded-xl text-left transition-all duration-150",
                        active
                          ? `bg-gradient-to-br ${lang.color} border ${lang.border}`
                          : "bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.12]"
                      )}
                    >
                      <span className="text-xl leading-none flex-shrink-0">{lang.icon}</span>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium truncate", active ? "text-white" : "text-muted-foreground")}>
                          {lang.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{lang.desc}</p>
                      </div>
                      {active && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
                {filteredLangs.length === 0 && (
                  <div className="col-span-3 py-8 text-center text-muted-foreground text-sm">
                    No languages match "{langSearch}"
                  </div>
                )}
              </div>
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Visibility
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "public", label: "Public", icon: Globe, desc: "Anyone can view and fork" },
                  { value: "private", label: "Private", icon: Lock, desc: "Only you can access" },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = privacy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setPrivacy(opt.value)}
                      data-testid={`radio-${opt.value}`}
                      className={cn(
                        "flex flex-col gap-2 p-4 rounded-xl text-left transition-all duration-150",
                        active
                          ? "border border-primary/50 bg-primary/10"
                          : "border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={cn("w-3.5 h-3.5", active ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn("text-sm font-medium", active ? "text-white" : "text-muted-foreground")}>
                            {opt.label}
                          </span>
                        </div>
                        {active && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected summary */}
            {selectedLangObj && (
              <div
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{selectedLangObj.icon}</span>
                  <div>
                    <p className="text-sm text-white font-medium">{selectedLangObj.label}</p>
                    <p className="text-xs text-muted-foreground">{selectedLangObj.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {privacy === "private" ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                  <span className="capitalize">{privacy}</span>
                </div>
              </div>
            )}

            {/* Create Button */}
            <div className="pt-1 pb-8">
              <button
                data-testid="button-create-project"
                onClick={() => setLocation("/workspace")}
                disabled={!title.trim()}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all duration-200",
                  title.trim()
                    ? "hover:opacity-90 active:scale-[0.98]"
                    : "opacity-40 cursor-not-allowed"
                )}
                style={{
                  background: "linear-gradient(135deg, #7c8dff, #a78bfa)",
                  boxShadow: title.trim()
                    ? "0 0 24px rgba(124,141,255,0.35), 0 4px 12px rgba(0,0,0,0.3)"
                    : "none",
                }}
              >
                <ArrowRight className="w-4 h-4" />
                Create Repl
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
