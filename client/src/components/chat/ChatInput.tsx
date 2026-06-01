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
  const [showPopup, setShowPopup]         = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [model, setModel]                 = useState("Economy");
  const [planMode, setPlanMode]           = useState(false);
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
    /* Outer wrapper: reduced vertical padding (was px-3 pb-3 pt-2) */
    <div className="px-3 pb-2 pt-1 flex-shrink-0">
      {/* Container: rounded-xl (was rounded-2xl) */}
      <div
        className="rounded-xl overflow-visible transition-all duration-200"
        style={{
          background: "#1a1f2e",
          border: isBusy ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Textarea: pt-2 pb-0.5 (was pt-3 pb-1), minHeight 34 (was 46), maxHeight 120 (was 140) */}
        <textarea
          ref={chatInputRef}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isBusy ? (isAgentThinking ? "Agent is working…" : "Agent is responding…") : "Make, test, iterate..."}
          disabled={isBusy}
          rows={1}
          className="w-full bg-transparent px-4 pt-2 pb-0.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: 34, maxHeight: 120 }}
          data-testid="input-chat"
        />

        {/* Toolbar: pb-1.5 pt-0.5 (was pb-2.5 pt-0.5) */}
        <div className="flex items-center justify-between px-2 pb-1.5 pt-0.5">

          {/* Left: + and cursor icon — gap-0.5 (was gap-1) */}
          <div className="flex items-center gap-0.5">

            {/* + popup — w-6 h-6 (was w-7 h-7) */}
            <div ref={popupRef} className="relative">
              <button
                onClick={() => setShowPopup((v) => !v)}
                className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
                data-testid="button-chat-add"
              >
                <Plus className="h-3.5 w-3.5" />
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

            {/* Cursor/selection icon — w-6 h-6 (was w-7 h-7) */}
            <button
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
              title="Select context"
            >
              <MousePointer2 className="h-3 w-3" />
            </button>
          </div>

          {/* Right: model selector, plan toggle, mic, divider, send — gap-1 (was gap-1.5) */}
          <div className="flex items-center gap-1">

            {/* Economy model selector — h-6 (was h-7) */}
            <div ref={modelMenuRef} className="relative">
              <button
                onClick={() => setShowModelMenu((v) => !v)}
                className="flex items-center gap-1 px-1.5 h-6 rounded-md text-[11px] font-medium transition-colors hover:bg-white/6"
                style={{ color: "#94A3B8", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
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
                <ChevronDown className="h-2 w-2" />
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

            {/* Plan toggle — h-6 (was h-7), dot w-3 h-3 (was w-3.5 h-3.5) */}
            <button
              onClick={() => setPlanMode((v) => !v)}
              className="flex items-center gap-1 px-1.5 h-6 rounded-md text-[11px] font-medium transition-all"
              style={{
                color: planMode ? "#E5E7EB" : "#94A3B8",
                border: `1px solid ${planMode ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                background: planMode ? "rgba(59,130,246,0.12)" : "transparent",
              }}
              title="Plan mode"
            >
              <div
                className="w-3 h-3 rounded-full border flex-shrink-0 transition-all"
                style={{
                  borderColor: planMode ? "#3B82F6" : "rgba(255,255,255,0.3)",
                  background: planMode ? "#3B82F6" : "transparent",
                }}
              />
              <span>Plan</span>
            </button>

            {/* Mic — w-6 h-6 (was w-7 h-7) */}
            <button
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
              title="Voice input"
            >
              <Mic className="h-3 w-3" />
            </button>

            {/* Divider */}
            <div className="w-px h-3.5 flex-shrink-0 mx-0.5" style={{ background: "rgba(255,255,255,0.1)" }} />

            {/* Send / Stop — w-7 h-7 (was w-8 h-8) */}
            {isBusy ? (
              <button
                onClick={onStop}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80 active:scale-95"
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
                  "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200",
                  chatInput.trim()
                    ? "text-white hover:opacity-90 active:scale-95"
                    : "text-muted-foreground/30 cursor-not-allowed"
                )}
                style={
                  chatInput.trim()
                    ? { background: "linear-gradient(135deg, #3B82F6, #2563EB)", boxShadow: "0 0 10px rgba(59,130,246,0.35)" }
                    : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }
                }
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
