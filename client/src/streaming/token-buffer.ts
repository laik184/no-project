/**
 * client/src/streaming/token-buffer.ts
 *
 * RAF-throttled token accumulator.
 * Incoming tokens are pushed into a buffer; a requestAnimationFrame loop
 * drains the buffer on each frame so the React render rate stays tied to
 * the display refresh rate (~60fps) regardless of token arrival speed.
 *
 * Usage:
 *   const buf = new TokenBuffer((chunk) => appendToMessage(chunk));
 *   buf.push("Hello"); buf.push(" world");
 *   buf.destroy(); // on cleanup
 */

export class TokenBuffer {
  private buffer: string[] = [];
  private rafId:  number   = 0;
  private active  = true;

  constructor(private readonly onFlush: (chunk: string) => void) {
    this.schedule();
  }

  push(token: string): void {
    if (!this.active) return;
    this.buffer.push(token);
  }

  /** Force an immediate flush (e.g. when stream ends). */
  flush(): void {
    if (this.buffer.length === 0) return;
    this.onFlush(this.buffer.join(""));
    this.buffer = [];
  }

  /** Cancel RAF loop and flush remaining tokens. */
  destroy(): void {
    this.active = false;
    cancelAnimationFrame(this.rafId);
    this.flush();
  }

  private schedule(): void {
    this.rafId = requestAnimationFrame(() => {
      if (!this.active) return;
      if (this.buffer.length > 0) {
        const chunk = this.buffer.join("");
        this.buffer = [];
        this.onFlush(chunk);
      }
      this.schedule();
    });
  }
}
