export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ParsedResponse {
  thought: string;
  toolCall?: ToolCall;
  done: boolean;
  summary?: string;
  parseError?: string;
  raw: string;
}

function extractJSON(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) return text.slice(first, last + 1);

  return text.trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseResponse(raw: string): ParsedResponse {
  const jsonStr = extractJSON(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      thought: '',
      done: false,
      parseError: 'LLM response is not valid JSON',
      raw,
    };
  }

  if (!isRecord(parsed)) {
    return {
      thought: '',
      done: false,
      parseError: 'Parsed value is not an object',
      raw,
    };
  }

  const thought = typeof parsed.thought === 'string' ? parsed.thought : '';
  const done = parsed.done === true;
  const summary = typeof parsed.summary === 'string' ? parsed.summary : undefined;

  if (done) {
    return { thought, done: true, summary, raw };
  }

  if (!isRecord(parsed.tool_call)) {
    return {
      thought,
      done: false,
      parseError: 'Missing or invalid tool_call field',
      raw,
    };
  }

  const tc = parsed.tool_call;
  if (typeof tc.name !== 'string') {
    return {
      thought,
      done: false,
      parseError: 'tool_call.name must be a string',
      raw,
    };
  }

  return {
    thought,
    done: false,
    toolCall: {
      name: tc.name,
      arguments: isRecord(tc.arguments) ? tc.arguments : {},
    },
    raw,
  };
}
