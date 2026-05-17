import {
  pgTable, serial, varchar, text, timestamp, jsonb, integer, boolean, index,
} from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id:          serial("id").primaryKey(),
  name:        varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  framework:   varchar("framework", { length: 64 }),
  sandboxPath: text("sandbox_path"),
  status:      varchar("status", { length: 32 }).default("idle"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const agentRuns = pgTable("agent_runs", {
  id:        varchar("id", { length: 64 }).primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  goal:      text("goal").notNull(),
  status:    varchar("status", { length: 32 }).default("running"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  endedAt:   timestamp("ended_at", { withTimezone: true }),
  result:    jsonb("result"),
});

export const chatMessages = pgTable("chat_messages", {
  id:         serial("id").primaryKey(),
  projectId:  integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  runId:      varchar("run_id", { length: 64 }).references(() => agentRuns.id, { onDelete: "set null" }),
  role:       varchar("role", { length: 32 }).notNull(),
  content:    text("content").notNull(),
  feedback:   varchar("feedback", { length: 16 }),
  tokensUsed: integer("tokens_used"),
  toolCalls:  jsonb("tool_calls"),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const chatUploads = pgTable("chat_uploads", {
  id:         serial("id").primaryKey(),
  projectId:  integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  runId:      varchar("run_id", { length: 64 }).references(() => agentRuns.id, { onDelete: "set null" }),
  filename:   varchar("filename", { length: 255 }).notNull(),
  mimeType:   varchar("mime_type", { length: 128 }).notNull(),
  storedPath: text("stored_path").notNull(),
  sizeBytes:  integer("size_bytes").notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const agentEvents = pgTable("agent_events", {
  id:        serial("id").primaryKey(),
  runId:     varchar("run_id", { length: 64 }).references(() => agentRuns.id, { onDelete: "cascade" }),
  phase:     varchar("phase", { length: 64 }),
  agentName: varchar("agent_name", { length: 128 }),
  eventType: varchar("event_type", { length: 64 }),
  payload:   jsonb("payload"),
  ts:        timestamp("ts", { withTimezone: true }).defaultNow(),
});

export const artifacts = pgTable("artifacts", {
  id:        serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  kind:      varchar("kind", { length: 64 }),
  path:      text("path"),
  meta:      jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const diffQueue = pgTable("diff_queue", {
  id:         serial("id").primaryKey(),
  projectId:  integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  filePath:   text("file_path").notNull(),
  oldContent: text("old_content"),
  newContent: text("new_content"),
  status:     varchar("status", { length: 32 }).default("pending"),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Persistent tool execution history.
 * One row per tool invocation — tracks full lifecycle with correlation IDs.
 * Separate from agent_events (flat log) — this is structured, queryable data.
 */
export const toolExecutions = pgTable("tool_executions", {
  id:           serial("id").primaryKey(),
  executionId:  varchar("execution_id", { length: 64 }).notNull().unique(),
  runId:        varchar("run_id", { length: 64 }).references(() => agentRuns.id, { onDelete: "cascade" }),
  projectId:    integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  stepIndex:    integer("step_index"),
  toolName:     varchar("tool_name", { length: 128 }).notNull(),
  toolCategory: varchar("tool_category", { length: 64 }),
  status:       varchar("status", { length: 32 }).default("running").notNull(),
  argsJson:     jsonb("args_json"),
  resultJson:   jsonb("result_json"),
  errorText:    text("error_text"),
  durationMs:   integer("duration_ms"),
  retryCount:   integer("retry_count").default(0).notNull(),
  replaySafe:   boolean("replay_safe").default(true).notNull(),
  startedAt:    timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt:      timestamp("ended_at", { withTimezone: true }),
}, (t) => [
  index("tool_executions_run_id_idx").on(t.runId),
  index("tool_executions_project_id_idx").on(t.projectId),
  index("tool_executions_tool_name_idx").on(t.toolName),
  index("tool_executions_started_at_idx").on(t.startedAt),
]);

export const consoleLogs = pgTable("console_logs", {
  id:        serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  stream:    varchar("stream", { length: 16 }),
  line:      text("line"),
  ts:        timestamp("ts", { withTimezone: true }).defaultNow(),
});

export const deployments = pgTable("deployments", {
  id:          serial("id").primaryKey(),
  projectId:   integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  status:      varchar("status", { length: 32 }).default("idle").notNull(),
  url:         text("url"),
  region:      varchar("region", { length: 64 }).default("us-east-1").notNull(),
  environment: varchar("environment", { length: 32 }).default("production").notNull(),
  steps:       jsonb("steps").default([]).notNull(),
  error:       text("error"),
  startedAt:   timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const deploymentDomains = pgTable("deployment_domains", {
  id:        serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name:      varchar("name", { length: 255 }).notNull(),
  status:    varchar("status", { length: 32 }).default("pending").notNull(),
  addedAt:   timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
});

export const deploymentSecrets = pgTable("deployment_secrets", {
  id:             serial("id").primaryKey(),
  projectId:      integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  key:            varchar("key", { length: 255 }).notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const deploymentSettings = pgTable("deployment_settings", {
  id:          serial("id").primaryKey(),
  projectId:   integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  appName:     varchar("app_name", { length: 255 }).default("my-app").notNull(),
  environment: varchar("environment", { length: 32 }).default("production").notNull(),
  region:      varchar("region", { length: 64 }).default("us-east-1").notNull(),
  isPublic:    boolean("is_public").default(true).notNull(),
  dbUrl:       text("db_url"),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const deploymentAuthConfig = pgTable("deployment_auth_config", {
  id:                serial("id").primaryKey(),
  projectId:         integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  providers:         jsonb("providers").default([]).notNull(),
  requireEmailVerif: boolean("require_email_verif").default(true).notNull(),
  sessionExpiry:     varchar("session_expiry", { length: 16 }).default("7d").notNull(),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Project          = typeof projects.$inferSelect;
export type InsertProject    = typeof projects.$inferInsert;
export type ChatMessage      = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type ChatUpload       = typeof chatUploads.$inferSelect;
export type InsertChatUpload = typeof chatUploads.$inferInsert;
export type AgentRun         = typeof agentRuns.$inferSelect;
export type InsertAgentRun   = typeof agentRuns.$inferInsert;
export type AgentEventRow    = typeof agentEvents.$inferSelect;
export type InsertAgentEvent = typeof agentEvents.$inferInsert;
export type Artifact         = typeof artifacts.$inferSelect;
export type InsertArtifact   = typeof artifacts.$inferInsert;
export type DiffQueueItem    = typeof diffQueue.$inferSelect;
export type InsertDiffQueueItem = typeof diffQueue.$inferInsert;
export type ConsoleLog           = typeof consoleLogs.$inferSelect;
export type InsertConsoleLog     = typeof consoleLogs.$inferInsert;
export type ToolExecutionRow     = typeof toolExecutions.$inferSelect;
export type InsertToolExecution  = typeof toolExecutions.$inferInsert;
export type Deployment       = typeof deployments.$inferSelect;
export type InsertDeployment = typeof deployments.$inferInsert;
export type DeploymentDomain = typeof deploymentDomains.$inferSelect;
export type DeploymentSecret = typeof deploymentSecrets.$inferSelect;
export type DeploymentSettings = typeof deploymentSettings.$inferSelect;
export type DeploymentAuthConfig = typeof deploymentAuthConfig.$inferSelect;

// ─── Checkpoint + Rollback tables ────────────────────────────────────────────

export const checkpoints = pgTable("checkpoints", {
  id:            serial("id").primaryKey(),
  checkpointId:  varchar("checkpoint_id", { length: 64 }).notNull().unique(),
  projectId:     integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  runId:         varchar("run_id", { length: 64 }).references(() => agentRuns.id, { onDelete: "set null" }),
  trigger:       varchar("trigger", { length: 32 }).notNull(),
  status:        varchar("status", { length: 32 }).default("stable").notNull(),
  gitCommitSha:  varchar("git_commit_sha", { length: 64 }),
  fileCount:     integer("file_count").default(0).notNull(),
  label:         text("label"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("checkpoints_project_id_idx").on(t.projectId),
  index("checkpoints_run_id_idx").on(t.runId),
  index("checkpoints_created_at_idx").on(t.createdAt),
]);

export const rollbackHistory = pgTable("rollback_history", {
  id:            serial("id").primaryKey(),
  checkpointId:  varchar("checkpoint_id", { length: 64 }).notNull(),
  projectId:     integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  runId:         varchar("run_id", { length: 64 }),
  scope:         varchar("scope", { length: 32 }).notNull(),
  status:        varchar("status", { length: 32 }).default("completed").notNull(),
  restoredFiles: jsonb("restored_files").default([]).notNull(),
  error:         text("error"),
  triggeredAt:   timestamp("triggered_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("rollback_history_project_id_idx").on(t.projectId),
]);

export type Checkpoint       = typeof checkpoints.$inferSelect;
export type InsertCheckpoint = typeof checkpoints.$inferInsert;
export type RollbackHistoryRow = typeof rollbackHistory.$inferSelect;

export interface Folder {
  id: number;
  name: string;
  projectIds?: number[];
  createdAt?: string;
}
export type InsertFolder = Omit<Folder, "id" | "createdAt">;
