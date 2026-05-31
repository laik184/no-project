/**
 * FileWriteCard — renders file.write and patch.queue tool actions.
 *
 * Phase 3 (T1): When tool is patch.queue / diff.queued, show inline
 * Accept / Reject buttons instead of the "Written" badge.
 */
import { useState }                                    from "react";
import { FileCode, ExternalLink, CheckCircle2, Loader2,
         ThumbsUp, ThumbsDown, GitPullRequest, X }    from "lucide-react";
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
const getLang      = (p: string) => LANG_MAP[p.split(".").pop()?.toLowerCase() ?? ""] ?? "File";
const getFilename  = (p: string) => p.split("/").pop() ?? p;

const PATCH_TOOLS = new Set(["patch.queue", "diff.queued", "patch_queue"]);

type AcceptState = "pending" | "accepting" | "accepted" | "rejected" | "error";

function DiffAcceptRejectBar({
  filePath, proposed,
}: {
  filePath: string;
  proposed: string;
}) {
  const [state, setState] = useState<AcceptState>("pending");
  const [errMsg, setErrMsg] = useState("");

  const handleAccept = async () => {
    setState("accepting");
    try {
      const res = await fetch("/api/agent/diff-queue/apply", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ runId: null, files: [{ path: filePath, content: proposed }] }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => `HTTP ${res.status}`);
        setErrMsg(txt.slice(0, 80));
        setState("error");
        return;
      }
      window.dispatchEvent(new CustomEvent("file-saved", { detail: { path: filePath } }));
      window.dispatchEvent(new Event("file-refresh"));
      setState("accepted");
    } catch (e) {
      setErrMsg(String(e).slice(0, 80));
      setState("error");
    }
  };

  if (state === "accepted") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 text-[10px]"
        style={{ borderTop: "1px solid rgba(34,197,94,0.12)", color: "#22C55E" }}>
        <CheckCircle2 style={{ width: 11, height: 11 }} />
        Change applied
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 text-[10px]"
        style={{ borderTop: "1px solid rgba(239,68,68,0.12)", color: "rgba(239,68,68,0.7)" }}>
        <X style={{ width: 11, height: 11 }} />
        Change rejected
      </div>
    );
  }

  return (
    <div style={{ borderTop: "1px solid #263244" }}>
      {state === "error" && errMsg && (
        <p className="px-3 pt-1.5 text-[9.5px]" style={{ color: "#EF4444" }}>{errMsg}</p>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        <GitPullRequest style={{ width: 11, height: 11, color: "rgba(59,130,246,0.7)", flexShrink: 0 }} />
        <span className="flex-1 text-[10px]" style={{ color: "#94A3B8" }}>
          AI proposes this change
        </span>
        <button
          onClick={() => setState("rejected")}
          disabled={state === "accepting"}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[9.5px] font-medium transition-all hover:bg-white/[0.06]"
          style={{ border: "1px solid rgba(239,68,68,0.25)", color: "rgba(239,68,68,0.8)" }}
          data-testid="button-diff-reject">
          <ThumbsDown style={{ width: 10, height: 10 }} />
          Reject
        </button>
        <button
          onClick={handleAccept}
          disabled={state === "accepting"}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[9.5px] font-medium transition-all"
          style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22C55E" }}
          data-testid="button-diff-accept">
          {state === "accepting"
            ? <Loader2 className="animate-spin" style={{ width: 10, height: 10 }} />
            : <ThumbsUp style={{ width: 10, height: 10 }} />}
          {state === "accepting" ? "Applying…" : "Accept"}
        </button>
      </div>
    </div>
  );
}

interface FileWriteCardProps {
  item: AgentStreamItem;
  onOpenFile?: (path: string) => void;
}

export function FileWriteCard({ item, onOpenFile }: FileWriteCardProps) {
  const tool      = String(item.tool ?? "");
  const isPatch   = PATCH_TOOLS.has(tool);
  const filePath  = (item.meta?.file as string) ?? item.content;
  const filename  = getFilename(filePath);
  const lang      = getLang(filePath);
  const langColor = LANG_COLOR[lang] ?? "#86efac";
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
      style={{
        background: "#111827",
        border: isPatch ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(134,239,172,0.15)",
        animation: "card-enter 0.22s cubic-bezier(0.22,1,0.36,1) both",
      }}>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: isPatch ? "rgba(59,130,246,0.1)" : "rgba(134,239,172,0.08)",
            border: isPatch ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(134,239,172,0.15)",
          }}>
          <FileCode style={{ width: 13, height: 13, color: isPatch ? "#3B82F6" : "#86efac" }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] font-medium font-mono truncate"
              style={{ color: "#E5E7EB" }}>{filename}</span>
            <span className="text-[8.5px] px-1.5 py-0.5 rounded-sm font-mono flex-shrink-0"
              style={{ background: `${langColor}12`, border: `1px solid ${langColor}28`, color: `${langColor}cc` }}>
              {lang}
            </span>
            {isPatch && (
              <span className="text-[8.5px] px-1.5 py-0.5 rounded-sm font-mono flex-shrink-0"
                style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.22)", color: "#3B82F6" }}>
                patch
              </span>
            )}
          </div>
          <span className="text-[9px] font-mono truncate block mt-0.5"
            style={{ color: "#94A3B8" }}>{filePath}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isPatch && (
            isRunning
              ? <Loader2 className="animate-spin" style={{ width: 12, height: 12, color: "#86efac" }} />
              : <span className="flex items-center gap-1 text-[9px] font-medium" style={{ color: "#22C55E" }}>
                  <CheckCircle2 style={{ width: 11, height: 11 }} />
                  Written
                </span>
          )}
          {!isPatch && onOpenFile && isDone && (
            <button onClick={() => onOpenFile(filePath)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium transition-colors hover:bg-white/[0.06]"
              style={{ color: "#86efac", border: "1px solid rgba(134,239,172,0.18)" }}
              data-testid={`button-file-write-open-${filename}`}>
              <ExternalLink style={{ width: 9, height: 9 }} /> Open
            </button>
          )}
        </div>
      </div>

      {/* Diff preview lines */}
      {previewLines.length > 0 && (
        <div className="px-3 pb-2.5">
          <div className="rounded-md overflow-hidden text-[9.5px] font-mono leading-relaxed"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #263244" }}>
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

      {isPatch && isDone && proposed !== undefined && (
        <DiffAcceptRejectBar filePath={filePath} proposed={proposed} />
      )}
      {isPatch && isRunning && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-[10px]" style={{ color: "#3B82F6" }}>
          <Loader2 className="animate-spin" style={{ width: 10, height: 10 }} />
          Preparing patch…
        </div>
      )}
    </div>
  );
}
