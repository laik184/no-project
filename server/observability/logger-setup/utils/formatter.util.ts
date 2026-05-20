import type { FormatType, LogEntry } from "../types.js";

export function formatEntry(entry: LogEntry, format: FormatType): string {
  if (format === "pretty") {
    const parts: string[] = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.message,
    ];

    if (entry.requestId) parts.push(`| requestId=${entry.requestId}`);
    if (entry.service) parts.push(`| service=${entry.service}`);
    if (entry.environment) parts.push(`| env=${entry.environment}`);
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      parts.push(`| meta=${JSON.stringify(entry.meta)}`);
    }
    if (entry.error) {
      parts.push(`| error=${entry.error.name}: ${entry.error.message}`);
      if (entry.error.stack) parts.push(`| stack=${entry.error.stack}`);
    }

    return parts.join(" ");
  }

  return JSON.stringify(entry);
}
