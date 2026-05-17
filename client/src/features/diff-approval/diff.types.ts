export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface DiffEvent {
  diffId:       number;
  sessionId:    string;
  projectId:    number;
  runId:        string;
  filePath:     string;
  isNewFile:    boolean;
  oldContent:   string;
  newContent:   string;
  unifiedDiff:  string;
  status:       ApprovalStatus;
  createdAt:    number;
  expiresAt:    number;
}
