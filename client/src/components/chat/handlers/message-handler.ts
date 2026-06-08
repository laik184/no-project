import type { AgentHandlerDeps, AgentEvent } from "../agent-event-handler";

function toFriendlyRunError(err: string): string {
  if (err.includes("timeout")) return "The agent timed out. Please try again.";
  if (err.includes("cancelled")) return "The run was cancelled.";
  if (err.includes("quota") || err.includes("rate limit")) return "AI quota reached. Please try again shortly.";
  return `Something went wrong: ${err.slice(0, 120)}`;
}

export function handleMessageEvents(e: AgentEvent, deps: AgentHandlerDeps): void {
  const { runId, setMessages, setIsAgentThinking, setIsAgentTyping, setActiveAction, finalizeStream, flushGroup } = deps;

  switch (e.eventType) {
    case "agent.question": {
      flushGroup();
      setIsAgentThinking(false);
      setActiveAction(null);
      const { text, options, questionId } = e.payload ?? {};
      if (text && Array.isArray(options) && questionId) {
        setMessages((p) => [...p, { role: "question" as const, time: "just now", question: { text, options, questionId, runId } }]);
      }
      break;
    }

    case "agent.question.answered": {
      const { questionId: answeredId, answer: confirmedAnswer } = e.payload ?? {};
      if (answeredId && confirmedAnswer) {
        setMessages((p) => p.map((m) =>
          m.role === "question" && m.question.questionId === answeredId
            ? { ...m, question: { ...m.question, answered: confirmedAnswer } }
            : m,
        ));
      }
      setIsAgentThinking(true);
      setActiveAction({ type: "action", tool: "analysis.think", content: "Processing answer…", status: "running" });
      break;
    }

    case "agent.message": {
      finalizeStream();
      flushGroup();
      setIsAgentTyping(false);
      setActiveAction(null);
      const text = typeof e.payload === "string" ? e.payload : (e.payload?.text || JSON.stringify(e.payload));
      if (text) setMessages((p) => [...p, { role: "agent", content: text, time: "just now" }]);
      break;
    }
  }

  // Run lifecycle events use `type` field (not `eventType`)
  switch ((e as any).type as string | undefined) {
    case "run.started":
      setIsAgentThinking(true);
      setActiveAction({ type: "action", tool: "analysis.think", content: "Starting…", status: "running" });
      break;

    case "run.completed":
      setIsAgentThinking(false);
      setIsAgentTyping(false);
      setActiveAction(null);
      break;

    case "run.failed": {
      const errMsg = (e as any).error as string | undefined;
      setIsAgentThinking(false);
      setIsAgentTyping(false);
      setActiveAction(null);
      if (errMsg) {
        const friendly = toFriendlyRunError(errMsg);
        setMessages((p) => [...p, { role: "agent" as const, content: friendly, time: "just now" }]);
      }
      break;
    }
  }
}
