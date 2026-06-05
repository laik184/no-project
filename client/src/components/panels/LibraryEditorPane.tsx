import Editor from "@monaco-editor/react";
import { X, Save, FileCode, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { OpenFile } from "./library-panel-data";
import { getLanguageIcon } from "./LibraryTreeNode";

interface LibraryEditorPaneProps {
  openFiles: OpenFile[];
  activeEditorId: string | null;
  activeFile: OpenFile | undefined;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onEditorChange: (value: string | undefined) => void;
  onSaveFile: (id: string) => void;
}

export function LibraryEditorPane({
  openFiles, activeEditorId, activeFile, onSelectTab, onCloseTab, onEditorChange, onSaveFile,
}: LibraryEditorPaneProps) {
  if (openFiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: "rgba(100,116,139,0.5)" }}>
        <FileCode className="h-10 w-10" style={{ color: "rgba(100,116,139,0.3)" }} />
        <p className="text-sm">Click a file to open it in the editor</p>
        <p className="text-xs" style={{ color: "rgba(100,116,139,0.35)" }}>or right-click to create a new file</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="flex items-center border-b overflow-x-auto flex-shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", scrollbarWidth: "none" }}
      >
        {openFiles.map((file) => (
          <div
            key={file.id}
            onClick={() => onSelectTab(file.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 border-r cursor-pointer flex-shrink-0 transition-all group text-xs",
              activeEditorId === file.id
                ? "bg-white/6 text-foreground border-b-2 border-b-primary"
                : "text-muted-foreground hover:bg-white/4 hover:text-foreground"
            )}
            style={{ borderRightColor: "rgba(255,255,255,0.06)" }}
            data-testid={`editor-tab-${file.id}`}
          >
            {getLanguageIcon(file.name)}
            <span className="whitespace-nowrap max-w-[120px] truncate">{file.name}</span>
            {file.isDirty && <Circle className="h-1.5 w-1.5 fill-current text-primary flex-shrink-0" />}
            <button
              onClick={(e) => { e.stopPropagation(); onCloseTab(file.id); }}
              className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-white/12 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
              data-testid={`button-close-editor-tab-${file.id}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
      </div>

      {activeFile && (
        <div className="flex items-center justify-between px-3 py-1 border-b flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
          <div className="flex items-center gap-1.5">
            {getLanguageIcon(activeFile.name)}
            <span className="text-xs text-foreground/60">{activeFile.name}</span>
            {activeFile.isDirty && <span className="text-[10px] text-primary/70">● unsaved</span>}
          </div>
          <button
            onClick={() => onSaveFile(activeFile.id)}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all",
              activeFile.isDirty
                ? "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20"
                : "text-muted-foreground/40 cursor-default"
            )}
            disabled={!activeFile.isDirty}
            data-testid="button-save-file"
          >
            <Save className="h-3 w-3" />
            Save
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeFile && (
          <Editor
            key={activeFile.id}
            height="100%"
            language={activeFile.language}
            value={activeFile.content}
            onChange={onEditorChange}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              renderLineHighlight: "line",
              wordWrap: "on",
              automaticLayout: true,
              formatOnType: true,
              tabSize: 2,
              insertSpaces: true,
              bracketPairColorization: { enabled: true },
              renderWhitespace: "none",
              cursorBlinking: "smooth",
              smoothScrolling: true,
              padding: { top: 12, bottom: 12 },
              scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
            }}
          />
        )}
      </div>
    </>
  );
}
