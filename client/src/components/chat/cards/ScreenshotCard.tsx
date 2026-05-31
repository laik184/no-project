/**
 * ScreenshotCard — handles imageData (base64) and imageUrl.
 * Neutral dark workspace theme.
 */
import { useState } from "react";
import { Camera, ExternalLink, Loader2 } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface ScreenshotCardProps {
  item: AgentStreamItem;
}

export function ScreenshotCard({ item }: ScreenshotCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError,  setImgError]  = useState(false);

  const imageUrl  = item.meta?.imageUrl  as string | undefined;
  const imageData = item.meta?.imageData as string | undefined;
  const url       = item.meta?.url       as string | undefined ?? item.meta?.file as string | undefined;
  const isRunning = item.status === "running";

  const imgSrc = imageUrl
    ? imageUrl
    : imageData
      ? (imageData.startsWith("data:") ? imageData : `data:image/png;base64,${imageData}`)
      : null;

  const hasImage = !!imgSrc && !imgError;

  return (
    <div
      className="rounded-lg overflow-hidden"
      data-testid="screenshot-card"
      style={{
        background: "#111827",
        border:     "1px solid #1f2937",
        animation:  "card-enter 0.22s cubic-bezier(0.22,1,0.36,1) both",
      }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: (hasImage || isRunning) ? "1px solid #1f2937" : "none" }}>
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(148,163,184,0.07)", border: "1px solid #1f2937" }}>
          {isRunning
            ? <Loader2 style={{ width: 12, height: 12, color: "#94a3b8" }} className="animate-spin" />
            : <Camera  style={{ width: 12, height: 12, color: "#94a3b8" }} />}
        </div>
        <span className="text-[11px] font-medium flex-1" style={{ color: "rgba(203,213,225,0.85)" }}>
          {isRunning ? "Capturing screenshot…" : "Screenshot captured"}
        </span>
        {url && !isRunning && (
          <a href={url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] transition-colors hover:bg-white/[0.06]"
            style={{ color: "#94a3b8", border: "1px solid #1f2937" }}
            data-testid="button-screenshot-open">
            <ExternalLink style={{ width: 9, height: 9 }} /> Open
          </a>
        )}
      </div>

      {/* Loading skeleton */}
      {isRunning && (
        <div className="px-3 py-3">
          <div className="rounded-md" style={{ height: 120, background: "rgba(148,163,184,0.04)", border: "1px solid #1f2937", animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
      )}

      {/* Image preview */}
      {imgSrc && !isRunning && (
        <div className="px-3 pb-2.5 pt-2">
          {!imgLoaded && !imgError && (
            <div className="rounded-md" style={{ height: 120, background: "rgba(148,163,184,0.04)", border: "1px solid #1f2937", animation: "pulse 1.5s ease-in-out infinite" }} />
          )}
          <img
            src={imgSrc}
            alt="Screenshot preview"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className="w-full rounded-md object-cover"
            style={{
              maxHeight: 180,
              border:    "1px solid #1f2937",
              display:   imgLoaded ? "block" : "none",
            }}
            data-testid="img-screenshot-preview"
          />
          {imgError && (
            <p className="text-[10px] py-2 text-center" style={{ color: "rgba(100,116,139,0.5)" }}>
              Image could not be loaded
            </p>
          )}
        </div>
      )}

      {/* URL bar */}
      {url && !isRunning && (
        <div className="px-3 pb-2">
          <span className="text-[9.5px] font-mono truncate block"
            style={{ color: "rgba(100,116,139,0.5)" }}>{url}</span>
        </div>
      )}
    </div>
  );
}
