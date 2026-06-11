/**
 * server/tools/coding/generic/generate-generic-file.ts
 * Tool: coding_generate_generic_file
 *
 * Catch-all coding tool for any TypeScript/JavaScript file.
 * Uses the LLM to generate file content based on goal + path.
 * Handles: "create hello.ts with a function", "write utils.ts", etc.
 */

import type { ToolExecutionContext }                from '../../registry/tool-types.ts';
import { TIMEOUT }                                  from '../../registry/tool-metadata.ts';
import { defineCodingTool }                         from '../../registry/define-tool.ts';
import { codingOk, codingFail, llmResult }          from '../shared/coding-result.ts';
import { getLLMClient, getDefaultModel }            from '../../../shared/llm-client.ts';
import { parseCodeResponse, hasParseError }         from '../llm/response-parser.ts';

interface GenericFileInput {
  path?:    string;   // e.g. "hello.ts", "hello.txt", "src/utils/math.ts"
  goal?:    string;   // user goal / description of what to create
  content?: string;   // if provided, write directly without LLM
}

const RETRY_TWICE = { maxAttempts: 2, delayMs: 500, backoff: 'linear' as const };

export const generateGenericFileTool = defineCodingTool<GenericFileInput>({
  name:        'coding_generate_generic_file',
  category:    'coding',
  description: 'Generate any text/code file from a goal description. Uses LLM when content is not deterministic. Returns file map — does not write to disk.',
  inputSchema: {
    path:    { type: 'string', description: 'Target file path (e.g. hello.ts)',        required: false },
    goal:    { type: 'string', description: 'What to create (user goal description)',  required: false },
    content: { type: 'string', description: 'Explicit content to write (skips LLM)',  required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_TWICE,

  handler: async (input: GenericFileInput, ctx: ToolExecutionContext) => {
    const goal = input.goal?.trim() ?? '';
    const rawPath = input.path?.trim() ?? '';

    // Derive a sensible file path if none provided
    const filePath = rawPath || derivePathFromGoal(goal);

    if (!filePath) {
      return codingFail('Cannot determine target file path. Provide "path" or "goal" containing a filename.');
    }

    // If explicit content was provided, write directly. Empty string is valid content.
    if (Object.prototype.hasOwnProperty.call(input, 'content')) {
      return codingOk(llmResult(
        { [filePath]: input.content ?? '' },
        `Wrote ${filePath}`,
        true,
      ));
    }

    if (isPlainFileCreationGoal(goal, filePath)) {
      return codingOk(llmResult(
        { [filePath]: '' },
        `Created empty file ${filePath}`,
        true,
      ));
    }

    if (!goal) {
      return codingFail('Provide "goal" describing what code to generate, or "content" to write directly.');
    }

    // Call LLM to generate the file content
    try {
      const client = getLLMClient();
      const model  = getDefaultModel();

      const ext = filePath.split('.').pop() ?? 'ts';
      const isTs  = ext === 'ts' || ext === 'tsx';
      const langNote = isTs ? 'TypeScript (strict, no any)' : 'JavaScript (ES modules)';

      const system = `You are CodeGen — a precise code generation engine.
Produce production-quality ${langNote}.
Respond with ONLY a JSON object — no prose, no markdown outside the JSON.

Response format:
{
  "files": {
    "${filePath}": "<complete file contents here>"
  },
  "summary": "one-sentence description"
}

Rules:
- File contents must be complete and working — no TODOs, no stubs, no placeholders
- Use named exports; also export default for the main entity if applicable
- No duplicate imports, no circular imports`;

      const user = `Create the file "${filePath}" that accomplishes: ${goal}`;

      const response = await client.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens:  2048,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user   },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? '';
      const parsed = parseCodeResponse(raw);

      if (hasParseError(parsed)) {
        return codingFail(`LLM response could not be parsed: ${parsed.parseError}`);
      }

      if (Object.keys(parsed.files).length === 0) {
        return codingFail('LLM returned an empty files map. Try rephrasing your goal.');
      }

      // Ensure the target file is in the response (LLM may have renamed it)
      const files = parsed.files;
      if (!files[filePath] && Object.keys(files).length > 0) {
        const firstKey = Object.keys(files)[0]!;
        files[filePath] = files[firstKey]!;
        delete files[firstKey];
      }

      return codingOk(llmResult(files, parsed.summary, true));

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return codingFail(`LLM call failed: ${msg}`);
    }
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Try to extract a filename from the goal string.
 * e.g. "create hello.ts and write a function" → "hello.ts"
 */
function derivePathFromGoal(goal: string): string {
  const match = goal.match(/\b([\w/-]+\.[A-Za-z0-9]{1,12})\b/i);
  if (match) return match[1]!;

  // Fall back to a generic name based on goal keywords
  const lower = goal.toLowerCase();
  if (lower.includes('util'))   return 'utils.ts';
  if (lower.includes('helper')) return 'helpers.ts';
  if (lower.includes('type'))   return 'types.ts';
  if (lower.includes('config')) return 'config.ts';
  if (lower.includes('index'))  return 'index.ts';
  return 'generated.ts';
}

function isPlainFileCreationGoal(goal: string, filePath: string): boolean {
  if (!goal.trim()) return false;
  const lower = goal.toLowerCase();
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const codeExts = new Set(['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs', 'cjs', 'json']);
  return /\b(create|make|add)\b/.test(lower)
    && /\bfile\b/.test(lower)
    && !/\b(with|containing|that|which|function|component|class|export|import)\b/.test(lower)
    && !codeExts.has(ext);
}
