export type ConversationStatus = 'active' | 'archived' | 'deleted';
export type TurnStatus         = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type SessionStatus      = 'open' | 'closing' | 'closed';

export interface Conversation {
  conversationId: string;
  projectId:      number;
  status:         ConversationStatus;
  title:          string;
  messageCount:   number;
  createdAt:      Date;
  updatedAt:      Date;
  lastMessageAt?: Date;
}

export interface ConversationSummary {
  conversationId: string;
  projectId:      number;
  title:          string;
  status:         ConversationStatus;
  messageCount:   number;
  lastMessageAt?: Date;
  createdAt:      Date;
}

export interface ChatSession {
  sessionId:      string;
  conversationId: string;
  projectId:      number;
  status:         SessionStatus;
  openedAt:       Date;
  closedAt?:      Date;
}

export interface ChatTurn {
  turnId:         string;
  runId:          string;
  conversationId: string;
  projectId:      number;
  goal:           string;
  status:         TurnStatus;
  startedAt:      Date;
  completedAt?:   Date;
  durationMs?:    number;
}
