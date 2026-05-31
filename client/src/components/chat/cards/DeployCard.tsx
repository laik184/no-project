import { Globe, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface DeployCardProps {
  item: AgentStreamItem;
}

export function DeployCard({ item }: DeployCardProps) {
  const url       = item.meta?.url ?? item.meta?.file;
  const isRunning = item.status === "running";
  const isDone    = item.status === "done";

  return (
    <div className="rounded-lg flex items-center gap-2.5 px-3 py-2" data-testid="deploy-card"
      style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.15)" }}>

      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)" }}>
        <Globe style={{ width: 13, height: 13, color: "#60a5fa" }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium" style={{ color: "rgba(203,213,225,0.9)" }}>
            Deploy
          </span>
          {isRunning && (
            <span className="flex items-center gap-1 text-[9px]" style={{ color: "#60a5fa" }}>
              <Loader2 className="animate-spin" style={{ width: 9, height: 9 }} /> Publishing…
            </span>
          )}
          {isDone && (
            <span className="flex items-center gap-1 text-[9px]" style={{ color: "#4ade80" }}>
              <CheckCircle2 style={{ width: 9, height: 9 }} /> Live
            </span>
          )}
        </div>
        {url && (
          <span className="text-[9.5px] font-mono truncate block mt-0.5"
            style={{ color: "rgba(96,165,250,0.7)" }}>{url}</span>
        )}
      </div>

      {url && isDone && (
        <a href={url} target="_blank" rel="noreferrer"
          className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium transition-colors hover:bg-white/[0.06]"
          style={{ color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}
          data-testid="button-deploy-open">
          <ExternalLink style={{ width: 9, height: 9 }} /> Open
        </a>
      )}
    </div>
  );
}
