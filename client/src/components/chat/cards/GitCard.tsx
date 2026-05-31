import { GitBranch, GitCommit } from "lucide-react";
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
  return "Git";
}

export function GitCard({ item }: GitCardProps) {
  const tool    = String(item.tool ?? "git.commit");
  const opLabel = operationLabel(tool);
  const branch  = item.meta?.branch;
  const hash    = item.meta?.commitHash;
  const shortHash = hash ? hash.slice(0, 7) : null;

  return (
    <div className="rounded-lg flex items-center gap-2.5 px-3 py-2" data-testid="git-card"
      style={{ background: "rgba(134,239,172,0.04)", border: "1px solid rgba(134,239,172,0.14)" }}>

      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(134,239,172,0.1)", border: "1px solid rgba(134,239,172,0.2)" }}>
        {hash ? (
          <GitCommit style={{ width: 13, height: 13, color: "#86efac" }} />
        ) : (
          <GitBranch style={{ width: 13, height: 13, color: "#86efac" }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium" style={{ color: "rgba(203,213,225,0.9)" }}>
            {opLabel}
          </span>
          {branch && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: "rgba(134,239,172,0.1)", border: "1px solid rgba(134,239,172,0.2)", color: "rgba(134,239,172,0.8)" }}>
              {branch}
            </span>
          )}
          {shortHash && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: "rgba(134,239,172,0.07)", border: "1px solid rgba(134,239,172,0.15)", color: "rgba(134,239,172,0.6)" }}>
              {shortHash}
            </span>
          )}
        </div>
        <span className="text-[9.5px] truncate block mt-0.5" style={{ color: "rgba(100,116,139,0.55)" }}>
          {item.content}
        </span>
      </div>
    </div>
  );
}
