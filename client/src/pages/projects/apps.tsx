import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Archive,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  Code2,
  Copy,
  FilePlus2,
  Folder,
  FolderPlus,
  Grid2X2,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Server,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";
type ProjectStatus = "active" | "draft" | "archived";
type ProjectFramework = "React" | "Next.js" | "Node.js" | "Python";

type Project = {
  id: string;
  name: string;
  description: string;
  framework: ProjectFramework;
  status: ProjectStatus;
  visibility: "Private" | "Public";
  folder: string;
  updatedAt: string;
  favorite: boolean;
  color: string;
  initials: string;
};

const STORAGE_KEY = "nura-x-projects";
const FOLDERS_KEY = "nura-x-project-folders";

const importedProject: Project = {
  id: "nura-x-deployer",
  name: "NURA X Deployer",
  description: "AI-powered workspace for building and publishing apps.",
  framework: "React",
  status: "active",
  visibility: "Private",
  folder: "All",
  updatedAt: "Just now",
  favorite: true,
  color: "from-indigo-500/30 to-violet-500/20",
  initials: "NX",
};

const frameworkIcons: Record<ProjectFramework, typeof Code2> = {
  React: Code2,
  "Next.js": Code2,
  "Node.js": Server,
  Python: CircleDot,
};

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function timeLabel(value: string) {
  return value === "Just now" ? value : value;
}

function ProjectIcon({ project, small = false }: { project: Project; small?: boolean }) {
  const FrameworkIcon = frameworkIcons[project.framework];
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br font-semibold text-white shadow-inner",
        project.color,
        small ? "h-9 w-9 text-[11px]" : "h-12 w-12 text-xs",
      )}
      aria-hidden="true"
    >
      <span className="flex items-center gap-0.5">
        {project.initials}
        <FrameworkIcon className={cn("opacity-60", small ? "h-2.5 w-2.5" : "h-3 w-3")} />
      </span>
    </div>
  );
}

function SelectField({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="relative flex min-w-[118px] items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-white/10 bg-white/[0.035] px-3 pr-8 text-xs font-medium text-foreground outline-none transition-colors hover:border-white/20 focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
        aria-label={label}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground" />
    </label>
  );
}

function ProjectMenu({
  project,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:bg-white/10 hover:text-foreground"
        aria-label={`Actions for ${project.name}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-white/10 bg-[hsl(222,28%,10%)] p-1.5 shadow-2xl">
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-foreground hover:bg-white/8"
              onClick={() => {
                setOpen(false);
                onRename();
              }}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Rename
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-foreground hover:bg-white/8"
              onClick={() => {
                setOpen(false);
                onDuplicate();
              }}
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" /> Duplicate
            </button>
            <div className="my-1 border-t border-white/8" />
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-red-300 hover:bg-red-500/10"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  view,
  onOpen,
  onFavorite,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  view: ViewMode;
  onOpen: () => void;
  onFavorite: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  if (view === "list") {
    return (
      <div className="group flex items-center gap-3 border-b border-white/7 px-4 py-3 transition-colors hover:bg-white/[0.035]">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onOpen} aria-label={`Open ${project.name}`}>
          <ProjectIcon project={project} small />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{project.name}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{project.description}</span>
          </span>
        </button>
        <span className="hidden w-24 items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <Code2 className="h-3.5 w-3.5" /> {project.framework}
        </span>
        <span className="hidden w-24 items-center gap-1.5 text-xs text-muted-foreground lg:flex">
          <Clock3 className="h-3.5 w-3.5" /> {timeLabel(project.updatedAt)}
        </span>
        <StatusPill status={project.status} />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFavorite} aria-label={project.favorite ? "Remove from favorites" : "Add to favorites"}>
          <Star className={cn("h-4 w-4", project.favorite ? "fill-amber-300 text-amber-300" : "text-muted-foreground")} />
        </Button>
        <ProjectMenu project={project} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
    );
  }

  return (
    <article className="group relative flex min-h-[190px] cursor-pointer flex-col rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-white/[0.045] hover:shadow-[0_10px_35px_rgba(0,0,0,0.18)]" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <ProjectIcon project={project} />
        <div className="flex items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" onClick={onFavorite} aria-label={project.favorite ? "Remove from favorites" : "Add to favorites"}>
            <Star className={cn("h-4 w-4", project.favorite ? "fill-amber-300 text-amber-300" : "text-muted-foreground")} />
          </Button>
          <ProjectMenu project={project} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
        </div>
      </div>
      <div className="mt-4 min-w-0">
        <h3 className="truncate text-sm font-semibold text-foreground">{project.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-4 text-muted-foreground">{project.description}</p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md bg-white/7 px-2 py-1 text-[10px] font-medium text-muted-foreground">{project.framework}</span>
          <span className="truncate text-[10px] text-muted-foreground">{project.visibility}</span>
        </div>
        <StatusPill status={project.status} />
      </div>
      <div className="mt-3 flex items-center gap-1.5 border-t border-white/7 pt-3 text-[10px] text-muted-foreground">
        <Clock3 className="h-3 w-3" /> Updated {timeLabel(project.updatedAt)}
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: ProjectStatus }) {
  const labels: Record<ProjectStatus, string> = { active: "Active", draft: "Draft", archived: "Archived" };
  const colors: Record<ProjectStatus, string> = {
    active: "bg-emerald-400/10 text-emerald-300",
    draft: "bg-amber-400/10 text-amber-300",
    archived: "bg-white/8 text-muted-foreground",
  };
  return <span className={cn("rounded-full px-2 py-1 text-[10px] font-medium", colors[status])}>{labels[status]}</span>;
}

export default function Apps() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>(() => readStored(STORAGE_KEY, [importedProject]));
  const [folders, setFolders] = useState<string[]>(() => readStored(FOLDERS_KEY, ["All", "Personal"]));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [framework, setFramework] = useState("all");
  const [folder, setFolder] = useState("All");
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState<ViewMode>("grid");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [loading] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    window.localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }, [folders]);

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects
      .filter((project) => !query || `${project.name} ${project.description} ${project.framework}`.toLowerCase().includes(query))
      .filter((project) => status === "all" || project.status === status)
      .filter((project) => framework === "all" || project.framework === framework)
      .filter((project) => folder === "All" || project.folder === folder)
      .filter((project) => !favoritesOnly || project.favorite)
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "oldest") return a.updatedAt.localeCompare(b.updatedAt);
        return Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name);
      });
  }, [projects, search, status, framework, folder, favoritesOnly, sort]);

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setFramework("all");
    setFolder("All");
    setFavoritesOnly(false);
  };

  const openCreate = () => {
    setName("");
    setDescription("");
    setCreateOpen(true);
  };

  const createProject = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const project: Project = {
      id: `${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: trimmed,
      description: description.trim() || "A new project in your workspace.",
      framework: "React",
      status: "draft",
      visibility: "Private",
      folder: folder === "All" ? "Personal" : folder,
      updatedAt: "Just now",
      favorite: false,
      color: "from-cyan-500/25 to-blue-500/20",
      initials: trimmed.slice(0, 2).toUpperCase(),
    };
    setProjects((current) => [project, ...current]);
    setCreateOpen(false);
    toast({ title: "Project created", description: `${trimmed} is ready to open.` });
  };

  const addFolder = () => {
    const trimmed = newFolder.trim();
    if (!trimmed || folders.includes(trimmed)) return;
    setFolders((current) => [...current, trimmed]);
    setNewFolder("");
    setFolderOpen(false);
    toast({ title: "Folder created", description: `${trimmed} is now available in your filters.` });
  };

  const duplicateProject = (project: Project) => {
    const copy = { ...project, id: `${project.id}-copy-${Date.now()}`, name: `${project.name} copy`, updatedAt: "Just now", favorite: false };
    setProjects((current) => [copy, ...current]);
    toast({ title: "Project duplicated", description: `${copy.name} was added to your projects.` });
  };

  const renameProject = () => {
    const trimmed = name.trim();
    if (!selected || !trimmed) return;
    setProjects((current) => current.map((project) => project.id === selected.id ? { ...project, name: trimmed, updatedAt: "Just now" } : project));
    setRenameOpen(false);
    toast({ title: "Project renamed", description: `The project is now called ${trimmed}.` });
  };

  const deleteProject = () => {
    if (!selected) return;
    setProjects((current) => current.filter((project) => project.id !== selected.id));
    setDeleteOpen(false);
    toast({ title: "Project deleted", description: `${selected.name} was removed from this browser workspace.` });
  };

  const openRename = (project: Project) => {
    setSelected(project);
    setName(project.name);
    setRenameOpen(true);
  };

  const openDelete = (project: Project) => {
    setSelected(project);
    setDeleteOpen(true);
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-white/8 px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Folder className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">Projects</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">Build, organize, and manage your apps</p>
          </div>
        </div>
        <Button onClick={openCreate} className="h-9 gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/.2)] hover:bg-primary/90">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New app</span>
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1440px] px-5 py-6 sm:px-8 sm:py-8">
          <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <button className="hover:text-foreground" onClick={() => setFolder("All")}>All projects</button>
                <span>/</span>
                <span className="text-foreground">{folder === "All" ? "All" : folder}</span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Your projects</h2>
              <p className="mt-1 text-sm text-muted-foreground">Everything you are building in this workspace.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="h-9 gap-2 rounded-lg border-white/10 bg-white/[0.025] text-xs hover:bg-white/8" onClick={() => setFolderOpen(true)}>
                <FolderPlus className="h-3.5 w-3.5" /> New folder
              </Button>
              <Button variant="outline" className="h-9 gap-2 rounded-lg border-white/10 bg-white/[0.025] text-xs hover:bg-white/8" onClick={openCreate}>
                <FilePlus2 className="h-3.5 w-3.5" /> Start from scratch
              </Button>
            </div>
          </div>

          <section className="rounded-2xl border border-white/8 bg-white/[0.018] p-3 sm:p-4" aria-label="Project controls">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search projects</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search projects..."
                  className="h-9 border-white/10 bg-black/20 pl-9 pr-9 text-xs placeholder:text-muted-foreground/70"
                  aria-label="Search projects"
                />
                {search && <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")} aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <SelectField value={status} onChange={setStatus} label="Filter by status">
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </SelectField>
                <SelectField value={framework} onChange={setFramework} label="Filter by framework">
                  <option value="all">All frameworks</option>
                  <option value="React">React</option>
                  <option value="Next.js">Next.js</option>
                  <option value="Node.js">Node.js</option>
                  <option value="Python">Python</option>
                </SelectField>
                <SelectField value={folder} onChange={setFolder} label="Filter by folder">
                  {folders.map((item) => <option key={item} value={item}>{item === "All" ? "All folders" : item}</option>)}
                </SelectField>
                <SelectField value={sort} onChange={setSort} label="Sort projects">
                  <option value="updated">Recently updated</option>
                  <option value="name">Name A–Z</option>
                  <option value="oldest">Oldest updated</option>
                </SelectField>
                <Button variant="outline" className={cn("h-9 gap-2 rounded-lg border-white/10 bg-white/[0.035] text-xs", favoritesOnly && "border-amber-300/30 bg-amber-300/10 text-amber-200")} onClick={() => setFavoritesOnly((current) => !current)} aria-pressed={favoritesOnly}>
                  <Star className={cn("h-3.5 w-3.5", favoritesOnly && "fill-amber-300")} /> Favorites
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/7 pt-3">
              <p className="text-xs text-muted-foreground">{visibleProjects.length} {visibleProjects.length === 1 ? "project" : "projects"}</p>
              <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-black/20 p-0.5" aria-label="Project view">
                <Button variant="ghost" size="icon" className={cn("h-7 w-7 rounded-md", view === "grid" && "bg-white/10 text-foreground")} onClick={() => setView("grid")} aria-label="Grid view" aria-pressed={view === "grid"}><Grid2X2 className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className={cn("h-7 w-7 rounded-md", view === "list" && "bg-white/10 text-foreground")} onClick={() => setView("list")} aria-label="List view" aria-pressed={view === "list"}><List className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </section>

          <div className="mt-7">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl border border-white/8 bg-white/[0.035]" />)}
              </div>
            ) : visibleProjects.length > 0 ? (
              view === "grid" ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleProjects.map((project) => <ProjectCard key={project.id} project={project} view={view} onOpen={() => navigate(`/workspace/${project.id}`)} onFavorite={() => setProjects((current) => current.map((item) => item.id === project.id ? { ...item, favorite: !item.favorite } : item))} onRename={() => openRename(project)} onDuplicate={() => duplicateProject(project)} onDelete={() => openDelete(project)} />)}
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.018]">
                  <div className="hidden items-center gap-3 border-b border-white/7 px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:flex"><span className="flex-1">Project</span><span className="w-24">Framework</span><span className="w-24">Updated</span><span className="w-20">Status</span><span className="w-20" /></div>
                  {visibleProjects.map((project) => <ProjectCard key={project.id} project={project} view={view} onOpen={() => navigate(`/workspace/${project.id}`)} onFavorite={() => setProjects((current) => current.map((item) => item.id === project.id ? { ...item, favorite: !item.favorite } : item))} onRename={() => openRename(project)} onDuplicate={() => duplicateProject(project)} onDelete={() => openDelete(project)} />)}
                </div>
              )
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.012] px-6 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground"><Search className="h-5 w-5" /></div>
                <h3 className="text-sm font-semibold text-foreground">{projects.length === 0 ? "No projects yet" : "No projects found"}</h3>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{projects.length === 0 ? "Create your first app to get started." : "Try a different search or remove some filters."}</p>
                {projects.length === 0 ? <Button onClick={openCreate} className="mt-5 h-9 gap-2 text-xs"><Plus className="h-3.5 w-3.5" /> Create your first app</Button> : <Button variant="outline" onClick={resetFilters} className="mt-5 h-9 text-xs">Clear filters</Button>}
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center gap-2 rounded-xl border border-white/7 bg-white/[0.018] px-4 py-3 text-xs text-muted-foreground">
            <Users className="h-4 w-4 text-primary/80" />
            <span>Projects shared with you will appear here.</span>
            <Archive className="ml-auto h-4 w-4 opacity-40" />
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-white/10 bg-[hsl(222,28%,9%)] sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Create a new app</DialogTitle></DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2"><Label htmlFor="project-name">Project name</Label><Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createProject()} placeholder="e.g. Customer portal" autoFocus /></div>
            <div className="space-y-2"><Label htmlFor="project-description">Description <span className="text-muted-foreground">(optional)</span></Label><Input id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you building?" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={createProject} disabled={!name.trim()}><Plus className="mr-2 h-4 w-4" />Create app</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="border-white/10 bg-[hsl(222,28%,9%)] sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Create a folder</DialogTitle></DialogHeader>
          <div className="py-3"><Label htmlFor="folder-name">Folder name</Label><Input id="folder-name" className="mt-2" value={newFolder} onChange={(event) => setNewFolder(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addFolder()} placeholder="e.g. Client work" autoFocus /></div>
          <DialogFooter><Button variant="outline" onClick={() => setFolderOpen(false)}>Cancel</Button><Button onClick={addFolder} disabled={!newFolder.trim() || folders.includes(newFolder.trim())}><FolderPlus className="mr-2 h-4 w-4" />Create folder</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="border-white/10 bg-[hsl(222,28%,9%)] sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Rename project</DialogTitle></DialogHeader>
          <div className="py-3"><Label htmlFor="rename-name">Project name</Label><Input id="rename-name" className="mt-2" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && renameProject()} autoFocus /></div>
          <DialogFooter><Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button><Button onClick={renameProject} disabled={!name.trim()}><Check className="mr-2 h-4 w-4" />Save changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-white/10 bg-[hsl(222,28%,9%)] sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Delete project?</DialogTitle></DialogHeader>
          <p className="py-3 text-sm leading-6 text-muted-foreground">This will remove <span className="font-medium text-foreground">{selected?.name}</span> from this browser workspace. This action cannot be undone.</p>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={deleteProject}><Trash2 className="mr-2 h-4 w-4" />Delete project</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}