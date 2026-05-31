import {
  File, Folder, FolderOpen,
  FileJson, Globe, Palette, FileText,
  Settings2, ImageIcon,
} from "lucide-react";
import { SiTypescript, SiJavascript, SiPython, SiReact } from "react-icons/si";

// Inline badge for languages without a react-icon
function LangBadge({ abbr, bg, fg = "#fff" }: { abbr: string; bg: string; fg?: string }) {
  return (
    <span style={{
      width: 13, height: 13, borderRadius: 2, flexShrink: 0,
      background: bg, color: fg, fontSize: 7, fontWeight: 800,
      lineHeight: "13px", textAlign: "center",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      letterSpacing: "-0.5px", fontFamily: "system-ui, sans-serif",
    }}>
      {abbr}
    </span>
  );
}

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

  // React / JSX — TSX & JSX
  if (n.endsWith(".tsx") || n.endsWith(".jsx"))
    return <SiReact style={{ width: 13, height: 13, flexShrink: 0, color: "#61dafb" }} />;
  // TypeScript
  if (n.endsWith(".ts"))
    return <SiTypescript style={{ width: 13, height: 13, flexShrink: 0, color: "#3178c6" }} />;
  // JavaScript
  if (n.endsWith(".js") || n.endsWith(".mjs") || n.endsWith(".cjs"))
    return <SiJavascript style={{ width: 13, height: 13, flexShrink: 0, color: "#f7df1e" }} />;
  // Python
  if (n.endsWith(".py") || n.endsWith(".pyw"))
    return <SiPython style={{ width: 13, height: 13, flexShrink: 0, color: "#3572a5" }} />;
  // JSON
  if (n.endsWith(".json") || n.endsWith(".jsonc"))
    return <FileJson  style={{ width: 13, height: 13, flexShrink: 0, color: "#fbbf24" }} />;
  // CSS family
  if (n.endsWith(".css") || n.endsWith(".scss") || n.endsWith(".sass") || n.endsWith(".less"))
    return <Palette   style={{ width: 13, height: 13, flexShrink: 0, color: "#f472b6" }} />;
  // HTML
  if (n.endsWith(".html") || n.endsWith(".htm"))
    return <Globe     style={{ width: 13, height: 13, flexShrink: 0, color: "#fb923c" }} />;
  // Markdown
  if (n.endsWith(".md") || n.endsWith(".mdx"))
    return <FileText  style={{ width: 13, height: 13, flexShrink: 0, color: "#94a3b8" }} />;
  // Env / config
  if (n.startsWith(".env") || n.endsWith(".env"))
    return <Settings2 style={{ width: 13, height: 13, flexShrink: 0, color: "#a3e635" }} />;
  // Images
  if (n.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|bmp|tiff)$/))
    return <ImageIcon style={{ width: 13, height: 13, flexShrink: 0, color: "#c084fc" }} />;
  // Go
  if (n.endsWith(".go"))       return <LangBadge abbr="Go" bg="#00add8" />;
  // Rust
  if (n.endsWith(".rs"))       return <LangBadge abbr="Rs" bg="#ce422b" />;
  // Java / Kotlin
  if (n.endsWith(".java") || n.endsWith(".kt"))
    return <LangBadge abbr="Jv" bg="#f89820" />;
  // Ruby
  if (n.endsWith(".rb"))       return <LangBadge abbr="Rb" bg="#cc342d" />;
  // PHP
  if (n.endsWith(".php"))      return <LangBadge abbr="Ph" bg="#8892be" />;
  // Shell
  if (n.endsWith(".sh") || n.endsWith(".bash") || n.endsWith(".zsh"))
    return <LangBadge abbr="Sh" bg="#4eaa25" />;
  // YAML
  if (n.endsWith(".yaml") || n.endsWith(".yml"))
    return <LangBadge abbr="Yl" bg="#cb171e" />;
  // TOML / INI / config
  if (n.endsWith(".toml") || n.endsWith(".ini") || n.endsWith(".cfg"))
    return <LangBadge abbr="Cf" bg="#6b7280" />;

  return <File style={{ width: 13, height: 13, flexShrink: 0, color: "#64748b" }} />;
}

export function guessLang(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".tsx") || n.endsWith(".ts")) return "typescript";
  if (n.endsWith(".jsx") || n.endsWith(".js")) return "javascript";
  if (n.endsWith(".py"))   return "python";
  if (n.endsWith(".css") || n.endsWith(".scss")) return "css";
  if (n.endsWith(".html")) return "html";
  if (n.endsWith(".json")) return "json";
  if (n.endsWith(".md"))   return "markdown";
  return "plaintext";
}

export function emojiIcon(name: string, type: string): string {
  if (type === "directory" || type === "folder") return "📁";
  if (name.endsWith(".tsx") || name.endsWith(".jsx")) return "⚛️";
  if (name.endsWith(".ts")  || name.endsWith(".js"))  return "📜";
  if (name.endsWith(".py"))   return "🐍";
  if (name.endsWith(".json")) return "📄";
  if (name.endsWith(".html")) return "🌐";
  if (name.endsWith(".css"))  return "🎨";
  return "📃";
}
