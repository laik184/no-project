import { RefObject } from "react";
import { Search } from "lucide-react";
import { FileNode, getNodePath } from "./library-panel-data";
import { getLanguageIcon } from "./LibraryTreeNode";

interface LibraryQuickOpenProps {
  showQuickOpen: boolean;
  quickOpenQuery: string;
  setQuickOpenQuery: (q: string) => void;
  quickOpenIdx: number;
  setQuickOpenIdx: (fn: (i: number) => number) => void;
  quickOpenResults: FileNode[];
  tree: FileNode[];
  inputRef: RefObject<HTMLInputElement | null>;
  onOpen: (file: FileNode) => void;
  onClose: () => void;
}

export function LibraryQuickOpen({
  showQuickOpen, quickOpenQuery, setQuickOpenQuery,
  quickOpenIdx, setQuickOpenIdx, quickOpenResults,
  tree, inputRef, onOpen, onClose,
}: LibraryQuickOpenProps) {
  if (!showQuickOpen) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center pt-12 px-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => { onClose(); setQuickOpenQuery(""); }}
    >
      <div
        className="w-full rounded-xl overflow-hidden flex flex-col"
        style={{ maxWidth: 480, maxHeight: 360, background: "rgba(13,14,26,0.99)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "rgba(148,163,184,0.5)" }} />
          <input
            ref={inputRef}
            value={quickOpenQuery}
            onChange={(e) => { setQuickOpenQuery(e.target.value); setQuickOpenIdx(() => 0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setQuickOpenIdx((i) => Math.min(i + 1, quickOpenResults.length - 1)); }
              if (e.key === "ArrowUp")   { e.preventDefault(); setQuickOpenIdx((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter" && quickOpenResults[quickOpenIdx]) { onOpen(quickOpenResults[quickOpenIdx]); onClose(); setQuickOpenQuery(""); }
              if (e.key === "Escape")    { onClose(); setQuickOpenQuery(""); }
            }}
            placeholder="Search files by name..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
            data-testid="input-quick-open"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(148,163,184,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>ESC</kbd>
        </div>

        <div className="overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
          {quickOpenResults.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: "rgba(100,116,139,0.5)" }}>No files found</div>
          ) : (
            quickOpenResults.map((file, idx) => {
              const isSelected = idx === quickOpenIdx;
              const path = getNodePath(tree, file.id) || file.name;
              const qLower = quickOpenQuery.toLowerCase();
              const nameLower = file.name.toLowerCase();
              const matchIdx = nameLower.indexOf(qLower);
              return (
                <button
                  key={file.id}
                  onClick={() => { onOpen(file); onClose(); setQuickOpenQuery(""); }}
                  onMouseEnter={() => setQuickOpenIdx(() => idx)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                  style={{ background: isSelected ? "rgba(124,141,255,0.12)" : "transparent" }}
                  data-testid={`quickopen-result-${file.id}`}
                >
                  {getLanguageIcon(file.name)}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs truncate" style={{ color: isSelected ? "rgba(226,232,240,1)" : "rgba(226,232,240,0.75)" }}>
                      {matchIdx >= 0 && quickOpenQuery ? (
                        <>
                          <span>{file.name.slice(0, matchIdx)}</span>
                          <span style={{ color: "#f59e0b", fontWeight: 600 }}>{file.name.slice(matchIdx, matchIdx + quickOpenQuery.length)}</span>
                          <span>{file.name.slice(matchIdx + quickOpenQuery.length)}</span>
                        </>
                      ) : file.name}
                    </span>
                    <span className="text-[10px] truncate" style={{ color: "rgba(100,116,139,0.5)" }}>{path}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 px-3 py-1.5 border-t flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
          {[["↑↓", "navigate"], ["↵", "open"], ["ESC", "close"]].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(100,116,139,0.5)" }}>
              <kbd className="px-1 py-px rounded font-mono" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
