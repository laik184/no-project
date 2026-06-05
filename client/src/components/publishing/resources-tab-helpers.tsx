export const TOTAL_MEM_MB = 512;

export type TimeRange = "5m" | "1h" | "24h";

export interface DataPoint {
  time: string;
  cpu: number;
  mem: number;
}

export function generateData(range: TimeRange): DataPoint[] {
  const now = Date.now();
  let count: number, stepMs: number;
  if (range === "5m")  { count = 30; stepMs = 10_000; }
  else if (range === "1h") { count = 60; stepMs = 60_000; }
  else                  { count = 48; stepMs = 1_800_000; }

  let cpu = 30 + Math.random() * 20;
  let mem = 200 + Math.random() * 80;

  return Array.from({ length: count }, (_, i) => {
    const t = new Date(now - (count - 1 - i) * stepMs);
    const label = range === "24h"
      ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: range === "5m" ? "2-digit" : undefined });

    cpu = Math.max(5, Math.min(98, cpu + (Math.random() - 0.47) * 12));
    if (Math.random() < 0.07) cpu = Math.min(98, cpu + 30 + Math.random() * 20);
    mem = Math.max(80, Math.min(TOTAL_MEM_MB - 10, mem + (Math.random() - 0.45) * 18));

    return { time: label, cpu: Math.round(cpu * 10) / 10, mem: Math.round(mem) };
  });
}

export function SkeletonChart() {
  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "skel-sweep 1.4s ease-in-out infinite",
        }}
      />
    </div>
  );
}
