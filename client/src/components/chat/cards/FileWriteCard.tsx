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

// ── Language helpers ───────────────────────────────────────────────────────────

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

// ── Diff Accept/Reject bar (T1) ────────────────────────────────────────────────

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
        style={{ borderTop: "1px solid rgba(74,222,128,0.1)", color: "#4ade80" }}>
        <CheckCircle2 style={{ width: 11, height: 11 }} />
        Change applied
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 text-[10px]"
        style={{ borderTop: "1px solid rgba(248,113,113,0.1)", color: "rgba(248,113,113,0.7)" }}>
        <X style={{ width: 11, height: 11 }} />
        Change rejected
      </div>
    );
  }

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      {state === "error" && errMsg && (
        <p className="px-3 pt-1.5 text-[9.5px]" style={{ color: "#f87171" }}>{errMsg}</p>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        <GitPullRequest style={{ width: 11, height: 11, color: "rgba(124,141,255,0.7)", flexShrink: 0 }} />
        <span className="flex-1 text-[10px]" style={{ color: "rgba(148,163,184,0.65)" }}>
          AI proposes this change
        </span>
        <button
          onClick={() => setState("rejected")}
          disabled={state === "accepting"}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[9.5px] font-medium transition-all hover:bg-white/[0.06]"
          style={{ border: "1px solid rgba(248,113,113,0.25)", color: "rgba(248,113,113,0.8)" }}
          data-testid="button-diff-reject">
          <ThumbsDown style={{ width: 10, height: 10 }} />
          Reject
        </button>
        <button
          onClick={handleAccept}
          disabled={state === "accepting"}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[9.5px] font-medium transition-all"
          style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }}
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

// ── Main card ──────────────────────────────────────────────────────────────────

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

  // Diff preview: prefer logs (unified diff), fall back to comparing original vs proposed
  const previewLines = logs
    ? logs.split("\n").filter((l) => l.startsWith("+") || l.startsWith("-")).slice(0, 4)
    : [];

  return (
    <div
      className="rounded-lg overflow-hidden"
      data-testid="file-write-card"
      style={{
        background: isPatch
          ? "rgba(124,141,255,0.04)"
          : "rgba(134,239,172,0.04)",
        border: `1px solid ${isPatch ? "rgba(124,141,255,0.18)" : "rgba(134,239,172,0.15)"}`,
        animation: "card-enter 0.22s cubic-bezier(0.22,1,0.36,1) both",
      }}>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: isPatch ? "rgba(124,141,255,0.1)" : "rgba(134,239,172,0.1)",
            border: `1px solid ${isPatch ? "rgba(124,141,255,0.22)" : "rgba(134,239,172,0.2)"}`,
          }}>
          <FileCode style={{ width: 13, height: 13, color: isPatch ? "#7c8dff" : "#86efac" }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] font-medium font-mono truncate"
              style={{ color: "rgba(203,213,225,0.9)" }}>{filename}</span>
            <span className="text-[8.5px] px-1.5 py-0.5 rounded-sm font-mono flex-shrink-0"
              style={{ background: `${langColor}15`, border: `1px solid ${langColor}30`, color: `${langColor}cc` }}>
              {lang}
            </span>
            {isPatch && (
              <span className="text-[8.5px] px-1.5 py-0.5 rounded-sm font-mono flex-shrink-0"
                style={{ background: "rgba(124,141,255,0.1)", border: "1px solid rgba(124,141,255,0.25)", color: "#7c8dff" }}>
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
              ? <Loader2 className="animate-spin" style={{ width: 12, height: 12, color: "#86efac" }} />
              : <span className="flex items-center gap-1 text-[9px] font-medium" style={{ color: "#4ade80" }}>
                  <CheckCircle2 style={{ width: 11, height: 11 }} />
                  Written
                </span>
          )}
          {!isPatch && onOpenFile && isDone && (
            <button onClick={() => onOpenFile(filePath)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium transition-colors hover:bg-white/[0.06]"
              style={{ color: "#86efac", border: "1px solid rgba(134,239,172,0.2)" }}
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
            style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(134,239,172,0.1)" }}>
            {previewLines.map((line, i) => (
              <div key={i} className="px-2.5 py-[1px]"
                style={{
                  background: line.startsWith("+") ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)",
                  color:      line.startsWith("+") ? "rgba(134,239,172,0.8)"  : "rgba(248,113,113,0.7)",
                }}>
                {line.slice(0, 80)}{line.length > 80 ? "…" : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* T1 — Accept / Reject bar for patch.queue */}
      {isPatch && isDone && proposed !== undefined && (
        <DiffAcceptRejectBar filePath={filePath} proposed={proposed} />
      )}
      {isPatch && isRunning && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-[10px]" style={{ color: "#7c8dff" }}>
          <Loader2 className="animate-spin" style={{ width: 10, height: 10 }} />
          Preparing patch…
        </div>
      )}
    </div>
  );
}
