export class TimeoutError extends Error {
  constructor(name: string, timeoutMs: number) {
    super(`Check "${name}" timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(label, timeoutMs));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function nowMs(): number {
  return Date.now();
}

export function elapsedMs(startMs: number): number {
  return Date.now() - startMs;
}
