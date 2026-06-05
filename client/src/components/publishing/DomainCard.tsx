import {
  CheckCircle2,
  Globe,
  Check,
  Copy,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Trash2,
  Clock,
  Loader2,
} from "lucide-react";
import {
  type DomainEntry,
  getDnsRecords,
  DomainStatusBadge,
  DnsRow,
} from "./domains-tab-atoms";

interface DomainCardProps {
  domain: DomainEntry;
  isExpanded: boolean;
  setExpandedId: (id: string | null) => void;
  copiedDomain: string | null;
  copyDomainUrl: (name: string) => void;
  retryDomain: (id: string) => void;
  removeDomain: (id: string) => void;
}

export function DomainCard({ domain, isExpanded, setExpandedId, copiedDomain, copyDomainUrl, retryDomain, removeDomain }: DomainCardProps) {
  const records = getDnsRecords(domain.name);
  const isVerified = domain.status === "connected";

  return (
    <div
      className="dom-anim rounded-xl overflow-hidden"
      style={{ border: `1px solid ${isVerified ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.08)"}`, background: isVerified ? "rgba(74,222,128,0.03)" : "rgba(255,255,255,0.025)", transition: "border-color 0.5s, background 0.5s" }}
      data-testid={`domain-card-${domain.id}`}
    >
      {/* Domain row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-shrink-0">
          {isVerified ? (
            <div className="verified-icon w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)" }}>
              <CheckCircle2 className="h-4 w-4" style={{ color: "#4ade80" }} />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <Globe className="h-3.5 w-3.5" style={{ color: "rgba(100,116,139,0.5)" }} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[12.5px] font-semibold truncate" style={{ color: isVerified ? "#86efac" : "rgba(226,232,240,0.85)" }}>
              {domain.name}
            </span>
            <DomainStatusBadge status={domain.status} />
          </div>
          <p className="text-[10.5px] mt-0.5" style={{ color: "rgba(100,116,139,0.5)" }}>
            {domain.status === "pending"   && "Waiting for DNS propagation..."}
            {domain.status === "verifying" && "Checking DNS records..."}
            {domain.status === "connected" && "Domain connected successfully ✓"}
            {domain.status === "error"     && "DNS verification failed. Check your records."}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => copyDomainUrl(domain.name)}
            className="p-1.5 rounded-md transition-all duration-100"
            style={{ color: copiedDomain === domain.name ? "#4ade80" : "rgba(100,116,139,0.5)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            title="Copy URL"
            data-testid={`button-copy-domain-url-${domain.id}`}
          >
            {copiedDomain === domain.name ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {domain.status === "error" && (
            <button
              onClick={() => retryDomain(domain.id)}
              className="p-1.5 rounded-md transition-all duration-100"
              style={{ color: "rgba(167,139,250,0.7)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              title="Retry verification"
              data-testid={`button-retry-domain-${domain.id}`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpandedId(isExpanded ? null : domain.id)}
            className="p-1.5 rounded-md transition-all duration-150"
            style={{ color: "rgba(100,116,139,0.5)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            title="Show DNS records"
            data-testid={`button-expand-domain-${domain.id}`}
          >
            <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }} />
          </button>
          <button
            onClick={() => removeDomain(domain.id)}
            className="p-1.5 rounded-md transition-all duration-100"
            style={{ color: "rgba(248,113,113,0.5)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.07)"; (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(248,113,113,0.5)"; }}
            title="Remove domain"
            data-testid={`button-remove-domain-${domain.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* DNS instructions (expanded) */}
      {isExpanded && (
        <div className="dom-anim px-4 pb-4 pt-1">
          <div className="rounded-xl p-4" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2 mb-3">
              {[
                { n: "1", label: "Add DNS records" },
                { n: "→", label: "" },
                { n: "2", label: "Wait for propagation" },
                { n: "→", label: "" },
                { n: "3", label: isVerified ? "Verified ✓" : "Auto-verify" },
              ].map((s, i) =>
                s.n === "→" ? (
                  <ChevronRight key={i} className="h-3 w-3 flex-shrink-0" style={{ color: "rgba(100,116,139,0.4)" }} />
                ) : (
                  <div key={i} className="flex items-center gap-1.5">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                      style={{
                        background: s.n === "3" && isVerified ? "rgba(74,222,128,0.2)" : "rgba(124,141,255,0.15)",
                        color: s.n === "3" && isVerified ? "#4ade80" : "#a78bfa",
                        border: `1px solid ${s.n === "3" && isVerified ? "rgba(74,222,128,0.3)" : "rgba(124,141,255,0.25)"}`,
                      }}
                    >
                      {s.n === "3" && isVerified ? "✓" : s.n}
                    </span>
                    <span className="text-[10.5px]" style={{ color: s.n === "3" && isVerified ? "#86efac" : "rgba(148,163,184,0.65)" }}>
                      {s.label}
                    </span>
                  </div>
                )
              )}
            </div>

            <p className="text-[10.5px] mb-3 px-1" style={{ color: "rgba(100,116,139,0.6)" }}>
              Add these DNS records in your domain provider's dashboard (Namecheap, GoDaddy, Cloudflare, etc.)
            </p>

            <div className="grid grid-cols-[60px_70px_1fr_28px] gap-2 pb-1.5 mb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {["Type","Name","Value",""].map((h) => (
                <span key={h} className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color: "rgba(100,116,139,0.45)" }}>{h}</span>
              ))}
            </div>

            {records.map((r) => <DnsRow key={r.type + r.name} {...r} />)}

            <div
              className="mt-4 flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
              style={{
                background: isVerified ? "rgba(74,222,128,0.08)" : domain.status === "verifying" ? "rgba(167,139,250,0.07)" : "rgba(251,191,36,0.07)",
                border: `1px solid ${isVerified ? "rgba(74,222,128,0.2)" : domain.status === "verifying" ? "rgba(167,139,250,0.2)" : "rgba(251,191,36,0.2)"}`,
                transition: "all 0.5s ease",
              }}
            >
              {isVerified ? (
                <>
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 verified-icon" style={{ color: "#4ade80" }} />
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: "#86efac" }}>Domain verified</p>
                    <p className="text-[10.5px]" style={{ color: "rgba(134,239,172,0.6)" }}>Your domain is live and pointing correctly.</p>
                  </div>
                </>
              ) : domain.status === "verifying" ? (
                <>
                  <Loader2 className="h-4 w-4 flex-shrink-0" style={{ color: "#a78bfa", animation: "spin-slow 1s linear infinite" }} />
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: "#a78bfa" }}>Checking DNS records…</p>
                    <p className="text-[10.5px]" style={{ color: "rgba(167,139,250,0.6)" }}>Verification happens automatically. This may take a moment.</p>
                  </div>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 flex-shrink-0" style={{ color: "#fbbf24" }} />
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: "#fbbf24" }}>Waiting for DNS propagation</p>
                    <p className="text-[10.5px]" style={{ color: "rgba(251,191,36,0.6)" }}>DNS changes can take up to 48 hrs. We'll verify automatically.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
