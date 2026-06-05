import Editor, { type OnMount } from "@monaco-editor/react";
import type { WorkspaceTab } from "./editor-toolbar";
import { dirtyStateStore } from "@/features/editor-state/dirty-state.store";

interface CenterPanelMonacoEditorProps {
  activeTab: WorkspaceTab;
  wordWrap: boolean;
  onMount: OnMount;
  onChange: (value: string | undefined) => void;
}

export function CenterPanelMonacoEditor({
  activeTab, wordWrap, onMount, onChange,
}: CenterPanelMonacoEditorProps) {
  const restoredContent =
    dirtyStateStore.getEditedContent(activeTab.id) ?? activeTab.fileContent;

  return (
    <div className="absolute inset-0">
      <Editor
        key={activeTab.id}
        defaultValue={restoredContent}
        language={activeTab.fileLang ?? "typescript"}
        theme="vs-dark"
        onMount={onMount}
        onChange={onChange}
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
