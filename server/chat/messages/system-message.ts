/**
 * system-message.ts — Constructs system message payloads.
 * Owns system prompt templates and injection rules.
 */
import type { SystemMessagePayload } from '../types/message.types.ts';

const SYSTEM_PROMPT_BASE = `You are NURA-X, an autonomous AI coding agent.
You plan, write, test, and deploy code to fulfil the user's goal.
Always be precise, fail-closed, and explain your actions.`;

/**
 * Builds the base system prompt for an agent run.
 */
export function buildBaseSystemPayload(
  projectId:   number,
  sandboxRoot: string,
  runId?:      string,
): SystemMessagePayload {
  const content = [
    SYSTEM_PROMPT_BASE,
    `Sandbox root: ${sandboxRoot}`,
    `Project ID: ${projectId}`,
  ].join('\n');

  return { projectId, runId, content };
}

/**
 * Builds a context-injection system message (e.g., file content, run history).
 */
export function buildContextInjectionPayload(
  projectId: number,
  context:   string,
  runId?:    string,
): SystemMessagePayload {
  return {
    projectId,
    runId,
    content: `<context>\n${context}\n</context>`,
  };
}
