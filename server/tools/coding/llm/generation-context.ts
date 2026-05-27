/**
 * server/tools/coding/llm/generation-context.ts
 *
 * Type contract for LLM generation context.
 * Decouples tool handlers from prompt/response internals.
 */

export interface GenerationContext {
  toolName:       string;
  task:           string;
  framework?:     'react' | 'express' | 'nextjs' | 'none';
  language?:      'typescript' | 'javascript';
  style?:         'tailwind' | 'css-modules' | 'styled-components' | 'none';
  extraRules?:    string[];
  targetFiles?:   string[];
  maxFiles?:      number;
}

export interface BuiltPrompt {
  system: string;
  user:   string;
}

export interface ParsedCodeResponse {
  files:       Record<string, string>;
  summary:     string;
  parseError?: string;
}

export interface LlmCallOptions {
  timeoutMs?:   number;
  temperature?: number;
  maxTokens?:   number;
}
