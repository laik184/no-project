import { useState } from "react";
import {
  Settings,
  X,
  Save,
  Check,
  UserCheck,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type AppSecret, AppSecretsSection } from "./AppSecretsSection";
import { AppDbSection } from "./AppDbSection";

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
        <AppDbSection
          dbStatus={dbStatus}
          dbUrl={dbUrl}
          dbVisible={dbVisible}
          setDbVisible={setDbVisible}
        />

        {/* 4. App Secrets */}
        <AppSecretsSection
          secrets={secrets}
          setSecrets={setSecrets}
          addingSecret={addingSecret}
          setAddingSecret={setAddingSecret}
          newKey={newKey}
          setNewKey={setNewKey}
          newVal={newVal}
          setNewVal={setNewVal}
          editingId={editingId}
          setEditingId={setEditingId}
          editVal={editVal}
          setEditVal={setEditVal}
          deleteConfirmId={deleteConfirmId}
          setDeleteConfirmId={setDeleteConfirmId}
        />

        <div style={{ height: "8px" }} />
      </div>
    </div>
  );
}
