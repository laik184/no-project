export function isValidRedirectUri(uri: string, allowedUris: readonly string[]): boolean {
  try {
    const parsed = new URL(uri);
    return allowedUris.some((allowed) => {
      try {
        const allowedParsed = new URL(allowed);
        return (
          parsed.protocol === allowedParsed.protocol &&
          parsed.host === allowedParsed.host &&
          parsed.pathname === allowedParsed.pathname
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function buildRedirectWithCode(redirectUri: string, code: string, state?: string): string {
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

export function buildRedirectWithError(redirectUri: string, error: string): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  return url.toString();
}
