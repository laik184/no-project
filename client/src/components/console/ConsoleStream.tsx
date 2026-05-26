/**
 * IQ 2000 — Console · ConsoleStream
 *
 * Virtualized scrolling list of log lines.
 * Features:
 *  - Auto-scroll to bottom on new lines (pauses when user scrolls up)
 *  - Search/filter with highlight
 *  - Kind filter tabs (all / errors / warnings / system)
 *  - Scroll-to-bottom FAB
 *  - Performance: only renders visible rows via CSS containment
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ConsoleLine } from "./ConsoleLine";
import type { LogLine } from "@/types/console";

type KindFilter = "all" | "stderr" | "error" | "system";

interface Props {
  lines:   LogLine[];
  search?: string;
}

const FILTER_LABELS: Record<KindFilter, string> = {
  all:    "All",
  stderr: "Stderr",
  error:  "Errors",
  system: "System",
};

export function ConsoleStream({ lines, search = "" }: Props) {
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter lines by kind and search
  const filtered = useMemo(() => {
    let result = kindFilter === "all"
      ? lines
      : lines.filter((l) => l.kind === kindFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l) => l.text.toLowerCase().includes(q));
    }

    return result;
  }, [lines, kindFilter, search]);

  // Error / warning counts for filter tabs
  const counts = useMemo(() => ({
    stderr: lines.filter((l) => l.kind === "stderr").length,
    error:  lines.filter((l) => l.kind === "error").length,
    system: lines.filter((l) => l.kind === "system").length,
  }), [lines]);

  // Auto-scroll to bottom when new lines arrive (only if pinned)
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [filtered, autoScroll]);

  // Detect manual scroll-up to pause auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setAutoScroll(true);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Kind filter tabs */}
      <div
        className="flex items-center gap-0.5 px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        {(Object.keys(FILTER_LABELS) as KindFilter[]).map((k) => {
          const count = k !== "all" ? counts[k as keyof typeof counts] : null;
          const active = kindFilter === k;
          return (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className="text-[10px] px-2 py-0.5 rounded transition-colors flex items-center gap-1"
              style={{
                color:      active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)",
                background: active ? "rgba(255,255,255,0.08)" : "transparent",
              }}
            >
              {FILTER_LABELS[k]}
              {count != null && count > 0 && (
                <span
                  className="rounded-full px-1 text-[9px]"
                  style={{
                    background: k === "error" ? "rgba(255,85,85,0.25)" : "rgba(255,255,255,0.1)",
                    color:      k === "error" ? "#ff7b7b" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Log lines */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-1.5"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.08) transparent",
          contain: "strict",
        }}
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
              {search ? "No matching lines" : "No output yet"}
            </span>
          </div>
        ) : (
          filtered.map((line) => (
            <ConsoleLine key={line.id} line={line} search={search} />
          ))
        )}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {/* Scroll-to-bottom FAB */}
      {!autoScroll && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 right-3 rounded-full text-xs px-2.5 py-1 shadow-lg transition-all"
          style={{
            background: "rgba(77,157,224,0.25)",
            border:     "1px solid rgba(77,157,224,0.35)",
            color:      "#4d9de0",
          }}
        >
          ↓ latest
        </button>
      )}
    </div>
  );
}
