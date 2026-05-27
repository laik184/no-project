/**
 * tool-contracts.ts
 * TypeScript input/output contracts for every executor tool.
 * Keeps tool-dispatcher.ts and tool-validator.ts in sync.
 */

export interface WriteFileInput  { path: string; content: string }
export interface ReadFileInput   { path: string }
export interface EditFileInput   { path: string; old_string: string; new_string: string }
export interface DeleteFileInput { path: string }
export interface ListDirInput    { path?: string; recursive?: boolean }
export interface SearchFilesInput { query: string; base_dir?: string }
export interface RunCommandInput { command: string }
export interface NpmInstallInput { packages?: string[]; dev?: boolean }
export interface RunTestsInput   { script?: string }
export interface TaskCompleteInput { summary: string }

export type ToolInput =
  | WriteFileInput
  | ReadFileInput
  | EditFileInput
  | DeleteFileInput
  | ListDirInput
  | SearchFilesInput
  | RunCommandInput
  | NpmInstallInput
  | RunTestsInput
  | TaskCompleteInput;
