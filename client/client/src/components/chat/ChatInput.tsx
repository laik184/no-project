import { useState, useRef, useEffect } from "react";
import { Plus, Paperclip, ImageIcon, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentsButton } from "@/components/agent/AgentsHub";

interface ChatInputProps {
  chatInput: string;
  setChatInput: (v: string) => void;
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
  isAgentThinking: boolean;
  isAgentTyping: boolean;
  onSend: () => void;
  onStop: () => void;
}

export function ChatInput({ chatInput, setChatInput, chatInputRef, isAgentThinking, isAgentTyping, onSend, onStop }: ChatInputProps) {
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const isBusy = isAgentThinking || isAgentTyping;

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const projectId = Number(window.localStorage.getItem("nura.projectId") || "1") || 1;
    const fd = new FormData();
    fd.append("projectId", String(projectId));
    Array.from(fileList).forEach((f) => fd.append("files", f));
    try {
      await fetch("/api/chat/upload", { method: "POST", body: fd });
    } catch (err) {
      console.warn("[chat] file upload failed:", err);
    }
    e.target.value = "";
  };

  useEffect(() => {
    if (!showPopup) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setShowPopup(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopup]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div className="p-3 border-t flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="rounded-xl transition-all duration-300"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: isBusy ? "1px solid rgba(124,141,255,0.4)" : "1px solid rgba(255,255,255,0.09)",
          boxShadow: isBusy ? "0 0 0 3px rgba(124,141,255,0.08), 0 4px 20px rgba(0,0,0,0.2)" : "0 4px 20px rgba(0,0,0,0.2)",
        }}>
        <textarea ref={chatInputRef} value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isBusy ? (isAgentThinking ? "Agent is working…" : "Agent is responding…") : "Make, test, iterate..."}
          disabled={isBusy} rows={1}
          className="w-full bg-transparent px-3 pt-3 text-xs text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: 42, maxHeight: 120 }}
          data-testid="input-chat" />

        <div className="flex items-center justify-between px-2 pb-2 pt-0.5">
          <div className="flex items-center gap-1.5">
            <div ref={popupRef} className="relative">
              <button onClick={() => setShowPopup((v) => !v)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
                data-testid="button-chat-add">
                <Plus className="h-3.5 w-3.5" />
              </button>
              {showPopup && (
                <div className="absolute bottom-full left-0 mb-2 z-50 overflow-hidden"
                  style={{ width: 175, background: "rgba(13,13,28,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, boxShadow: "0 -4px 32px rgba(0,0,0,0.5)" }}>
                  <label data-testid="button-chat-popup-upload-file"
                    className="flex items-center gap-3 w-full px-4 py-3 text-left text-xs text-white/75 hover:bg-white/6 hover:text-white transition-colors cursor-pointer"
                    onClick={() => setShowPopup(false)}>
                    <input type="file" multiple accept=".pdf,.zip,.tar,.gz,.txt,.csv,.json,.md" className="hidden" onChange={handleFilesChange} />
                    <Paperclip className="h-3.5 w-3.5 text-[#7c8dff] flex-shrink-0" />
                    <span>Upload File</span>
                  </label>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 12px" }} />
                  <label data-testid="button-chat-popup-upload-photo"
                    className="flex items-center gap-3 w-full px-4 py-3 text-left text-xs text-white/75 hover:bg-white/6 hover:text-white transition-colors cursor-pointer"
                    onClick={() => setShowPopup(false)}>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleFilesChange} />
                    <ImageIcon className="h-3.5 w-3.5 text-[#a78bfa] flex-shrink-0" />
                    <span>Upload Photo</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isBusy && <AgentsButton size="sm" />}
            {isBusy ? (
              <button onClick={onStop}
                className="flex items-center gap-1 px-2 h-6 rounded-lg text-[10px] font-semibold text-white transition-all hover:opacity-80 active:scale-95"
                style={{ background: "rgba(239,68,68,0.85)", boxShadow: "0 0 10px rgba(239,68,68,0.4)" }}
                data-testid="button-stop-agent-input">
                <div className="w-2 h-2 rounded-sm bg-white flex-shrink-0" />Stop
              </button>
            ) : (
              <button onClick={onSend} disabled={!chatInput.trim()}
                className={cn("w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200",
                  chatInput.trim() ? "text-white hover:opacity-90" : "bg-white/5 text-muted-foreground/50 cursor-not-allowed")}
                style={chatInput.trim() ? { background: "linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)", boxShadow: "0 0 12px rgba(124,141,255,0.4)" } : {}}
                data-testid="button-chat-send">
                <Send className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
