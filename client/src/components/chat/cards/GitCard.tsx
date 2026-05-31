/**
 * GitCard — renders git.* tool actions.
 * Neutral dark workspace theme.
 */
import { GitBranch, GitCommit, FileCode } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface GitCardProps {
  item: AgentStreamItem;
}

function operationLabel(tool: string): string {
  if (tool.includes("commit")) return "Committed";
  if (tool.includes("push"))   return "Pushed";
  if (tool.includes("pull"))   return "Pulled";
  if (tool.includes("clone"))  return "Cloned";
  if (tool.includes("add"))    return "Staged";
  if (tool.includes("status")) return "Status";
  return "Git";
}

export function GitCard({ item }: GitCardProps) {
  const tool         = String(item.tool ?? "git.commit");
  const opLabel      = operationLabel(tool);
  const branch       = item.meta?.branch       as string | undefined;
  const hash         = item.meta?.commitHash   as string | undefined;
  const filesChanged = item.meta?.filesChanged as number | undefined;
  const message      = item.meta?.message      as string | undefined;
  const shortHash    = hash ? hash.slice(0, 7) : null;

  return (
    <div
      className="rounded-lg flex items-center gap-2.5 px-3 py-2"
      data-testid="git-card"
      style={{
        background: "#111827",
        border:     "1px solid #1f2937",
        animation:  "card-enter 0.22s cubic-bezier(0.22,1,0.36,1) both",
      }}>

      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)" }}>
        {hash
          ? <GitCommit style={{ width: 13, height: 13, color: "#22c55e" }} />
          : <GitBranch style={{ width: 13, height: 13, color: "#22c55e" }} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium" style={{ color: "rgba(203,213,225,0.9)" }}>
            {opLabel}
          </span>
          {branch && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", color: "rgba(134,239,172,0.75)" }}>
              {branch}
            </span>
          )}
          {shortHash && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: "rgba(148,163,184,0.06)", border: "1px solid #1f2937", color: "rgba(148,163,184,0.55)" }}>
              {shortHash}
            </span>
          )}
          {filesChanged !== undefined && filesChanged > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] flex-shrink-0"
              style={{ color: "rgba(100,116,139,0.55)" }}>
              <FileCode style={{ width: 9, height: 9 }} />
              {filesChanged}
            </span>
          )}
        </div>
        <span className="text-[9.5px] truncate block mt-0.5"
          style={{ color: "rgba(100,116,139,0.5)" }}>
          {message ?? item.content}
        </span>
      </div>
    </div>
  );
}
