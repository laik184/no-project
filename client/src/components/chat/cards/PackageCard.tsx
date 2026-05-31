import { Package, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface PackageCardProps {
  item: AgentStreamItem;
}

function operationLabel(tool: string): string {
  if (tool.includes("uninstall") || tool.includes("remove")) return "Uninstalling";
  if (tool.includes("detect") || tool.includes("missing"))   return "Detecting";
  return "Installing";
}

export function PackageCard({ item }: PackageCardProps) {
  const tool     = String(item.tool ?? "package.install");
  const opLabel  = operationLabel(tool);
  const isRunning = item.status === "running";
  const isError   = (item.status as string) === "error";
  const isDone    = item.status === "done";

  const packages: string[] = item.meta?.packageNames ??
    (item.meta?.logs
      ? item.meta.logs.split(/[\s,]+/).filter(Boolean).slice(0, 8)
      : item.content.replace(/Installing|Uninstalling|Detecting/gi, "").trim().split(/,\s*/).filter(Boolean).slice(0, 8));

  return (
    <div className="rounded-lg px-3 py-2.5" data-testid="package-card"
      style={{ background: "rgba(251,146,60,0.04)", border: "1px solid rgba(251,146,60,0.15)" }}>

      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)" }}>
          <Package style={{ width: 12, height: 12, color: "#fb923c" }} />
        </div>
        <span className="text-[11px] font-medium flex-1" style={{ color: "rgba(203,213,225,0.85)" }}>
          {opLabel} packages
        </span>
        <div className="flex-shrink-0">
          {isRunning && <Loader2 className="animate-spin" style={{ width: 13, height: 13, color: "#fb923c" }} />}
          {isDone    && <CheckCircle2 style={{ width: 13, height: 13, color: "#4ade80" }} />}
          {isError   && <XCircle style={{ width: 13, height: 13, color: "#f87171" }} />}
        </div>
      </div>

      {packages.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {packages.map((pkg, i) => (
            <span key={i}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.15)", color: "rgba(251,146,60,0.8)" }}>
              {pkg}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[9.5px]" style={{ color: "rgba(100,116,139,0.5)" }}>
          {packages.length > 0 ? `${packages.length} package${packages.length !== 1 ? "s" : ""}` : "—"}
        </span>
        {isDone && (
          <span className="text-[9.5px]" style={{ color: "#4ade80" }}>· ✓ Complete</span>
        )}
        {isError && (
          <span className="text-[9.5px]" style={{ color: "#f87171" }}>· ✗ Failed</span>
        )}
      </div>
    </div>
  );
}
