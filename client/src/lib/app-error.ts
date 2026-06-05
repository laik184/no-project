/**
 * client/src/lib/app-error.ts
 *
 * Frontend error utilities.
 * Converts API error responses and thrown values into toast notifications.
 * Replaces all direct alert() calls across the codebase.
 */

export interface ApiErrorBody {
  errorId?:            string;
  type?:               string;
  title?:              string;
  message?:            string;
  recoverySuggestion?: string;
  severity?:           string;
}

export interface ApiResponse {
  ok:     boolean;
  error?: ApiErrorBody | string;
  [key: string]: unknown;
}

type ToastFn = (opts: {
  title:        string;
  description?: string;
  variant?:     'default' | 'destructive';
}) => void;

/**
 * Displays a structured error toast.
 *
 * Handles three input shapes:
 *  1. A structured `ApiErrorBody` from the new error framework
 *  2. A plain string error message
 *  3. A caught `Error` or unknown exception
 *
 * @param toast    The toast function from useToast()
 * @param err      The error — ApiErrorBody, string, or thrown value
 * @param fallback Fallback title when err has no title (default: "Something went wrong")
 */
export function toastError(
  toast:    ToastFn,
  err:      ApiErrorBody | string | unknown,
  fallback = 'Something went wrong',
): void {
  let title       = fallback;
  let description: string | undefined;

  if (err && typeof err === 'object' && 'title' in (err as object)) {
    const e = err as ApiErrorBody;
    title       = e.title ?? fallback;
    description = [e.message, e.recoverySuggestion].filter(Boolean).join(' — ') || undefined;
  } else if (typeof err === 'string' && err.length > 0) {
    description = err;
  } else if (err instanceof Error) {
    description = err.message;
  }

  toast({ title, description, variant: 'destructive' });
}

/**
 * Displays a success toast.
 */
export function toastSuccess(toast: ToastFn, title: string, description?: string): void {
  toast({ title, description, variant: 'default' });
}

/**
 * Extracts the error payload from an API response body.
 * Returns null if the response was successful.
 */
export function extractApiError(json: ApiResponse): ApiErrorBody | null {
  if (json.ok) return null;
  if (!json.error) return { message: 'An unexpected error occurred.' };
  if (typeof json.error === 'string') return { message: json.error };
  return json.error as ApiErrorBody;
}

/**
 * Convenience: fetch + parse + toast on failure.
 * Returns the parsed JSON on success, undefined on error.
 *
 * Usage:
 *   const data = await fetchWithToast(toast, '/api/foo', { method: 'POST', ... });
 *   if (data) { ... }
 */
export async function fetchWithToast<T extends ApiResponse>(
  toast:   ToastFn,
  url:     string,
  options?: RequestInit,
  fallbackTitle = 'Request Failed',
): Promise<T | undefined> {
  try {
    const res  = await fetch(url, options);
    const json = await res.json() as T;
    if (!json.ok) {
      const err = extractApiError(json);
      toastError(toast, err ?? fallbackTitle, fallbackTitle);
      return undefined;
    }
    return json;
  } catch (e) {
    toastError(toast, e, fallbackTitle);
    return undefined;
  }
}
