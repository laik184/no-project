import { useState, useRef, useEffect } from "react";
import {
  Globe,
  Check,
  Copy,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  type DomainStatus,
  type DomainEntry,
} from "./domains-tab-atoms";
import { DomainCard } from "./DomainCard";

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
      {domains.map((domain) => (
        <DomainCard
          key={domain.id}
          domain={domain}
          isExpanded={expandedId === domain.id}
          setExpandedId={setExpandedId}
          copiedDomain={copiedDomain}
          copyDomainUrl={copyDomainUrl}
          retryDomain={retryDomain}
          removeDomain={removeDomain}
        />
      ))}
    </div>
  );
}
