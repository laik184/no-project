import { randomUUID } from "node:crypto";

export function generateTraceId(): string {
  return randomUUID().replace(/-/g, "");
}

export function generateSpanId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

export function isValidTraceId(id: string): boolean {
  return /^[0-9a-f]{32}$/.test(id);
}

export function isValidSpanId(id: string): boolean {
  return /^[0-9a-f]{16}$/.test(id);
}
