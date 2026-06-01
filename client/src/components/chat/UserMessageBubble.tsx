import { useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";

const COLLAPSE_THRESHOLD = 120;

interface UserMessageBubbleProps {
  content: string;
  index:   number;
}

export function UserMessageBubble({ content, index }: UserMessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const safeContent = content ?? "";
  const isLong = safeContent.length > COLLAPSE_THRESHOLD;

  if (!isLong) {
    return (
      <div
        className="max-w-[82%] px-3 py-2 rounded-2xl text-[11.5px] leading-relaxed"
        style={{ background: "#1A2230", border: "1px solid #263244", color: "#E5E7EB" }}
        data-testid={`message-user-${index}`}
      >
        {safeContent}
      </div>
    );
  }

  const preview = safeContent.slice(0, COLLAPSE_THRESHOLD).trimEnd();

  return (
    <div
      className="max-w-[88%] rounded-xl overflow-hidden text-[11.5px]"
      style={{ border: "1px solid #263244", background: "#111827" }}
      data-testid={`message-user-${index}`}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5"
        style={{ background: "#1A2230", borderBottom: "1px solid #263244" }}>
        <FileText className="h-3 w-3 flex-shrink-0" style={{ color: "#3B82F6" }} />
        <span className="text-[10px] font-medium" style={{ color: "#64748B" }}>Message</span>
        <span className="ml-auto text-[10px]" style={{ color: "#475569" }}>
          {safeContent.split(/\s+/).filter(Boolean).length} words
        </span>
      </div>

      <div className="px-3 py-2.5" style={{ color: "#CBD5E1" }}>
        <p className="leading-relaxed whitespace-pre-wrap break-words">
          {expanded ? safeContent : (
            <>{preview}<span style={{ color: "#475569" }}>…</span></>
          )}
        </p>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors hover:bg-white/5"
        style={{ color: "#3B82F6", borderTop: "1px solid #1E293B" }}
      >
        {expanded
          ? <><ChevronUp className="h-3 w-3" /> Show less</>
          : <><ChevronDown className="h-3 w-3" /> Show more</>
        }
      </button>
    </div>
  );
}
