/**
 * Responsibility: Safe serialization / deserialization of memory payloads —
 *                 handles circular references, BigInt, and unknown types.
 * Dependencies: none
 * Failure: serialize returns null on failure; deserialize returns null on parse error.
 * Telemetry: none — pure encoding layer.
 */

class MemorySerializer {
  serialize(payload: unknown): string | null {
    try {
      return JSON.stringify(payload, this.replacer);
    } catch (err) {
      console.error("[memory-serializer] Serialize error:", (err as Error).message);
      return null;
    }
  }

  deserialize<T = unknown>(raw: string): T | null {
    try {
      return JSON.parse(raw, this.reviver) as T;
    } catch (err) {
      console.error("[memory-serializer] Deserialize error:", (err as Error).message);
      return null;
    }
  }

  byteSize(payload: unknown): number {
    const s = this.serialize(payload);
    return s ? Buffer.byteLength(s, "utf8") : 0;
  }

  private replacer(_key: string, value: unknown): unknown {
    if (typeof value === "bigint") return { __bigint: value.toString() };
    if (value instanceof Map)     return { __map: [...value.entries()] };
    if (value instanceof Set)     return { __set: [...value.values()] };
    return value;
  }

  private reviver(_key: string, value: unknown): unknown {
    if (value && typeof value === "object") {
      const v = value as Record<string, unknown>;
      if ("__bigint" in v) return BigInt(v.__bigint as string);
      if ("__map" in v)    return new Map(v.__map as [unknown, unknown][]);
      if ("__set" in v)    return new Set(v.__set as unknown[]);
    }
    return value;
  }
}

export const memorySerializer = new MemorySerializer();
