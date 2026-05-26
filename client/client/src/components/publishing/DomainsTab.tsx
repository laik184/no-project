import { useState, useRef, useEffect } from "react";
import {
  Globe,
  Check,
  Copy,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Clock,
  ChevronRight,
  ChevronDown,
  Trash2,
  RotateCcw,
  X,
} from "lucide-react";

type DomainStatus = "pending" | "verifying" | "connected" | "error";

interface DomainEntry {
  id: string;
  name: string;
  status: DomainStatus;
  addedAt: number;
}

function getDnsRecords(domain: string) {
  const apex = domain.replace(/^www\./, "");
  return [
    { type: "CNAME", name: "www",  value: "nura-x-app.replit.app" },
    { type: "A",     name: "@",    value: "76.76.21.21"             },
    { type: "TXT",   name: "_replit-verify", value: `replit-verify=${apex.replace(/\./g, "-")}-ok` },
  ];
}

function DomainStatusBadge({ status }: { status: DomainStatus }) {
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

function DnsRow({ type, name, value }: { type: string; name: string; value: string }) {
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

export function DomainsTab() {
  const [domains, setDomains]       = useState<DomainEntry[]>([]);
  const [showAdd, setShowAdd]       = useState(false);
  const [inputVal, setInputVal]     = useState("");
  const [inputErr, setInputErr]     = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const timerMap = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const validateDomain = (v: string) => {
    const trimmed = v.trim().toLowerCase().replace(/^https?:\/\//, "");
    if (!trimmed) return { err: "Please enter a domain name.", val: "" };
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(trimmed)) return { err: "Invalid domain format (e.g. yoursite.com)", val: "" };
    return { err: "", val: trimmed };
  };

  const startVerification = (id: string) => {
    timerMap.current[id] = setTimeout(() => {
      setDomains((prev) => prev.map((d) => d.id === id ? { ...d, status: "verifying" } : d));
      timerMap.current[id] = setTimeout(() => {
        setDomains((prev) => prev.map((d) => d.id === id ? { ...d, status: "connected" } : d));
      }, 4500 + Math.random() * 2000);
    }, 2000 + Math.random() * 1500);
  };

  const addDomain = () => {
    const { err, val } = validateDomain(inputVal);
    if (err) { setInputErr(err); return; }
    if (domains.find((d) => d.name === val)) { setInputErr("Domain already connected."); return; }
    const id = `dom-${Date.now()}`;
    const entry: DomainEntry = { id, name: val, status: "pending", addedAt: Date.now() };
    setDomains((prev) => [entry, ...prev]);
    setExpandedId(id);
    setShowAdd(false);
    setInputVal("");
    setInputErr("");
    startVerification(id);
  };

  const removeDomain = (id: string) => {
    clearTimeout(timerMap.current[id]);
    delete timerMap.current[id];
    setDomains((prev) => prev.filter((d) => d.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const retryDomain = (id: string) => {
    clearTimeout(timerMap.current[id]);
    setDomains((prev) => prev.map((d) => d.id === id ? { ...d, status: "pending" } : d));
    startVerification(id);
  };

  const copyDomainUrl = (name: string) => {
    navigator.clipboard.writeText(`https://${name}`);
    setCopiedDomain(name);
    setTimeout(() => setCopiedDomain(null), 1500);
  };

  useEffect(() => {
    const timers = timerMap.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <style>{`
        @keyframes dom-fadein {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes verified-pop {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .dom-anim   { animation: dom-fadein 0.22s ease; }
        .verified-icon { animation: verified-pop 0.4s cubic-bezier(0.22,1,0.36,1); }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[13px] font-semibold" style={{ color: "rgba(226,232,240,0.9)" }}>Domains</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(100,116,139,0.55)" }}>Connect your custom domain to your app</p>
        </div>
        {!showAdd && (
          <button
            onClick={() => { setShowAdd(true); setInputErr(""); setInputVal(""); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150 flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#7c8dff,#a78bfa)", color: "#fff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            data-testid="button-add-domain"
          >
            <Globe className="h-3.5 w-3.5" />
            Add Domain
          </button>
        )}
      </div>

      {/* Add domain input */}
      {showAdd && (
        <div className="dom-anim rounded-xl p-4 space-y-3" style={{ background: "rgba(124,141,255,0.05)", border: "1px solid rgba(124,141,255,0.18)" }}>
          <p className="text-[12px] font-semibold" style={{ color: "rgba(167,139,250,0.9)" }}>Connect a new domain</p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="yoursite.com"
                value={inputVal}
                onChange={(e) => { setInputVal(e.target.value); setInputErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") addDomain(); if (e.key === "Escape") setShowAdd(false); }}
                className="w-full px-3 py-2 rounded-lg text-[12.5px] outline-none font-mono transition-all duration-150"
                style={{
                  background: "rgba(0,0,0,0.3)",
                  border: `1px solid ${inputErr ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)"}`,
                  color: "rgba(226,232,240,0.9)",
                }}
                autoFocus
                data-testid="input-domain-name"
              />
              {inputErr && (
                <p className="absolute -bottom-5 left-0 text-[10.5px]" style={{ color: "#f87171" }}>{inputErr}</p>
              )}
            </div>
            <button
              onClick={addDomain}
              className="px-3.5 py-2 rounded-lg text-[12px] font-semibold flex-shrink-0 transition-all duration-150"
              style={{ background: "linear-gradient(135deg,#7c8dff,#a78bfa)", color: "#fff" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              data-testid="button-connect-domain"
            >
              Connect
            </button>
            <button
              onClick={() => { setShowAdd(false); setInputErr(""); setInputVal(""); }}
              className="p-2 rounded-lg transition-all duration-150 flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(100,116,139,0.6)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
              data-testid="button-cancel-add-domain"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {inputErr && <div style={{ height: "8px" }} />}
        </div>
      )}

      {/* Empty state */}
      {domains.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: "rgba(100,116,139,0.5)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Globe className="h-6 w-6 opacity-40" />
          </div>
          <p className="text-[13px] font-medium">No domains connected yet</p>
          <p className="text-[11.5px]" style={{ color: "rgba(100,116,139,0.38)" }}>Click "Add Domain" to connect your custom domain</p>
        </div>
      )}

      {/* Domain list */}
      {domains.map((domain) => {
        const isExpanded = expandedId === domain.id;
        const records = getDnsRecords(domain.name);
        const isVerified = domain.status === "connected";

        return (
          <div
            key={domain.id}
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
      })}
    </div>
  );
}
