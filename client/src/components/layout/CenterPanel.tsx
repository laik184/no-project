import { useState, useRef, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { Eye, Database, Terminal, Globe, X, Plus, GitBranch, Lock, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import Preview from "@/pages/preview/index";
import { DatabasePanel } from "@/components/panels/DatabasePanel";
import { ConsolePanel } from "@/components/console";
import { PublishingPanel, AuthPanel } from "@/components/panels/PublishingPanel";
import { FileTreePanel } from "@/components/file-explorer";
import { GitPanel } from "./GitPanel";
import { CheckpointPanel } from "@/components/panels/CheckpointPanel";
import {
  EditorToolbar, StatusBar, ToolbarBtn,
  fileTabIcon, langDisplayName,
} from "./editor-toolbar";
import type { WorkspaceTab } from "./editor-toolbar";

export type { WorkspaceTab } from "./editor-toolbar";

function urlTabIcon(url: string): React.ReactElement {
  if (url === "/preview")        return <Eye        style={{ width: 11, height: 11, color: "#60a5fa" }} />;
  if (url === "__database__")    return <Database   style={{ width: 11, height: 11, color: "#34d399" }} />;
  if (url === "__console__")     return <Terminal   style={{ width: 11, height: 11, color: "#fbbf24" }} />;
  if (url === "__publishing__")  return <Globe      style={{ width: 11, height: 11, color: "#4ade80" }} />;
  if (url === "__auth__")        return <Lock       style={{ width: 11, height: 11, color: "#a78bfa" }} />;
  if (url === "__git__")         return <GitBranch  style={{ width: 11, height: 11, color: "#86efac" }} />;
  if (url === "__checkpoints__") return <Camera     style={{ width: 11, height: 11, color: "#fbbf24" }} />;
  return <Globe style={{ width: 11, height: 11, color: "#94a3b8" }} />;
}

function tabIcon(tab: WorkspaceTab): React.ReactElement {
  if (tab.fileContent !== undefined) return fileTabIcon(tab.label, tab.fileLang);
  if (tab.url) return urlTabIcon(tab.url);
  return <></>;
}

const toolItems = [
  {
    section: "Your App",
    items: [
      { id: "preview",    label: "Preview",    sub: "Live preview of your app in real time",                 icon: Eye,       color: "#60a5fa", bg: "rgba(96,165,250,0.1)",   url: "/preview"       },
      { id: "database",   label: "Database",   sub: "Manage tables, rows, and run queries",                  icon: Database,  color: "#34d399", bg: "rgba(52,211,153,0.1)",   url: "__database__"   },
      { id: "console",    label: "Console",    sub: "Run commands and view server logs",                     icon: Terminal,  color: "#fbbf24", bg: "rgba(251,191,36,0.1)",   url: "__console__"    },
      { id: "git",        label: "Git",        sub: "Version history, branches, and commits",                icon: GitBranch, color: "#86efac", bg: "rgba(134,239,172,0.1)", url: "__git__"        },
    ],
  },
  {
    section: "Deployment",
    items: [
      { id: "publishing",   label: "Publishing",  sub: "Publish a live, stable, public version of your app",     icon: Globe,   color: "#4ade80", bg: "rgba(74,222,128,0.1)",   url: "__publishing__"  },
    ],
  },
  {
    section: "Safety",
    items: [
      { id: "checkpoints",  label: "Checkpoints", sub: "Browse history, compare snapshots, and one-click restore", icon: Camera, color: "#fbbf24", bg: "rgba(251,191,36,0.1)", url: "__checkpoints__" },
    ],
  },
];

interface CenterPanelProps {
  tabs: WorkspaceTab[];
  activeTabId: number;
  setActiveTabId: (id: number) => void;
  addTab: () => void;
  closeTab: (id: number) => void;
  addToolTab: (label: string, url: string) => void;
  openFileTab: (name: string, content: string, lang: string) => void;
  showFileExplorer: boolean;
  setShowFileExplorer: (v: boolean) => void;
  activeFileName: string;
}

export function CenterPanel({
  tabs, activeTabId, setActiveTabId, addTab, closeTab,
  addToolTab, openFileTab, showFileExplorer, setShowFileExplorer, activeFileName,
}: CenterPanelProps) {
  const [modifiedIds, setModifiedIds] = useState<Set<number>>(new Set());
  const [wordWrap, setWordWrap]       = useState(true);
  const [cursorPos, setCursorPos]     = useState({ line: 1, col: 1 });
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const markModified = useCallback((id: number) => {
    setModifiedIds((prev) => { const s = new Set(prev); s.add(id); return s; });
  }, []);

  const removeModified = useCallback((id: number) => {
    setModifiedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });
  }, []);

  const handleFormat = useCallback(() => {
    editorRef.current?.getAction("editor.action.formatDocument")?.run();
  }, []);

  const toggleWrap = useCallback(() => {
    setWordWrap((w) => {
      const next = !w;
      editorRef.current?.updateOptions({ wordWrap: next ? "on" : "off" });
      return next;
    });
  }, []);

  const activeTab  = tabs.find((t) => t.id === activeTabId);
  const isFileTab  = activeTab?.fileContent !== undefined;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      {/* ── Tab bar ── */}
      <div
        className="flex items-center gap-0.5 px-3 border-b flex-shrink-0 overflow-x-auto"
        style={{ height: 38, background: "rgba(255,255,255,0.01)", borderColor: "rgba(255,255,255,0.06)", scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => {
          const isActive   = tab.id === activeTabId;
          const isModified = modifiedIds.has(tab.id);
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className="flex items-center gap-1.5 pl-2.5 pr-1 rounded-md border text-xs cursor-pointer transition-all flex-shrink-0 group"
              style={{ height: 26, background: isActive ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.025)", borderColor: isActive ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)", color: isActive ? "rgba(226,232,240,0.9)" : "rgba(148,163,184,0.55)" }}
              data-testid={`tab-${tab.id}`}
            >
              {tabIcon(tab)}
              <span className="whitespace-nowrap text-[11.5px]">{tab.label}</span>
              <div className="w-4 h-4 flex items-center justify-center ml-0.5">
                {isModified ? (
                  <>
                    <span className="group-hover:hidden w-1.5 h-1.5 rounded-full" style={{ background: "#fbbf24" }} />
                    <button onClick={(e) => { e.stopPropagation(); removeModified(tab.id); closeTab(tab.id); }} className="hidden group-hover:flex w-4 h-4 items-center justify-center rounded hover:bg-white/10 transition-colors" data-testid={`button-close-tab-${tab.id}`}>
                      <X style={{ width: 9, height: 9 }} />
                    </button>
                  </>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100" data-testid={`button-close-tab-${tab.id}`}>
                    <X style={{ width: 9, height: 9 }} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <button
          onClick={addTab}
          className={cn("flex items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors flex-shrink-0", tabs.length > 0 ? "w-6 h-6 justify-center" : "px-2.5 h-7")}
          data-testid="button-new-tab"
        >
          <Plus style={{ width: 12, height: 12 }} />
          {tabs.length === 0 && <span>Tools &amp; files</span>}
        </button>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">

          {isFileTab && (
            <EditorToolbar
              label={activeTab!.label}
              lang={activeTab!.fileLang}
              modified={modifiedIds.has(activeTab!.id)}
              wordWrap={wordWrap}
              line={cursorPos.line}
              col={cursorPos.col}
              onToggleWrap={toggleWrap}
              onFormat={handleFormat}
            />
          )}

          <div className="flex-1 relative overflow-hidden">
            {(() => {
              if (isFileTab) {
                return (
                  <div className="absolute inset-0">
                    <Editor
                      key={activeTab!.id}
                      defaultValue={activeTab!.fileContent}
                      language={activeTab!.fileLang ?? "typescript"}
                      theme="vs-dark"
                      onMount={handleMount}
                      onChange={() => markModified(activeTab!.id)}
                      options={{
                        fontSize: 13,
                        fontFamily: '"Fira Code","Cascadia Code","JetBrains Mono",monospace',
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        lineNumbers: "on",
                        renderLineHighlight: "line",
                        padding: { top: 12, bottom: 12 },
                        cursorBlinking: "smooth",
                        smoothScrolling: true,
                        wordWrap: wordWrap ? "on" : "off",
                        tabSize: 2,
                        automaticLayout: true,
                      }}
                    />
                  </div>
                );
              }
              if (activeTab?.url === "/preview")        return <Preview />;
              if (activeTab?.url === "__database__")    return <DatabasePanel />;
              if (activeTab?.url === "__console__")     return <ConsolePanel />;
              if (activeTab?.url === "__publishing__")  return <PublishingPanel />;
              if (activeTab?.url === "__auth__")        return <AuthPanel onClose={() => closeTab(activeTabId)} />;
              if (activeTab?.url === "__git__")         return <GitPanel />;
              if (activeTab?.url === "__checkpoints__") return <CheckpointPanel />;
              if (activeTab?.url) {
                return <iframe key={activeTab.url} src={activeTab.url} className="absolute inset-0 w-full h-full border-0" title={activeTab.label} data-testid={`iframe-tab-${activeTab.id}`} />;
              }
              return (
                <div className="absolute inset-0 overflow-y-auto" style={{ background: "rgba(255,255,255,0.006)" }}>
                  <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.022) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
                  <div className="relative py-8 px-6 w-full">
                    <div style={{ maxWidth: 700, margin: "0 auto" }}>
                      {toolItems.map((section) => (
                        <div key={section.section} className="mb-7">
                          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(148,163,184,0.38)" }}>{section.section}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {section.items.map((item) => {
                              const Icon = item.icon;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => addToolTab(item.label, item.url)}
                                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group transition-all duration-200"
                                  style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.07)" }}
                                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.border = "1px solid rgba(124,141,255,0.28)"; el.style.background = "rgba(124,141,255,0.055)"; el.style.transform = "translateY(-1px)"; el.style.boxShadow = "0 4px 16px rgba(124,141,255,0.08)"; }}
                                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.border = "1px solid rgba(255,255,255,0.07)"; el.style.background = "rgba(255,255,255,0.028)"; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; }}
                                  data-testid={`button-newtab-tool-${item.id}`}
                                >
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: item.bg }}>
                                    <Icon style={{ width: 15, height: 15, color: item.color }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors mb-0.5 truncate">{item.label}</p>
                                    <p className="text-[10.5px] leading-snug line-clamp-2" style={{ color: "rgba(148,163,184,0.48)" }}>{item.sub}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {isFileTab && (
            <StatusBar
              lang={activeTab!.fileLang}
              modified={modifiedIds.has(activeTab!.id)}
              line={cursorPos.line}
              col={cursorPos.col}
            />
          )}
        </div>

        {/* ── File Explorer side panel ── */}
        <div className="h-full flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out" style={{ width: showFileExplorer ? 240 : 0, borderLeft: showFileExplorer ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
          {showFileExplorer && (
            <FileTreePanel
              activeFileName={activeFileName}
              onFileOpen={(name, content, lang) => openFileTab(name, content, lang)}
              onClose={() => setShowFileExplorer(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
