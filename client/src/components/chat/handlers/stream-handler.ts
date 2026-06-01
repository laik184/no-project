import type { AgentHandlerDeps, AgentEvent } from "../agent-event-handler";

export function handleStreamEvents(e: AgentEvent, deps: AgentHandlerDeps): void {
  const {
    setMessages, setIsAgentThinking, setIsAgentTyping, setActiveAction,
    startStream, pushToken, finalizeStream, flushGroup,
  } = deps;

  switch (e.eventType) {
    case "agent.stream.start":
      finalizeStream();
      setIsAgentThinking(false);
      setIsAgentTyping(false);
      setActiveAction(null);
      startStream();
      break;

    case "agent.token": {
      const tok = e.payload?.token as string | undefined;
      if (tok) pushToken(tok);
      break;
    }

    case "agent.stream.end":
      finalizeStream();
      break;

    case "agent.thinking":
      setIsAgentThinking(true);
      setActiveAction({
        type: "action",
        tool: "analysis.think",
        content: e.payload?.text || `Thinking${e.agentName ? ` (${e.agentName})` : ""}…`,
        status: "running",
      });
      break;

    case "agent.retry": {
      const { attempt, maxAttempts, delayMs, error, operation } = e.payload ?? {};
      const delay = delayMs >= 1000 ? `${(delayMs / 1000).toFixed(1)}s` : `${delayMs}ms`;
      setActiveAction({
        type: "action",
        tool: "agent.retry",
        content: `Retrying ${operation || "request"} (attempt ${attempt}/${maxAttempts}) in ${delay} — ${(error || "").slice(0, 80)}`,
        status: "running",
      });
      break;
    }

    case "agent.replanning": {
      const { text, continuationCount, maxContinuations, limitReached } = e.payload ?? {};
      setIsAgentThinking(true);
      if (limitReached) {
        flushGroup();
        setMessages((p) => [...p, { role: "agent", content: `⏹ ${text || "Continuation limit reached."}`, time: "just now" }]);
        setActiveAction(null);
      } else {
        setActiveAction({ type: "action", tool: "plan.replan", content: text || `Re-planning (${continuationCount}/${maxContinuations})…`, status: "running" });
      }
      break;
    }

    case "agent.context_compressed": {
      const { originalMessageCount, compressedMessageCount, continuationCount } = e.payload ?? {};
      setActiveAction({ type: "action", tool: "plan.compress", content: `Context compressed: ${originalMessageCount} → ${compressedMessageCount} messages (run ${continuationCount})`, status: "running" });
      break;
    }

    case "agent.continuation": {
      const { text, continuationCount, maxContinuations } = e.payload ?? {};
      setActiveAction({ type: "action", tool: "plan.continue", content: text || `Continuation ${continuationCount}/${maxContinuations}…`, status: "running" });
      break;
    }
  }
}
