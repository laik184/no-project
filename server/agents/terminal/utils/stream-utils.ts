const ANSI_ESCAPE_RE = /\x1B\[[0-9;]*[A-Za-z]/g;
const CTRL_CHAR_RE   = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_RE, '').replace(CTRL_CHAR_RE, '');
}

export function splitLines(chunk: string): string[] {
  return chunk.split('\n');
}

export function truncateOutput(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(-maxChars);
}

export function isSuspiciousOutput(stdout: string, exitCode: number): boolean {
  if (exitCode !== 0) return false;
  const lower = stdout.toLowerCase();
  return (
    lower.includes('error:') ||
    lower.includes('fatal:') ||
    lower.includes('cannot find module')
  );
}

export function estimateBytes(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}
