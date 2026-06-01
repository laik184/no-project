import { useRef, useEffect } from "react";
import { Bot, Cpu, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentMarkdown   } from "@/components/agent/AgentMarkdown";
import { CheckpointCard  } from "@/components/panels/CheckpointCard";
import { FileDiffCard    } from "@/components/diff/FileDiffCard";
import { ThinkingBubble, LiveActionBar } from "./LiveActionBar";
import { QuestionCard    } from "./QuestionCard";
import { ActionGroup     } from "./ActionGroup";
import { PlanningCard    } from "./cards/PlanningCard";
import { UserMessageBubble } from "./UserMessageBubble";
import { TypingIndicator   } from "./TypingIndicator";
import type { ChatMessage  } from "./types";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface ChatMessagesProps {
  messages:          ChatMessage[];
  isAgentThinking:   boolean;
  isAgentTyping:     boolean;
  activeAction:      AgentStreamItem | null;
  showNewChatScreen: boolean;
  suggestedPrompts:  string[];
  onOpenFile:        (path: string) => void;
  onAnswer:          (questionId: string, runId: string, answer: string) => void;
  onSelectPrompt:    (prompt: string) => void;
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
        if (msg.role === "question")   return <QuestionCard key={i} data={msg.question} onAnswer={onAnswer} />;
        if (msg.role === "plan")        return <PlanningCard key={i} plan={msg.plan} />;
        if (msg.role === "tool_group")  return <ActionGroup key={i} actions={msg.actions} onOpenFile={onOpenFile} />;

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
      {isAgentTyping && <TypingIndicator />}

      <div ref={endRef} />
    </div>
  );
}
