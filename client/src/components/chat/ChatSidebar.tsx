import { Home, Plus, LayoutPanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface ChatSidebarProps {
  onNewChat: () => void;
  onToggleLayout?: () => void;
  hasActiveChat?: boolean;
}

export function ChatSidebar({ onNewChat, onToggleLayout, hasActiveChat = false }: ChatSidebarProps) {
  const [, navigate] = useLocation();

  return (
    <div
      className="flex flex-col items-center py-2 flex-shrink-0"
      style={{
        width: 44,
        background: "rgba(255,255,255,0.018)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        height: "100%",
      }}
    >
      {/* Top: Home icon */}
      <button
        onClick={() => navigate("/")}
        className="w-7 h-7 rounded-lg flex items-center justify-center mb-3 flex-shrink-0 hover:bg-white/8 transition-colors"
        title="Home"
        data-testid="button-sidebar-home"
        style={{ color: "rgba(148,163,184,0.5)" }}
      >
        <Home style={{ width: 13, height: 13 }} />
      </button>

      {/* Active chat indicator (◉) */}
      <button
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center mb-1 transition-all flex-shrink-0",
          hasActiveChat
            ? "bg-primary/15 border border-primary/30"
            : "hover:bg-white/6 border border-transparent",
        )}
        title="Current chat"
        data-testid="button-sidebar-active-chat"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          style={{ width: 16, height: 16 }}
        >
          <circle
            cx="8"
            cy="8"
            r="6.5"
            stroke={hasActiveChat ? "#3B82F6" : "rgba(148,163,184,0.5)"}
            strokeWidth="1.5"
          />
          <circle
            cx="8"
            cy="8"
            r="3"
            fill={hasActiveChat ? "#3B82F6" : "rgba(148,163,184,0.5)"}
          />
        </svg>
      </button>

      {/* + New chat */}
      <button
        onClick={onNewChat}
        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/6 transition-all border border-transparent hover:border-white/08 flex-shrink-0"
        title="New chat"
        data-testid="button-sidebar-new-chat"
        style={{ color: "rgba(148,163,184,0.55)" }}
      >
        <Plus style={{ width: 15, height: 15 }} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom: Layout toggle */}
      <button
        onClick={onToggleLayout}
        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/6 transition-all border border-transparent hover:border-white/08 flex-shrink-0"
        title="Toggle layout"
        data-testid="button-sidebar-layout"
        style={{ color: "rgba(148,163,184,0.45)" }}
      >
        <LayoutPanelLeft style={{ width: 15, height: 15 }} />
      </button>
    </div>
  );
}
