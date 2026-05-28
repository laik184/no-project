/**
 * server/agents/executor/reasoning/task-analyzer.ts
 *
 * Converts a user goal into an annotated execution graph with:
 *   - subtasks and descriptions
 *   - inferred dependencies
 *   - risk flags
 *   - validation requirements
 *   - agent and tool requirements
 *
 * No LLM calls — deterministic keyword-based analysis.
 * No tool imports. No execution.
 */

import type { TaskKind } from '../types/executor.types.ts';

// ── Output types ──────────────────────────────────────────────────────────────

export type SubtaskCategory = 'setup' | 'implementation' | 'testing' | 'deployment' | 'validation' | 'cleanup';

export interface AnalyzedSubtask {
  id:                  string;
  label:               string;
  description:         string;
  category:            SubtaskCategory;
  requiredKind:        TaskKind;
  estimatedComplexity: 'low' | 'medium' | 'high';
  dependsOn:           string[];          // subtask ids
  requiresValidation:  boolean;
  riskFlags:           string[];
  toolHints:           string[];
}

export interface TaskAnalysis {
  goal:             string;
  subtasks:         AnalyzedSubtask[];
  totalComplexity:  'low' | 'medium' | 'high';
  requiresBrowser:  boolean;
  requiresFilesystem: boolean;
  requiresTerminal: boolean;
  requiresVerify:   boolean;
  estimatedMs:      number;
  risks:            string[];
}

// ── Patterns ──────────────────────────────────────────────────────────────────

const BROWSER_SIGNALS   = /\b(ui|click|navigate|screenshot|browser|dom|visual|page|e2e)\b/i;
const TERMINAL_SIGNALS  = /\b(install|npm|yarn|build|compile|run|exec|bash|shell|command|migrate|seed)\b/i;
const CODING_SIGNALS    = /\b(create|write|edit|fix|refactor|add|implement|generate|update|delete)\b/i;
const VERIFY_SIGNALS    = /\b(test|verify|check|validate|lint|typecheck|spec|assert)\b/i;
const FS_SIGNALS        = /\b(file|folder|directory|move|copy|rename|delete|read|write|path)\b/i;
const HIGH_RISK         = /\b(delete|drop|truncate|reset|purge|wipe|remove all|destroy)\b/i;
const MEDIUM_RISK       = /\b(migrate|upgrade|modify.*schema|change.*database|alter)\b/i;

let _seq = 0;
function _id(): string { return `task_${++_seq}`; }

function _complexity(goal: string, subCount: number): 'low' | 'medium' | 'high' {
  if (subCount >= 5 || goal.length > 200) return 'high';
  if (subCount >= 3 || goal.length > 80)  return 'medium';
  return 'low';
}

function _estimateMs(complexity: 'low' | 'medium' | 'high'): number {
  return complexity === 'high' ? 120_000 : complexity === 'medium' ? 60_000 : 30_000;
}

function _extractRisks(goal: string): string[] {
  const risks: string[] = [];
  if (HIGH_RISK.test(goal))   risks.push('Destructive operation detected — verify intent before execution');
  if (MEDIUM_RISK.test(goal)) risks.push('Schema-altering operation — ensure backup before proceeding');
  if (/production|prod\b/i.test(goal)) risks.push('Production environment target — use dry-run first');
  if (/auth|password|secret|token/i.test(goal)) risks.push('Credential-adjacent operation — audit output carefully');
  return risks;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function analyzeTask(goal: string): TaskAnalysis {
  const requiresBrowser    = BROWSER_SIGNALS.test(goal);
  const requiresTerminal   = TERMINAL_SIGNALS.test(goal);
  const requiresFilesystem = FS_SIGNALS.test(goal) || CODING_SIGNALS.test(goal);
  const requiresVerify     = VERIFY_SIGNALS.test(goal);
  const risks              = _extractRisks(goal);
  const subtasks:           AnalyzedSubtask[] = [];

  // Always start with a setup task
  const setupId = _id();
  subtasks.push({
    id: setupId, label: 'Setup execution context',
    description: 'Validate environment and prepare sandbox for task execution',
    category: 'setup', requiredKind: 'filesystem',
    estimatedComplexity: 'low', dependsOn: [],
    requiresValidation: false, riskFlags: [],
    toolHints: ['check_filesystem', 'list_directory'],
  });

  // Coding/implementation
  if (requiresFilesystem || CODING_SIGNALS.test(goal)) {
    const implId = _id();
    subtasks.push({
      id: implId, label: 'Implementation',
      description: `Apply code changes: ${goal.slice(0, 80)}`,
      category: 'implementation', requiredKind: 'coding',
      estimatedComplexity: _complexity(goal, 3),
      dependsOn: [setupId], requiresValidation: true,
      riskFlags: risks,
      toolHints: ['write_file', 'apply_patch', 'create_file'],
    });
  }

  // Terminal operations
  if (requiresTerminal) {
    const termId = _id();
    const priorId = subtasks[subtasks.length - 1].id;
    subtasks.push({
      id: termId, label: 'Execute commands',
      description: 'Run terminal commands required by the task',
      category: 'implementation', requiredKind: 'terminal',
      estimatedComplexity: 'medium', dependsOn: [priorId],
      requiresValidation: true, riskFlags: risks,
      toolHints: ['run_terminal_command', 'execute_bash'],
    });
  }

  // Browser interaction
  if (requiresBrowser) {
    const browseId = _id();
    const priorId = subtasks[subtasks.length - 1].id;
    subtasks.push({
      id: browseId, label: 'Browser interaction',
      description: 'Navigate and interact with the UI',
      category: 'implementation', requiredKind: 'browser',
      estimatedComplexity: 'high', dependsOn: [priorId],
      requiresValidation: true, riskFlags: [],
      toolHints: ['navigate_page', 'click_element', 'capture_screenshot'],
    });
  }

  // Verification
  if (requiresVerify || subtasks.some((s) => s.requiresValidation)) {
    const verifyId = _id();
    const priorId = subtasks[subtasks.length - 1].id;
    subtasks.push({
      id: verifyId, label: 'Verification',
      description: 'Validate that the task was completed successfully',
      category: 'validation', requiredKind: 'verify',
      estimatedComplexity: 'low', dependsOn: [priorId],
      requiresValidation: false, riskFlags: [],
      toolHints: ['run_typecheck', 'run_tests', 'verify_build'],
    });
  }

  const totalComplexity = _complexity(goal, subtasks.length);

  return {
    goal, subtasks, totalComplexity, requiresBrowser,
    requiresFilesystem, requiresTerminal, requiresVerify,
    estimatedMs: _estimateMs(totalComplexity),
    risks,
  };
}
