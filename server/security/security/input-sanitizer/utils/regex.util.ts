export const PATTERNS = Object.freeze({
  SCRIPT_TAG: /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  OPEN_SCRIPT_TAG: /<script[^>]*>/gi,
  CLOSE_SCRIPT_TAG: /<\/script>/gi,
  ON_EVENT_ATTR: /\s*on\w+\s*=\s*["'][^"']*["']/gi,
  ON_EVENT_UNQUOTED: /\s*on\w+\s*=\s*[^\s>]*/gi,
  JAVASCRIPT_PROTO: /javascript\s*:/gi,
  VBSCRIPT_PROTO: /vbscript\s*:/gi,
  DATA_PROTO_SCRIPT: /data\s*:\s*text\/html/gi,
  DANGEROUS_TAGS: /<(iframe|object|embed|applet|link|meta|base|form)[^>]*>/gi,
  CLOSE_DANGEROUS_TAGS: /<\/(iframe|object|embed|applet|link|meta|base|form)>/gi,
  HTML_TAG: /<[^>]+>/g,
  SQL_COMMENT: /(--|#|\/\*|\*\/)/g,
  SQL_KEYWORDS: /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|CAST|CONVERT|DECLARE|TRUNCATE|GRANT|REVOKE|INTO|OUTFILE|LOAD_FILE)\b/gi,
  SQL_TAUTOLOGY: /('\s*OR\s*'?\s*\d+\s*=\s*\d+'?|'\s*OR\s*'1'='1)/gi,
  NULL_BYTE: /\x00/g,
  CONTROL_CHARS: /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
  UNSAFE_PROTO: /^(javascript|vbscript|data|file):.*$/i,
  ALLOWED_URL: /^(https?|ftp|mailto):\/\/.+/i,
  WHITESPACE_COLLAPSE: /\s{2,}/g,
});

export function test(pattern: RegExp, input: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(input);
}

export function replace(pattern: RegExp, input: string, replacement: string = ""): string {
  pattern.lastIndex = 0;
  return input.replace(pattern, replacement);
}
