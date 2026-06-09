import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAgentRunner } from "./useAgentRunner";
import { ChatHeader, ChatHistoryPanel } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { fetchFileContent, guessLangFromPath, fetchChatHistory, fetchChatPrompts } from "./tool-helpers";
import type { ChatPanelProps } from "./types";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

const DEFAULT_PROMPTS = [
  "Check my app for bugs",
  "Add user authentication",
  "Connect a database",
  "Add payment processing",
  "Write tests for my code",
  "Add dark mode",
];

export function ChatPanel({ inputRef, currentAction, onOpenFile }: ChatPanelProps) {
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
