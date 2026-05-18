/**
 * DiffApprovalModal
 *
 * Renders a floating modal whenever the AI agent wants to overwrite an existing
 * file. The user can approve (apply the write) or reject (discard the change).
 *
 * Conflict awareness:
 *   If the file is currently open and dirty in the editor, the modal warns the
 *   user and shows THEIR unsaved edits vs the AI's proposed content — not the
 *   stale on-disk version. This prevents silent loss of unsaved work.
 *
 * Mount once at the workspace root — it listens to SSE internally.
 */

import { useState, useEffect }  from "react";
import { Check, X, Clock, FileCode, Loader2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button }                from "@/components/ui/button";
import { Badge }                 from "@/components/ui/badge";
import { useDiffApproval }       from "./useDiffApproval";
import { DiffViewer }            from "./DiffViewer";
import { dirtyStateStore, type TabEditorState } from "@/features/editor-state/dirty-state.store";

// ── Reactive dirty-state hook ─────────────────────────────────────────────────

/**
 * Subscribes to dirtyStateStore and returns the tab state for the given
 * filePath, or null if the file isn't open / tracked.
 */
function useDirtyFile(filePath: string | undefined): TabEditorState | null {
  const [state, setState] = useState<TabEditorState | null>(
    filePath ? (dirtyStateStore.getTabByFilePath(filePath) ?? null) : null,
  );

  useEffect(() => {
    if (!filePath) { setState(null); return; }
    // Sync immediately in case the store updated between render and effect.
    setState(dirtyStateStore.getTabByFilePath(filePath) ?? null);

    return dirtyStateStore.subscribe((snapshot) => {
      for (const tab of snapshot.values()) {
        if (tab.filePath === filePath) { setState(tab); return; }
      }
      setState(null);
    });
  }, [filePath]);

  return state;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  projectId?: number;
}

export function DiffApprovalModal({ projectId }: Props) {
  const { current, queue, approve, reject, loading, secondsLeft } =
    useDiffApproval(projectId);

  const [expanded, setExpanded] = useState(true);

  // Reactively detect whether the file being reviewed is dirty in the editor.
  const dirtyTab = useDirtyFile(current?.filePath);
  const hasDirtyConflict = !!(dirtyTab?.isDirty && dirtyTab.editedContent !== null);

  const pending = queue.filter(d => d.status === "pending");

  if (!current || current.status !== "pending") return null;

  const isLoading   = loading === current.sessionId;
  const isUrgent    = (secondsLeft ?? 999) < 60;
  const queueLength = pending.length;

  // When the file is dirty, show the user's unsaved edits vs AI's content.
  // This is the critical fix: the diff reflects what the user will actually lose.
  const diffOldContent = hasDirtyConflict
    ? (dirtyTab!.editedContent ?? current.oldContent)
    : current.oldContent;

  const handleApprove = () => {
    // If approving while dirty, dispatch a signal so the workspace can
    // inform the user that their unsaved edits were superseded.
    if (hasDirtyConflict) {
      window.dispatchEvent(
        new CustomEvent("file:approved-over-dirty", {
          detail: { filePath: current.filePath },
        }),
      );
    }
    approve(current.sessionId);
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[560px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background shadow-2xl"
      data-testid="diff-approval-modal"
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
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

      {/* ── Dirty-conflict warning banner ────────────────────────────────────── */}
      {hasDirtyConflict && (
        <div
          className="flex items-start gap-2 px-4 py-2.5 bg-amber-950/40 border-b border-amber-800/40"
          data-testid="diff-modal-dirty-warning"
        >
          <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-snug">
            <span className="font-semibold text-amber-300">You have unsaved edits in this file.</span>
            {" "}The diff below compares your current edits to the AI's version.
            Approving will overwrite your unsaved changes — or click{" "}
            <span className="font-semibold">Keep my edits</span> to discard the AI's change.
          </div>
        </div>
      )}

      {/* ── Diff body ───────────────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pt-3 pb-2">
          {hasDirtyConflict && (
            <p className="text-[11px] text-amber-400/70 mb-1.5 font-mono">
              Your unsaved edits → AI's proposed version
            </p>
          )}
          <DiffViewer
            diff={current.unifiedDiff}
            filePath={current.filePath}
            oldContent={diffOldContent}
            newContent={current.newContent}
            maxHeight="300px"
          />
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {hasDirtyConflict
            ? "Approving will replace your unsaved edits."
            : "AI wants to modify this file. Review the diff above."}
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
            {hasDirtyConflict ? "Keep my edits" : "Reject"}
          </Button>

          <Button
            size="sm"
            className={`gap-1.5 text-white ${
              hasDirtyConflict
                ? "bg-amber-600 hover:bg-amber-500"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
            disabled={isLoading}
            onClick={handleApprove}
            data-testid="diff-modal-approve"
          >
            {isLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Check className="size-3.5" />}
            {hasDirtyConflict ? "Apply AI changes" : "Apply"}
          </Button>
        </div>
      </div>
    </div>
  );
}
