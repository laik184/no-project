export type QuestionStatus = 'pending' | 'answered' | 'expired' | 'cancelled';
export type QuestionKind   = 'clarification' | 'ambiguity' | 'confirmation';

export interface ChatQuestion {
  questionId: string;
  runId:      string;
  projectId:  number;
  kind:       QuestionKind;
  text:       string;
  options:    string[];
  status:     QuestionStatus;
  answer?:    string;
  askedAt:    Date;
  answeredAt?: Date;
  expiresAt?: Date;
}

export interface AskQuestionPayload {
  runId:     string;
  projectId: number;
  kind:      QuestionKind;
  text:      string;
  options:   string[];
  ttlMs?:    number;
}

export interface AnswerPayload {
  questionId: string;
  runId:      string;
  projectId:  number;
  answer:     string;
}

export interface ClarificationRequest {
  goal:       string;
  ambiguities: string[];
}

export interface ClarificationContext {
  originalGoal:   string;
  clarifications: Array<{ question: string; answer: string }>;
  refinedGoal:    string;
}
