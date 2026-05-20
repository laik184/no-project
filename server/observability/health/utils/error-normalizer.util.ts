export function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err !== null && typeof err === "object") {
    const asObj = err as Record<string, unknown>;
    if (typeof asObj["message"] === "string") return asObj["message"];
  }
  return "Unknown error";
}

export function normalizeErrorWithName(err: unknown): { name: string; message: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { name: "Error", message: normalizeError(err) };
}

export function isCritical(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.name === "ReferenceError" ||
      err.name === "TypeError" ||
      err.name === "SyntaxError"
    );
  }
  return false;
}
