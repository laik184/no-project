export type ExecutionStatus = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface DbAdapter {
  execute: (sql: string, migrationName: string) => Promise<void>;
}

export interface MigrationScript {
  name: string;
  path: string;
  sql: string;
}

export interface ExecutionPlan {
  executionId: string;
  migrations: MigrationScript[];
}

export interface MigrationLog {
  timestamp: string;
  executionId: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  step: string;
  message: string;
  migration?: string;
}

export interface FailureReport {
  executionId: string;
  failedMigration: string;
  error: string;
  rollbackRequested: true;
  generatedAt: string;
}

export interface ExecutionResult {
  success: boolean;
  executed: string[];
  failed?: string[];
  logs: MigrationLog[];
  error?: string;
}

export interface RunMigrationsInput {
  executionId: string;
  migrationsDir: string;
  dbAdapter: DbAdapter;
}

export interface RunnerOutput {
  executed: string[];
  failed: string[];
  error?: string;
}
