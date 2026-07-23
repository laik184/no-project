import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, LayoutGrid, List as ListIcon, MoreVertical,
  Star, Clock, Globe, Lock, Plus, Check, X,
  ChevronDown, Activity, AlertCircle, Box, Terminal,
  LayoutTemplate, XCircle, Folder, Settings, Trash2,
  ExternalLink, Loader2
} from 'lucide-react';

// --- Types ---
type ProjectStatus = 'active' | 'building' | 'failed' | 'archived';
type ProjectVisibility = 'public' | 'private';

interface Project {
  id: string;
  name: string;
  description: string;
  framework: string;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  lastUpdated: string;
  folder: string;
  isFavorite: boolean;
}

// --- Mock Data ---
const MOCK_PROJECTS: Project[] = [
  {
    id: 'prj_1',
    name: 'api-gateway-service',
    description: 'Core routing and auth middleware for microservices',
    framework: 'Node.js',
    status: 'active',
    visibility: 'private',
    lastUpdated: new Date(Date.now() - 2 * 3600000).toISOString(),
    folder: 'Backend',
    isFavorite: true,
  },
  {
    id: 'prj_2',
    name: 'admin-dashboard-v2',
    description: 'Internal tool for customer success team',
    framework: 'React',
    status: 'building',
    visibility: 'private',
    lastUpdated: new Date(Date.now() - 5 * 60000).toISOString(),
    folder: 'Internal Tools',
    isFavorite: false,
  },
  {
    id: 'prj_3',
    name: 'marketing-site',
    description: 'Public facing website and blog',
    framework: 'Next.js',
    status: 'active',
    visibility: 'public',
    lastUpdated: new Date(Date.now() - 24 * 3600000).toISOString(),
    folder: 'Web',
    isFavorite: true,
  },
  {
    id: 'prj_4',
    name: 'payment-worker',
    description: 'Background jobs for Stripe webhook processing',
    framework: 'Python',
    status: 'failed',
    visibility: 'private',
    lastUpdated: new Date(Date.now() - 12 * 3600000).toISOString(),
    folder: 'Backend',
    isFavorite: false,
  },
  {
    id: 'prj_5',
    name: 'ios-companion-app',
    description: 'React Native mobile application',
    framework: 'React Native',
    status: 'active',
    visibility: 'public',
    lastUpdated: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    folder: 'Mobile',
    isFavorite: false,
  },
  {
    id: 'prj_6',
    name: 'legacy-auth-service',
    description: 'Deprecated authentication endpoints',
    framework: 'Node.js',
    status: 'archived',
    visibility: 'private',
    lastUpdated: new Date(Date.now() - 120 * 24 * 3600000).toISOString(),
    folder: 'Backend',
    isFavorite: false,
  },
  {
    id: 'prj_7',
    name: 'design-system-docs',
    description: 'Storybook documentation for UI components',
    framework: 'React',
    status: 'active',
    visibility: 'public',
    lastUpdated: new Date(Date.now() - 48 * 3600000).toISOString(),
    folder: 'Web',
    isFavorite: false,
  },
  {
    id: 'prj_8',
    name: 'data-pipeline-sync',
    description: 'Nightly ETL jobs for analytics warehouse',
    framework: 'Python',
    status: 'building',
    visibility: 'private',
    lastUpdated: new Date(Date.now() - 15 * 60000).toISOString(),
    folder: 'Data',
    isFavorite: true,
  }
];

// --- Utilities ---
const timeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + 'y ago';
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + 'mo ago';
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + 'd ago';
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + 'h ago';
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + 'm ago';
  return Math.floor(seconds) + 's ago';
};

const getFrameworkIcon = (framework: string) => {
  switch (framework) {
    case 'React':
    case 'React Native':
      return <Box className="w-4 h-4 text-blue-400" />;
    case 'Next.js':
      return <LayoutTemplate className="w-4 h-4 text-zinc-300" />;
    case 'Node.js':
      return <Terminal className="w-4 h-4 text-green-400" />;
    case 'Python':
      return <Terminal className="w-4 h-4 text-yellow-400" />;
    default:
      return <Box className="w-4 h-4 text-zinc-400" />;
  }
};

const getStatusBadge = (status: ProjectStatus) => {
  switch (status) {
    case 'active':
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Active
        </div>
      );
    case 'building':
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-medium">
          <Loader2 className="w-3 h-3 animate-spin" />
          Building
        </div>
      );
    case 'failed':
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium">
          <XCircle className="w-3 h-3" />
          Failed
        </div>
      );
    case 'archived':
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 text-xs font-medium">
          <ArchiveIcon className="w-3 h-3" />
          Archived
        </div>
      );
  }
};

const ArchiveIcon = (props: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="21 8 21 21 3 21 3 8"></polyline>
    <rect x="1" y="3" width="22" height="5"></rect>
    <line x1="10" y1="12" x2="14" y2="12"></line>
  </svg>
);

// --- Hooks ---
function useOnClickOutside(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

// --- Components ---

function Dropdown({ 
  trigger, 
  items, 
  align = 'right',
  width = 'w-48'
}: { 
  trigger: React.ReactNode, 
  items: { label: string, icon?: React.ReactNode, onClick: () => void, danger?: boolean, separator?: boolean }[],
  align?: 'left' | 'right',
  width?: string
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, () => setIsOpen(false));

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>
      
      {isOpen && (
        <div 
          className={`absolute z-50 mt-1 ${width} rounded-md bg-zinc-900 border border-zinc-800 shadow-xl focus:outline-none origin-top-right ${align === 'right' ? 'right-0' : 'left-0'} animate-in fade-in slide-in-from-top-2 duration-200`}
        >
          <div className="py-1">
            {items.map((item, i) => item.separator ? (
              <div key={`sep-${i}`} className="h-px bg-zinc-800 my-1" />
            ) : (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                  setIsOpen(false);
                }}
                className={`flex items-center w-full px-3 py-2 text-sm text-left transition-colors ${
                  item.danger 
                    ? 'text-red-400 hover:bg-red-500/10' 
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {item.icon && <span className="mr-2 opacity-70">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export function ProjectsDashboard() {
  // State
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('all');
  const [filterFolder, setFilterFolder] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'lastUpdated' | 'name'>('lastUpdated');
  
  const [demoState, setDemoState] = useState<'loaded' | 'loading' | 'empty'>('loaded');

  // Derived state
  const folders = useMemo(() => {
    const f = new Set(MOCK_PROJECTS.map(p => p.folder));
    return ['all', ...Array.from(f)];
  }, []);

  const filteredProjects = useMemo(() => {
    let result = projects.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
      const matchesFolder = filterFolder === 'all' || p.folder === filterFolder;
      
      return matchesSearch && matchesStatus && matchesFolder;
    });

    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    });

    // Sort favorites first
    return result.sort((a, b) => (a.isFavorite === b.isFavorite ? 0 : a.isFavorite ? -1 : 1));
  }, [projects, searchQuery, filterStatus, filterFolder, sortBy]);

  // Actions
  const toggleFavorite = (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const duplicateProject = (project: Project) => {
    const newProject: Project = {
      ...project,
      id: `prj_${Date.now()}`,
      name: `${project.name}-copy`,
      isFavorite: false,
      lastUpdated: new Date().toISOString(),
      status: 'building'
    };
    setProjects(prev => [newProject, ...prev]);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Box className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Projects</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors px-3 py-2">
              Docs
            </button>
            <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm shadow-indigo-900/20">
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="relative group max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-100 text-sm rounded-md pl-9 pr-8 py-2.5 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            {/* Filter: Folder */}
            <Dropdown
              align="right"
              trigger={
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-md transition-colors text-zinc-300 whitespace-nowrap">
                  <Folder className="w-4 h-4 text-zinc-500" />
                  {filterFolder === 'all' ? 'All Folders' : filterFolder}
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </button>
              }
              items={folders.map(f => ({
                label: f === 'all' ? 'All Folders' : f,
                onClick: () => setFilterFolder(f),
                icon: filterFolder === f ? <Check className="w-4 h-4 text-indigo-400" /> : <span className="w-4" />
              }))}
            />

            {/* Filter: Status */}
            <Dropdown
              align="right"
              trigger={
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-md transition-colors text-zinc-300 whitespace-nowrap">
                  <Activity className="w-4 h-4 text-zinc-500" />
                  {filterStatus === 'all' ? 'All Statuses' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </button>
              }
              items={[
                { label: 'All Statuses', onClick: () => setFilterStatus('all'), icon: filterStatus === 'all' ? <Check className="w-4 h-4 text-indigo-400" /> : <span className="w-4"/> },
                { separator: true, onClick: () => {} },
                { label: 'Active', onClick: () => setFilterStatus('active'), icon: filterStatus === 'active' ? <Check className="w-4 h-4 text-indigo-400" /> : <span className="w-4"/> },
                { label: 'Building', onClick: () => setFilterStatus('building'), icon: filterStatus === 'building' ? <Check className="w-4 h-4 text-indigo-400" /> : <span className="w-4"/> },
                { label: 'Failed', onClick: () => setFilterStatus('failed'), icon: filterStatus === 'failed' ? <Check className="w-4 h-4 text-indigo-400" /> : <span className="w-4"/> },
                { label: 'Archived', onClick: () => setFilterStatus('archived'), icon: filterStatus === 'archived' ? <Check className="w-4 h-4 text-indigo-400" /> : <span className="w-4"/> },
              ]}
            />

            {/* Sort */}
            <Dropdown
              align="right"
              trigger={
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-md transition-colors text-zinc-300 whitespace-nowrap">
                  Sort: {sortBy === 'lastUpdated' ? 'Last Updated' : 'Name'}
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </button>
              }
              items={[
                { label: 'Last Updated', onClick: () => setSortBy('lastUpdated'), icon: sortBy === 'lastUpdated' ? <Check className="w-4 h-4 text-indigo-400" /> : <span className="w-4"/> },
                { label: 'Alphabetical', onClick: () => setSortBy('name'), icon: sortBy === 'name' ? <Check className="w-4 h-4 text-indigo-400" /> : <span className="w-4"/> },
              ]}
            />

            <div className="w-px h-6 bg-zinc-800 hidden sm:block mx-1"></div>

            {/* View Toggle */}
            <div className="flex bg-zinc-900/50 p-1 rounded-md border border-zinc-800">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                aria-label="List view"
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {demoState === 'loading' ? (
          <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-5 flex flex-col gap-4 animate-pulse">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800/50" />
                    <div className="space-y-2">
                      <div className="w-32 h-4 rounded bg-zinc-800/50" />
                      <div className="w-24 h-3 rounded bg-zinc-800/30" />
                    </div>
                  </div>
                </div>
                <div className="w-full h-12 rounded bg-zinc-800/30" />
                <div className="flex justify-between items-center mt-2">
                  <div className="flex gap-2">
                    <div className="w-16 h-5 rounded-full bg-zinc-800/50" />
                    <div className="w-16 h-5 rounded-full bg-zinc-800/50" />
                  </div>
                  <div className="w-20 h-4 rounded bg-zinc-800/30" />
                </div>
              </div>
            ))}
          </div>
        ) : demoState === 'empty' || projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
            <div className="w-16 h-16 mb-6 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 shadow-sm">
              <Box className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-medium text-zinc-100 mb-2">No projects found</h3>
            <p className="text-zinc-400 max-w-sm mb-6">
              Get started by creating a new project. You can deploy applications, APIs, and websites.
            </p>
            <button 
              onClick={() => {
                setDemoState('loaded');
                setProjects(MOCK_PROJECTS);
              }}
              className="bg-zinc-100 hover:bg-white text-zinc-900 font-medium px-5 py-2.5 rounded-md transition-colors shadow-sm"
            >
              Create first project
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Search className="w-12 h-12 text-zinc-700 mb-4" />
            <h3 className="text-lg font-medium text-zinc-100 mb-2">No results for "{searchQuery}"</h3>
            <p className="text-zinc-500">
              Try adjusting your filters or search query.
            </p>
            <button 
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
                setFilterFolder('all');
              }}
              className="mt-6 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
            {filteredProjects.map((project) => (
              <div 
                key={project.id}
                className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-[#121214] p-5 transition-all hover:border-zinc-700 hover:bg-[#18181b] hover:shadow-lg hover:shadow-black/20 focus-within:ring-2 focus-within:ring-indigo-500/50"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-sm">
                        {getFrameworkIcon(project.framework)}
                      </div>
                      <div>
                        <a href={`#${project.id}`} className="font-medium text-zinc-100 hover:text-indigo-400 transition-colors focus:outline-none flex items-center gap-1.5">
                          {project.name}
                          {project.visibility === 'private' && <Lock className="w-3 h-3 text-zinc-500" />}
                        </a>
                        <div className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                          <Folder className="w-3 h-3" />
                          {project.folder}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 -mt-1 -mr-1">
                      <button 
                        onClick={() => toggleFavorite(project.id)}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-yellow-400 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        aria-label={project.isFavorite ? "Unfavorite" : "Favorite"}
                      >
                        <Star className={`w-4 h-4 ${project.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </button>
                      <Dropdown
                        trigger={
                          <button 
                            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            aria-label="Options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        }
                        items={[
                          { label: 'Open Settings', icon: <Settings className="w-4 h-4" />, onClick: () => console.log('Open settings') },
                          { label: 'Visit Deployment', icon: <ExternalLink className="w-4 h-4" />, onClick: () => console.log('Visit') },
                          { separator: true, onClick: () => {} },
                          { label: project.isFavorite ? 'Remove from Favorites' : 'Add to Favorites', icon: <Star className="w-4 h-4" />, onClick: () => toggleFavorite(project.id) },
                          { label: 'Duplicate', icon: <Box className="w-4 h-4" />, onClick: () => duplicateProject(project) },
                          { separator: true, onClick: () => {} },
                          { label: 'Delete Project', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => deleteProject(project.id) }
                        ]}
                      />
                    </div>
                  </div>
                  
                  <p className="text-sm text-zinc-400 line-clamp-2 mb-6 leading-relaxed">
                    {project.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(project.status)}
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs font-medium text-zinc-300">
                      {project.framework}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500" title={new Date(project.lastUpdated).toLocaleString()}>
                    <Clock className="w-3.5 h-3.5" />
                    {timeAgo(project.lastUpdated)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Demo Controls (Only for demonstration purposes) */}
      <div className="fixed bottom-4 right-4 flex gap-2 bg-zinc-900 border border-zinc-800 p-1.5 rounded-lg shadow-xl z-50">
        {(['loaded', 'loading', 'empty'] as const).map(state => (
          <button
            key={state}
            onClick={() => setDemoState(state)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              demoState === state ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            {state.charAt(0).toUpperCase() + state.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
