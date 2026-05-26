import { useState } from "react";
import { MessageSquare, MoreVertical, RotateCcw, ChevronDown, Paperclip, Zap, Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/context/app-state-context";
import { useLocation } from "wouter";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function GridAgentPage() {
  const { messages, setMessages } = useAppState();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [buildOpen, setBuildOpen] = useState(false);

  const handleSend = () => {
    if (message.trim()) {
      const userMessage = {
        id: Date.now().toString(),
        role: "user" as const,
        content: message,
        timestamp: new Date(),
      };
      setMessages([...messages, userMessage]);

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: "I'm processing your request...",
        timestamp: new Date(),
      };
      setMessages([...messages, userMessage, assistantMessage]);

      setTimeout(() => {
        setMessages((prev: Message[]) =>
          prev.map((msg: Message) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  content: "Done! Your request has been processed. I'm ready for the next one.",
                }
              : msg
          )
        );
      }, 1000);

      setMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div 
      className="flex flex-col h-full cursor-pointer hover:opacity-90 transition-opacity"
      onClick={() => setLocation("/agent")}
    >
      <header className="flex items-center justify-between px-4 py-3 bg-[#0d0d0d] border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800 h-9 w-9">
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-sm"></div>
          <span className="text-white font-medium">Agent</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800 h-9 w-9">
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800 h-9 w-9">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto bg-[#080808] p-3 sm:p-4 flex flex-col">
        <div className="space-y-2 sm:space-y-3 flex-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg text-xs sm:text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-200"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </main>
      
      <div className="bg-[#0d0d0d] px-2 sm:px-4 py-2 sm:py-3 border-t border-gray-800">
        <div className="bg-[#262d3d] rounded-xl sm:rounded-2xl border border-gray-700 px-2.5 sm:px-4 py-2 sm:py-3 w-full">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Make, test, iterate..."
            className="min-h-[32px] sm:min-h-[36px] resize-none border-0 p-0 text-xs sm:text-base bg-transparent focus-visible:ring-0 placeholder:text-gray-500 text-white mb-1.5 sm:mb-2 max-h-[80px] overflow-y-auto"
          />

          <div className="flex items-center justify-between gap-1 sm:gap-2 flex-wrap">
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                className="text-white hover:text-white hover:bg-gray-700 h-7 sm:h-8 px-1.5 sm:px-2 gap-0.5 sm:gap-1 flex-shrink-0 text-xs"
                onClick={() => setBuildOpen(!buildOpen)}
              >
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
                <span className="font-medium hidden sm:inline">Build</span>
                <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                className="text-gray-400 hover:text-white hover:bg-gray-700 h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0"
              >
                <Paperclip className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button 
                variant="ghost" 
                size="icon"
                className="text-gray-400 hover:text-white hover:bg-gray-700 h-7 w-7 sm:h-8 sm:w-8 hidden sm:flex"
              >
                <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                className="text-gray-400 hover:text-white hover:bg-gray-700 h-7 w-7 sm:h-8 sm:w-8 hidden sm:flex"
              >
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <Button
                size="icon"
                className="rounded-lg bg-blue-600 hover:bg-blue-700 h-7 w-7 sm:h-8 sm:w-8"
                onClick={handleSend}
                disabled={!message.trim()}
              >
                <Send className="w-3 h-3 sm:w-4 sm:h-4" fill="white" stroke="white" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
