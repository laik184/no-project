import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { MonitoredProcessOutput } from "../types.js";
import { parseStreamChunk } from "../utils/stream-parser.util.js";

export async function monitorProcess(
  child: ChildProcessWithoutNullStreams,
): Promise<Readonly<MonitoredProcessOutput>> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let stdoutRemainder = "";
  let stderrRemainder = "";

  child.stdout.on("data", (chunk: Buffer) => {
    const parsed = parseStreamChunk(stdoutRemainder, chunk);
    stdoutRemainder = parsed.remainder;
    stdoutLines.push(...parsed.lines);
  });

  child.stderr.on("data", (chunk: Buffer) => {
    const parsed = parseStreamChunk(stderrRemainder, chunk);
    stderrRemainder = parsed.remainder;
    stderrLines.push(...parsed.lines);
  });

  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (exitCode, signal) => {
      if (stdoutRemainder.length > 0) {
        stdoutLines.push(stdoutRemainder);
      }
      if (stderrRemainder.length > 0) {
        stderrLines.push(stderrRemainder);
      }

      resolve(
        Object.freeze<MonitoredProcessOutput>({
          stdout: Object.freeze([...stdoutLines]),
          stderr: Object.freeze([...stderrLines]),
          exitCode,
          signal,
        }),
      );
    });
  });
}
