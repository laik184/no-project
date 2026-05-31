import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { FileExplorer } from "../file-explorer";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

export default function UnifiedGrid() {
  const [selectedFile, setSelectedFile] = useState("");
  const [fileContent, setFileContent]   = useState("");
  const [projectPath, setProjectPath]   = useState("");

  useRealtimeEvent("console", (data) => {
    try {
      const d = data as Record<string, unknown>;
      if (d.level === "project-path" && d.projectPath) {
        setProjectPath(d.projectPath as string);
      }
    } catch {}
  });

  useEffect(() => {
    if (!selectedFile) { setFileContent(""); return; }
    fetch(`/api/read-file?path=${encodeURIComponent(selectedFile)}`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setFileContent(j.content || ""); })
      .catch(() => setFileContent(""));
  }, [selectedFile]);

  const detectLang = (f: string) => {
    if (f.endsWith(".ts") || f.endsWith(".tsx")) return "typescript";
    if (f.endsWith(".js") || f.endsWith(".jsx")) return "javascript";
    if (f.endsWith(".json")) return "json";
    if (f.endsWith(".html")) return "html";
    if (f.endsWith(".css")) return "css";
    return "plaintext";
  };

  const save = async () => {
    if (!selectedFile) return;
    await fetch("/api/save-file", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ filePath: selectedFile, content: fileContent }),
    });
    try {
      window.dispatchEvent(new CustomEvent("file-saved", { detail: { path: selectedFile } }));
    } catch {
      window.dispatchEvent(new Event("file-saved"));
    }
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* FileExplorer controls its own width via internal resize state */}
      <FileExplorer
        projectPath={projectPath}
        activeFile={selectedFile}
        onFileSelect={setSelectedFile}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{
          padding: "4px 8px", background: "#1e1e1e",
          borderBottom: "1px solid #2a2a2a",
          display: "flex", gap: 8, alignItems: "center",
        }}>
          <span style={{ color: "#888", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedFile || "No file selected"}
          </span>
          {selectedFile && (
            <button
              onClick={save}
              style={{ fontSize: 11, padding: "2px 10px", borderRadius: 4, cursor: "pointer", background: "#252525", border: "1px solid #333", color: "#c4c4c4" }}
              data-testid="button-save-file"
            >
              Save
            </button>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <Editor
            height="100%"
            language={detectLang(selectedFile)}
            value={fileContent}
            onChange={(v) => setFileContent(v || "")}
            theme="vs-dark"
            options={{ minimap: { enabled: false }, fontSize: 13 }}
          />
        </div>
      </div>
    </div>
  );
}
