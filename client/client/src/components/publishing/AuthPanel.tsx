import { useState } from "react";
import { Lock, Check, X } from "lucide-react";

type AuthProvider = "email" | "google" | "github" | "discord";

interface ProviderConfig {
  id: AuthProvider;
  name: string;
  icon: string;
  enabled: boolean;
}

export function AuthPanel({ onClose }: { onClose: () => void }) {
  const [providers, setProviders] = useState<ProviderConfig[]>([
    { id: "email",   name: "Email / Password",  icon: "✉️",  enabled: true  },
    { id: "google",  name: "Google",             icon: "🟡", enabled: true  },
    { id: "github",  name: "GitHub",             icon: "⚫", enabled: false },
    { id: "discord", name: "Discord",            icon: "🟣", enabled: false },
  ]);
  const [requireEmailVerif, setRequireEmailVerif] = useState(true);
  const [sessionExpiry, setSessionExpiry]         = useState("7d");
  const [saved, setSaved]                         = useState(false);

  const toggleProvider = (id: AuthProvider) =>
    setProviders((prev) => prev.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div
      className="absolute inset-0 flex flex-col z-20"
      style={{ background: "hsl(222,30%,5%)", animation: "overlay-slidein 0.3s cubic-bezier(0.22,1,0.36,1)" }}
    >
      <style>{`
        @keyframes overlay-slidein { from{transform:translateY(100%);opacity:0.6} to{transform:translateY(0);opacity:1} }
        @keyframes auth-fadein { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes saved-pop  { 0%{opacity:0;transform:scale(0.85)} 60%{transform:scale(1.05)} 100%{opacity:1;transform:scale(1)} }
        .auth-section { animation: auth-fadein 0.22s ease; }
        .saved-badge  { animation: saved-pop 0.3s cubic-bezier(0.22,1,0.36,1); }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2.5">
          <Lock className="h-3.5 w-3.5" style={{ color: "rgba(148,163,184,0.55)" }} />
          <span className="text-xs font-semibold tracking-wide" style={{ color: "rgba(226,232,240,0.85)" }}>Authentication</span>
          <span className="text-[10.5px]" style={{ color: "rgba(100,116,139,0.5)" }}>— Manage login providers</span>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="saved-badge flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80" }}>
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150"
            style={{ background: "linear-gradient(135deg,#7c8dff,#a78bfa)", color: "#fff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            data-testid="button-save-auth"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-all duration-150"
            style={{ color: "rgba(148,163,184,0.5)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            data-testid="button-close-auth"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.07) transparent" }}>

        {/* Providers */}
        <div className="auth-section rounded-xl p-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-3" style={{ color: "rgba(100,116,139,0.5)" }}>Login Providers</p>
          <div className="space-y-2">
            {providers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200"
                style={{
                  background: p.enabled ? "rgba(124,141,255,0.07)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${p.enabled ? "rgba(124,141,255,0.2)" : "rgba(255,255,255,0.07)"}`,
                }}
                data-testid={`provider-row-${p.id}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{p.icon}</span>
                  <div>
                    <p className="text-[12.5px] font-medium" style={{ color: p.enabled ? "rgba(226,232,240,0.9)" : "rgba(148,163,184,0.5)" }}>{p.name}</p>
                    <p className="text-[10.5px]" style={{ color: "rgba(100,116,139,0.45)" }}>{p.enabled ? "Enabled" : "Disabled"}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleProvider(p.id)}
                  className="relative w-9 h-5 rounded-full transition-all duration-300 flex-shrink-0"
                  style={{
                    background: p.enabled ? "linear-gradient(135deg,#7c8dff,#a78bfa)" : "rgba(255,255,255,0.1)",
                    border: `1px solid ${p.enabled ? "rgba(124,141,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                  }}
                  data-testid={`toggle-provider-${p.id}`}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300"
                    style={{ background: "#fff", left: p.enabled ? "calc(100% - 18px)" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Session Settings */}
        <div className="auth-section rounded-xl p-4 space-y-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(100,116,139,0.5)" }}>Session Settings</p>

          <div className="flex items-center justify-between gap-4 py-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div>
              <p className="text-[12.5px] font-medium" style={{ color: "rgba(226,232,240,0.85)" }}>Require email verification</p>
              <p className="text-[10.5px] mt-0.5" style={{ color: "rgba(100,116,139,0.5)" }}>Users must verify email before accessing the app</p>
            </div>
            <button
              onClick={() => setRequireEmailVerif((v) => !v)}
              className="flex-shrink-0 relative w-9 h-5 rounded-full transition-all duration-300"
              style={{
                background: requireEmailVerif ? "linear-gradient(135deg,#7c8dff,#a78bfa)" : "rgba(255,255,255,0.1)",
                border: `1px solid ${requireEmailVerif ? "rgba(124,141,255,0.4)" : "rgba(255,255,255,0.1)"}`,
              }}
              data-testid="toggle-email-verif"
            >
              <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300" style={{ background: "#fff", left: requireEmailVerif ? "calc(100% - 18px)" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
            </button>
          </div>

          <div>
            <label className="text-[11px] font-medium block mb-2" style={{ color: "rgba(148,163,184,0.6)" }}>Session Expiry</label>
            <div className="flex gap-2">
              {[{ val: "1d", label: "1 day" }, { val: "7d", label: "7 days" }, { val: "30d", label: "30 days" }, { val: "never", label: "Never" }].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setSessionExpiry(opt.val)}
                  className="flex-1 py-1.5 rounded-lg text-[11.5px] font-medium transition-all duration-200"
                  style={{
                    background: sessionExpiry === opt.val ? "rgba(124,141,255,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${sessionExpiry === opt.val ? "rgba(124,141,255,0.3)" : "rgba(255,255,255,0.07)"}`,
                    color: sessionExpiry === opt.val ? "#a78bfa" : "rgba(148,163,184,0.5)",
                  }}
                  data-testid={`session-expiry-${opt.val}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
