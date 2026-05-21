/**
 * server/browser/checks/console-error-collector.ts
 * Collects console errors from the project's runtime log output.
 * Single responsibility: error collection from runtime logs. Read-only.
 */

import fs   from "fs/promises";
import path from "path";
import { getProjectDir } from "../../infrastructure/sandbox/sandbox.util.ts";
import type { ConsoleError } from "../types.ts";

const LOG_PATTERNS: Array<{ re: RegExp; level: ConsoleError["level"] }> = [
  { re: /^\s*error[:\s]/i,   level: "error" },
  { re: /^\s*warn(?:ing)?[:\s]/i, level: "warning" },
  { re: /uncaught\s+(?:type)?error/i, level: "error" },
  { re: /failed\s+to\s+(?:load|fetch|compile)/i, level: "error" },
  { re: /cannot\s+read\s+(?:property|properties)/i, level: "error" },
];

export async function collectConsoleErrors(
  projectId: number,
): Promise<ConsoleError[]> {
  const logPath = path.join(getProjectDir(projectId), ".nura", "runtime.log");
  const errors  = new Map<string, ConsoleError>();

  try {
    const content = await fs.readFile(logPath, "utf8");
    const lines   = content.split("\n").slice(-200); // last 200 lines

    for (const line of lines) {
      for (const { re, level } of LOG_PATTERNS) {
        if (re.test(line)) {
          const key = line.trim().slice(0, 80);
          if (errors.has(key)) {
            errors.get(key)!.count++;
          } else {
            errors.set(key, { level, message: key, count: 1 });
          }
          break;
        }
      }
    }
  } catch {
    // No log file yet — that's fine on first run
  }

  return [...errors.values()].sort((a, b) => b.count - a.count).slice(0, 20);
}

export function hasRepeatedErrors(errors: ConsoleError[], threshold = 3): boolean {
  return errors.some(e => e.level === "error" && e.count >= threshold);
}
