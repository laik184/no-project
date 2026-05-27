import type { PlanTask } from '../../executor/types/executor.types.ts';
import { getLLMApiKey, getLLMModel, getLLMBaseUrl } from './llm-client.ts';

export interface ToolLoopResult {
  success:   boolean;
  summary:   string;
  artifacts: string[];
  steps:     number;
  error?:    string;
}

export async function runToolLoop(
  task:      PlanTask,
  runId:     string,
  projectId: string,
): Promise<ToolLoopResult> {
  const apiKey = getLLMApiKey();
  if (!apiKey) {
    return {
      success:   false,
      summary:   'LLM not available — missing API key',
      artifacts: [],
      steps:     0,
      error:     'MISSING_API_KEY',
    };
  }

  try {
    const { OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey,
      baseURL: getLLMBaseUrl(),
      defaultHeaders: { 'HTTP-Referer': 'https://nura-x.replit.app' },
    });

    const response = await client.chat.completions.create({
      model:      getLLMModel(),
      max_tokens: 2048,
      messages: [
        {
          role:    'system',
          content: 'You are an expert software engineer. Generate concise, production-ready code.',
        },
        {
          role:    'user',
          content: `Task: ${task.description ?? task.id}\nCategory: ${task.category ?? 'general'}\nProject: ${projectId}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? '';
    return {
      success:   true,
      summary:   content.slice(0, 200),
      artifacts: [],
      steps:     1,
    };
  } catch (err) {
    return {
      success:   false,
      summary:   String(err),
      artifacts: [],
      steps:     0,
      error:     String(err),
    };
  }
}
