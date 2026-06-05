import { Key, Lock, Plus, X, Eye, EyeOff, Pencil, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AppSecret {
  id: string;
  key: string;
  value: string;
  visible: boolean;
}

const INPUT_BASE = "w-full px-3 py-2 rounded-lg text-[12.5px] outline-none transition-all duration-150 font-mono";
const INPUT_STYLE = { background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(226,232,240,0.9)" };

interface AppSecretsSectionProps {
  secrets: AppSecret[];
  setSecrets: (fn: (prev: AppSecret[]) => AppSecret[]) => void;
  addingSecret: boolean;
  setAddingSecret: (v: boolean) => void;
  newKey: string;
  setNewKey: (v: string) => void;
  newVal: string;
  setNewVal: (v: string) => void;
  editingId: string | null;
  setEditingId: (v: string | null) => void;
  editVal: string;
  setEditVal: (v: string) => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (v: string | null) => void;
}

export function AppSecretsSection({ secrets, setSecrets, addingSecret, setAddingSecret, newKey, setNewKey, newVal, setNewVal, editingId, setEditingId, editVal, setEditVal, deleteConfirmId, setDeleteConfirmId }: AppSecretsSectionProps) {
  const SECTION = "rounded-xl p-4 space-y-3 flex-shrink-0";
  const SECTION_STYLE = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" };
  const LABEL = "text-[10px] font-semibold uppercase tracking-wide";

  const toggleVisible = (id: string) =>
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

  return (
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
                    onClick={() => toggleVisible(secret.id)}
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
  );
}
