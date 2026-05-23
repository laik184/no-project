/**
 * system-prompt.agent.ts  (Phase 1 split — thin facade ≤10 lines)
 *
 * Builds the system prompt used by every agent run.
 * The prompt constant is in system-prompt.constant.ts to keep this file ≤250 lines.
 */

import { cleanString }          from "../utils/string-cleaner.util.js";
import { DEFAULT_SYSTEM_PROMPT } from "./system-prompt.constant.ts";

export { DEFAULT_SYSTEM_PROMPT };

export function buildSystemPrompt(input?: string): string {
  return cleanString(input && input.trim().length > 0 ? input : DEFAULT_SYSTEM_PROMPT);
}
