/**
 * DiffApprovalModal
 *
 * Renders a floating modal whenever the AI agent wants to overwrite an existing
 * file. The user can approve (apply the write) or reject (discard the change).
 *
 * Mount once at the workspace root — it listens to SSE internally.
 */

import { useState }         from "react";
import { Check, X, Clock, FileCode, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button }           from "@/components/ui/button";
import { Badge }            from "@/components/ui/badge";
import { useDiffApproval }  from "./useDiffApproval";
import { DiffViewer }       from "./DiffViewer";

interface Props {
  projectId?: number;
}

export function DiffApprovalModal({ projectId }: Props) {
  const { current, queue, approve, reject, loading, secondsLeft } =
    useDiffApproval(projectId);

  const [expanded, setExpanded] = useState(true);

  const pending = queue.filter(d => d.status === "pending");

  if (!current || current.status !== "pending") return null;

  const isLoading   = loading === current.sessionId;
  const isUrgent    = (secondsLeft ?? 999) < 60;
  const queueLength = pending.length;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[540px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background shadow-2xl"
      data-testid="diff-approval-modal"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="size-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <FileCode className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate" data-testid="diff-modal-filename">
            {current.filePath}
          </span>
          {queueLength > 1 && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              +{queueLength - 1} more
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {secondsLeft !== null && (
            <span
              className={`flex items-center gap-1 text-xs ${isUrgent ? "text-red-400" : "text-muted-foreground"}`}
              data-testid="diff-modal-countdown"
            >
              <Clock className="size-3" />
              {secondsLeft}s
            </span>
          )}
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(v => !v)}
            data-testid="diff-modal-toggle"
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        </div>
      </div>

      {/* ── Diff body ───────────────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pt-3 pb-2">
          <DiffViewer
            diff={current.unifiedDiff}
            filePath={current.filePath}
            maxHeight="320px"
          />
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          AI wants to modify this file. Review the diff above.
        </p>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-red-400 border-red-800/40 hover:bg-red-950/30 hover:text-red-300"
            disabled={isLoading}
            onClick={() => reject(current.sessionId)}
            data-testid="diff-modal-reject"
          >
            {isLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <X className="size-3.5" />}
            Reject
          </Button>

          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
            disabled={isLoading}
            onClick={() => approve(current.sessionId)}
            data-testid="diff-modal-approve"
          >
            {isLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Check className="size-3.5" />}
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
