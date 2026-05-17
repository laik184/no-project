import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { FileExplorer } from "../file-explorer";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

export default function UnifiedGrid() {
  const [selectedFile, setSelectedFile] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [projectPath, setProjectPath] = useState("");

  useRealtimeEvent("console", (data) => {
    try {
      const d = data as Record<string, unknown>;
      if (d.level === "project-path" && d.projectPath) {
        setProjectPath(d.projectPath as string);
      }
    } catch {}
  });

  useEffect(() => {
    if (!selectedFile) {
      setFileContent("");
      return;
    }
    fetch(`/api/read-file?path=${encodeURIComponent(selectedFile)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setFileContent(j.content || "");
      })
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
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filePath: selectedFile, content: fileContent }),
    });
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("file-saved", { detail: { path: selectedFile } })
        );
      } catch {
        window.dispatchEvent(new Event("file-saved"));
      }
    }
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ width: 220, borderRight: "1px solid #333", overflow: "auto" }}>
        <FileExplorer
          projectPath={projectPath}
          activeFile={selectedFile}
          onFileSelect={setSelectedFile}
        />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "4px 8px", background: "#1e1e1e", borderBottom: "1px solid #333", display: "flex", gap: 8 }}>
          <span style={{ color: "#888", fontSize: 12 }}>{selectedFile || "No file selected"}</span>
          {selectedFile && (
            <button onClick={save} style={{ fontSize: 11, padding: "1px 8px" }}>Save</button>
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
