import type { StepType } from '../../executor/types/execution.types.ts';

export type ToolName =
  | 'file_writer'
  | 'file_editor'
  | 'shell_executor'
  | 'npm_manager'
  | 'validator';

export interface ToolSelection {
  primary:   ToolName;
  fallback?: ToolName;
  reason:    string;
}

const STEP_TOOL_MAP: Record<StepType, ToolSelection> = {
  generate_frontend:  { primary: 'file_writer',    reason: 'Generates new frontend file' },
  generate_backend:   { primary: 'file_writer',    reason: 'Generates new backend file' },
  generate_api:       { primary: 'file_writer',    reason: 'Generates API handler file' },
  generate_database:  { primary: 'file_writer',    reason: 'Generates schema file' },
  generate_auth:      { primary: 'file_writer',    reason: 'Generates auth system files' },
  generate_component: { primary: 'file_writer',    reason: 'Generates React component file' },
  write_file:         { primary: 'file_writer',    reason: 'Writes raw file content' },
  edit_file:          { primary: 'file_editor',    fallback: 'file_writer', reason: 'Edits existing file' },
  npm_install:        { primary: 'npm_manager',    reason: 'Installs npm packages' },
  npm_run:            { primary: 'npm_manager',    reason: 'Runs npm script' },
  run_command:        { primary: 'shell_executor', reason: 'Runs safe shell command' },
  validate_output:    { primary: 'validator',      reason: 'Validates generated output' },
  checkpoint:         { primary: 'file_writer',    reason: 'Creates filesystem snapshot' },
};

export function selectTool(stepType: StepType): ToolSelection {
  const selection = STEP_TOOL_MAP[stepType];
  if (!selection) {
    throw new Error(`No tool mapping for step type: ${stepType}`);
  }
  return selection;
}

export function requiresFileAccess(stepType: StepType): boolean {
  return ['generate_frontend', 'generate_backend', 'generate_api', 'generate_database',
    'generate_auth', 'generate_component', 'write_file', 'edit_file', 'checkpoint'].includes(stepType);
}

export function requiresShellAccess(stepType: StepType): boolean {
  return ['npm_install', 'npm_run', 'run_command'].includes(stepType);
}
