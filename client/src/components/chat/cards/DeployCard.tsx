/**
 * DeployCard — Phase 3 (T4): backend now wires url and environment into
 * entry.meta. Added environment badge and URL copy-to-clipboard.
 */
import { useState }                                          from "react";
import { Globe, ExternalLink, CheckCircle2, Loader2, Copy } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface DeployCardProps {
  item: AgentStreamItem;
}

export function DeployCard({ item }: DeployCardProps) {
  const [copied, setCopied] = useState(false);

  const url         = item.meta?.url         as string | undefined ?? item.meta?.file as string | undefined;
  const environment = item.meta?.environment as string | undefined;
  const isRunning   = item.status === "running";
  const isDone      = item.status === "done";

  const handleCopyUrl = () => {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div
      className="rounded-lg flex items-center gap-2.5 px-3 py-2"
      data-testid="deploy-card"
      style={{
        background: "rgba(96,165,250,0.04)",
        border:     "1px solid rgba(96,165,250,0.15)",
        animation:  "card-enter 0.22s cubic-bezier(0.22,1,0.36,1) both",
      }}>

      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)" }}>
        <Globe style={{ width: 13, height: 13, color: "#60a5fa" }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium" style={{ color: "rgba(203,213,225,0.9)" }}>
            Deploy
          </span>
          {environment && (
            <span className="text-[8.5px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
              style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.22)", color: "rgba(96,165,250,0.85)" }}>
              {environment}
            </span>
          )}
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
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[9.5px] font-mono truncate"
              style={{ color: "rgba(96,165,250,0.7)" }}>{url}</span>
            {isDone && (
              <button
                onClick={handleCopyUrl}
                className="flex-shrink-0 flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded transition-colors hover:bg-white/[0.06]"
                style={{ color: copied ? "#4ade80" : "rgba(96,165,250,0.5)" }}
                data-testid="button-deploy-copy-url"
                title="Copy URL">
                <Copy style={{ width: 8, height: 8 }} />
                {copied && "Copied!"}
              </button>
            )}
          </div>
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
