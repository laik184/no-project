export function getEnvString(key: string, fallback: string): string {
  const val = process.env[key];
  return typeof val === "string" && val.length > 0 ? val : fallback;
}

export function getEnvBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === "true") return true;
  if (val === "false") return false;
  return fallback;
}

export function getEnvNumber(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined || val === "") return fallback;
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}
