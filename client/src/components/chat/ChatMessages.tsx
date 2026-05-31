import { useRef, useEffect } from "react";
import { Bot, Sparkles, MessageSquarePlus } from "lucide-react";
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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(124,141,255,0.08)", border: "1px solid rgba(124,141,255,0.18)" }}>
            <MessageSquarePlus className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-1.5">New chat with Agent</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed px-2">
              Agent can make changes, review its work, and debug itself automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestedPrompts.map((prompt) => (
              <button key={prompt} onClick={() => onSelectPrompt(prompt)}
                className="px-3 py-1.5 rounded-lg text-[11px] text-white/75 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
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
        return (
          <div key={i} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5"
              style={msg.role === "agent" ? { background: "linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)" } : { background: "rgba(255,255,255,0.1)" }}>
              {msg.role === "agent" ? <Bot className="h-3 w-3 text-white" /> : <span className="text-foreground">U</span>}
            </div>
            {msg.role === "agent" ? (
              <div className="flex-1 min-w-0 py-0.5" data-testid={`message-agent-${i}`}>
                <AgentMarkdown content={msg.content} />
                {msg.isStreaming && (
                  <>
                    <style>{`
                      @keyframes stream-cursor { 0%,100%{opacity:1} 50%{opacity:0} }
                      .stream-cursor { animation: stream-cursor 0.8s ease-in-out infinite; }
                    `}</style>
                    <span className="stream-cursor inline-block w-[2px] h-[13px] ml-0.5 rounded-sm align-middle" style={{ background: "#7c8dff", verticalAlign: "text-bottom" }} />
                  </>
                )}
              </div>
            ) : (
              <div className="max-w-[82%] px-3 py-2 rounded-2xl text-[11.5px] leading-relaxed"
                style={{ background: "rgba(124,141,255,0.18)", border: "1px solid rgba(124,141,255,0.28)", color: "rgba(226,232,240,1)" }}
                data-testid={`message-user-${i}`}>
                {msg.content}
              </div>
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
            style={{ background: "linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)", boxShadow: "0 0 10px rgba(124,141,255,0.35)" }}>
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <div className="typing-wrapper flex flex-col gap-1.5 px-3.5 py-2.5 rounded-2xl rounded-tl-sm"
            style={{ background: "rgba(124,141,255,0.07)", border: "1px solid rgba(124,141,255,0.2)" }}>
            <span className="text-[11px] font-semibold" style={{ color: "rgba(167,139,250,0.95)" }}>Responding</span>
            <div className="flex items-center gap-[4px]">
              <span className="typing-dot-1 w-[5px] h-[5px] rounded-full block" style={{ background: "rgba(167,139,250,0.9)" }} />
              <span className="typing-dot-2 w-[5px] h-[5px] rounded-full block" style={{ background: "rgba(167,139,250,0.9)" }} />
              <span className="typing-dot-3 w-[5px] h-[5px] rounded-full block" style={{ background: "rgba(167,139,250,0.9)" }} />
            </div>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
