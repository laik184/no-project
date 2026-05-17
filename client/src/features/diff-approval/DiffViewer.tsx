/**
 * DiffViewer
 * Renders a unified diff string with syntax highlighting.
 * No external diff-rendering library required.
 */

import { cn } from "@/lib/utils";

interface Props {
  diff:      string;
  filePath:  string;
  maxHeight?: string;
}

interface DiffLine {
  type:    "header" | "hunk" | "add" | "del" | "ctx" | "meta";
  content: string;
}

function parseDiffLines(diff: string): DiffLine[] {
  return diff.split("\n").map((line): DiffLine => {
    if (line.startsWith("--- ") || line.startsWith("+++ ")) return { type: "meta",   content: line };
    if (line.startsWith("@@"))                                 return { type: "hunk",   content: line };
    if (line.startsWith("+"))                                  return { type: "add",    content: line };
    if (line.startsWith("-"))                                  return { type: "del",    content: line };
    return { type: "ctx", content: line };
  });
}

export function DiffViewer({ diff, filePath, maxHeight = "400px" }: Props) {
  if (!diff) {
    return (
      <div className="text-sm text-muted-foreground px-4 py-6 text-center">
        No changes detected.
      </div>
    );
  }

  const lines = parseDiffLines(diff);
  const additions = lines.filter(l => l.type === "add").length;
  const deletions = lines.filter(l => l.type === "del").length;

  return (
    <div className="flex flex-col gap-1">
      {/* File header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-t border border-border text-xs font-mono">
        <span className="text-muted-foreground truncate">{filePath}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-emerald-500 font-semibold">+{additions}</span>
          <span className="text-red-500 font-semibold">-{deletions}</span>
        </div>
      </div>

      {/* Diff body */}
      <div
        className="overflow-auto rounded-b border border-t-0 border-border bg-[#0d1117] font-mono text-xs leading-5"
        style={{ maxHeight }}
        data-testid="diff-viewer-body"
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => {
              if (line.type === "meta") return null;
              return (
                <tr
                  key={i}
                  className={cn(
                    "group",
                    line.type === "add"  && "bg-emerald-950/40",
                    line.type === "del"  && "bg-red-950/40",
                    line.type === "hunk" && "bg-blue-950/30",
                  )}
                >
                  <td
                    className={cn(
                      "select-none w-4 px-2 text-right border-r border-border/30 text-[10px]",
                      line.type === "add"  && "text-emerald-500/60 border-emerald-800/30",
                      line.type === "del"  && "text-red-500/60 border-red-800/30",
                      line.type === "ctx"  && "text-muted-foreground/40",
                      line.type === "hunk" && "text-blue-400/60",
                    )}
                  >
                    {line.type === "add" ? "+" : line.type === "del" ? "−" : ""}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-px whitespace-pre-wrap break-all",
                      line.type === "add"  && "text-emerald-300",
                      line.type === "del"  && "text-red-300",
                      line.type === "ctx"  && "text-slate-400",
                      line.type === "hunk" && "text-blue-400 italic",
                    )}
                  >
                    {line.content.slice(1) /* strip leading +/- */ || "\u00a0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
