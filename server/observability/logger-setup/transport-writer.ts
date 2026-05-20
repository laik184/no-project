import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { LogEntry, LogLevel, TransportConfig } from "./types.js";

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = Object.freeze({
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
});

export function isLevelEnabled(entryLevel: LogLevel, configLevel: LogLevel): boolean {
  return LEVEL_ORDER[entryLevel] >= LEVEL_ORDER[configLevel];
}

export function writeToTransport(
  transport: Readonly<TransportConfig>,
  line: string,
): void {
  if (transport.type === "console") {
    process.stdout.write(line + "\n");
    return;
  }
  if (transport.type === "file" && transport.filePath) {
    try {
      mkdirSync(dirname(transport.filePath), { recursive: true });
      appendFileSync(transport.filePath, line + "\n", "utf8");
    } catch {
      process.stderr.write(
        `[logger] Failed to write to file transport: ${transport.filePath}\n`,
      );
    }
  }
}

export function dispatchEntry(
  entry: Readonly<LogEntry>,
  serialize: (e: Readonly<LogEntry>) => string,
  transports: readonly Readonly<TransportConfig>[],
): void {
  const line = serialize(entry);
  for (const transport of transports) {
    writeToTransport(transport, line);
  }
}
