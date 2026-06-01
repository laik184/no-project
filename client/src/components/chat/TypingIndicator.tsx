import { Bot } from "lucide-react";

export function TypingIndicator() {
  return (
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
  );
}
