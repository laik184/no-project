import { useState } from "react";
import {
  Check,
  Copy,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export type DomainStatus = "pending" | "verifying" | "connected" | "error";

export interface DomainEntry {
  id: string;
  name: string;
  status: DomainStatus;
  addedAt: number;
}

export function getDnsRecords(domain: string) {
  const apex = domain.replace(/^www\./, "");
  return [
    { type: "CNAME", name: "www",  value: "nura-x-app.replit.app" },
    { type: "A",     name: "@",    value: "76.76.21.21"             },
    { type: "TXT",   name: "_replit-verify", value: `replit-verify=${apex.replace(/\./g, "-")}-ok` },
  ];
}

export function DomainStatusBadge({ status }: { status: DomainStatus }) {
  const cfg = {
    pending:    { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",   border: "rgba(251,191,36,0.25)",   label: "Pending"    },
    verifying:  { color: "#a78bfa", bg: "rgba(167,139,250,0.1)",  border: "rgba(167,139,250,0.25)",  label: "Verifying…" },
    connected:  { color: "#4ade80", bg: "rgba(74,222,128,0.1)",   border: "rgba(74,222,128,0.25)",   label: "Connected"  },
    error:      { color: "#f87171", bg: "rgba(248,113,113,0.1)",  border: "rgba(248,113,113,0.25)",  label: "Error"      },
  }[status];

  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
    >
      {status === "connected" && <CheckCircle2 className="h-3 w-3" />}
      {status === "verifying" && <Loader2 className="h-3 w-3" style={{ animation: "spin-slow 1s linear infinite" }} />}
      {status === "error"     && <AlertTriangle className="h-3 w-3" />}
      {status === "pending"   && <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />}
      {cfg.label}
    </span>
  );
}

export function DnsRow({ type, name, value }: { type: string; name: string; value: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (field: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <div className="grid grid-cols-[60px_70px_1fr_28px] gap-2 items-center py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded text-center" style={{ background: "rgba(124,141,255,0.12)", color: "#a78bfa", border: "1px solid rgba(124,141,255,0.2)" }}>{type}</span>
      <span className="font-mono text-[11px]" style={{ color: "rgba(226,232,240,0.75)" }}>{name}</span>
      <span className="font-mono text-[11px] truncate" style={{ color: "rgba(148,163,184,0.8)" }}>{value}</span>
      <button
        onClick={() => copy(type + name, value)}
        className="p-1 rounded transition-all duration-100"
        style={{ color: copied === type + name ? "#4ade80" : "rgba(100,116,139,0.5)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        title="Copy value"
        data-testid={`button-copy-dns-${type.toLowerCase()}`}
      >
        {copied === type + name ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}
