/**
 * useTokenStream — RAF-throttled token streaming for a single agent message.
 *
 * Responsibilities (one only):
 *   - Maintains a TokenBuffer per active stream session.
 *   - Appends a streaming placeholder message via startStream().
 *   - Flushes the buffer and marks the message non-streaming via finalizeStream().
 *   - Feeds incoming tokens via pushToken().
 *
 * All returned functions are stable across renders (useCallback + internal refs).
 * The hook has no side-effects on its own — it only acts when its functions are called.
 */
import { useRef, useCallback } from "react";
import { TokenBuffer } from "@/streaming/token-buffer";
import type { ChatMessage } from "@/components/chat/types";

type SetMessages = React.Dispatch<React.SetStateAction<ChatMessage[]>>;

export function useTokenStream(setMessages: SetMessages) {
  const bufRef    = useRef<TokenBuffer | null>(null);
  const activeRef = useRef(false);

  const finalizeStream = useCallback(() => {
    if (!activeRef.current) return;
    bufRef.current?.destroy();
    bufRef.current    = null;
    activeRef.current = false;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "agent" && (last as { isStreaming?: boolean }).isStreaming) {
        return [...prev.slice(0, -1), { ...last, isStreaming: false }];
      }
      return prev;
    });
  }, [setMessages]);

  const startStream = useCallback(() => {
    finalizeStream();
    activeRef.current = true;
    setMessages((prev) => [
      ...prev,
      { role: "agent", content: "", isStreaming: true, time: "just now" },
    ]);
    bufRef.current = new TokenBuffer((chunk) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "agent" && (last as { isStreaming?: boolean }).isStreaming) {
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
        }
        return prev;
      });
    });
  }, [finalizeStream, setMessages]);

  const pushToken = useCallback((token: string) => {
    bufRef.current?.push(token);
  }, []);

  return { startStream, pushToken, finalizeStream };
}
