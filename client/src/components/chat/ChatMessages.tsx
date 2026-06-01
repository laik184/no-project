import { useRef, useEffect, useState } from "react";
import { Bot, MessageSquarePlus, Cpu, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentMarkdown } from "@/components/agent/AgentMarkdown";
import { CheckpointCard } from "@/components/panels/CheckpointCard";
import { FileDiffCard } from "@/components/diff/FileDiffCard";
import { ThinkingBubble, LiveActionBar } from "./LiveActionBar";
import { QuestionCard } from "./QuestionCard";
import { ActionGroup } from "./ActionGroup";
import { PlanningCard } from "./cards/PlanningCard";
import type { ChatMessage } from "./types";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

// Threshold: if message longer than this, show as collapsible card
const COLLAPSE_THRESHOLD = 120;

function UserMessageBubble({ content, index }: { content: string; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > COLLAPSE_THRESHOLD;

  // Short message — plain bubble (existing style)
  if (!isLong) {
    return (
      <div
        className="max-w-[82%] px-3 py-2 rounded-2xl text-[11.5px] leading-relaxed"
        style={{ background: "#1A2230", border: "1px solid #263244", color: "#E5E7EB" }}
        data-testid={`message-user-${index}`}
      >
        {content}
      </div>
    );
  }

  // Long message — collapsible file-style card
  const preview = content.slice(0, COLLAPSE_THRESHOLD).trimEnd();

  return (
    <div
      className="max-w-[88%] rounded-xl overflow-hidden text-[11.5px]"
      style={{ border: "1px solid #263244", background: "#111827" }}
      data-testid={`message-user-${index}`}
    >
      {/* Card header — file pill */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5"
        style={{ background: "#1A2230", borderBottom: "1px solid #263244" }}
      >
        <FileText className="h-3 w-3 flex-shrink-0" style={{ color: "#3B82F6" }} />
        <span className="text-[10px] font-medium" style={{ color: "#64748B" }}>Message</span>
        <span className="ml-auto text-[10px]" style={{ color: "#475569" }}>
          {content.split(/\s+/).filter(Boolean).length} words
        </span>
      </div>

      {/* Content area */}
      <div className="px-3 py-2.5" style={{ color: "#CBD5E1" }}>
        <p className="leading-relaxed whitespace-pre-wrap break-words">
          {expanded ? content : (
            <>
              {preview}
              <span style={{ color: "#475569" }}>…</span>
            </>
          )}
        </p>
      </div>

      {/* Expand / Collapse toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors hover:bg-white/5"
        style={{ color: "#3B82F6", borderTop: "1px solid #1E293B" }}
      >
        {expanded ? (
          <><ChevronUp className="h-3 w-3" /> Show less</>
        ) : (
          <><ChevronDown className="h-3 w-3" /> Show more</>
        )}
      </button>
    </div>
  );
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  isAgentThinking: boolean;
  isAgentTyping: boolean;
  activeAction: AgentStreamItem | null;
  showNewChatScreen: boolean;
  suggestedPrompts: string[];
  onOpenFile: (path: string) => void;
  onAnswer: (questionId: string, runId: string, answer: string) => void;
  onSelectPrompt: (prompt: string) => void;
}


export function ChatMessages({ messages, isAgentThinking, isAgentTyping, activeAction, showNewChatScreen, suggestedPrompts, onOpenFile, onAnswer, onSelectPrompt }: ChatMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAgentThinking]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
      {showNewChatScreen && (
        <div className="flex flex-col items-center justify-center flex-1 h-full gap-5 text-center px-2 py-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "#1A2230", border: "1px solid #263244" }}>
            <Cpu className="h-5 w-5" style={{ color: "#3B82F6" }} />
          </div>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "#E5E7EB" }}>New session</p>
            <p className="text-[11px] leading-relaxed px-2" style={{ color: "#94A3B8" }}>
              NURAX can make changes, review its work, and debug itself automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestedPrompts.map((prompt) => (
              <button key={prompt} onClick={() => onSelectPrompt(prompt)}
                className="px-3 py-1.5 rounded-lg text-[11px] transition-colors"
                style={{ background: "#1A2230", border: "1px solid #263244", color: "#94A3B8" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#E5E7EB"; (e.currentTarget as HTMLElement).style.borderColor = "#3B82F6"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; (e.currentTarget as HTMLElement).style.borderColor = "#263244"; }}
                data-testid={`button-new-chat-prompt-${prompt.replace(/\s+/g, "-").toLowerCase()}`}>
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {!showNewChatScreen && messages.map((msg, i) => {
        if (msg.role === "checkpoint") {
          const cpNumber = messages.slice(0, i + 1).filter((m) => m.role === "checkpoint").length;
          const isLatest = messages.slice(i + 1).every((m) => m.role !== "checkpoint");
          return <CheckpointCard key={i} data={msg.checkpoint} checkpointNumber={cpNumber} isLatest={isLatest} />;
        }
        if (msg.role === "diff") {
          return (
            <div key={i} className="flex flex-col gap-2" data-testid={`diff-group-${i}`}>
              {msg.diffs.map((diff, j) => <FileDiffCard key={j} diff={diff} />)}
            </div>
          );
        }
        if (msg.role === "question") {
          return <QuestionCard key={i} data={msg.question} onAnswer={onAnswer} />;
        }
        if (msg.role === "plan") {
          return <PlanningCard key={i} plan={msg.plan} />;
        }
        if (msg.role === "tool_group") {
          return (
            <ActionGroup
              key={i}
              actions={msg.actions}
              onOpenFile={onOpenFile}
            />
          );
        }
        const isBotRole = msg.role === "agent" || msg.role === "assistant";
        return (
          <div key={i} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            {isBotRole && (
              <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5"
                style={{ background: "#1A2230", border: "1px solid #263244" }}>
                <Bot className="h-3 w-3" style={{ color: "#3B82F6" }} />
              </div>
            )}
            {isBotRole ? (
              <div className="flex-1 min-w-0 py-0.5" data-testid={`message-${msg.role}-${i}`}>
                <AgentMarkdown content={msg.content} />
                {msg.isStreaming && (
                  <>
                    <style>{`
                      @keyframes stream-cursor { 0%,100%{opacity:1} 50%{opacity:0} }
                      .stream-cursor { animation: stream-cursor 0.8s ease-in-out infinite; }
                    `}</style>
                    <span className="stream-cursor inline-block w-[2px] h-[13px] ml-0.5 rounded-sm align-middle" style={{ background: "#3B82F6", verticalAlign: "text-bottom" }} />
                  </>
                )}
              </div>
            ) : (
              <UserMessageBubble content={msg.content} index={i} />
            )}
          </div>
        );
      })}

      {activeAction && activeAction.tool === "analysis.think" && !isAgentTyping && <ThinkingBubble />}
      {activeAction && activeAction.tool !== "analysis.think" && !isAgentTyping && <LiveActionBar action={activeAction} />}

      {isAgentTyping && (
        <div className="flex gap-2 items-start" data-testid="agent-typing-indicator">
          <style>{`
            @keyframes typing-bounce { 0%,60%,100%{transform:translateY(0) scale(0.7);opacity:0.35} 30%{transform:translateY(-4px) scale(1);opacity:1} }
            @keyframes typing-fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
            .typing-dot-1{animation:typing-bounce 1.1s ease-in-out infinite;animation-delay:0ms}
            .typing-dot-2{animation:typing-bounce 1.1s ease-in-out infinite;animation-delay:160ms}
            .typing-dot-3{animation:typing-bounce 1.1s ease-in-out infinite;animation-delay:320ms}
            .typing-wrapper{animation:typing-fade-in 0.2s cubic-bezier(0.22,1,0.36,1) both}
          `}</style>
          <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5"
            style={{ background: "#1A2230", border: "1px solid #263244" }}>
            <Bot className="h-3 w-3" style={{ color: "#3B82F6" }} />
          </div>
          <div className="typing-wrapper flex flex-col gap-1.5 px-3.5 py-2.5 rounded-2xl rounded-tl-sm"
            style={{ background: "#111827", border: "1px solid #263244" }}>
            <span className="text-[11px] font-semibold" style={{ color: "#94A3B8" }}>Responding</span>
            <div className="flex items-center gap-[4px]">
              <span className="typing-dot-1 w-[5px] h-[5px] rounded-full block" style={{ background: "#3B82F6" }} />
              <span className="typing-dot-2 w-[5px] h-[5px] rounded-full block" style={{ background: "#3B82F6" }} />
              <span className="typing-dot-3 w-[5px] h-[5px] rounded-full block" style={{ background: "#3B82F6" }} />
            </div>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
