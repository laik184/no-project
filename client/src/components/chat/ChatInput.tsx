import { useState, useRef, useEffect } from "react";
import { Plus, MousePointer2, Mic, ArrowUp, Paperclip, ImageIcon, Square } from "lucide-react";
import { cn } from "@/lib/utils";

const MODES = [
  {
    id: "Lite",
    label: "Lite",
    description: "Lightweight and fast. Great for quick fixes, small edits, and simple tasks.",
  },
  {
    id: "Economy",
    label: "Economy",
    description: "Cost-optimized models for everyday tasks. Delivers a strong balance of speed and quality. Best mode for most builds.",
  },
  {
    id: "Power",
    label: "Power",
    badge: "Core",
    description: "High-performance models for complex tasks, advanced reasoning, and large-scale rewrites.",
  },
];

// 3x3 grid dots icon
function DotsGrid({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      {[2.5, 6, 9.5].flatMap((x) =>
        [2.5, 6, 9.5].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="currentColor" />
        ))
      )}
    </svg>
  );
}

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
  const [showPopup, setShowPopup]     = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [mode, setMode]               = useState("Economy");
  const [planMode, setPlanMode]       = useState(false);
  const popupRef    = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const isBusy = isAgentThinking || isAgentTyping;
  const currentMode = MODES.find((m) => m.id === mode) ?? MODES[1];

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
    if (!showPopup && !showModeMenu) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setShowPopup(false);
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) setShowModeMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopup, showModeMenu]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div className="px-3 pb-2 pt-1 flex-shrink-0">
      {/* Outer container — position:relative so send button can be pinned */}
      <div
        className="rounded-xl overflow-visible transition-all duration-200 relative"
        style={{
          background: "#1a1f2e",
          border: isBusy ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Textarea — pr-11 so text never overlaps the send button */}
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

        {/* Send / Stop — absolutely pinned to bottom-right */}
        <div className="absolute bottom-1.5 right-2">
          {isBusy ? (
            <button
              onClick={onStop}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80 active:scale-95"
              style={{ background: "rgba(239,68,68,0.85)" }}
              data-testid="button-stop-agent-input"
            >
              <Square className="h-3 w-3 fill-white text-white" />
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

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 pb-1.5 pt-0.5">

          {/* Left: + and cursor */}
          <div className="flex items-center gap-0.5">
            {/* + popup */}
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

            {/* Cursor icon */}
            <button
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
              title="Select context"
            >
              <MousePointer2 className="h-3 w-3" />
            </button>
          </div>

          {/* Right: mode selector, plan, mic */}
          <div className="flex items-center gap-1">

            {/* Agent mode selector */}
            <div ref={modeMenuRef} className="relative">
              <button
                onClick={() => setShowModeMenu((v) => !v)}
                className="flex items-center gap-1 px-1.5 h-6 rounded-md text-[11px] font-medium transition-colors hover:bg-white/6"
                style={{ color: "#94A3B8", border: "1px solid rgba(255,255,255,0.08)" }}
                data-testid="button-mode-selector"
              >
                <DotsGrid size={10} />
                <span>{mode}</span>
              </button>

              {/* Agent modes popup — Replit style */}
              {showModeMenu && (
                <div
                  className="absolute bottom-full right-0 mb-2 z-50"
                  style={{
                    width: 300,
                    background: "#0D1117",
                    border: "1px solid #1E2D3D",
                    borderRadius: 14,
                    boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
                  }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                    <span className="text-[12px] font-semibold" style={{ color: "#94A3B8" }}>Agent modes</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px]" style={{ color: "#475569" }}>Cycle</span>
                      {["Ctrl", "Shift", "I"].map((k) => (
                        <span
                          key={k}
                          className="text-[9px] px-1 py-0.5 rounded"
                          style={{ background: "#1A2230", border: "1px solid #263244", color: "#64748B", fontFamily: "monospace" }}
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Mode pills row */}
                  <div className="flex items-center gap-2 px-3 pb-3">
                    {MODES.map((m) => {
                      const isActive = mode === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => { setMode(m.id); setShowModeMenu(false); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] font-medium transition-all"
                          style={{
                            background: isActive ? "#1A3050" : "#111827",
                            border: `1px solid ${isActive ? "#2563EB" : "#1E2D3D"}`,
                            color: isActive ? "#E5E7EB" : "#64748B",
                          }}
                        >
                          <DotsGrid size={9} />
                          <span>{m.label}</span>
                          {m.badge && (
                            <span
                              className="text-[9px] font-bold px-1 py-0.5 rounded-sm flex items-center gap-0.5"
                              style={{ background: "#7C3AED", color: "#E9D5FF" }}
                            >
                              + {m.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Description */}
                  <div
                    className="px-4 pb-3.5 text-[11px] leading-relaxed"
                    style={{ color: "#64748B", borderTop: "1px solid #1E2D3D", paddingTop: 10 }}
                  >
                    {currentMode.description}
                  </div>
                </div>
              )}
            </div>

            {/* Plan toggle */}
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

            {/* Mic */}
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
