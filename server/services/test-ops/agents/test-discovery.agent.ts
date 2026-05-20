import { join } from "node:path";

import type { DiscoveryResult } from "../types.js";
import { appendLog } from "../utils/logger.util.js";
import { fileSystemService } from "../../../../../services/index.js";

const TEST_FILE_RE = /\.(test|spec)\.ts$/;

async function walkForTests(rootDir: string): Promise<readonly string[]> {
  const discovered: string[] = [];
  const entries = await fileSystemService.readDir(rootDir);

  for (const entryName of entries) {
    const fullPath = join(rootDir, entryName);
    let stat: { readonly isFile: boolean; readonly isDirectory: boolean; readonly size: number; readonly mtimeMs: number };
    try {
      stat = await fileSystemService.stat(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory) {
      if (entryName === "node_modules" || entryName.startsWith(".")) continue;
      const nested = await walkForTests(fullPath);
      discovered.push(...nested);
      continue;
    }

    if (stat.isFile && TEST_FILE_RE.test(entryName)) {
      discovered.push(fullPath);
    }
  }

  return Object.freeze(discovered);
}

export async function discoverTests(cwd: string = process.cwd()): Promise<DiscoveryResult> {
  let logs = Object.freeze([]) as readonly string[];
  logs = appendLog(logs, "INFO", `Scanning for tests in ${cwd}`);

  const files = await walkForTests(cwd);
  logs = appendLog(logs, "INFO", `Discovered ${files.length} test file(s)`);

  return Object.freeze({ files, logs });
}
