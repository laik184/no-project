import { useState, useRef, useEffect } from "react";
import { Plus, MousePointer2, ChevronDown, Mic, ArrowUp, Paperclip, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MODELS = ["Economy", "Balanced", "Pro", "Max"];

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
  const [showPopup, setShowPopup]       = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [model, setModel]               = useState("Economy");
  const [planMode, setPlanMode]         = useState(false);
  const popupRef     = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const isBusy = isAgentThinking || isAgentTyping;

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const projectId = Number(window.localStorage.getItem("nura.projectId") || "1") || 1;
    const fd = new FormData();
    fd.append("projectId", String(projectId));
    Array.from(fileList).forEach((f) => fd.append("files", f));
    try { await fetch("/api/chat/upload", { method: "POST", body: fd }); } catch {}
    e.target.value = "";
  };

  useEffect(() => {
    if (!showPopup && !showModelMenu) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setShowPopup(false);
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) setShowModelMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopup, showModelMenu]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div className="px-3 pb-3 pt-2 flex-shrink-0">
      <div
        className="rounded-2xl overflow-visible transition-all duration-200"
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
          className="w-full bg-transparent px-4 pt-3 pb-1 text-[13px] text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: 46, maxHeight: 140 }}
          data-testid="input-chat"
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2.5 pb-2.5 pt-0.5">

          {/* Left: + and cursor icon */}
          <div className="flex items-center gap-1">
            {/* + popup */}
            <div ref={popupRef} className="relative">
              <button
                onClick={() => setShowPopup((v) => !v)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
                data-testid="button-chat-add"
              >
                <Plus className="h-4 w-4" />
              </button>
              {showPopup && (
                <div
                  className="absolute bottom-full left-0 mb-2 z-50 overflow-hidden"
                  style={{ width: 175, background: "#0B0F14", border: "1px solid #263244", borderRadius: 12, boxShadow: "0 -4px 32px rgba(0,0,0,0.5)" }}
                >
                  <label
                    className="flex items-center gap-3 w-full px-4 py-3 text-left text-xs hover:bg-white/6 transition-colors cursor-pointer"
                    style={{ color: "#94A3B8" }}
                    onClick={() => setShowPopup(false)}
                    data-testid="button-chat-popup-upload-file"
                  >
                    <input type="file" multiple accept=".pdf,.zip,.tar,.gz,.txt,.csv,.json,.md" className="hidden" onChange={handleFilesChange} />
                    <Paperclip className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#3B82F6" }} />
                    <span>Upload File</span>
                  </label>
                  <div style={{ height: 1, background: "#263244", margin: "0 12px" }} />
                  <label
                    className="flex items-center gap-3 w-full px-4 py-3 text-left text-xs hover:bg-white/6 transition-colors cursor-pointer"
                    style={{ color: "#94A3B8" }}
                    onClick={() => setShowPopup(false)}
                    data-testid="button-chat-popup-upload-photo"
                  >
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleFilesChange} />
                    <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#94A3B8" }} />
                    <span>Upload Photo</span>
                  </label>
                </div>
              )}
            </div>

            {/* Cursor/selection icon */}
            <button
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
              title="Select context"
            >
              <MousePointer2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Right: model selector, plan toggle, mic, send */}
          <div className="flex items-center gap-1.5">

            {/* Economy model selector */}
            <div ref={modelMenuRef} className="relative">
              <button
                onClick={() => setShowModelMenu((v) => !v)}
                className="flex items-center gap-1.5 px-2 h-7 rounded-lg text-[11px] font-medium transition-colors hover:bg-white/6"
                style={{ color: "#94A3B8", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="2.5" cy="2.5" r="1.2" fill="currentColor" />
                  <circle cx="6"   cy="2.5" r="1.2" fill="currentColor" />
                  <circle cx="9.5" cy="2.5" r="1.2" fill="currentColor" />
                  <circle cx="2.5" cy="6"   r="1.2" fill="currentColor" />
                  <circle cx="6"   cy="6"   r="1.2" fill="currentColor" />
                  <circle cx="9.5" cy="6"   r="1.2" fill="currentColor" />
                  <circle cx="2.5" cy="9.5" r="1.2" fill="currentColor" />
                  <circle cx="6"   cy="9.5" r="1.2" fill="currentColor" />
                  <circle cx="9.5" cy="9.5" r="1.2" fill="currentColor" />
                </svg>
                <span>{model}</span>
                <ChevronDown className="h-2.5 w-2.5" />
              </button>
              {showModelMenu && (
                <div
                  className="absolute bottom-full right-0 mb-2 z-50 overflow-hidden"
                  style={{ width: 130, background: "#0B0F14", border: "1px solid #263244", borderRadius: 10, boxShadow: "0 -4px 24px rgba(0,0,0,0.5)" }}
                >
                  {MODELS.map((m) => (
                    <button
                      key={m}
                      onClick={() => { setModel(m); setShowModelMenu(false); }}
                      className="flex items-center justify-between w-full px-3.5 py-2.5 text-left text-xs hover:bg-white/6 transition-colors"
                      style={{ color: m === model ? "#E5E7EB" : "#94A3B8" }}
                    >
                      {m}
                      {m === model && <span style={{ color: "#3B82F6", fontSize: 9 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Plan toggle */}
            <button
              onClick={() => setPlanMode((v) => !v)}
              className="flex items-center gap-1.5 px-2 h-7 rounded-lg text-[11px] font-medium transition-all"
              style={{
                color: planMode ? "#E5E7EB" : "#94A3B8",
                border: `1px solid ${planMode ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                background: planMode ? "rgba(59,130,246,0.12)" : "transparent",
              }}
              title="Plan mode"
            >
              <div
                className="w-3.5 h-3.5 rounded-full border flex-shrink-0 transition-all"
                style={{
                  borderColor: planMode ? "#3B82F6" : "rgba(255,255,255,0.3)",
                  background: planMode ? "#3B82F6" : "transparent",
                }}
              />
              <span>Plan</span>
            </button>

            {/* Mic */}
            <button
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
              title="Voice input"
            >
              <Mic className="h-3.5 w-3.5" />
            </button>

            {/* Send / Stop */}
            {isBusy ? (
              <button
                onClick={onStop}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                style={{ background: "rgba(239,68,68,0.85)" }}
                data-testid="button-stop-agent-input"
              >
                <div className="w-2.5 h-2.5 rounded-sm bg-white flex-shrink-0" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!chatInput.trim()}
                className={cn(
                  "w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-200",
                  chatInput.trim()
                    ? "text-white hover:opacity-90 active:scale-95"
                    : "text-muted-foreground/40 cursor-not-allowed"
                )}
                style={chatInput.trim() ? { background: "#2563EB" } : { background: "rgba(255,255,255,0.06)" }}
                data-testid="button-chat-send"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
