/**
 * stream-buffer.ts
 * Chunked buffer that accumulates streaming process output
 * and emits it via a callback without truncation.
 */

export type ChunkCallback = (chunk: string) => void;

export class StreamBuffer {
  private chunks:      string[] = [];
  private totalBytes   = 0;
  private readonly maxBytes: number;
  private readonly onChunk?: ChunkCallback;

  constructor(opts: { maxBytes?: number; onChunk?: ChunkCallback } = {}) {
    this.maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;  // 10 MB hard cap
    this.onChunk  = opts.onChunk;
  }

  push(data: Buffer | string): void {
    const str   = typeof data === 'string' ? data : data.toString('utf8');
    const bytes = Buffer.byteLength(str, 'utf8');

    if (this.totalBytes + bytes > this.maxBytes) {
      const remaining = this.maxBytes - this.totalBytes;
      if (remaining <= 0) return;
      const truncated = str.slice(0, remaining);
      this.chunks.push(truncated);
      this.totalBytes += Buffer.byteLength(truncated);
    } else {
      this.chunks.push(str);
      this.totalBytes += bytes;
    }

    this.onChunk?.(str);
  }

  get text(): string {
    return this.chunks.join('');
  }

  get byteSize(): number {
    return this.totalBytes;
  }

  get isCapped(): boolean {
    return this.totalBytes >= this.maxBytes;
  }

  /** Last N characters — useful for LLM context injection. */
  tail(chars = 4000): string {
    const full = this.text;
    return full.length > chars ? full.slice(-chars) : full;
  }

  clear(): void {
    this.chunks  = [];
    this.totalBytes = 0;
  }
}
