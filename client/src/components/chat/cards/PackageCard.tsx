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
  const tool      = String(item.tool ?? "package.install");
  const opLabel   = operationLabel(tool);
  const isRunning = item.status === "running";
  const isError   = (item.status as string) === "error";
  const isDone    = item.status === "done";

  const packages: string[] = item.meta?.packageNames ??
    (item.meta?.logs
      ? item.meta.logs.split(/[\s,]+/).filter(Boolean).slice(0, 8)
      : item.content.replace(/Installing|Uninstalling|Detecting/gi, "").trim().split(/,\s*/).filter(Boolean).slice(0, 8));

  return (
    <div className="rounded-lg px-3 py-2.5" data-testid="package-card"
      style={{ background: "#111827", border: "1px solid #1f2937" }}>

      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.22)" }}>
          <Package style={{ width: 12, height: 12, color: "#f97316" }} />
        </div>
        <span className="text-[11px] font-medium flex-1" style={{ color: "rgba(203,213,225,0.85)" }}>
          {opLabel} packages
        </span>
        <div className="flex-shrink-0">
          {isRunning && <Loader2 className="animate-spin" style={{ width: 12, height: 12, color: "#f97316" }} />}
          {isDone    && <CheckCircle2 style={{ width: 12, height: 12, color: "#22c55e" }} />}
          {isError   && <XCircle     style={{ width: 12, height: 12, color: "#ef4444" }} />}
        </div>
      </div>

      {packages.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {packages.map((pkg, i) => (
            <span key={i}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "rgba(148,163,184,0.06)", border: "1px solid #1f2937", color: "rgba(148,163,184,0.65)" }}>
              {pkg}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[9.5px]" style={{ color: "rgba(100,116,139,0.45)" }}>
          {packages.length > 0 ? `${packages.length} package${packages.length !== 1 ? "s" : ""}` : "—"}
        </span>
        {isDone  && <span className="text-[9.5px]" style={{ color: "#22c55e" }}>· ✓ Complete</span>}
        {isError && <span className="text-[9.5px]" style={{ color: "#ef4444" }}>· ✗ Failed</span>}
      </div>
    </div>
  );
}
