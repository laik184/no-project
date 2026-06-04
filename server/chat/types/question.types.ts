export type QuestionStatus = 'pending' | 'answered' | 'expired' | 'cancelled';
export type QuestionKind   = 'clarification' | 'ambiguity' | 'confirmation';

export interface ChatQuestion {
  questionId:  string;
  runId:       string;
  projectId:   number;
  kind:        QuestionKind;
  text:        string;
  options:     string[];
  status:      QuestionStatus;
  askedAt:     Date;
  expiresAt?:  Date;
  answer?:     string;
  answeredAt?: Date;
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
  answer:     string;
}

export interface ClarificationContext {
  originalGoal:    string;
  clarifications:  string[];
  refinedGoal:     string;
}
