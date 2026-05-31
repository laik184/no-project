import { FileText, ExternalLink } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

const LANG_MAP: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
  py: "Python", rs: "Rust", go: "Go", java: "Java", css: "CSS",
  html: "HTML", json: "JSON", md: "Markdown", sh: "Shell", yaml: "YAML",
  yml: "YAML", toml: "TOML", sql: "SQL", graphql: "GraphQL",
};

const LANG_COLOR: Record<string, string> = {
  TypeScript: "#3b82f6", JavaScript: "#f59e0b", Python: "#10b981",
  Rust: "#f97316", Go: "#06b6d4", CSS: "#a78bfa", HTML: "#ef4444",
  JSON: "#6b7280", Markdown: "#94a3b8", Shell: "#a3e635",
  SQL: "#34d399", GraphQL: "#e879f9",
};

function getExt(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

function getLang(path: string): string {
  return LANG_MAP[getExt(path)] ?? getExt(path).toUpperCase() || "File";
}

function getFilename(path: string): string {
  return path.split("/").pop() ?? path;
}

interface FileOpenCardProps {
  item: AgentStreamItem;
  onOpenFile?: (path: string) => void;
}

export function FileOpenCard({ item, onOpenFile }: FileOpenCardProps) {
  const filePath = item.meta?.file ?? item.content;
  const filename = getFilename(filePath);
  const lang     = getLang(filePath);
  const langColor = LANG_COLOR[lang] ?? "#7dd3fc";
  const lineCount = item.meta?.lineCount;

  return (
    <div className="rounded-lg flex items-center gap-2.5 px-3 py-2" data-testid="file-open-card"
      style={{ background: "rgba(125,211,252,0.05)", border: "1px solid rgba(125,211,252,0.14)" }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(125,211,252,0.1)", border: "1px solid rgba(125,211,252,0.2)" }}>
        <FileText style={{ width: 13, height: 13, color: "#7dd3fc" }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] font-medium font-mono truncate"
            style={{ color: "rgba(203,213,225,0.9)" }}>{filename}</span>
          <span className="text-[8.5px] px-1.5 py-0.5 rounded-sm font-mono flex-shrink-0"
            style={{ background: `${langColor}15`, border: `1px solid ${langColor}30`, color: `${langColor}cc` }}>
            {lang}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9.5px] font-mono truncate" style={{ color: "rgba(100,116,139,0.55)" }}>
            {filePath}
          </span>
          {lineCount !== undefined && (
            <span className="text-[9px] flex-shrink-0" style={{ color: "rgba(100,116,139,0.4)" }}>
              · {lineCount} lines
            </span>
          )}
        </div>
      </div>

      {onOpenFile && (
        <button onClick={() => onOpenFile(filePath)}
          className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium transition-colors hover:bg-white/[0.06]"
          style={{ color: "#7dd3fc", border: "1px solid rgba(125,211,252,0.2)" }}
          data-testid={`button-file-open-${filename}`}>
          <ExternalLink style={{ width: 9, height: 9 }} /> Open
        </button>
      )}
    </div>
  );
}
