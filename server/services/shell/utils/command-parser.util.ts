export function sanitizeToken(value: string): string {
  return value.trim();
}

export function normalizeArgs(args: readonly string[] | undefined): readonly string[] {
  if (!args || args.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze(args.map(sanitizeToken).filter((token) => token.length > 0));
}

export function hasInjectionTokens(input: string): boolean {
  const lowered = input.toLowerCase();
  return ["&&", "||", ";", "`", "$(", "\\n", "\\r", "|"].some((token) => lowered.includes(token));
}
