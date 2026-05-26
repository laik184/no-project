import { useState } from "react";
import {
  Settings,
  X,
  Save,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Database,
  Key,
  Lock,
  Plus,
  Pencil,
  Trash2,
  Copy,
  UserCheck,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppSecret {
  id: string;
  key: string;
  value: string;
  visible: boolean;
}

const INITIAL_SECRETS: AppSecret[] = [
  { id: "s1", key: "OPENAI_API_KEY",    value: "sk-proj-xK9mL2nQpR7vB4wZ", visible: false },
  { id: "s2", key: "DATABASE_URL",       value: "postgresql://user:pass@db.replit.app/prod", visible: false },
  { id: "s3", key: "STRIPE_SECRET_KEY",  value: "sk_live_51AbCdEfGhIjKlMn",  visible: false },
];

export function AppSettingsPanel({ onClose }: { onClose: () => void }) {
  const [appName, setAppName]       = useState("nura-x-app");
  const [env, setEnv]               = useState("production");
  const [region, setRegion]         = useState("us-east-1");
  const [isPublicApp, setIsPublicApp] = useState(true);
  const [dbStatus]                  = useState<"connected" | "error">("connected");
  const [dbUrl]                     = useState("postgresql://nura:••••••@db.replit.app/prod");
  const [dbVisible, setDbVisible]   = useState(false);
  const [secrets, setSecrets]       = useState<AppSecret[]>(INITIAL_SECRETS);
  const [addingSecret, setAddingSecret] = useState(false);
  const [newKey, setNewKey]         = useState("");
  const [newVal, setNewVal]         = useState("");
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editVal, setEditVal]       = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saved, setSaved]           = useState(false);
  const [nameErr, setNameErr]       = useState("");

  const toggleSecretVisible = (id: string) =>
    setSecrets((prev) => prev.map((s) => s.id === id ? { ...s, visible: !s.visible } : s));

  const addSecret = () => {
    if (!newKey.trim()) return;
    setSecrets((prev) => [...prev, { id: `s${Date.now()}`, key: newKey.trim().toUpperCase(), value: newVal, visible: false }]);
    setNewKey(""); setNewVal(""); setAddingSecret(false);
  };

  const deleteSecret = (id: string) => {
    setSecrets((prev) => prev.filter((s) => s.id !== id));
    setDeleteConfirmId(null);
  };

  const startEdit = (s: AppSecret) => { setEditingId(s.id); setEditVal(s.value); };
  const saveEdit  = (id: string) => {
    setSecrets((prev) => prev.map((s) => s.id === id ? { ...s, value: editVal } : s));
    setEditingId(null);
  };

  const handleSave = () => {
    if (!appName.trim()) { setNameErr("App name cannot be empty."); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const SECTION = "rounded-xl p-4 space-y-3 flex-shrink-0";
  const SECTION_STYLE = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" };
  const LABEL = "text-[10px] font-semibold uppercase tracking-wide";
  const INPUT_BASE = "w-full px-3 py-2 rounded-lg text-[12.5px] outline-none transition-all duration-150 font-mono";
  const INPUT_STYLE = { background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(226,232,240,0.9)" };

  return (
    <div
      className="absolute inset-0 flex flex-col z-20"
      style={{ background: "hsl(222,30%,5%)", animation: "overlay-slidein 0.3s cubic-bezier(0.22,1,0.36,1)" }}
    >
      <style>{`
        @keyframes overlay-slidein { from{transform:translateY(100%);opacity:0.6} to{transform:translateY(0);opacity:1} }
        @keyframes set-fadein { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes saved-pop  { 0%{opacity:0;transform:scale(0.85)} 60%{transform:scale(1.05)} 100%{opacity:1;transform:scale(1)} }
        .set-section { animation: set-fadein 0.22s ease; }
        .saved-badge { animation: saved-pop 0.3s cubic-bezier(0.22,1,0.36,1); }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2.5">
          <Settings className="h-3.5 w-3.5" style={{ color: "rgba(148,163,184,0.55)" }} />
          <span className="text-xs font-semibold tracking-wide" style={{ color: "rgba(226,232,240,0.85)" }}>App Settings</span>
          <span className="text-[10.5px]" style={{ color: "rgba(100,116,139,0.5)" }}>— Configure your production app</span>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="saved-badge flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80" }}>
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150"
            style={{ background: "linear-gradient(135deg,#7c8dff,#a78bfa)", color: "#fff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            data-testid="button-save-settings"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-all duration-150"
            style={{ color: "rgba(148,163,184,0.5)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            data-testid="button-close-settings"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.07) transparent" }}>

        {/* 1. Access Control */}
        <div className={cn(SECTION, "set-section")} style={SECTION_STYLE}>
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="h-3.5 w-3.5" style={{ color: "rgba(124,141,255,0.7)" }} />
            <p className={LABEL} style={{ color: "rgba(124,141,255,0.7)" }}>Access Control</p>
          </div>
          <p className="text-[11px]" style={{ color: "rgba(100,116,139,0.55)" }}>Who can access your deployed app</p>
          <div className="flex gap-2 mt-2">
            {[{ id: "public", label: "Public", desc: "Anyone can access" }, { id: "private", label: "Private", desc: "Restricted access" }].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setIsPublicApp(opt.id === "public")}
                className="flex-1 flex flex-col gap-0.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200"
                style={{
                  background: (opt.id === "public") === isPublicApp ? "rgba(124,141,255,0.1)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${(opt.id === "public") === isPublicApp ? "rgba(124,141,255,0.3)" : "rgba(255,255,255,0.07)"}`,
                }}
                data-testid={`access-${opt.id}`}
              >
                <span className="text-[12px] font-semibold" style={{ color: (opt.id === "public") === isPublicApp ? "#a78bfa" : "rgba(148,163,184,0.6)" }}>{opt.label}</span>
                <span className="text-[10.5px]" style={{ color: "rgba(100,116,139,0.5)" }}>{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. General Configuration */}
        <div className={cn(SECTION, "set-section")} style={SECTION_STYLE}>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="h-3.5 w-3.5" style={{ color: "rgba(148,163,184,0.5)" }} />
            <p className={LABEL} style={{ color: "rgba(148,163,184,0.5)" }}>General Configuration</p>
          </div>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-[11px] font-medium block mb-1.5" style={{ color: "rgba(148,163,184,0.6)" }}>App Name</label>
              <input
                value={appName}
                onChange={(e) => { setAppName(e.target.value); setNameErr(""); }}
                className={INPUT_BASE}
                style={{ ...INPUT_STYLE, borderColor: nameErr ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.09)" }}
                data-testid="input-app-name"
              />
              {nameErr && <p className="text-[10.5px] mt-1" style={{ color: "#f87171" }}>{nameErr}</p>}
            </div>
            <div>
              <label className="text-[11px] font-medium block mb-1.5" style={{ color: "rgba(148,163,184,0.6)" }}>Environment</label>
              <select
                value={env}
                onChange={(e) => setEnv(e.target.value)}
                className={INPUT_BASE}
                style={{ ...INPUT_STYLE, fontFamily: "inherit" }}
                data-testid="select-environment"
              >
                <option value="production">Production</option>
                <option value="development">Development</option>
                <option value="staging">Staging</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium block mb-1.5" style={{ color: "rgba(148,163,184,0.6)" }}>
                <MapPin className="h-3 w-3 inline mr-1 relative" style={{ top: "-1px" }} />
                Region
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className={INPUT_BASE}
                style={{ ...INPUT_STYLE, fontFamily: "inherit" }}
                data-testid="select-region"
              >
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="eu-west-1">Europe (Ireland)</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Database */}
        <div className={cn(SECTION, "set-section")} style={SECTION_STYLE}>
          <div className="flex items-center gap-2 mb-1">
            <Database className="h-3.5 w-3.5" style={{ color: dbStatus === "connected" ? "rgba(74,222,128,0.7)" : "rgba(248,113,113,0.7)" }} />
            <p className={LABEL} style={{ color: dbStatus === "connected" ? "rgba(74,222,128,0.7)" : "rgba(248,113,113,0.7)" }}>Production Database</p>
            <span className="ml-auto flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full font-semibold" style={{
              background: dbStatus === "connected" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
              border: `1px solid ${dbStatus === "connected" ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
              color: dbStatus === "connected" ? "#4ade80" : "#f87171",
            }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: dbStatus === "connected" ? "#4ade80" : "#f87171" }} />
              {dbStatus === "connected" ? "Connected" : "Error"}
            </span>
          </div>
          <div className="mt-2">
            <label className="text-[11px] font-medium block mb-1.5" style={{ color: "rgba(148,163,184,0.6)" }}>Database URL</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={dbVisible ? "text" : "password"}
                  value={dbUrl}
                  readOnly
                  className={cn(INPUT_BASE, "pr-9")}
                  style={INPUT_STYLE}
                  data-testid="input-db-url"
                />
                <button
                  onClick={() => setDbVisible((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors duration-150"
                  style={{ color: "rgba(100,116,139,0.5)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.8)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(100,116,139,0.5)"; }}
                  title={dbVisible ? "Hide" : "Show"}
                  data-testid="toggle-db-url-visibility"
                >
                  {dbVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <button
                className="px-3 py-2 rounded-lg text-[11.5px] font-medium flex-shrink-0 flex items-center gap-1.5 transition-all duration-150"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(148,163,184,0.7)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                data-testid="button-reconnect-db"
              >
                <RefreshCw className="h-3 w-3" />
                Reconnect
              </button>
            </div>
          </div>
        </div>

        {/* 4. App Secrets */}
        <div className={cn(SECTION, "set-section")} style={SECTION_STYLE}>
          <div className="flex items-center gap-2">
            <Key className="h-3.5 w-3.5" style={{ color: "rgba(251,191,36,0.7)" }} />
            <p className={LABEL} style={{ color: "rgba(251,191,36,0.7)" }}>App Secrets</p>
            <button
              onClick={() => { setAddingSecret(true); setNewKey(""); setNewVal(""); }}
              className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(251,191,36,0.15)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(251,191,36,0.08)"; }}
              data-testid="button-add-secret"
            >
              <Plus className="h-3 w-3" />
              Add Secret
            </button>
          </div>
          <p className="text-[10.5px]" style={{ color: "rgba(100,116,139,0.5)" }}>
            <Lock className="h-3 w-3 inline mr-1 relative" style={{ top: "-1px" }} />
            Values are encrypted at rest. Toggle the eye icon to reveal temporarily.
          </p>

          {addingSecret && (
            <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}>
              <input
                placeholder="SECRET_KEY_NAME"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") addSecret(); if (e.key === "Escape") setAddingSecret(false); }}
                className={cn(INPUT_BASE)}
                style={{ ...INPUT_STYLE, fontSize: "11.5px" }}
                autoFocus
                data-testid="input-new-secret-key"
              />
              <div className="flex gap-2">
                <input
                  placeholder="secret value"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addSecret(); if (e.key === "Escape") setAddingSecret(false); }}
                  className={cn(INPUT_BASE, "flex-1")}
                  style={{ ...INPUT_STYLE, fontSize: "11.5px" }}
                  type="password"
                  data-testid="input-new-secret-value"
                />
                <button onClick={addSecret} className="px-3 py-2 rounded-lg text-[11.5px] font-semibold flex-shrink-0 transition-all duration-150" style={{ background: "linear-gradient(135deg,#7c8dff,#a78bfa)", color: "#fff" }} data-testid="button-save-new-secret">Add</button>
                <button onClick={() => setAddingSecret(false)} className="p-2 rounded-lg transition-all duration-150" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(100,116,139,0.5)" }} data-testid="button-cancel-new-secret"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}

          <div className="space-y-2 mt-1">
            {secrets.map((secret) => (
              <div key={secret.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }} data-testid={`secret-row-${secret.id}`}>
                {deleteConfirmId === secret.id ? (
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5" style={{ background: "rgba(248,113,113,0.07)" }}>
                    <p className="text-[11.5px]" style={{ color: "#fca5a5" }}>Delete <strong>{secret.key}</strong>?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteConfirmId(null)} className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(148,163,184,0.7)" }} data-testid={`button-cancel-delete-${secret.id}`}>Cancel</button>
                      <button onClick={() => deleteSecret(secret.id)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150" style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }} data-testid={`button-confirm-delete-${secret.id}`}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-2.5" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold font-mono flex-1 truncate" style={{ color: "rgba(251,191,36,0.85)" }}>{secret.key}</span>
                      <button
                        onClick={() => toggleSecretVisible(secret.id)}
                        className="p-1 rounded transition-colors duration-150 flex-shrink-0"
                        style={{ color: secret.visible ? "#a78bfa" : "rgba(100,116,139,0.45)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = secret.visible ? "#c4b5fd" : "rgba(148,163,184,0.7)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = secret.visible ? "#a78bfa" : "rgba(100,116,139,0.45)"; }}
                        title={secret.visible ? "Hide value" : "Show value"}
                        data-testid={`toggle-secret-${secret.id}`}
                      >
                        {secret.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => editingId === secret.id ? setEditingId(null) : startEdit(secret)}
                        className="p-1 rounded transition-colors duration-150 flex-shrink-0"
                        style={{ color: "rgba(100,116,139,0.45)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.8)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(100,116,139,0.45)"; }}
                        data-testid={`button-edit-secret-${secret.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(secret.id)}
                        className="p-1 rounded transition-colors duration-150 flex-shrink-0"
                        style={{ color: "rgba(248,113,113,0.45)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(248,113,113,0.45)"; }}
                        data-testid={`button-delete-secret-${secret.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingId === secret.id ? (
                      <div className="flex gap-2">
                        <input
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(secret.id); if (e.key === "Escape") setEditingId(null); }}
                          className={cn(INPUT_BASE, "flex-1 text-[11.5px]")}
                          style={INPUT_STYLE}
                          autoFocus
                          data-testid={`input-edit-secret-${secret.id}`}
                        />
                        <button onClick={() => saveEdit(secret.id)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "linear-gradient(135deg,#7c8dff,#a78bfa)", color: "#fff" }} data-testid={`button-save-edit-${secret.id}`}>Save</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11.5px] flex-1 truncate" style={{ color: secret.visible ? "rgba(226,232,240,0.8)" : "rgba(100,116,139,0.5)", letterSpacing: secret.visible ? "normal" : "2px" }}>
                          {secret.visible ? secret.value : "••••••••••••••••"}
                        </span>
                        {secret.visible && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(secret.value); }}
                            className="p-0.5 rounded transition-colors duration-150 flex-shrink-0"
                            style={{ color: "rgba(100,116,139,0.4)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.7)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(100,116,139,0.4)"; }}
                            title="Copy value"
                            data-testid={`button-copy-secret-${secret.id}`}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {secrets.length === 0 && !addingSecret && (
              <div className="flex flex-col items-center py-8 gap-2" style={{ color: "rgba(100,116,139,0.4)" }}>
                <Key className="h-6 w-6 opacity-30" />
                <p className="text-[12px]">No secrets added yet</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ height: "8px" }} />
      </div>
    </div>
  );
}
