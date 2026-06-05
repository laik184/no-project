import { X, AlertTriangle } from "lucide-react";

interface CenterPanelConflictBannerProps {
  conflictPath: string | null;
  activeFilePath: string | undefined;
  isFileTab: boolean;
  onReload: () => void;
  onOverwrite: () => void;
  onDismiss: () => void;
}

export function CenterPanelConflictBanner({
  conflictPath, activeFilePath, isFileTab, onReload, onOverwrite, onDismiss,
}: CenterPanelConflictBannerProps) {
  if (!isFileTab || !conflictPath || conflictPath !== activeFilePath) return null;

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2 flex-shrink-0 text-xs"
      style={{ background: "rgba(239,68,68,0.1)", borderBottom: "1px solid rgba(239,68,68,0.22)" }}
      data-testid="banner-conflict"
    >
      <AlertTriangle style={{ width: 13, height: 13, color: "#fca5a5", flexShrink: 0 }} />
      <span style={{ color: "#fca5a5", flex: 1 }}>
        Server has a newer version — your changes weren&apos;t saved.
      </span>
      <button
        onClick={onReload}
        className="px-2.5 py-0.5 rounded text-[11px] font-medium transition-opacity hover:opacity-80"
        style={{ background: "rgba(239,68,68,0.22)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}
        data-testid="button-conflict-reload"
      >
        Reload from server
      </button>
      <button
        onClick={onOverwrite}
        className="px-2.5 py-0.5 rounded text-[11px] font-medium transition-opacity hover:opacity-80"
        style={{ background: "rgba(255,255,255,0.07)", color: "rgba(226,232,240,0.65)", border: "1px solid rgba(255,255,255,0.1)" }}
        data-testid="button-conflict-overwrite"
      >
        Force overwrite
      </button>
      <button
        onClick={onDismiss}
        className="opacity-40 hover:opacity-80 transition-opacity ml-1"
        data-testid="button-conflict-dismiss"
      >
        <X style={{ width: 11, height: 11 }} />
      </button>
    </div>
  );
}
