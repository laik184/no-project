import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";
import type { FileDiff } from "@/components/diff/FileDiffCard";
import type { CheckpointData } from "@/components/panels/CheckpointCard";

export interface QuestionData {
  text: string;
  options: string[];
  questionId: string;
  runId: string;
  answered?: string;
}

export type ChatMessage =
  | { role: "user";       content: string;            time: string }
  | { role: "agent";      content: string;            time: string; isStreaming?: boolean }
  | { role: "tool_group"; actions: AgentStreamItem[]; time: string }
  | { role: "diff";       diffs: FileDiff[];           time: string }
  | { role: "checkpoint"; checkpoint: CheckpointData; time: string }
  | { role: "question";   question: QuestionData;     time: string };

export interface ChatPanelProps {
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  currentAction?: AgentStreamItem | null;
  onOpenFile?: (path: string, content: string, lang: string) => void;
}
