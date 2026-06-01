import { useState } from "react";
import { MousePointer2, Mic, ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentModeMenu } from "./AgentModeMenu";
import { UploadPopup   } from "./UploadPopup";

interface ChatInputProps {
  chatInput:       string;
  setChatInput:    (v: string) => void;
  chatInputRef:    React.RefObject<HTMLTextAreaElement>;
  isAgentThinking: boolean;
  isAgentTyping:   boolean;
  onSend:          () => void;
  onStop:          () => void;
}

export function ChatInput({ chatInput, setChatInput, chatInputRef, isAgentThinking, isAgentTyping, onSend, onStop }: ChatInputProps) {
  const [mode,     setMode]     = useState("Economy");
  const [planMode, setPlanMode] = useState(false);
  const isBusy = isAgentThinking || isAgentTyping;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div className="px-3 pb-2 pt-1 flex-shrink-0">
      <div
        className="rounded-xl overflow-visible transition-all duration-200 relative"
        style={{
          background: "#1a1f2e",
          border: isBusy ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Textarea */}
        <textarea
          ref={chatInputRef}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isBusy ? (isAgentThinking ? "Agent is working…" : "Agent is responding…") : "Make, test, iterate..."}
          disabled={isBusy}
          rows={1}
          className="w-full bg-transparent pl-4 pr-11 pt-2 pb-0.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: 34, maxHeight: 120 }}
          data-testid="input-chat"
        />

        {/* Send / Stop */}
        <div className="absolute bottom-1.5 right-2">
          {isBusy ? (
            <button
              onClick={onStop}
              className="rounded-lg flex items-center justify-center transition-all hover:opacity-80 active:scale-95"
              style={{ width: 25, height: 25, background: "rgba(239,68,68,0.85)" }}
              data-testid="button-stop-agent-input"
            >
              <Square className="h-3 w-3 fill-white text-white" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!chatInput.trim()}
              className={cn(
                "rounded-lg flex items-center justify-center transition-all duration-200",
                chatInput.trim() ? "text-white hover:opacity-90 active:scale-95" : "text-muted-foreground/30 cursor-not-allowed"
              )}
              style={{
                width: 25, height: 25,
                ...(chatInput.trim()
                  ? { background: "linear-gradient(135deg, #3B82F6, #2563EB)", boxShadow: "0 0 10px rgba(59,130,246,0.35)" }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" })
              }}
              data-testid="button-chat-send"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 pb-1.5 pt-0.5">
          {/* Left */}
          <div className="flex items-center gap-0.5">
            <UploadPopup />
            <button
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
              title="Select context"
            >
              <MousePointer2 className="h-3 w-3" />
            </button>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1">
            <AgentModeMenu mode={mode} onSelect={setMode} />

            <button
              onClick={() => setPlanMode((v) => !v)}
              className="flex items-center gap-1 px-1.5 h-6 rounded-md text-[11px] font-medium transition-all"
              style={{
                color:      planMode ? "#E5E7EB" : "#94A3B8",
                border:     `1px solid ${planMode ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                background: planMode ? "rgba(59,130,246,0.12)" : "transparent",
              }}
              title="Plan mode"
            >
              <div
                className="w-3 h-3 rounded-full border flex-shrink-0 transition-all"
                style={{
                  borderColor: planMode ? "#3B82F6" : "rgba(255,255,255,0.3)",
                  background:  planMode ? "#3B82F6" : "transparent",
                }}
              />
              <span>Plan</span>
            </button>

            <button
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
              title="Voice input"
            >
              <Mic className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
