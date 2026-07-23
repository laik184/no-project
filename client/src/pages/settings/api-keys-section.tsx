import { AlertCircle, Copy, Eye, EyeOff, KeyRound, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { SectionCard, EmptyState, StatusBadge } from "./settings-primitives";
import type { ApiKeyRecord, KeyProvider, ProviderDetails, SectionId } from "./settings-types";

export function ApiKeysSection({ apiKeys, providers, visibility, onAdd, onEdit, onDelete, onCopy, onTest, testingProvider, mobileSection, activeSection, onReset }: {
  apiKeys: Partial<Record<KeyProvider, ApiKeyRecord>>;
  providers: ProviderDetails[];
  visibility: "masked" | "reveal";
  onAdd: (provider: ProviderDetails) => void;
  onEdit: (provider: ProviderDetails, existing: ApiKeyRecord) => void;
  onDelete: (provider: KeyProvider) => void;
  onCopy: (provider: KeyProvider) => void;
  onTest: (provider: KeyProvider) => void;
  onToggleVisibility: () => void;
  testingProvider: KeyProvider | null;
  mobileSection?: SectionId | null;
  activeSection?: SectionId;
  onReset: (section: SectionId) => void;
}) {
  return <SectionCard id="keys" title="API Keys" description="Connect your own model providers. Keys are masked by default and stored only in this browser." icon={KeyRound} onReset={onReset} mobileSection={mobileSection} activeSection={activeSection}>
    <div className="flex items-start gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-4 text-xs leading-5 text-amber-100/80"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p><strong className="font-medium text-amber-200">Frontend-only storage.</strong> No server or provider connection is available in this imported snapshot. “Test connection” performs a local format check and never sends a request.</p></div>
    <div className="space-y-3">
      {providers.map((provider) => {
        const record = apiKeys[provider.id];
        const masked = record ? `${record.value.slice(0, 4)}${"•".repeat(Math.max(4, Math.min(16, record.value.length - 4)))}${record.value.slice(-4)}` : "";
        return <div key={provider.id} className="settings-row settings-api-key-row rounded-xl border border-white/8 bg-black/10 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold" style={{ borderColor: `${provider.color}40`, background: `${provider.color}15`, color: provider.color }}>{provider.name.slice(0, 1)}</div><div className="min-w-0"><p className="text-sm font-medium text-foreground">{provider.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{record?.label ?? provider.description}</p></div></div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {record && <StatusBadge status={record.status} message={record.message} />}
              {record ? <><code className="max-w-[180px] truncate rounded-md bg-white/5 px-2 py-1 text-[11px] text-muted-foreground" title={masked}>{visibility === "reveal" ? record.value : masked}</code><button type="button" onClick={onToggleVisibility} className="rounded-md p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label={visibility === "reveal" ? `Hide ${provider.name} key` : `Show ${provider.name} key`}>{visibility === "reveal" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button><button type="button" onClick={() => onEdit(provider, record)} className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"><Pencil className="mr-1 inline h-3 w-3" />Edit</button><button type="button" onClick={() => onCopy(provider.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label={`Copy ${provider.name} key`}><Copy className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onDelete(provider.id)} className="rounded-md p-1.5 text-red-300/70 hover:bg-red-400/10 hover:text-red-300" aria-label={`Delete ${provider.name} key`}><Trash2 className="h-3.5 w-3.5" /></button></> : <button type="button" onClick={() => onAdd(provider)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"><Plus className="h-3.5 w-3.5" />Add key</button>}
              {record && <button type="button" onClick={() => onTest(provider.id)} disabled={testingProvider === provider.id} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-60">{testingProvider === provider.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}Test connection</button>}
            </div>
          </div>
        </div>;
      })}
    </div>
    {!Object.keys(apiKeys).length && <EmptyState title="No provider keys configured" description="Add a key above when you want to use a provider outside the workspace defaults." />}
  </SectionCard>;
}