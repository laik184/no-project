/**
 * server/approvals/diff.types.ts
 * Shared types for the diff approval system.
 */

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface PendingApproval {
  /** Matches diffQueue.id for persistence/audit */
  diffId:      number;
  /** Internal correlation ID */
  sessionId:   string;
  projectId:   number;
  runId:       string;
  filePath:    string;
  isNewFile:   boolean;
  oldContent:  string;
  newContent:  string;
  /** Rendered unified diff sent to the frontend */
  unifiedDiff: string;
  status:      ApprovalStatus;
  createdAt:   number;
  expiresAt:   number;
}

export interface ApprovalRequest {
  sessionId:  string;
  projectId:  number;
  runId:      string;
  filePath:   string;
  isNewFile:  boolean;
  oldContent: string;
  newContent: string;
}

export interface ApprovalOutcome {
  approved:  boolean;
  sessionId: string;
  diffId:    number;
}
