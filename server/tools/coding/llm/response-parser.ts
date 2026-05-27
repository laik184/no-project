/**
 * server/tools/coding/llm/response-parser.ts
 *
 * Parses LLM generation responses into structured file maps.
 * Pure function — no side effects, no I/O.
 */

import type { ParsedCodeResponse } from './generation-context.ts';

function extractJsonString(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first !== -1 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringRecord(v: unknown): v is Record<string, string> {
  if (!isRecord(v)) return false;
  return Object.values(v).every(val => typeof val === 'string');
}

export function parseCodeResponse(raw: string): ParsedCodeResponse {
  const jsonStr = extractJsonString(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { files: {}, summary: '', parseError: `Response is not valid JSON. Got: ${raw.slice(0, 200)}` };
  }

  if (!isRecord(parsed)) {
    return { files: {}, summary: '', parseError: 'Parsed value is not an object' };
  }

  if (!isRecord(parsed.files)) {
    return { files: {}, summary: '', parseError: 'Missing or non-object "files" field' };
  }

  if (!isStringRecord(parsed.files)) {
    return { files: {}, summary: '', parseError: 'All "files" values must be strings' };
  }

  const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Generated code';

  return { files: parsed.files as Record<string, string>, summary };
}

export function hasParseError(r: ParsedCodeResponse): r is ParsedCodeResponse & { parseError: string } {
  return typeof r.parseError === 'string';
}
