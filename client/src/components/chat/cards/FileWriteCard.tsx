import { FileCode, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

const LANG_MAP: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
  py: "Python", rs: "Rust", go: "Go", css: "CSS", html: "HTML",
  json: "JSON", md: "Markdown", sh: "Shell", yaml: "YAML", yml: "YAML",
  sql: "SQL",
};
const LANG_COLOR: Record<string, string> = {
  TypeScript: "#3b82f6", JavaScript: "#f59e0b", Python: "#10b981",
  Rust: "#f97316", Go: "#06b6d4", CSS: "#a78bfa", HTML: "#ef4444",
  JSON: "#6b7280", Markdown: "#94a3b8", Shell: "#a3e635", SQL: "#34d399",
};
const getLang = (p: string) => LANG_MAP[p.split(".").pop()?.toLowerCase() ?? ""] ?? "File";
const getFilename = (p: string) => p.split("/").pop() ?? p;

interface FileWriteCardProps {
  item: AgentStreamItem;
  onOpenFile?: (path: string) => void;
}

export function FileWriteCard({ item, onOpenFile }: FileWriteCardProps) {
  const filePath  = item.meta?.file ?? item.content;
  const filename  = getFilename(filePath);
  const lang      = getLang(filePath);
  const langColor = LANG_COLOR[lang] ?? "#86efac";
  const isRunning = item.status === "running";
  const isDone    = item.status === "done" || !isRunning;
  const logs      = item.meta?.logs;

  // Extract a short diff preview from logs (first few lines)
  const previewLines = logs
    ? logs.split("\n").filter((l) => l.startsWith("+") || l.startsWith("-")).slice(0, 4)
    : [];

  return (
    <div className="rounded-lg overflow-hidden" data-testid="file-write-card"
      style={{ background: "rgba(134,239,172,0.04)", border: "1px solid rgba(134,239,172,0.15)" }}>

      {/* Header row */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(134,239,172,0.1)", border: "1px solid rgba(134,239,172,0.2)" }}>
          <FileCode style={{ width: 13, height: 13, color: "#86efac" }} />
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
            <span className="text-[9px] font-mono truncate" style={{ color: "rgba(100,116,139,0.5)" }}>
              {filePath}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isRunning ? (
            <Loader2 className="animate-spin" style={{ width: 12, height: 12, color: "#86efac" }} />
          ) : (
            <span className="flex items-center gap-1 text-[9px] font-medium"
              style={{ color: "#4ade80" }}>
              <CheckCircle2 style={{ width: 11, height: 11 }} />
              Written
            </span>
          )}
          {onOpenFile && isDone && (
            <button onClick={() => onOpenFile(filePath)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium transition-colors hover:bg-white/[0.06]"
              style={{ color: "#86efac", border: "1px solid rgba(134,239,172,0.2)" }}
              data-testid={`button-file-write-open-${filename}`}>
              <ExternalLink style={{ width: 9, height: 9 }} /> Open
            </button>
          )}
        </div>
      </div>

      {/* Diff preview */}
      {previewLines.length > 0 && (
        <div className="px-3 pb-2.5">
          <div className="rounded-md overflow-hidden text-[9.5px] font-mono leading-relaxed"
            style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(134,239,172,0.1)" }}>
            {previewLines.map((line, i) => (
              <div key={i} className="px-2.5 py-[1px]"
                style={{
                  background: line.startsWith("+") ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)",
                  color: line.startsWith("+") ? "rgba(134,239,172,0.8)" : "rgba(248,113,113,0.7)",
                }}>
                {line.slice(0, 80)}{line.length > 80 ? "…" : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
