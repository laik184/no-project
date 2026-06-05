import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { type DataPoint, SkeletonChart } from "./resources-tab-helpers";

interface ResourcesCpuChartProps {
  data: DataPoint[];
  loading: boolean;
  isCpuCrit: boolean;
  CustomTooltip: React.ComponentType<any>;
}

export function ResourcesCpuChart({ data, loading, isCpuCrit, CustomTooltip }: ResourcesCpuChartProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.2)" }}>
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: isCpuCrit ? "#f87171" : "#a78bfa" }} />
          <span className="text-[12px] font-semibold" style={{ color: "rgba(226,232,240,0.8)" }}>CPU Utilization</span>
        </div>
        {isCpuCrit && (
          <span className="text-[10.5px] flex items-center gap-1" style={{ color: "rgba(248,113,113,0.7)" }}>
            <AlertTriangle className="h-3 w-3" /> Above 80% threshold
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 p-2">
        {loading ? (
          <SkeletonChart />
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[12px]" style={{ color: "rgba(100,116,139,0.4)" }}>No resource data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={isCpuCrit ? "#f87171" : "#a78bfa"} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={isCpuCrit ? "#f87171" : "#a78bfa"} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "rgba(100,116,139,0.5)", fontFamily: "monospace" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "rgba(100,116,139,0.5)", fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceArea y1={80} y2={100} fill="rgba(248,113,113,0.07)" stroke="rgba(248,113,113,0.2)" strokeDasharray="4 3" />
              <ReferenceLine y={80} stroke="rgba(248,113,113,0.45)" strokeDasharray="5 3" label={{ value: "80% critical", position: "insideTopRight", fontSize: 9, fill: "rgba(248,113,113,0.55)", fontFamily: "monospace" }} />
              <Area
                type="monotone"
                dataKey="cpu"
                name="CPU"
                stroke={isCpuCrit ? "#f87171" : "#a78bfa"}
                strokeWidth={1.5}
                fill="url(#cpuGrad)"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: isCpuCrit ? "#f87171" : "#a78bfa" }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
