import { RefObject } from "react";
import { X, Search } from "lucide-react";
import { FileNode, SearchResult, findNode } from "./library-panel-data";
import { getLanguageIcon } from "./LibraryTreeNode";

interface LibrarySearchPaneProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: SearchResult[];
  tree: FileNode[];
  openFile: (node: FileNode) => void;
  setShowSearch: (v: boolean) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
}

export function LibrarySearchPane({
  searchQuery, setSearchQuery, searchResults, tree, openFile, setShowSearch, searchInputRef,
}: LibrarySearchPaneProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-2 py-2 border-b flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Search className="h-3 w-3 flex-shrink-0" style={{ color: "rgba(148,163,184,0.5)" }} />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in files..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none min-w-0"
            data-testid="input-global-search"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-[10px] mt-1.5" style={{ color: "rgba(148,163,184,0.4)" }}>
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {!searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: "rgba(100,116,139,0.45)" }}>
            <Search className="h-6 w-6" style={{ color: "rgba(100,116,139,0.25)" }} />
            <p className="text-[11px] text-center px-4">Type to search across all files</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: "rgba(100,116,139,0.45)" }}>
            <p className="text-[11px]">No results found</p>
          </div>
        ) : (
          <div className="py-1">
            {(() => {
              const grouped = searchResults.reduce<Record<string, SearchResult[]>>((acc, r) => {
                if (!acc[r.fileId]) acc[r.fileId] = [];
                acc[r.fileId].push(r);
                return acc;
              }, {});
              return Object.entries(grouped).map(([fileId, results]) => (
                <div key={fileId}>
                  <div className="flex items-center gap-1.5 px-2 py-1 sticky top-0" style={{ background: "rgba(10,12,20,0.98)" }}>
                    {getLanguageIcon(results[0].fileName)}
                    <span className="text-[10px] font-semibold truncate" style={{ color: "rgba(226,232,240,0.6)" }}>{results[0].fileName}</span>
                    <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: "rgba(100,116,139,0.5)" }}>{results.length}</span>
                  </div>
                  {results.map((result, i) => {
                    const before = result.lineText.slice(0, result.matchIndex);
                    const match  = result.lineText.slice(result.matchIndex, result.matchIndex + searchQuery.length);
                    const after  = result.lineText.slice(result.matchIndex + searchQuery.length);
                    return (
                      <button
                        key={i}
                        onClick={() => { const node = findNode(tree, fileId); if (node) openFile(node); setShowSearch(false); }}
                        className="w-full text-left flex items-start gap-2 px-2 py-1 hover:bg-white/5 transition-colors group"
                        data-testid={`search-result-${fileId}-${i}`}
                      >
                        <span className="text-[10px] flex-shrink-0 mt-px font-mono" style={{ color: "rgba(100,116,139,0.4)", minWidth: 24, textAlign: "right" }}>{result.lineNumber}</span>
                        <span className="text-[11px] font-mono truncate" style={{ color: "rgba(148,163,184,0.65)" }}>
                          <span>{before}</span>
                          <span style={{ color: "#f59e0b", background: "rgba(245,158,11,0.15)", borderRadius: 2, padding: "0 1px" }}>{match}</span>
                          <span>{after}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
