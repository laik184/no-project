import { Camera, ExternalLink } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface ScreenshotCardProps {
  item: AgentStreamItem;
}

export function ScreenshotCard({ item }: ScreenshotCardProps) {
  const imageUrl = item.meta?.imageUrl;
  const url      = item.meta?.url ?? item.meta?.file;

  return (
    <div className="rounded-lg overflow-hidden" data-testid="screenshot-card"
      style={{ background: "rgba(244,114,182,0.04)", border: "1px solid rgba(244,114,182,0.15)" }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: imageUrl ? "1px solid rgba(244,114,182,0.1)" : "none" }}>
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(244,114,182,0.1)", border: "1px solid rgba(244,114,182,0.2)" }}>
          <Camera style={{ width: 12, height: 12, color: "#f472b6" }} />
        </div>
        <span className="text-[11px] font-medium flex-1" style={{ color: "rgba(203,213,225,0.85)" }}>
          Screenshot captured
        </span>
        {url && (
          <a href={url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] transition-colors hover:bg-white/[0.06]"
            style={{ color: "#f472b6", border: "1px solid rgba(244,114,182,0.2)" }}
            data-testid="button-screenshot-open">
            <ExternalLink style={{ width: 9, height: 9 }} /> Open
          </a>
        )}
      </div>

      {/* Image preview */}
      {imageUrl && (
        <div className="px-3 pb-2.5 pt-2">
          <img src={imageUrl} alt="Screenshot preview"
            className="w-full rounded-md object-cover"
            style={{ maxHeight: 180, border: "1px solid rgba(244,114,182,0.12)" }}
            data-testid="img-screenshot-preview" />
        </div>
      )}

      {/* URL bar */}
      {url && (
        <div className="px-3 pb-2">
          <span className="text-[9.5px] font-mono truncate block"
            style={{ color: "rgba(100,116,139,0.6)" }}>{url}</span>
        </div>
      )}
    </div>
  );
}
