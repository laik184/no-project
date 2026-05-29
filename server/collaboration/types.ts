export interface CollabSession {
  sessionId: string;
  projectId: string;
  ownerId: string;
  participants: CollabParticipant[];
  createdAt: Date;
  expiresAt: Date;
}

export interface CollabParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: "owner" | "editor" | "viewer";
  color: string;          // unique color per participant
  cursor?: CursorPosition;
  selection?: TextSelection;
  activeFile?: string;
  joinedAt: Date;
  lastSeenAt: Date;
  isOnline: boolean;
}

export interface CursorPosition {
  file: string;
  line: number;
  column: number;
}

export interface TextSelection {
  file: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface CollabEdit {
  sessionId: string;
  userId: string;
  file: string;
  operation: CrdtOperation;
  vectorClock: Record<string, number>;
  ts: number;
}

export type CrdtOperation =
  | { type: "insert"; position: number; chars: string }
  | { type: "delete"; position: number; length: number }
  | { type: "retain"; length: number };

export interface PresenceUpdate {
  sessionId: string;
  userId: string;
  cursor?: CursorPosition;
  selection?: TextSelection;
  activeFile?: string;
}

export interface CollabInvite {
  id: string;
  sessionId: string;
  projectId: string;
  invitedBy: string;
  role: "editor" | "viewer";
  expiresAt: Date;
  acceptedAt?: Date;
}

export interface CollabChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  displayName: string;
  content: string;
  ts: number;
}
