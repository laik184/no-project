export interface Debouncer {
  schedule: (content: string) => void;
  cancel: () => void;
  flush: () => Promise<void>;
}

export function createDebounce(
  fn: (content: string) => Promise<void>,
  ms: number,
): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: string | null = null;

  const cancel = () => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    pending = null;
  };

  const flush = async () => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    if (pending !== null) {
      const c = pending;
      pending = null;
      await fn(c);
    }
  };

  const schedule = (content: string) => {
    pending = content;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      if (pending !== null) {
        const c = pending;
        pending = null;
        await fn(c);
      }
    }, ms);
  };

  return { schedule, cancel, flush };
}
