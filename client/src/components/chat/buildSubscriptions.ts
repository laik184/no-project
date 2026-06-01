/**
 * buildSubscriptions — factories for the per-run checkpoint + lifecycle SSE subscriptions.
 * Extracted from useAgentRunner to keep the hook under 180 lines.
 */
import type { ChatMessage } from "./types";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
type CheckpointMsg = Extract<ChatMessage, { role: "checkpoint" }>;

export interface CheckpointSubParams {
  runId:                 string;
  msg:                   string;
  lifecycleCompletedRef: { current: boolean };
  checkpointDataRef:     { current: CheckpointMsg | null };
  setMessages:           Setter<ChatMessage[]>;
  toast:                 (opts: { description: string; duration: number }) => void;
}

export interface LifecycleSubParams {
  runId:                 string;
  msg:                   string;
  runStartMs:            number;
  checkpointDataRef:     { current: CheckpointMsg | null };
  lifecycleCompletedRef: { current: boolean };
  setMessages:           Setter<ChatMessage[]>;
  setIsAgentThinking:    Setter<boolean>;
  setIsAgentTyping:      Setter<boolean>;
  setActiveAction:       Setter<AgentStreamItem | null>;
  finalizeStream:        () => void;
  flushGroup:            () => void;
  agentStreamRef:        { current: { close: () => void } | null };
  currentRunIdRef:       { current: string | null };
}

function makeCheckpointMsg(e: {
  checkpointId: string; timestamp: string; filesChanged: number;
  createdFiles: string[]; modifiedFiles: string[]; deletedFiles: string[];
  title: string; trigger?: string;
}): CheckpointMsg {
  const timeStr = new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return {
    role: "checkpoint",
    time: timeStr,
    checkpoint: {
      checkpointId:  e.checkpointId,
      label:         e.title,
      description:   "Saved progress at end of loop",
      time:          timeStr,
      createdAt:     e.timestamp,
      trigger:       e.trigger ?? "run_complete",
      filesChanged:  e.filesChanged,
      createdFiles:  e.createdFiles,
      modifiedFiles: e.modifiedFiles,
      deletedFiles:  e.deletedFiles,
    },
  };
}

export function buildCheckpointSubscription(p: CheckpointSubParams): (raw: unknown) => void {
  return (raw) => {
    try {
      const e = raw as {
        eventType: string; runId?: string; trigger?: string;
        checkpointId?: string; timestamp?: string; filesChanged?: number;
        createdFiles?: string[]; modifiedFiles?: string[]; deletedFiles?: string[];
        title?: string;
      };
      if (e.runId && e.runId !== p.runId) return;

      if (e.eventType === "checkpoint.created" && e.checkpointId) {
        const msg_ = makeCheckpointMsg({
          checkpointId:  e.checkpointId,
          timestamp:     e.timestamp ?? new Date().toISOString(),
          filesChanged:  e.filesChanged ?? 0,
          createdFiles:  e.createdFiles ?? [],
          modifiedFiles: e.modifiedFiles ?? [],
          deletedFiles:  e.deletedFiles ?? [],
          title:         e.title ?? p.msg.slice(0, 72),
          trigger:       e.trigger,
        });
        if (p.lifecycleCompletedRef.current) {
          p.setMessages((prev) => [...prev, msg_]);
        } else {
          p.checkpointDataRef.current = msg_;
        }
      } else if (e.eventType === "stable") {
        p.toast({
          description: `Safety snapshot saved${e.trigger ? ` (${e.trigger.replace(/_/g, " ")})` : ""}`,
          duration: 2500,
        });
      }
    } catch { /* skip */ }
  };
}

export function buildLifecycleSubscription(p: LifecycleSubParams): (raw: unknown) => void {
  return (raw) => {
    try {
      const e = raw as { status: string; runId?: string };
      if (e.runId !== p.runId) return;
      if (!["completed", "failed", "cancelled"].includes(e.status)) return;

      p.finalizeStream();
      p.flushGroup();
      p.agentStreamRef.current?.close();
      p.agentStreamRef.current  = null;
      p.currentRunIdRef.current = null;
      p.setIsAgentThinking(false);
      p.setIsAgentTyping(false);
      p.setActiveAction(null);
      p.lifecycleCompletedRef.current = true;

      const durationMs = Date.now() - p.runStartMs;

      p.setMessages((prev) => {
        const actionsCompleted = prev
          .filter((m) => m.role === "tool_group")
          .reduce((sum, m) => sum + (m.role === "tool_group" ? m.actions.length : 0), 0);
        const cpData = p.checkpointDataRef.current;
        const filesChanged = cpData
          ? (cpData.checkpoint.createdFiles?.length ?? 0) +
            (cpData.checkpoint.modifiedFiles?.length ?? 0) +
            (cpData.checkpoint.deletedFiles?.length ?? 0)
          : 0;
        const completionMsg: ChatMessage = {
          role: "completion",
          time: "just now",
          completion: { status: e.status as "completed" | "cancelled" | "failed", goal: p.msg, filesChanged, actionsCompleted, durationMs },
        };
        return [...prev, completionMsg, ...(cpData ? [cpData] : [])];
      });
    } catch { /* skip */ }
  };
}
