/**
 * server/sandbox/runtime/command-whitelist.ts
 * Defines allowed commands and blocks forbidden ones.
 * Single responsibility: command validation. No execution.
 */

export interface CommandCheckResult {
  blocked:  boolean;
  reason?:  string;
  category: "allowed" | "blocked" | "restricted";
}

// Absolutely forbidden — block immediately
const FORBIDDEN: RegExp[] = [
  /rm\s+-rf\s+\//,
  /sudo\s+(su|bash|sh|-s|-i)/,
  /chmod\s+(777|a\+[rwx]+)\s+\//,
  /chown\s+root/,
  /mount\s+/,
  /mkfs\./,
  /dd\s+if=.*of=\/dev/,
  />\s*\/(?:etc|proc|sys|dev)\//,
  /(?:python3?|perl|ruby)\s+-[ce].*socket/,
  /nc\s+-[elu].*-e\s+\/bin/,                // reverse shells
  /base64\s+.*\|\s*(?:bash|sh|zsh)/,
  /kill\s+-9\s+1\b/,
  /shutdown|reboot|halt\b/,
  /iptables|ip6tables/,
  /passwd\b.*--/,
];

// Restricted — allowed but logged and rate-limited in production
const RESTRICTED: RegExp[] = [
  /curl\s+/,
  /wget\s+/,
  /npm\s+publish/,
  /git\s+push/,
  /ssh\s+/,
  /scp\s+/,
  /rsync\s+/,
];

// Explicitly safe prefixes (fast-path allow)
const SAFE_PREFIXES: string[] = [
  "npm install", "npm run", "npm test", "npm ci",
  "npx ", "node ", "tsx ", "tsc ",
  "git status", "git diff", "git log", "git add", "git commit",
  "ls ", "cat ", "echo ", "mkdir ", "cp ", "mv ", "touch ",
  "yarn ", "pnpm ", "vite ", "vitest ",
];

export function validateCommand(command: string): CommandCheckResult {
  const cmd = command.trim();

  // Fast-path: safe prefixes
  if (SAFE_PREFIXES.some(p => cmd.startsWith(p))) {
    return { blocked: false, category: "allowed" };
  }

  // Block forbidden
  for (const pattern of FORBIDDEN) {
    if (pattern.test(cmd)) {
      return {
        blocked:  true,
        reason:   `Command blocked — matches forbidden pattern: "${pattern.source}"`,
        category: "blocked",
      };
    }
  }

  // Flag restricted
  for (const pattern of RESTRICTED) {
    if (pattern.test(cmd)) {
      return {
        blocked:  false,
        reason:   `Restricted command — monitor closely: "${cmd.slice(0, 60)}"`,
        category: "restricted",
      };
    }
  }

  return { blocked: false, category: "allowed" };
}
