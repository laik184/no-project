import { History, MessageSquarePlus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./types";
import { RealtimeStatusDot } from "@/realtime/RealtimeStatusDot";

interface ChatHeaderProps {
  showHistoryPanel: boolean;
  onToggleHistory: () => void;
  onNewChat: () => void;
  chatHistory: { id: string; title: string; time: string; status: string; active: boolean }[];
}

export function ChatHeader({ showHistoryPanel, onToggleHistory, onNewChat, chatHistory }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)", boxShadow: "0 0 8px rgba(124,141,255,0.45)" }}>
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-foreground">Agent</span>
        <RealtimeStatusDot size={6} />
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onToggleHistory}
          className={cn("w-6 h-6 flex items-center justify-center rounded-lg transition-all",
            showHistoryPanel ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5")}
          data-testid="button-chat-history" title="Chat history">
          <History className="h-3.5 w-3.5" />
        </button>
        <button onClick={onNewChat}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          data-testid="button-new-chat" title="New chat with Agent">
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface ChatHistoryPanelProps {
  chatHistory: { id: string; title: string; time: string; status: string; active: boolean }[];
  onClose: () => void;
}

export function ChatHistoryPanel({ chatHistory, onClose }: ChatHistoryPanelProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Chat History</p>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {chatHistory.length === 0 && (
          <p className="text-[11px] text-muted-foreground px-4 py-3">No previous chats yet.</p>
        )}
        {chatHistory.map((chat) => (
          <button key={chat.id} onClick={onClose}
            data-testid={`button-history-chat-${chat.id}`}
            className="w-full flex flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-white/4 transition-colors group relative"
            style={chat.active ? { background: "rgba(124,141,255,0.07)" } : {}}>
            {chat.active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                style={{ background: "linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)" }} />
            )}
            <p className="text-[12px] leading-snug line-clamp-2 pr-2"
              style={{ color: chat.active ? "rgba(226,232,240,0.95)" : "rgba(226,232,240,0.7)" }}>
              {chat.title}
            </p>
            <p className="text-[10px]" style={{ color: "rgba(100,116,139,0.55)" }}>{chat.time}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
