import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

type WorkspaceEditorProps = {
  value: string;
  onChange: (value: string) => void;
  filePath?: string | null;
};

export default function WorkspaceEditor({ value, onChange, filePath }: WorkspaceEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const [lastServerContent, setLastServerContent] = useState<string | null>(null);

  function handleEditorDidMount(editor: any, monaco: any) {
    editorRef.current = editor;
    monacoRef.current = monaco;
  }

  // replace whole content while attempting to preserve cursor/selection
  function replaceWholeContent(newContent: string) {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const model = editor.getModel();
      const selection = editor.getSelection();
      const pos = selection ? selection.getPosition() : null;

      // set value
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: newContent }], () => null);

      // restore cursor if possible
      if (pos) {
        const lineCount = model.getLineCount();
        const lineNumber = Math.min(pos.lineNumber, lineCount);
        const col = Math.min(pos.column, model.getLineMaxColumn(lineNumber));
        editor.setPosition({ lineNumber, column: col });
        editor.revealPositionInCenter({ lineNumber, column: col });
      }
    } catch (e) {
      // fallback: setValue if available
      try { editor.setValue(newContent); } catch {}
    }
  }

  useEffect(() => {
    // If server content prop changed externally (lastServerContent) and editor has no unsaved edits,
    // auto-replace. Consumers should set `lastServerContent` via SSE handling in parent or here.
    // For now, keep lastServerContent sync with value when saved by parent.
  }, [lastServerContent]);

  // Expose onMount prop for monaco react
  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        defaultLanguage="typescript"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          wordWrap: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
