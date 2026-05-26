import {
  File, Folder, FolderOpen,
  Code2, FileJson, FileType2, Globe, Palette, FileText,
  Settings2, ImageIcon,
} from "lucide-react";

export function fileIcon(
  name: string,
  type: "file" | "folder",
  open?: boolean
): React.ReactElement {
  if (type === "folder")
    return open
      ? <FolderOpen style={{ width: 13, height: 13, flexShrink: 0, color: "#7c8dff" }} />
      : <Folder     style={{ width: 13, height: 13, flexShrink: 0, color: "#7c8dff" }} />;

  const n = name.toLowerCase();
  if (n.endsWith(".tsx") || n.endsWith(".jsx")) return <Code2    style={{ width: 13, height: 13, flexShrink: 0, color: "#60a5fa" }} />;
  if (n.endsWith(".ts")  || n.endsWith(".js"))  return <FileType2 style={{ width: 13, height: 13, flexShrink: 0, color: "#34d399" }} />;
  if (n.endsWith(".json"))  return <FileJson  style={{ width: 13, height: 13, flexShrink: 0, color: "#fbbf24" }} />;
  if (n.endsWith(".css"))   return <Palette   style={{ width: 13, height: 13, flexShrink: 0, color: "#f472b6" }} />;
  if (n.endsWith(".html"))  return <Globe     style={{ width: 13, height: 13, flexShrink: 0, color: "#fb923c" }} />;
  if (n.endsWith(".md"))    return <FileText  style={{ width: 13, height: 13, flexShrink: 0, color: "#94a3b8" }} />;
  if (n.startsWith(".env")) return <Settings2 style={{ width: 13, height: 13, flexShrink: 0, color: "#a3e635" }} />;
  if (n.match(/\.(png|jpg|jpeg|svg|gif|webp)$/))
    return <ImageIcon style={{ width: 13, height: 13, flexShrink: 0, color: "#c084fc" }} />;
  return <File style={{ width: 13, height: 13, flexShrink: 0, color: "#64748b" }} />;
}

export function guessLang(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".tsx") || n.endsWith(".ts")) return "typescript";
  if (n.endsWith(".jsx") || n.endsWith(".js")) return "javascript";
  if (n.endsWith(".css"))  return "css";
  if (n.endsWith(".html")) return "html";
  if (n.endsWith(".json")) return "json";
  if (n.endsWith(".md"))   return "markdown";
  return "plaintext";
}

export function emojiIcon(name: string, type: string): string {
  if (type === "directory" || type === "folder") return "📁";
  if (name.endsWith(".tsx") || name.endsWith(".jsx")) return "🧩";
  if (name.endsWith(".ts")  || name.endsWith(".js"))  return "📜";
  if (name.endsWith(".json")) return "📄";
  if (name.endsWith(".html")) return "🌐";
  if (name.endsWith(".css"))  return "🎨";
  return "📃";
}
