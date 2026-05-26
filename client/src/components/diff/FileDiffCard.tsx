import { useState } from "react";
import { ChevronDown, FileCode, FilePlus, FileEdit, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type DiffLineType = "add" | "remove" | "context" | "hunk";

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

export interface FileDiff {
  filename: string;
  status: "created" | "modified" | "deleted";
  additions: number;
  deletions: number;
  lines: DiffLine[];
}

interface FileDiffCardProps {
  diff: FileDiff;
}

function langFromFilename(name: string): string {
  if (name.endsWith(".tsx") || name.endsWith(".ts")) return "tsx";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".md")) return "md";
  if (name.endsWith(".sql")) return "sql";
  return "txt";
}

const STATUS_META = {
  created: { label: "Created", color: "#4ade80", Icon: FilePlus },
  modified: { label: "Modified", color: "#7c8dff", Icon: FileEdit },
  deleted:  { label: "Deleted",  color: "#f87171", Icon: FileCode },
};

export function FileDiffCard({ diff }: FileDiffCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const { label, color, Icon } = STATUS_META[diff.status];

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = diff.lines
      .filter((l) => l.type !== "hunk")
      .map((l) => l.content)
      .join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const shortName = diff.filename.split("/").pop() ?? diff.filename;
  const dir = diff.filename.includes("/")
    ? diff.filename.slice(0, diff.filename.lastIndexOf("/") + 1)
    : "";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
        animation: "diff-in 0.2s cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      <style>{`
        @keyframes diff-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors select-none cursor-pointer">
        <div className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon className="h-3 w-3" style={{ color }} />
        </div>
        <span className="flex-1 min-w-0 text-left">
          <span className="text-[10.5px]" style={{ color: "rgba(148,163,184,0.5)" }}>{dir}</span>
          <span className="text-[11px] font-semibold" style={{ color: "rgba(226,232,240,0.9)" }}>{shortName}</span>
          <span className="ml-2 text-[9px] font-medium px-1.5 py-0.5 rounded uppercase" style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>{label}</span>
        </span>
        <span className="flex items-center gap-1.5 flex-shrink-0 mr-1">
          {diff.additions > 0 && <span className="text-[10px] font-mono font-medium" style={{ color: "#4ade80" }}>+{diff.additions}</span>}
          {diff.deletions > 0 && <span className="text-[10px] font-mono font-medium" style={{ color: "#f87171" }}>-{diff.deletions}</span>}
        </span>
        <button onClick={handleCopy} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/8 transition-colors flex-shrink-0" style={{ color: copied ? "#4ade80" : "rgba(148,163,184,0.4)" }} title="Copy">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
        <ChevronDown className="h-3 w-3 flex-shrink-0 transition-transform duration-150" style={{ color: "rgba(148,163,184,0.35)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} />
      </div>
      {expanded && (
        <div className="overflow-x-auto text-[10.5px] font-mono" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full border-collapse">
            <tbody>
              {diff.lines.map((line, i) => {
                if (line.type === "hunk") {
                  return (
                    <tr key={i} style={{ background: "rgba(124,141,255,0.07)" }}>
                      <td colSpan={3} className="px-3 py-0.5 text-[9.5px] font-mono select-none" style={{ color: "rgba(124,141,255,0.7)" }}>{line.content}</td>
                    </tr>
                  );
                }
                const isAdd = line.type === "add";
                const isRemove = line.type === "remove";
                return (
                  <tr key={i} style={{ background: isAdd ? "rgba(74,222,128,0.07)" : isRemove ? "rgba(248,113,113,0.07)" : "transparent" }}>
                    <td className="px-2 py-0.5 text-right select-none w-7 flex-shrink-0" style={{ color: "rgba(148,163,184,0.25)", minWidth: 28 }}>{!isAdd ? (line.oldLineNo ?? "") : ""}</td>
                    <td className="px-2 py-0.5 text-right select-none w-7 flex-shrink-0" style={{ color: "rgba(148,163,184,0.25)", minWidth: 28 }}>{!isRemove ? (line.newLineNo ?? "") : ""}</td>
                    <td className="px-1 py-0.5 select-none w-4 text-center flex-shrink-0" style={{ color: isAdd ? "rgba(74,222,128,0.8)" : isRemove ? "rgba(248,113,113,0.8)" : "rgba(148,163,184,0.2)", minWidth: 16 }}>{isAdd ? "+" : isRemove ? "−" : " "}</td>
                    <td className="px-2 py-0.5 whitespace-pre" style={{ color: isAdd ? "rgba(187,247,208,0.9)" : isRemove ? "rgba(254,202,202,0.75)" : "rgba(203,213,225,0.7)" }}>{line.content}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export { generateMockDiffs } from "./mock-diffs";
