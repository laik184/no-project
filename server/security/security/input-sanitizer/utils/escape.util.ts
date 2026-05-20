const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
});

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

export function escapeSql(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\x00/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z");
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripNullBytes(input: string): string {
  return input.replace(/\x00/g, "");
}

export function stripControlChars(input: string): string {
  return input.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}
