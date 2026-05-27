export type ChunkCallback = (chunk: string) => void;

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export class StreamBuffer {
  private readonly chunks:    string[] = [];
  private totalBytes           = 0;
  private readonly maxBytes:   number;
  private readonly onChunk?:   ChunkCallback;

  constructor(opts: { maxBytes?: number; onChunk?: ChunkCallback } = {}) {
    this.maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
    this.onChunk  = opts.onChunk;
  }

  push(data: Buffer | string): void {
    const str   = typeof data === 'string' ? data : data.toString('utf8');
    const bytes = Buffer.byteLength(str, 'utf8');

    if (this.totalBytes >= this.maxBytes) return;

    const remaining = this.maxBytes - this.totalBytes;
    const safe      = bytes <= remaining ? str : str.slice(0, remaining);
    this.chunks.push(safe);
    this.totalBytes += Buffer.byteLength(safe, 'utf8');
    this.onChunk?.(str);
  }

  get text(): string    { return this.chunks.join(''); }
  get byteSize(): number { return this.totalBytes; }
  get isCapped(): boolean { return this.totalBytes >= this.maxBytes; }

  tail(chars = 4000): string {
    const full = this.text;
    return full.length > chars ? full.slice(-chars) : full;
  }

  clear(): void {
    this.chunks.length = 0;
    this.totalBytes    = 0;
  }
}
