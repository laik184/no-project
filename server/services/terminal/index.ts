/**
 * server/services/terminal/index.ts
 *
 * Public surface of the terminal service layer.
 * All consumers outside server/services/terminal/ MUST import from here.
 * No business logic lives in this file — only re-exports.
 */

// ── Orchestration (primary entry point) ───────────────────────────────────────
export {
  terminalOrchestratorService,
  OrchestratorError,
} from './orchestration/index.ts';
export type { RunCommandOptions, CommandOutput } from './orchestration/index.ts';

// ── Command ───────────────────────────────────────────────────────────────────
export {
  commandService,
  commandParser,
  commandValidator,
  CommandError,
  CommandParseError,
  CommandValidationError,
} from './command/index.ts';
export type {
  ParsedCommand,
  ValidationResult,
  ExecuteOptions,
  ExecuteResult,
  StreamResult,
} from './command/index.ts';

// ── Process ───────────────────────────────────────────────────────────────────
export {
  processService,
  processLifecycleService,
  processStreamService,
  ProcessServiceError,
  LifecycleError,
  StreamAttachError,
} from './process/index.ts';
export type {
  ProcessStatus,
  ManagedProcess,
  LineHandler,
} from './process/index.ts';

// ── Package manager ───────────────────────────────────────────────────────────
export {
  packageService,
  packageInstallerService,
  packageUninstallerService,
  packageUpdateService,
  packageManagerDetector,
  PackageServiceError,
  InstallError,
  UninstallError,
  UpdateError,
} from './package-manager/index.ts';
export type {
  PackageManager,
  DetectionResult,
  ListResult,
  InstallOptions,
  InstallResult,
  UninstallOptions,
  UninstallResult,
  UpdateOptions,
  UpdateResult,
} from './package-manager/index.ts';

// ── Runtime ───────────────────────────────────────────────────────────────────
export {
  runtimeService,
  runtimeRestartService,
  runtimeHealthService,
  RuntimeError,
  RestartError,
} from './runtime/index.ts';
export type {
  RuntimeInfo,
  RestartOptions,
  RestartResult,
  HealthStatus,
} from './runtime/index.ts';

// ── Session ───────────────────────────────────────────────────────────────────
export {
  terminalSessionService,
  terminalHistoryService,
  SessionError,
  HistoryError,
} from './session/index.ts';
export type {
  TerminalSession,
  HistoryEntry,
} from './session/index.ts';

// ── Streaming ─────────────────────────────────────────────────────────────────
export {
  terminalStreamService,
  stdoutStreamService,
  stderrStreamService,
  StreamServiceError,
} from './streaming/index.ts';
export type {
  StreamLine,
  StreamSource,
  StdoutChunk,
  StderrChunk,
} from './streaming/index.ts';

// ── Logging ───────────────────────────────────────────────────────────────────
export {
  terminalLogService,
  logParserService,
  LogServiceError,
} from './logging/index.ts';
export type {
  LogRecord,
  ParsedLogEntry,
  LogLevel,
} from './logging/index.ts';

// ── Shell utilities ───────────────────────────────────────────────────────────
export {
  shellService,
  ShellServiceError,
} from './shell/index.ts';
export type {
  DirEntry,
  LsResult,
} from './shell/index.ts';
