/**
 * TerminalCard — Phase 3 (T6): terminal output replay button added.
 * Replay animates stdout lines sequentially with per-line delay.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { TerminalSquare, Copy, CheckCircle2, XCircle, Clock, Play, Square } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

function exitBadge(code: number) {
  const ok = code === 0;
  return (
    <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded"
      style={{
        background: ok ? "rgba(74,222,128,0.1)"  : "rgba(248,113,113,0.1)",
        color:      ok ? "#4ade80"               : "#f87171",
        border:     `1px solid ${ok ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
      }}>
      {ok ? <CheckCircle2 style={{ width: 9, height: 9 }} /> : <XCircle style={{ width: 9, height: 9 }} />}
      exit {code}
    </span>
  );
}

const REPLAY_LINE_DELAY_MS = 55; // ms per line

interface TerminalCardProps {
  item: AgentStreamItem;
}

export function TerminalCard({ item }: TerminalCardProps) {
  const [copied,      setCopied]      = useState(false);
  const [replayLines, setReplayLines] = useState<string[] | null>(null); // null = not replaying
  const outputRef  = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const command    = (item.meta?.file as string | undefined) ?? item.content;
  const allStdout  = (item.meta?.stdout as string[] | undefined)
    ?? (item.meta?.logs ? String(item.meta.logs).split("\n") : []);
  const exitCode   = item.meta?.exitCode   as number | undefined;
  const durationMs = item.meta?.durationMs as number | undefined;

  // Use replay lines when replaying, otherwise full stdout
  const visibleLines = replayLines ?? allStdout;

  // Auto-scroll on new lines
  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleLines.length]);

  // Clean up interval on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const stopReplay = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setReplayLines(null);
  }, []);

  const startReplay = useCallback(() => {
    if (!allStdout.length) return;
    setReplayLines([]);
    let idx = 0;
    timerRef.current = setInterval(() => {
      idx++;
      setReplayLines(allStdout.slice(0, idx));
      if (idx >= allStdout.length) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        // Leave replayLines set so the full output stays visible; reset after brief pause
        setTimeout(() => setReplayLines(null), 800);
      }
    }, REPLAY_LINE_DELAY_MS);
  }, [allStdout]);

  const isReplaying = replayLines !== null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(allStdout.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div
      className="rounded-lg overflow-hidden"
      data-testid="terminal-card"
      style={{
        background: "rgba(163,230,53,0.04)",
        border:     "1px solid rgba(163,230,53,0.14)",
        animation:  "card-enter 0.22s cubic-bezier(0.22,1,0.36,1) both",
      }}>

      {/* Command header */}
      <div className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid rgba(163,230,53,0.09)" }}>
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(163,230,53,0.1)", border: "1px solid rgba(163,230,53,0.2)" }}>
          <TerminalSquare style={{ width: 12, height: 12, color: "#a3e635" }} />
        </div>
        <span className="flex-1 text-[11px] font-mono truncate" style={{ color: "rgba(163,230,53,0.9)" }}>
          <span style={{ color: "rgba(163,230,53,0.4)" }}>$ </span>{command}
        </span>
      </div>

      {/* Output area */}
      {visibleLines.length > 0 && (
        <div
          ref={outputRef}
          className="overflow-y-auto text-[9.5px] font-mono leading-relaxed px-3 py-2"
          style={{
            maxHeight: 140, background: "rgba(0,0,0,0.35)",
            color: "rgba(148,163,184,0.75)", whiteSpace: "pre-wrap", overflowX: "hidden",
          }}>
          {visibleLines.map((line, i) => (
            <div key={i} style={{ animation: isReplaying ? "card-enter 0.1s ease both" : "none" }}>
              {line}
            </div>
          ))}
          {/* Blinking cursor during replay */}
          {isReplaying && (
            <span style={{ animation: "blink 0.8s step-end infinite", color: "#a3e635" }}>▋</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {exitCode !== undefined && exitBadge(exitCode)}
        {durationMs !== undefined && (
          <span className="flex items-center gap-1 text-[9px]" style={{ color: "rgba(100,116,139,0.5)" }}>
            <Clock style={{ width: 9, height: 9 }} />
            {durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`}
          </span>
        )}
        <div className="flex-1" />

        {/* T6 — Replay button (shown when output exists and not currently running) */}
        {allStdout.length > 0 && item.status !== "running" && (
          <button
            onClick={isReplaying ? stopReplay : startReplay}
            className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors hover:bg-white/[0.06]"
            style={{ color: isReplaying ? "#f87171" : "rgba(163,230,53,0.6)" }}
            data-testid="button-terminal-replay"
            title={isReplaying ? "Stop replay" : "Replay output"}>
            {isReplaying
              ? <Square style={{ width: 9, height: 9 }} />
              : <Play  style={{ width: 9, height: 9 }} />}
            {isReplaying ? "Stop" : "Replay"}
          </button>
        )}

        {allStdout.length > 0 && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors hover:bg-white/[0.06]"
            style={{ color: copied ? "#4ade80" : "rgba(100,116,139,0.5)" }}
            data-testid="button-terminal-copy">
            <Copy style={{ width: 9, height: 9 }} />
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}
