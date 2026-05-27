export type StreamChunkType = 'stdout' | 'stderr';

export interface StreamChunk {
  type:      StreamChunkType;
  data:      string;
  timestamp: Date;
}

export interface StreamResult {
  stdout:     string;
  stderr:     string;
  exitCode:   number;
  durationMs: number;
  truncated:  boolean;
}

export interface StreamOptions {
  cwd:        string;
  timeoutMs?: number;
  env?:       NodeJS.ProcessEnv;
  onStdout?:  (chunk: string) => void;
  onStderr?:  (chunk: string) => void;
}

export interface ParsedLine {
  raw:       string;
  trimmed:   string;
  isEmpty:   boolean;
  timestamp: Date;
}
