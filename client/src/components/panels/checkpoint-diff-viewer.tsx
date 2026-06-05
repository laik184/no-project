import { Diff, FileCode, Loader2, X } from "lucide-react";
import { useCheckpointDiff } from "@/hooks/use-checkpoints";

export function DiffViewer({ fromId, toId, onClose }: { fromId: string; toId: string; onClose: () => void }) {
  const { data, isLoading, isError } = useCheckpointDiff(fromId, toId, !!(fromId && toId && fromId !== toId));
  const diff = data?.diff;

  const renderSection = (files: string[], color: string, symbol: string, label: string) => {
    if (!files.length) return null;
    return (
      <div>
        <p className="font-semibold mb-1 flex items-center gap-1" style={{ color }}>
          <span>{symbol}</span>
          <span>{label}</span>
          <span className="font-normal text-[9.5px] ml-0.5" style={{ color: `${color}99` }}>({files.length})</span>
        </p>
        <div className="space-y-0.5 max-h-36 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {files.map(f => (
            <p key={f} className="truncate pl-2 flex items-center gap-1" style={{ color: `${color}bb` }}>
              <FileCode style={{ width: 8, height: 8, flexShrink: 0 }} />
              <span className="truncate text-[9.5px]">{f}</span>
            </p>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(124,141,255,0.22)", background: "rgba(124,141,255,0.04)", animation: "cp-fadein 0.18s ease both" }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(124,141,255,0.14)" }}>
        <div className="flex items-center gap-1.5">
          <Diff style={{ width: 11, height: 11, color: "#7c8dff" }} />
          <span className="text-[10.5px] font-semibold" style={{ color: "rgba(203,213,225,0.9)" }}>Snapshot diff</span>
          {data?.summary && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(124,141,255,0.12)", color: "rgba(167,185,255,0.8)" }}>
              {data.summary}
            </span>
          )}
        </div>
        <button onClick={onClose} className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10" style={{ color: "rgba(148,163,184,0.5)" }}>
          <X style={{ width: 10, height: 10 }} />
        </button>
      </div>

      <div className="px-3 py-2.5 text-[10px]">
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#7c8dff" }} />
          </div>
        )}
        {isError && (
          <p className="py-2 text-center" style={{ color: "rgba(248,113,113,0.7)" }}>Could not load diff.</p>
        )}
        {diff && !isLoading && (
          <div className="space-y-3">
            {renderSection(diff.added,    "#4ade80", "+", "Added")}
            {renderSection(diff.modified, "#fbbf24", "~", "Modified")}
            {renderSection(diff.removed,  "#f87171", "−", "Removed")}
            {diff.totalChanges === 0 && (
              <p className="py-2 text-center" style={{ color: "rgba(148,163,184,0.5)" }}>No file changes between these checkpoints.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
