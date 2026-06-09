import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { History, MessageSquarePlus } from "lucide-react";
import { useAgentRunner } from "./useAgentRunner";
import { ChatHistoryPanel } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { fetchFileContent, guessLangFromPath, fetchChatHistory, fetchChatPrompts } from "./tool-helpers";
import type { ChatPanelProps } from "./types";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

const DEFAULT_PROMPTS = [
  "Check my app for bugs",
  "Connect a database",
  "Write tests for my code",
  "Add dark mode",
];

export function ChatPanel({ inputRef, currentAction, onOpenFile, newChatTrigger }: ChatPanelProps) {
  const [chatInput, setChatInput]                 = useState("");
  const [showNewChatScreen, setShowNewChatScreen] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel]   = useState(false);
  const internalInputRef                          = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = (inputRef as React.RefObject<HTMLTextAreaElement>) ?? internalInputRef;

  const projectId = Number(window.localStorage.getItem("nura.projectId") || "1") || 1;

  const {
    messages, setMessages,
    isAgentThinking, isAgentTyping,
    activeAction, setActiveAction,
    runAgent, stopAgent, handleAnswer,
  } = useAgentRunner();

  const { data: historyData } = useQuery({
    queryKey: ["/api/chat/history", projectId],
    queryFn:  () => fetchChatHistory(projectId),
    staleTime: 30_000,
  });
  const chatHistory = historyData ?? [];

  const { data: promptsData } = useQuery({
    queryKey: ["/api/chat/prompts", projectId],
    queryFn:  () => fetchChatPrompts(projectId),
    staleTime: 60_000,
  });
  const suggestedPrompts = promptsData ?? DEFAULT_PROMPTS;

  // Sync externally-driven active action (e.g. from workspace toolbar)
  // Fix: single setState call, no duplicate update.
  useEffect(() => {
    if (currentAction !== undefined) {
      setActiveAction((currentAction as AgentStreamItem | null) ?? null);
    }
  }, [currentAction, setActiveAction]);

  // External "new chat" trigger from sidebar
  const prevTriggerRef = useRef(newChatTrigger ?? 0);
  useEffect(() => {
    if (newChatTrigger !== undefined && newChatTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = newChatTrigger;
      setShowNewChatScreen(true);
      setShowHistoryPanel(false);
      setMessages([]);
    }
  }, [newChatTrigger, setMessages]);

  // Auto-send prompt from URL on first mount
  useEffect(() => {
    const prompt = new URLSearchParams(window.location.search).get("prompt") || "";
    if (!prompt) return;
    const t = setTimeout(() => runAgent(prompt), 1800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenFile = async (path: string) => {
    if (!onOpenFile) { await fetchFileContent(path); return; }
    const { content, lang } = await fetchFileContent(path);
    onOpenFile(path, content, lang || guessLangFromPath(path));
  };

  const handleSend = () => {
    if (!chatInput.trim() || isAgentThinking || isAgentTyping) return;
    const msg = chatInput.trim();
    setChatInput("");
    setShowNewChatScreen(false);
    runAgent(msg);
  };

  const handleSelectPrompt = (prompt: string) => {
    setChatInput(prompt);
    setShowNewChatScreen(false);
    setTimeout(() => chatInputRef.current?.focus(), 50);
  };

  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden"
      style={{ background: "rgba(255,255,255,0.015)" }}
    >
      {/* ── Mini header with history + new chat icons ────────────────────── */}
      <div
        className="flex items-center justify-end px-3 flex-shrink-0"
        style={{
          height: 36,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => { setShowHistoryPanel((v) => !v); setShowNewChatScreen(false); }}
          className={cn(
            "w-6 h-6 flex items-center justify-center rounded-lg transition-all",
            showHistoryPanel
              ? "text-blue-400 bg-blue-500/10"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5",
          )}
          data-testid="button-chat-history"
          title="Chat history"
        >
          <History className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => { setShowNewChatScreen(true); setShowHistoryPanel(false); setMessages([]); }}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          data-testid="button-new-chat"
          title="New chat"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {showHistoryPanel && (
        <ChatHistoryPanel
          chatHistory={chatHistory}
          onClose={() => setShowHistoryPanel(false)}
        />
      )}

      {!showHistoryPanel && (
        <>
          <ChatMessages
            messages={messages}
            isAgentThinking={isAgentThinking}
            isAgentTyping={isAgentTyping}
            activeAction={activeAction}
            showNewChatScreen={showNewChatScreen}
            suggestedPrompts={suggestedPrompts}
            onOpenFile={handleOpenFile}
            onAnswer={handleAnswer}
            onSelectPrompt={handleSelectPrompt}
          />
          <ChatInput
            chatInput={chatInput}
            setChatInput={setChatInput}
            chatInputRef={chatInputRef}
            isAgentThinking={isAgentThinking}
            isAgentTyping={isAgentTyping}
            onSend={handleSend}
            onStop={stopAgent}
          />
        </>
      )}
    </div>
  );
}
