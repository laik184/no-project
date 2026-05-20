import type { ChildProcessWithoutNullStreams } from "node:child_process";

export interface TimeoutController {
  readonly timeoutFired: Promise<boolean>;
  cancel: () => void;
}

export function createTimeoutController(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Readonly<TimeoutController> {
  let timer: NodeJS.Timeout | null = null;
  let settled = false;
  let resolveTimeout: (timedOut: boolean) => void = () => undefined;

  const timeoutFired = new Promise<boolean>((resolve) => {
    resolveTimeout = resolve;
  });

  const settle = (timedOut: boolean): void => {
    if (settled) return;
    settled = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    resolveTimeout(timedOut);
  };

  timer = setTimeout(() => {
    if (!child.killed) {
      child.kill("SIGKILL");
    }
    settle(true);
  }, timeoutMs);

  child.once("close", () => {
    settle(false);
  });

  const cancel = () => {
    settle(false);
  };

  return Object.freeze({ timeoutFired, cancel });
}
