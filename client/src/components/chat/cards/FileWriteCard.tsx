/**
 * FileWriteCard — renders file.write and patch.queue tool actions.
 */
import { FileCode, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import { DiffAcceptRejectBar } from "./DiffAcceptRejectBar";

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
const PATCH_TOOLS = new Set(["patch.queue", "diff.queued", "patch_queue"]);
const getLang     = (p: string) => LANG_MAP[p.split(".").pop()?.toLowerCase() ?? ""] ?? "File";
const getFilename = (p: string) => p.split("/").pop() ?? p;

interface FileWriteCardProps {
  item:        AgentStreamItem;
  onOpenFile?: (path: string) => void;
}

export function FileWriteCard({ item, onOpenFile }: FileWriteCardProps) {
  const tool      = String(item.tool ?? "");
  const isPatch   = PATCH_TOOLS.has(tool);
  const filePath  = (item.meta?.file as string) ?? item.content;
  const filename  = getFilename(filePath);
  const lang      = getLang(filePath);
  const langColor = LANG_COLOR[lang] ?? "#94a3b8";
  const isRunning = item.status === "running";
  const isDone    = item.status === "done" || !isRunning;
  const logs      = item.meta?.logs as string | undefined;
  const proposed  = item.meta?.proposed as string | undefined;

  const previewLines = logs
    ? logs.split("\n").filter((l) => l.startsWith("+") || l.startsWith("-")).slice(0, 4)
    : [];

  return (
    <div
      className="rounded-lg overflow-hidden"
      data-testid="file-write-card"
      style={{ background: "#111827", border: "1px solid #1f2937", animation: "card-enter 0.22s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)" }}>
          <FileCode style={{ width: 13, height: 13, color: "#22c55e" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] font-medium font-mono truncate" style={{ color: "#e5e7eb" }}>{filename}</span>
            <span className="text-[8.5px] px-1.5 py-0.5 rounded-sm font-mono flex-shrink-0"
              style={{ background: `${langColor}12`, border: `1px solid ${langColor}25`, color: `${langColor}cc` }}>
              {lang}
            </span>
            {isPatch && (
              <span className="text-[8.5px] px-1.5 py-0.5 rounded-sm font-mono flex-shrink-0"
                style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.22)", color: "#3b82f6" }}>
                patch
              </span>
            )}
          </div>
          <span className="text-[9px] font-mono truncate block mt-0.5"
            style={{ color: "rgba(100,116,139,0.5)" }}>{filePath}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isPatch && (
            isRunning
              ? <Loader2 className="animate-spin" style={{ width: 12, height: 12, color: "#22c55e" }} />
              : <span className="flex items-center gap-1 text-[9px] font-medium" style={{ color: "#22c55e" }}>
                  <CheckCircle2 style={{ width: 11, height: 11 }} /> Written
                </span>
          )}
          {!isPatch && onOpenFile && isDone && (
            <button onClick={() => onOpenFile(filePath)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium transition-colors hover:bg-white/[0.06]"
              style={{ color: "#94a3b8", border: "1px solid #1f2937" }}
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
            style={{ background: "#0b0f14", border: "1px solid #1f2937" }}>
            {previewLines.map((line, i) => (
              <div key={i} className="px-2.5 py-[1px]"
                style={{
                  background: line.startsWith("+") ? "rgba(34,197,94,0.07)"  : "rgba(239,68,68,0.07)",
                  color:      line.startsWith("+") ? "rgba(134,239,172,0.8)" : "rgba(248,113,113,0.7)",
                }}>
                {line.slice(0, 80)}{line.length > 80 ? "…" : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {isPatch && isDone  && proposed !== undefined && <DiffAcceptRejectBar filePath={filePath} proposed={proposed} />}
      {isPatch && isRunning && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-[10px]" style={{ color: "#3b82f6" }}>
          <Loader2 className="animate-spin" style={{ width: 10, height: 10 }} />
          Preparing patch…
        </div>
      )}
    </div>
  );
}
