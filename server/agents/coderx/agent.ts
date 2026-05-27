import OpenAI               from 'openai';
import { buildPrompt }      from './prompt.ts';
import { parseResponse }    from './parser.ts';
import { dispatch }         from './dispatcher.ts';
import type { PromptContext } from './prompt.ts';
import type { ParsedResponse } from './parser.ts';
import type { DispatchOptions } from './dispatcher.ts';

export interface LoopOptions {
  task:               string;
  basePath:           string;
  projectFiles?:      Record<string, string>;
  extraInstructions?: string;
  maxIterations?:     number;
  timeoutMs?:         number;
}

export interface LoopResult {
  success:      boolean;
  summary?:     string;
  iterations:   number;
  observations: string[];
  error?:       string;
}

interface ToolSignature {
  name:     string;
  argsHash: string;
}

const MAX_ITERATIONS    = 20;
const DEFAULT_TIMEOUT   = 120_000;

function hashArgs(args: Record<string, unknown>): string {
  return JSON.stringify(args);
}

function isDuplicate(sig: ToolSignature, seen: ToolSignature[]): boolean {
  return seen.some(s => s.name === sig.name && s.argsHash === sig.argsHash);
}

function buildClient(): OpenAI {
  const apiKey  = process.env.OPENROUTER_API_KEY ?? process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ?? '';
  const baseURL = process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1';
  return new OpenAI({ apiKey, baseURL });
}

async function callLLM(client: OpenAI, system: string, user: string): Promise<string> {
  const model = process.env.LLM_MODEL ?? 'openai/gpt-4o-mini';
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user   },
    ],
    temperature: 0.2,
  });
  return res.choices[0]?.message?.content ?? '';
}

export async function runToolLoop(opts: LoopOptions): Promise<LoopResult> {
  const maxIter     = opts.maxIterations ?? MAX_ITERATIONS;
  const timeoutMs   = opts.timeoutMs     ?? DEFAULT_TIMEOUT;
  const dispatchOpts: DispatchOptions = { basePath: opts.basePath };
  const client      = buildClient();

  const observations: string[]         = [];
  const seenTools:    ToolSignature[]  = [];
  const deadline = Date.now() + timeoutMs;

  for (let i = 0; i < maxIter; i++) {
    if (Date.now() > deadline) {
      return { success: false, iterations: i, observations, error: 'Timeout exceeded' };
    }

    const ctx: PromptContext = {
      task:               opts.task,
      projectFiles:       opts.projectFiles,
      extraInstructions:  opts.extraInstructions,
      iteration:          i + 1,
      observations,
    };

    const { system, user } = buildPrompt(ctx);

    let raw: string;
    try {
      raw = await callLLM(client, system, user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, iterations: i + 1, observations, error: `LLM error: ${msg}` };
    }

    const parsed: ParsedResponse = parseResponse(raw);

    if (parsed.parseError) {
      observations.push(`[parse error] ${parsed.parseError}`);
      continue;
    }

    if (parsed.done) {
      return { success: true, summary: parsed.summary, iterations: i + 1, observations };
    }

    if (!parsed.toolCall) {
      observations.push('[warning] No tool call and not done — skipping turn');
      continue;
    }

    const sig: ToolSignature = { name: parsed.toolCall.name, argsHash: hashArgs(parsed.toolCall.arguments) };

    if (isDuplicate(sig, seenTools)) {
      observations.push(`[loop guard] Duplicate tool call: ${sig.name} — stopping`);
      return { success: false, iterations: i + 1, observations, error: 'Repeated tool call detected' };
    }

    seenTools.push(sig);

    const result = await dispatch(parsed.toolCall.name, parsed.toolCall.arguments, dispatchOpts);
    observations.push(
      result.success
        ? `[${parsed.toolCall.name}] OK — ${result.output.slice(0, 200)}`
        : `[${parsed.toolCall.name}] ERROR — ${result.error}`,
    );
  }

  return {
    success:    false,
    iterations: maxIter,
    observations,
    error:      `Max iterations (${maxIter}) reached without completion`,
  };
}
