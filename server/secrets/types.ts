export interface Secret {
  id: string;
  projectId: string;
  key: string;
  value: string;         // encrypted at rest
  iv: string;            // encryption IV
  description?: string;
  isSystem: boolean;     // system-injected (DATABASE_URL etc.)
  createdAt: Date;
  updatedAt: Date;
}

export interface SecretSummary {
  id: string;
  projectId: string;
  key: string;
  description?: string;
  isSystem: boolean;
  hasValue: boolean;     // value nahi dikhate, sirf has/not
  updatedAt: Date;
}

export interface UpsertSecretPayload {
  projectId: string;
  key: string;
  value: string;
  description?: string;
}

export interface BulkUpsertPayload {
  projectId: string;
  secrets: Array<{ key: string; value: string }>;
}

export interface SecretAuditEntry {
  id: string;
  secretId: string;
  projectId: string;
  action: "created" | "updated" | "deleted" | "accessed";
  performedBy: string;
  ts: number;
}

export interface EnvFileParseResult {
  entries: Array<{ key: string; value: string; line: number }>;
  errors: Array<{ line: number; message: string }>;
}
