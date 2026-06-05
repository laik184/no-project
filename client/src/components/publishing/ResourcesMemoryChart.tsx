import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { type DataPoint, TOTAL_MEM_MB, SkeletonChart } from "./resources-tab-helpers";

interface ResourcesMemoryChartProps {
  data: DataPoint[];
  loading: boolean;
  memNow: number;
  CustomTooltip: React.ComponentType<any>;
}

export function ResourcesMemoryChart({ data, loading, memNow, CustomTooltip }: ResourcesMemoryChartProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.2)" }}>
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: "#4ade80" }} />
          <span className="text-[12px] font-semibold" style={{ color: "rgba(226,232,240,0.8)" }}>Memory Utilization</span>
        </div>
        <span className="text-[10px]" style={{ color: "rgba(100,116,139,0.45)" }}>
          {memNow} MB / {TOTAL_MEM_MB} MB
        </span>
      </div>
      <div className="flex-1 min-h-0 p-2">
        {loading ? (
          <SkeletonChart />
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[12px]" style={{ color: "rgba(100,116,139,0.4)" }}>No resource data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "rgba(100,116,139,0.5)", fontFamily: "monospace" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, TOTAL_MEM_MB]} tick={{ fontSize: 9, fill: "rgba(100,116,139,0.5)", fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}MB`} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={TOTAL_MEM_MB * 0.85} stroke="rgba(251,191,36,0.35)" strokeDasharray="4 3" label={{ value: "85% warn", position: "insideTopRight", fontSize: 9, fill: "rgba(251,191,36,0.5)", fontFamily: "monospace" }} />
              <Area
                type="monotone"
                dataKey="mem"
                name="Memory"
                stroke="#4ade80"
                strokeWidth={1.5}
                fill="url(#memGrad)"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: "#4ade80" }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
