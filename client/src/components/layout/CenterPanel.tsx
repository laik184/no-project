import { useState, useRef, useCallback, useEffect } from "react";
import { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { Eye, Database, Terminal, Globe, GitBranch, Lock, Camera, MonitorPlay } from "lucide-react";
import { CenterPanelTabBar } from "./CenterPanelTabBar";
import { CenterPanelConflictBanner } from "./CenterPanelConflictBanner";
import { CenterPanelToolsGrid } from "./CenterPanelToolsGrid";
import { CenterPanelMonacoEditor } from "./CenterPanelMonacoEditor";
import { cn } from "@/lib/utils";
import Preview from "@/pages/preview/index";
import { DatabasePanel } from "@/components/panels/DatabasePanel";
import { ConsolePanel } from "@/components/console";
import { PublishingPanel, AuthPanel } from "@/components/panels/PublishingPanel";
import { FileExplorer, guessLang } from "@/components/file-explorer";
import { GitPanel } from "./GitPanel";
import { CheckpointPanel }     from "@/components/panels/CheckpointPanel";
import { BrowserSessionPanel } from "@/components/panels/BrowserSessionPanel";
import {
  EditorToolbar, StatusBar, ToolbarBtn,
  fileTabIcon, langDisplayName,
} from "./editor-toolbar";
import type { WorkspaceTab } from "./editor-toolbar";
import { dirtyStateStore } from "@/features/editor-state/dirty-state.store";
import { saveQueueService } from "@/features/editor/services/save-queue";
import { useEditorSession } from "@/features/editor-state/hooks/useEditorSession";
import { useEditorSync } from "@/features/editor/hooks/useEditorSync";
import { onBeforeUnload } from "@/features/editor-state/editor-events";
import type { SaveStatus } from "@/features/editor/types/auto-save.types";

export type { WorkspaceTab } from "./editor-toolbar";

function urlTabIcon(url: string): React.ReactElement {
  if (url === "/preview")        return <Eye        style={{ width: 11, height: 11, color: "#60a5fa" }} />;
  if (url === "__database__")    return <Database   style={{ width: 11, height: 11, color: "#34d399" }} />;
  if (url === "__console__")     return <Terminal   style={{ width: 11, height: 11, color: "#fbbf24" }} />;
  if (url === "__publishing__")  return <Globe      style={{ width: 11, height: 11, color: "#4ade80" }} />;
  if (url === "__auth__")        return <Lock       style={{ width: 11, height: 11, color: "#a78bfa" }} />;
  if (url === "__git__")         return <GitBranch  style={{ width: 11, height: 11, color: "#86efac" }} />;
  if (url === "__checkpoints__") return <Camera      style={{ width: 11, height: 11, color: "#fbbf24" }} />;
  if (url === "__browser__")    return <MonitorPlay  style={{ width: 11, height: 11, color: "#60a5fa" }} />;
  return <Globe style={{ width: 11, height: 11, color: "#94a3b8" }} />;
}

function tabIcon(tab: WorkspaceTab): React.ReactElement {
  if (tab.fileContent !== undefined) return fileTabIcon(tab.label, tab.fileLang);
  if (tab.url) return urlTabIcon(tab.url);
  return <></>;
}


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
  // ── Per-tab derived state from the central store ───────────────────────────
  const [dirtyTabIds, setDirtyTabIds] = useState<Set<number>>(new Set());
  const [activeTabSaveStatus, setActiveTabSaveStatus] = useState<SaveStatus>('idle');
  const activeTabIdRef = useRef(activeTabId);
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);

  useEffect(() => {
    return dirtyStateStore.subscribe((snapshot) => {
      const dirty = new Set<number>();
      for (const [id, s] of snapshot) { if (s.isDirty) dirty.add(id); }
      setDirtyTabIds(dirty);
      const active = snapshot.get(activeTabIdRef.current);
      setActiveTabSaveStatus(active?.saveStatus ?? 'idle');
    });
  }, []);

  // ── Bridge: saveQueueService → dirtyStateStore ─────────────────────────────
  useEffect(() => {
    return saveQueueService.addStatusSubscriber((filePath, status, serverMtime) => {
      const tab = dirtyStateStore.getTabByFilePath(filePath);
      if (!tab) return;
      dirtyStateStore.setSaveStatus(tab.tabId, status, serverMtime);
      if (status === 'saved') dirtyStateStore.markClean(tab.tabId, serverMtime);
    });
  }, []);

  // ── Protect unsaved changes on browser close ───────────────────────────────
  useEffect(() => {
    return onBeforeUnload(() => dirtyStateStore.hasAnyDirty());
  }, []);

  // ── Conflict resolution ────────────────────────────────────────────────────
  // conflictPath is set when the save queue receives a 409 from the server
  // (our clientMtime doesn't match the file's actual mtime — another process
  // wrote the file between our last sync and this save).
  const [conflictPath, setConflictPath] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent).detail?.path as string | undefined;
      if (path) setConflictPath(path);
    };
    window.addEventListener("editor:conflict", handler);
    return () => window.removeEventListener("editor:conflict", handler);
  }, []);

  const handleConflictReload = useCallback(async () => {
    const fp = conflictPath;
    if (!fp) return;
    const tab = tabs.find((t) => (t.filePath ?? t.label) === fp);
    if (!tab) { setConflictPath(null); return; }
    try {
      const res  = await fetch(`/api/read-file?filePath=${encodeURIComponent(fp)}`);
      const data = await res.json() as { ok: boolean; content?: string; modifiedAt?: string };
      if (data.ok && data.content !== undefined) {
        const mtime = data.modifiedAt
          ? Math.round(new Date(data.modifiedAt).getTime())
          : Date.now();
        saveQueueService.updateServerMtime(fp, mtime);
        dirtyStateStore.applyExternalContent(tab.id, mtime);
        if (tab.id === activeTabId) {
          const model = editorRef.current?.getModel();
          if (model) {
            model.pushEditOperations(
              [], [{ range: model.getFullModelRange(), text: data.content }], () => null,
            );
          }
        }
      }
    } catch {}
    setConflictPath(null);
  }, [conflictPath, tabs, activeTabId]);

  const handleConflictOverwrite = useCallback(async () => {
    const fp = conflictPath;
    if (!fp) return;
    const tab = tabs.find((t) => (t.filePath ?? t.label) === fp);
    if (!tab) { setConflictPath(null); return; }
    const content = dirtyStateStore.getEditedContent(tab.id) ?? tab.fileContent ?? "";
    try {
      const res = await fetch("/api/save-file", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // No clientMtime field → server performs an unconditional overwrite
        body: JSON.stringify({ filePath: fp, content }),
      });
      const data = await res.json() as { ok: boolean; serverMtime?: number };
      if (data.ok) {
        saveQueueService.updateServerMtime(fp, data.serverMtime ?? Date.now());
        dirtyStateStore.markClean(tab.id, data.serverMtime);
      }
    } catch {}
    setConflictPath(null);
  }, [conflictPath, tabs]);

  const [explorerProjectPath, setExplorerProjectPath] = useState("");

  useEffect(() => {
    const projectId = Number(localStorage.getItem("nura.projectId") || "1") || 1;
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then((d: { ok: boolean; data?: { sandboxPath?: string | null } }) => {
        const p = d?.data?.sandboxPath;
        setExplorerProjectPath(p || "/tmp/nurax-sandbox");
      })
      .catch(() => setExplorerProjectPath("/tmp/nurax-sandbox"));
  }, []);

  const handleExplorerFileSelect = useCallback(async (path: string) => {
    try {
      const res = await fetch(`/api/read-file?filePath=${encodeURIComponent(path)}`);
      const data = await res.json() as { ok: boolean; content?: string };
      if (data.ok) openFileTab(path, data.content ?? "", guessLang(path));
    } catch {}
  }, [openFileTab]);

  const [wordWrap, setWordWrap] = useState(true);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const activeTab    = tabs.find((t) => t.id === activeTabId);
  const isFileTab    = activeTab?.fileContent !== undefined;
  const activeFilePath = activeTab?.filePath ?? activeTab?.label;

  // ── Editor session: per active tab (debounce + store integration) ──────────
  const { onContentChange, forceSave, flush } = useEditorSession({
    tabId: activeTabId,
    filePath: isFileTab ? activeFilePath : undefined,
  });

  // ── External sync: re-load editor when AI writes this file ────────────────
  useEditorSync({
    tabId: activeTabId,
    filePath: isFileTab ? activeFilePath : undefined,
    onExternalChange: useCallback((newContent: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;

      // Preserve cursor position and scroll so AI writes don't jump the view
      const selection  = editor.getSelection();
      const scrollTop  = editor.getScrollTop();
      const scrollLeft = editor.getScrollLeft();

      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text: newContent }],
        () => null,
      );

      // Restore position — clamp to new model bounds
      if (selection) {
        const lineCount = model.getLineCount();
        const ln  = Math.min(selection.positionLineNumber, lineCount);
        const col = Math.min(selection.positionColumn, model.getLineMaxColumn(ln));
        editor.setPosition({ lineNumber: ln, column: col });
      }
      editor.setScrollPosition({ scrollTop, scrollLeft });
    }, []),
  });

  // ── Tab switching: flush pending save before switching ─────────────────────
  const handleTabSwitch = useCallback(async (id: number) => {
    if (id === activeTabId) return;
    await flush();
    setActiveTabId(id);
  }, [activeTabId, flush, setActiveTabId]);

  // ── Tab close: flush, then clean store, then close ─────────────────────────
  const handleCloseTab = useCallback(async (id: number) => {
    if (id === activeTabId) await flush();
    dirtyStateStore.removeTab(id);
    const fp = tabs.find((t) => t.id === id)?.filePath;
    if (fp) saveQueueService.clear(fp);
    closeTab(id);
  }, [activeTabId, flush, tabs, closeTab]);

  // ── Monaco mount ───────────────────────────────────────────────────────────
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

  // ── Editor onChange ────────────────────────────────────────────────────────
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value === undefined) return;
    onContentChange(value);
  }, [onContentChange]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      {/* ── Tab bar ── */}
      <CenterPanelTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        dirtyTabIds={dirtyTabIds}
        onSwitchTab={(id) => void handleTabSwitch(id)}
        onCloseTab={(id) => void handleCloseTab(id)}
        onAddTab={addTab}
        tabIcon={tabIcon}
      />

      {/* ── Content area ── */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">

          {isFileTab && (
            <EditorToolbar
              label={activeTab!.label}
              lang={activeTab!.fileLang}
              modified={dirtyTabIds.has(activeTab!.id)}
              saveStatus={activeTabSaveStatus}
              wordWrap={wordWrap}
              line={cursorPos.line}
              col={cursorPos.col}
              onToggleWrap={toggleWrap}
              onFormat={handleFormat}
            />
          )}

          {/* Conflict resolution banner */}
          <CenterPanelConflictBanner
            conflictPath={conflictPath}
            activeFilePath={activeFilePath}
            isFileTab={isFileTab}
            onReload={() => void handleConflictReload()}
            onOverwrite={() => void handleConflictOverwrite()}
            onDismiss={() => setConflictPath(null)}
          />

          <div className="flex-1 relative overflow-hidden">
            {(() => {
              if (isFileTab) {
                return (
                  <CenterPanelMonacoEditor
                    activeTab={activeTab!}
                    wordWrap={wordWrap}
                    onMount={handleMount}
                    onChange={handleEditorChange}
                  />
                );
              }
              if (activeTab?.url === "/preview")        return <Preview />;
              if (activeTab?.url === "__database__")    return <DatabasePanel />;
              if (activeTab?.url === "__console__")     return <ConsolePanel />;
              if (activeTab?.url === "__publishing__")  return <PublishingPanel />;
              if (activeTab?.url === "__auth__")        return <AuthPanel onClose={() => void handleCloseTab(activeTabId)} />;
              if (activeTab?.url === "__git__")         return <GitPanel />;
              if (activeTab?.url === "__checkpoints__") return <CheckpointPanel />;
              if (activeTab?.url === "__browser__")    return <BrowserSessionPanel />;
              if (activeTab?.url) {
                return (
                  <iframe
                    key={activeTab.url}
                    src={activeTab.url}
                    className="absolute inset-0 w-full h-full border-0"
                    title={activeTab.label}
                    data-testid={`iframe-tab-${activeTab.id}`}
                  />
                );
              }
              return (
                <CenterPanelToolsGrid
                  onToolSelect={addToolTab}
                  onTabJump={(id) => void handleTabSwitch(id)}
                  existingTabs={tabs.filter((t) => t.id !== activeTabId)}
                  tabIcon={tabIcon}
                />
              );
            })()}
          </div>

          {isFileTab && (
            <StatusBar
              lang={activeTab!.fileLang}
              modified={dirtyTabIds.has(activeTab!.id)}
              saveStatus={activeTabSaveStatus}
              line={cursorPos.line}
              col={cursorPos.col}
            />
          )}
        </div>

        {/* ── File Explorer side panel ── */}
        <div
          className="h-full flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
          style={{ width: showFileExplorer ? 240 : 0, borderLeft: showFileExplorer ? "1px solid rgba(255,255,255,0.07)" : "none" }}
        >
          {showFileExplorer && (
            <FileExplorer
              projectPath={explorerProjectPath}
              activeFile={activeFilePath}
              onFileSelect={handleExplorerFileSelect}
            />
          )}
        </div>
      </div>
    </div>
  );
}
