import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProfileSection } from "./profile-section";
import { ModelsSection } from "./models-section";
import { ApiKeysSection } from "./api-keys-section";
import { PreferencesSection } from "./preferences-section";
import { EditorSection } from "./editor-section";
import { NotificationsSection } from "./notifications-section";
import { SecuritySection } from "./security-section";
import { AppearanceSection } from "./appearance-section";
import { EmptyState, TextField } from "./settings-primitives";
import {
  defaultSettings,
  mergeSettings,
  navigation,
  providerDetails,
  STORAGE_KEY,
  type ApiKeyRecord,
  type AppearanceSettings,
  type EditorSettings,
  type KeyProvider,
  type ModelSettings,
  type NotificationSettings,
  type PreferenceSettings,
  type ProfileSettings,
  type SaveState,
  type SectionId,
  type SecuritySettings,
  type SettingsState,
} from "./settings-types";

function useLocalSettings() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings(mergeSettings(JSON.parse(raw)));
    } catch {
      setSaveState("error");
    } finally {
      setHydrated(true);
    }
  }, []);

  const updateSettings = <K extends keyof SettingsState>(section: K, value: SettingsState[K]) => {
    setSettings((current) => ({ ...current, [section]: value }));
    setSaveState("dirty");
  };

  const save = async () => {
    setSaveState("saving");
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      setSaveState("success");
      window.setTimeout(() => setSaveState("saved"), 2200);
    } catch {
      setSaveState("error");
    }
  };

  const reset = (section?: SectionId) => {
    if (section) {
      setSettings((current) => ({ ...current, [section]: defaultSettings[section as keyof SettingsState] }));
    } else {
      setSettings(defaultSettings);
    }
    setSaveState("dirty");
  };

  return { settings, updateSettings, hydrated, saveState, save, reset };
}

function ApiKeyDialog({
  provider,
  existing,
  open,
  onOpenChange,
  onSave,
}: {
  provider: typeof providerDetails[number] | null;
  existing?: ApiKeyRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (record: ApiKeyRecord) => void;
}) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLabel(existing?.label ?? "Primary key");
    setValue(existing?.value ?? "");
    setShow(false);
    setError("");
  }, [existing, open]);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed.length < 8) {
      setError("Enter at least 8 characters. The key is stored only in this browser.");
      return;
    }
    if (!label.trim()) {
      setError("Add a label so you can recognize this key later.");
      return;
    }
    onSave({ value: trimmed, label: label.trim(), status: "untested" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#101019] sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit" : "Add"} {provider?.name} key</DialogTitle>
          <DialogDescription>{provider?.description}. This frontend-only workspace stores the value locally and never sends it to a server.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <TextField label="Key label" value={label} onChange={setLabel} placeholder="Personal key" maxLength={40} />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">API key or endpoint</span>
            <span className="relative block">
              <input
                value={value}
                type={show ? "text" : "password"}
                onChange={(event) => { setValue(event.target.value); setError(""); }}
                placeholder={provider?.placeholder}
                className={cn("h-10 w-full rounded-lg border bg-black/20 px-3 pr-10 font-mono text-sm text-foreground outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/20", error ? "border-red-400/60" : "border-white/10")}
                autoComplete="off"
                aria-invalid={Boolean(error)}
              />
              <button type="button" onClick={() => setShow((current) => !current)} className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={show ? "Hide key" : "Show key"}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
            {error && <span className="flex items-center gap-1.5 text-xs text-red-300"><AlertCircle className="h-3.5 w-3.5" />{error}</span>}
          </label>
        </div>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground">Cancel</button>
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"><Save className="h-4 w-4" />Save key</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Settings() {
  const [, navigate] = useLocation();
  const { settings, updateSettings, hydrated, saveState, save, reset } = useLocalSettings();
  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [apiDialog, setApiDialog] = useState<{ provider: typeof providerDetails[number]; existing?: ApiKeyRecord } | null>(null);
  const [deleteProvider, setDeleteProvider] = useState<KeyProvider | null>(null);
  const [sessionDialog, setSessionDialog] = useState<"sessions" | "devices" | "export" | "delete" | null>(null);
  const [testingProvider, setTestingProvider] = useState<KeyProvider | null>(null);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<SectionId | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closeSettings = () => navigate("/");

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3200);
  };

  const updateSection = <K extends keyof SettingsState>(section: K, value: SettingsState[K]) => updateSettings(section, value);

  const visibleNavigation = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? navigation.filter((item) => `${item.label} ${item.description} ${item.keywords}`.includes(query)) : navigation;
  }, [search]);

  useEffect(() => {
    if (!visibleNavigation.some((item) => item.id === activeSection) && visibleNavigation[0]) setActiveSection(visibleNavigation[0].id);
  }, [activeSection, visibleNavigation]);

  useEffect(() => {
    if (!hydrated) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFirst = () => {
      const first = modalRef.current?.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSettings();
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const timer = window.setTimeout(focusFirst, 40);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [hydrated]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, []);

  const goToSection = (id: SectionId) => {
    setActiveSection(id);
    setMobileNavOpen(false);
  };

  const openMobileSection = (id: SectionId) => {
    setActiveSection(id);
    setMobileSection(id);
    setSearch("");
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeMobileSection = () => {
    setMobileSection(null);
    setMobileNavOpen(false);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveAndNotify = async () => {
    await save();
    showToast("success", "Settings saved in this browser.");
  };

  const validateProfile = () => {
    const errors: Record<string, string> = {};
    if (settings.profile.displayName.length > 60) errors.displayName = "Use 60 characters or fewer.";
    if (settings.profile.username && !/^[a-z0-9_-]{3,30}$/i.test(settings.profile.username)) errors.username = "Use 3–30 letters, numbers, hyphens, or underscores.";
    if (settings.profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.profile.email)) errors.email = "Enter a valid email address.";
    if (settings.profile.avatarUrl && !/^https?:\/\/\S+$/i.test(settings.profile.avatarUrl)) errors.avatarUrl = "Use a full http:// or https:// URL.";
    setProfileErrors(errors);
    if (Object.keys(errors).length) {
      showToast("error", "Fix the highlighted profile fields before saving.");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateProfile()) return;
    await saveAndNotify();
  };

  const updateProfile = (patch: Partial<ProfileSettings>) => updateSection("profile", { ...settings.profile, ...patch });
  const updateModels = (patch: Partial<ModelSettings>) => updateSection("models", { ...settings.models, ...patch });
  const updatePreferences = (patch: Partial<PreferenceSettings>) => updateSection("preferences", { ...settings.preferences, ...patch });
  const updateEditor = (patch: Partial<EditorSettings>) => updateSection("editor", { ...settings.editor, ...patch });
  const updateNotifications = (patch: Partial<NotificationSettings>) => updateSection("notifications", { ...settings.notifications, ...patch });
  const updateSecurity = (patch: Partial<SecuritySettings>) => updateSection("security", { ...settings.security, ...patch });
  const updateAppearance = (patch: Partial<AppearanceSettings>) => updateSection("appearance", { ...settings.appearance, ...patch });

  const addKey = (provider: KeyProvider, record: ApiKeyRecord) => {
    updateSection("apiKeys", { ...settings.apiKeys, [provider]: record });
    showToast("success", "Key saved locally. Run the format check when ready.");
  };

  const removeKey = () => {
    if (!deleteProvider) return;
    const next = { ...settings.apiKeys };
    delete next[deleteProvider];
    updateSection("apiKeys", next);
    setDeleteProvider(null);
    showToast("success", `${providerDetails.find((item) => item.id === deleteProvider)?.name} key removed.`);
  };

  const testKey = (provider: KeyProvider) => {
    const record = settings.apiKeys[provider];
    if (!record) return;
    setTestingProvider(provider);
    window.setTimeout(() => {
      const valid = record.value.trim().length >= 8;
      updateSection("apiKeys", {
        ...settings.apiKeys,
        [provider]: { ...record, status: valid ? "connected" : "error", message: valid ? undefined : "Key is too short" },
      });
      setTestingProvider(null);
      showToast(valid ? "success" : "error", valid ? "Key format validated locally." : "Key format needs attention.");
    }, 650);
  };

  const copyKey = async (provider: KeyProvider) => {
    const value = settings.apiKeys[provider]?.value;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast("success", "Key copied to clipboard.");
    } catch {
      showToast("error", "Clipboard access was blocked by the browser.");
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nura-x-settings.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setSessionDialog(null);
    showToast("success", "Settings export downloaded.");
  };

  const clearLocalData = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem("nura-x-plan");
    window.localStorage.removeItem("nura-x-billing-cycle");
    setSessionDialog(null);
    window.location.reload();
  };

  if (!hydrated) {
    return (
      <main className="flex h-full min-h-0 flex-1 items-start justify-center overflow-auto bg-background p-5 sm:p-8">
        <div className="w-full max-w-6xl space-y-5" aria-label="Loading settings" aria-busy="true">
          <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-white/5" />
          <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-[520px] animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
      </main>
    );
  }

  const profileInitials = settings.profile.displayName.trim()
    ? settings.profile.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
    : "NX";
  const isLightPreview = settings.appearance.theme === "light";

  return (
    <main
      ref={mainRef}
      className={cn("settings-page relative flex min-h-0 flex-1 items-stretch justify-center overflow-auto bg-background md:fixed md:inset-0 md:z-[120] md:items-center md:overflow-hidden md:bg-black/70 md:p-6 md:backdrop-blur-[2px]", settings.appearance.compactMode && "settings-compact", !settings.appearance.animations && "settings-no-animations", settings.appearance.reducedMotion && "settings-reduced-motion")}
      data-theme={isLightPreview ? "light-preview" : "dark"}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSettings();
      }}
      style={{
        "--settings-accent": settings.appearance.accentColor,
        "--background": isLightPreview ? "0 0% 97%" : "0 0% 3%",
        "--foreground": isLightPreview ? "222 25% 12%" : "0 0% 95%",
        "--muted-foreground": isLightPreview ? "220 10% 42%" : "0 0% 50%",
      } as React.CSSProperties}
    >
      <style>{`
        .settings-page[data-theme="light-preview"] .text-foreground { color: hsl(222 25% 12%); }
        .settings-page[data-theme="light-preview"] .text-muted-foreground { color: hsl(220 10% 42%); }
        .settings-page[data-theme="light-preview"] .border-white\\/10 { border-color: rgba(15, 23, 42, .14); }
        .settings-page[data-theme="light-preview"] .border-white\\/8 { border-color: rgba(15, 23, 42, .10); }
        .settings-page[data-theme="light-preview"] .bg-black\\/20,
        .settings-page[data-theme="light-preview"] .bg-black\\/10 { background: rgba(15, 23, 42, .05); }
        .settings-compact .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem; }
        .settings-compact .px-5.py-6 { padding-top: 1rem; padding-bottom: 1rem; }
        .settings-compact .sm\\:px-7 { padding-left: 1.25rem; padding-right: 1.25rem; }
        .settings-section-compact .settings-section-header {
          gap: .6rem;
          padding: .65rem 1rem;
        }
        .settings-section-compact .settings-section-content {
          gap: .65rem;
          padding-top: .65rem;
          padding-bottom: .65rem;
        }
        .settings-section-compact .settings-section-content > :not([hidden]) ~ :not([hidden]) { margin-top: .65rem; }
        .settings-section-compact .settings-section-content .grid { gap: .65rem; }
        .settings-section-profile .settings-section-header {
          gap: .25rem;
          padding-top: .15rem;
          padding-bottom: .15rem;
        }
        .settings-section-profile .settings-section-header > div:first-child {
          gap: .35rem;
        }
        .settings-section-profile .settings-section-header > div:first-child > div:first-child {
          width: 1.5rem;
          height: 1.5rem;
          border-radius: .45rem;
        }
        .settings-section-profile .settings-section-header > div:first-child > div:first-child svg {
          width: .7rem;
          height: .7rem;
        }
        .settings-section-profile .settings-section-header h2 {
          font-size: .75rem;
          line-height: 1rem;
        }
        .settings-section-profile .settings-section-header p {
          margin-top: .15rem;
          font-size: .6rem;
          line-height: .7rem;
        }
        .settings-profile-summary {
          gap: .75rem;
          padding: .65rem;
        }
        .settings-profile-avatar {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: .65rem;
          font-size: .8rem;
        }
        .settings-profile-title {
          font-size: .75rem;
          line-height: .95rem;
        }
        .settings-profile-description {
          margin-top: .2rem;
          font-size: .65rem;
          line-height: .85rem;
        }
        .settings-profile-action {
          gap: .35rem;
          padding: .35rem .55rem;
          font-size: .65rem;
          line-height: .85rem;
        }
        .settings-profile-action svg { width: .7rem; height: .7rem; }
        .settings-section-models .settings-section-content {
          gap: .45rem;
          padding-top: .45rem;
          padding-bottom: .45rem;
        }
        .settings-section-models .settings-section-content > :not([hidden]) ~ :not([hidden]) { margin-top: .45rem; }
        .settings-section-models .settings-section-content .grid { gap: .45rem; }
        .settings-section-models .settings-section-content .rounded-xl.border {
          padding: .45rem;
        }
        .settings-toggle-card-compact {
          gap: .75rem;
          padding: .45rem .55rem;
        }
        .settings-toggle-card-compact > div:first-child > p:first-child {
          font-size: .75rem;
          line-height: .9rem;
        }
        .settings-toggle-card-compact > div:first-child > p:last-child {
          margin-top: .15rem;
          font-size: .65rem;
          line-height: .8rem;
        }
        .settings-toggle-card-compact > button {
          height: 1rem;
          width: 1.9rem;
        }
        .settings-toggle-switch[data-state="on"] .settings-toggle-knob {
          transform: translateX(1.5rem);
        }
        .settings-toggle-switch[data-state="off"] .settings-toggle-knob {
          transform: translateX(.25rem);
        }
        .settings-toggle-card-compact > button > .settings-toggle-knob {
          top: .2rem;
          height: .6rem;
          width: .6rem;
        }
        .settings-main-header {
          gap: .6rem;
          padding-top: .5rem;
          padding-bottom: .5rem;
        }
        .settings-main-header > div:first-child > div:first-child {
          gap: .5rem;
        }
        .settings-main-header > div:first-child > div:first-child > div:first-child {
          width: 2rem;
          height: 2rem;
          border-radius: .6rem;
        }
        .settings-main-header > div:first-child > div:first-child > div:first-child svg {
          width: .8rem;
          height: .8rem;
        }
        .settings-main-header h1 {
          font-size: .8rem;
          line-height: 1rem;
        }
        .settings-main-header p {
          margin-top: .15rem;
          font-size: .6rem;
          line-height: .75rem;
        }
        .settings-main-header > div:last-child {
          gap: .4rem;
        }
        .settings-main-header > div:last-child > span {
          gap: .3rem;
          font-size: .6rem;
          line-height: .75rem;
        }
        .settings-main-header > div:last-child > button:not([aria-label]) {
          gap: .35rem;
          padding: .35rem .65rem;
          border-radius: .5rem;
          font-size: .7rem;
          line-height: .85rem;
        }
        .settings-main-header > div:last-child > button:not([aria-label]) svg {
          width: .75rem;
          height: .75rem;
        }
        .settings-main-header > div:last-child > button[aria-label] {
          width: 1.75rem;
          height: 1.75rem;
        }
        .settings-main-header > div:last-child > button[aria-label] svg {
          width: .75rem;
          height: .75rem;
        }
        .settings-no-animations *, .settings-reduced-motion * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: 0.01ms !important;
        }
        @media (max-width: 767px) {
          .settings-mobile button,
          .settings-mobile select,
          .settings-mobile input:not([type="color"]),
          .settings-mobile textarea { min-height: 44px; }
          .settings-mobile .settings-mobile-icon-button { min-height: 44px; min-width: 44px; }
          .settings-mobile .settings-mobile-section-card > div:first-child { border-bottom: 0; padding: 1.25rem; }
          .settings-mobile .settings-mobile-section-card > div:first-child button { min-height: 36px; }
        }
        @keyframes settings-modal-in {
          from { opacity: 0; transform: translateY(10px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .settings-modal-panel { animation: settings-modal-in .22s cubic-bezier(.22,.8,.2,1) both; }
        .settings-no-animations .settings-modal-panel,
        .settings-reduced-motion .settings-modal-panel { animation: none; }
        @media (min-width: 768px) {
          .settings-modal-panel .settings-section-header {
            gap: .75rem;
            padding: .85rem 1rem;
          }
          .settings-modal-panel .settings-section-header h2 { font-size: .875rem; }
          .settings-modal-panel .settings-section-header p { margin-top: .2rem; font-size: .7rem; line-height: 1rem; }
          .settings-modal-panel .settings-section-header > div:first-child > div:first-child {
            height: 2rem;
            width: 2rem;
            border-radius: .65rem;
          }
          .settings-modal-panel .settings-section-header svg { height: .8rem; width: .8rem; }
          .settings-modal-panel .settings-section-content {
            gap: .55rem;
            padding: .65rem;
          }
          .settings-modal-panel .settings-section-content > :not([hidden]) ~ :not([hidden]) { margin-top: .6rem; }
          .settings-modal-panel .settings-section-content > .grid,
          .settings-modal-panel .settings-section-content .grid { gap: .55rem; }
          .settings-modal-panel .settings-section-content .space-y-3 > :not([hidden]) ~ :not([hidden]),
          .settings-modal-panel .settings-section-content .space-y-5 > :not([hidden]) ~ :not([hidden]),
          .settings-modal-panel .settings-section-content .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: .55rem; }
          .settings-modal-panel .settings-section-content .rounded-xl { border-radius: .6rem; }
          .settings-modal-panel .settings-section-content .rounded-xl.border { padding: .6rem; }
          .settings-modal-panel .settings-section-content .rounded-xl.border > .flex { gap: .55rem; }
          .settings-modal-panel .settings-section-content .rounded-lg.border { padding-top: .55rem; padding-bottom: .55rem; }
          .settings-modal-panel .settings-section-content .p-4 { padding: .6rem; }
          .settings-modal-panel .settings-section-content .p-5 { padding: .7rem; }
          .settings-modal-panel .settings-section-content .py-3\\.5 { padding-top: .5rem; padding-bottom: .5rem; }
          .settings-modal-panel .settings-section-content .py-2\\.5 { padding-top: .45rem; padding-bottom: .45rem; }
          .settings-modal-panel .settings-section-content .h-16 { height: 3rem; }
          .settings-modal-panel .settings-section-content .w-16 { width: 3rem; }
          .settings-modal-panel .settings-section-content .h-12 { height: 2.5rem; }
          .settings-modal-panel .settings-section-content .w-12 { width: 2.5rem; }
          .settings-modal-panel .settings-section-content input:not([type="range"]):not([type="color"]),
          .settings-modal-panel .settings-section-content select { height: 2.25rem; font-size: .75rem; }
          .settings-modal-panel .settings-section-content label { gap: .35rem; }
          .settings-modal-panel .settings-section-content label > span:first-child { font-size: .75rem; }
          .settings-modal-panel .settings-section-content label > span:nth-child(2) { font-size: .65rem; line-height: .9rem; }
          .settings-modal-panel .settings-section-content textarea { min-height: 4rem; height: 4rem; font-size: .75rem; line-height: 1.15rem; }
          .settings-modal-panel .settings-section-content button { min-height: 2rem; }
          .settings-modal-panel .settings-section-compact .settings-section-content {
            gap: .35rem;
            padding-top: .35rem;
            padding-bottom: .35rem;
          }
          .settings-modal-panel .settings-section-models .settings-section-content {
            gap: .25rem;
            padding-top: .25rem;
            padding-bottom: .25rem;
          }
          .settings-modal-panel .settings-section-models .settings-section-content > :not([hidden]) ~ :not([hidden]) {
            margin-top: .25rem;
          }
          .settings-modal-panel .settings-section-models .settings-section-content .grid {
            gap: .25rem;
          }
          .settings-modal-panel .settings-section-models .settings-section-content .rounded-xl.border {
            padding: .3rem;
            border-radius: .5rem;
          }
          .settings-modal-panel .settings-section-models .settings-section-content .rounded-xl.border > .flex {
            gap: .35rem;
          }
          .settings-modal-panel .settings-section-models .settings-section-content .rounded-lg.border {
            padding-top: .3rem;
            padding-bottom: .3rem;
          }
          .settings-modal-panel .settings-section-models .settings-section-content label {
            gap: .2rem;
          }
          .settings-modal-panel .settings-section-models .settings-section-content label > span:first-child {
            font-size: .7rem;
            line-height: .8rem;
          }
          .settings-modal-panel .settings-section-models .settings-section-content label > span:nth-child(2) {
            font-size: .58rem;
            line-height: .7rem;
          }
          .settings-modal-panel .settings-section-models .settings-section-content input:not([type="range"]):not([type="color"]),
          .settings-modal-panel .settings-section-models .settings-section-content select {
            height: 1.85rem;
            font-size: .68rem;
          }
          .settings-modal-panel .settings-section-models .settings-section-content .py-3\\.5 {
            padding-top: .3rem;
            padding-bottom: .3rem;
          }
          .settings-modal-panel .settings-toggle-card-compact {
            gap: .5rem;
            min-height: 3rem;
            padding: .3rem .35rem;
          }
          .settings-modal-panel .settings-toggle-card-compact > div:first-child > p:first-child {
            font-size: .65rem;
            line-height: .75rem;
          }
          .settings-modal-panel .settings-toggle-card-compact > div:first-child > p:last-child {
            margin-top: .12rem;
            font-size: .55rem;
            line-height: .7rem;
          }
          .settings-modal-panel .settings-toggle-card-compact > button {
            height: .8rem;
            width: 1.55rem;
          }
          .settings-modal-panel .settings-toggle-card-compact > button > .settings-toggle-knob {
            top: .15rem;
            height: .5rem;
            width: .5rem;
          }
          .settings-modal-panel .settings-toggle-switch[data-state="on"] .settings-toggle-knob {
            transform: translateX(.85rem);
          }
          .settings-modal-panel .settings-toggle-switch[data-state="off"] .settings-toggle-knob {
            transform: translateX(.15rem);
          }
          .settings-modal-panel .settings-section-compact .settings-section-header {
            gap: .5rem;
            padding: .45rem 1rem;
          }
          .settings-modal-panel .settings-section-compact .settings-section-header h2 { font-size: .8rem; }
          .settings-modal-panel .settings-section-compact .settings-section-header p { font-size: .65rem; line-height: .9rem; }
          .settings-modal-panel .settings-section-profile .settings-section-header {
            gap: .2rem;
            padding-top: .1rem;
            padding-bottom: .1rem;
          }
          .settings-modal-panel .settings-section-profile .settings-section-header > div:first-child { gap: .3rem; }
          .settings-modal-panel .settings-section-profile .settings-section-header > div:first-child > div:first-child { width: 1.35rem; height: 1.35rem; }
          .settings-modal-panel .settings-section-profile .settings-section-header h2 { font-size: .7rem; }
          .settings-modal-panel .settings-section-profile .settings-section-header p { font-size: .55rem; line-height: .65rem; }
          .settings-modal-panel .settings-section-compact .settings-section-content > :not([hidden]) ~ :not([hidden]) {
            margin-top: .35rem;
          }
          .settings-modal-panel .settings-section-compact .settings-section-content .grid {
            gap: .35rem;
          }
          .settings-modal-panel .settings-section-compact .settings-section-content .rounded-xl.border {
            padding: .4rem;
          }
          .settings-modal-panel .settings-section-compact .settings-section-content .rounded-lg.border {
            padding-top: .35rem;
            padding-bottom: .35rem;
          }
          .settings-modal-panel .settings-section-compact .settings-section-content .py-3\\.5 {
            padding-top: .35rem;
            padding-bottom: .35rem;
          }
          .settings-modal-panel .settings-section-compact .settings-section-content .p-4 {
            padding: .4rem;
          }
          .settings-modal-panel .settings-section-compact .settings-section-content .h-16 {
            height: 2.5rem;
          }
          .settings-modal-panel .settings-section-compact .settings-section-content .w-16 {
            width: 2.5rem;
          }
          .settings-modal-panel .settings-section-compact .settings-section-content textarea {
            min-height: 3rem;
            height: 3rem;
          }
          .settings-modal-panel .settings-nav-button {
            width: 100%;
            gap: .45rem;
            border-radius: .55rem;
            padding: .35rem .55rem;
          }
          .settings-modal-panel .settings-nav-button > svg {
            height: .75rem;
            width: .75rem;
          }
          .settings-modal-panel .settings-nav-button > span > span:first-child {
            font-size: .7rem;
            line-height: .85rem;
          }
          .settings-modal-panel .settings-nav-button > span > span:last-child {
            margin-top: .1rem;
            font-size: .55rem;
            line-height: .7rem;
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
          }
        }
        /* Shared 69px settings-row system: keep every standard item aligned. */
        .settings-modal-panel .settings-row {
          box-sizing: border-box;
          height: 69px;
          min-height: 69px;
          overflow: hidden;
        }
        .settings-modal-panel .settings-form-row {
          box-sizing: border-box;
          height: 69px;
          min-height: 69px;
          padding: 5px 10px;
          overflow: visible;
        }
        .settings-modal-panel .settings-form-row > :not([hidden]) ~ :not([hidden]) {
          margin-top: 2px;
        }
        .settings-modal-panel .settings-form-row > span:first-child {
          line-height: 14px;
        }
        .settings-modal-panel .settings-form-row > span:nth-child(2) {
          line-height: 11px;
        }
        .settings-modal-panel .settings-form-row input,
        .settings-modal-panel .settings-form-row select,
        .settings-modal-panel .settings-form-row textarea {
          box-sizing: border-box;
          height: 29px;
          min-height: 29px;
          padding-top: 4px;
          padding-bottom: 4px;
        }
        .settings-modal-panel .settings-form-row textarea {
          resize: vertical;
          line-height: 17px;
        }
        .settings-modal-panel .settings-toggle-card {
          padding-top: 6px;
          padding-bottom: 6px;
        }
        .settings-modal-panel .settings-toggle-card > div:first-child {
          min-width: 0;
        }
        .settings-modal-panel .settings-toggle-card > div:first-child > p:first-child {
          line-height: 16px;
        }
        .settings-modal-panel .settings-toggle-card > div:first-child > p:last-child {
          margin-top: 2px;
          line-height: 17px;
        }
        .settings-modal-panel .settings-profile-summary,
        .settings-modal-panel .settings-api-key-row,
        .settings-modal-panel .settings-action-row,
        .settings-modal-panel .settings-info-row,
        .settings-modal-panel .settings-model-temperature {
          padding-top: 6px;
          padding-bottom: 6px;
        }
        .settings-modal-panel .settings-profile-summary {
          flex-direction: row;
          gap: 10px;
        }
        .settings-modal-panel .settings-profile-avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
        }
        .settings-modal-panel .settings-profile-description {
          line-height: 15px;
        }
        .settings-modal-panel .settings-api-key-row > div {
          min-height: 0;
        }
        .settings-modal-panel .settings-api-key-row > div > div:first-child > div:first-child {
          width: 32px;
          height: 32px;
        }
        .settings-modal-panel .settings-model-temperature {
          overflow: visible;
        }
        .settings-modal-panel .settings-model-temperature > div:first-child {
          margin-bottom: 2px;
        }
        .settings-modal-panel .settings-model-temperature > div:first-child p {
          line-height: 14px;
        }
        .settings-modal-panel .settings-model-temperature > input {
          height: 6px;
        }
        .settings-modal-panel .settings-model-temperature > div:last-child {
          margin-top: 2px;
          line-height: 11px;
        }
        .settings-modal-panel .settings-accent-row {
          box-sizing: border-box;
          height: 69px;
          min-height: 69px;
          padding: 6px 10px;
          overflow: visible;
        }
        .settings-modal-panel .settings-accent-row > p {
          margin-bottom: 4px;
          line-height: 14px;
        }
        .settings-modal-panel .settings-accent-row button {
          height: 28px;
          width: 28px;
        }
        .settings-modal-panel .settings-accent-row label {
          height: 28px;
        }
        @media (max-width: 767px) {
          .settings-modal-panel .settings-row {
            min-height: 69px;
            height: auto;
          }
          .settings-modal-panel .settings-form-row {
            min-height: 69px;
            height: auto;
          }
          .settings-modal-panel .settings-profile-summary {
            min-height: 69px;
            height: auto;
          }
        }
      `}</style>
      <div ref={modalRef} className="settings-modal-panel flex h-full w-full flex-col overflow-hidden bg-background md:h-auto md:max-h-[calc(100dvh-2rem)] md:w-[70vw] md:max-w-[760px] md:rounded-2xl md:border md:border-white/12 md:shadow-[0_24px_100px_rgba(0,0,0,.7)]" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <header className="settings-main-header sticky top-0 z-30 hidden flex-wrap items-center justify-between gap-5 border-b border-white/8 bg-background/95 px-6 py-4 backdrop-blur-xl md:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><Settings2 className="h-4 w-4" /></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("items-center gap-1.5 text-xs sm:inline-flex", saveState === "error" ? "text-red-300" : saveState === "dirty" ? "text-amber-300" : "text-muted-foreground")}>
              {saveState === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saveState === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />}
              {saveState === "error" && <AlertCircle className="h-3.5 w-3.5" />}
              {saveState === "dirty" ? "Unsaved changes" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "All changes saved"}
            </span>
            <button type="button" onClick={handleSave} disabled={saveState === "saving"} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70">
              {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save changes
            </button>
            <button type="button" onClick={closeSettings} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Close settings">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="settings-modal-body flex min-h-0 flex-1 flex-col px-5 py-6 sm:px-8 lg:px-6 lg:py-5 md:grid md:grid-cols-[205px_minmax(0,1fr)] md:gap-0 md:overflow-hidden">
        <div className="settings-mobile md:hidden">
          {mobileSection === null ? (
            <>
              <header className="sticky top-0 z-20 -mx-5 mb-5 border-b border-white/8 bg-background/95 px-5 py-3 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={closeSettings} className="settings-mobile-icon-button inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Back to workspace">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary"><Settings2 className="h-4 w-4" /></div>
                    <h1 className="text-lg font-semibold text-foreground">Settings</h1>
                  </div>
                  <button type="button" onClick={handleSave} disabled={saveState === "saving"} className="settings-mobile-icon-button inline-flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-60" aria-label="Save settings">
                    {saveState === "saving" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  </button>
                </div>
              </header>
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Manage your workspace preferences.</p>
              </div>
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 font-semibold text-primary">{profileInitials}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{settings.profile.displayName || "Local workspace"}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{settings.profile.username ? `@${settings.profile.username}` : "Settings are saved on this device"}</p>
                </div>
                <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-300" aria-label="Local settings ready" />
              </div>
              <label className="relative mb-4 block">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search settings" className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.025] pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/70 focus:ring-2 focus:ring-primary/20" aria-label="Search settings" />
                {search && <button type="button" onClick={() => setSearch("")} className="settings-mobile-icon-button absolute right-0 top-0 inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground" aria-label="Clear settings search"><X className="h-4 w-4" /></button>}
              </label>
              <div className="space-y-2" aria-label="Settings sections">
                {visibleNavigation.map((item) => <MobileSectionButton key={item.id} item={item} onClick={openMobileSection} />)}
              </div>
              {!visibleNavigation.length && <EmptyState title="No settings found" description={`No category matches “${search}”. Try another search.`} action={<button type="button" onClick={() => setSearch("")} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-foreground hover:bg-white/5">Clear search</button>} />}
              <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">Choose a category to edit its settings. Changes stay on this device until you save them.</p>
            </>
          ) : (
            <header className="sticky top-0 z-20 -mx-5 mb-5 border-b border-white/8 bg-background/95 px-5 py-3 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <button type="button" onClick={closeMobileSection} className="settings-mobile-icon-button inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Back to Settings">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-foreground">{navigation.find((item) => item.id === mobileSection)?.label}</p>
                  <p className="truncate text-xs text-muted-foreground">Settings</p>
                </div>
                <span className={cn("hidden items-center gap-1 text-[11px] sm:inline-flex", saveState === "error" ? "text-red-300" : saveState === "dirty" ? "text-amber-300" : "text-muted-foreground")}>
                  {saveState === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {saveState === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />}
                  {saveState === "dirty" ? "Unsaved" : saveState === "saving" ? "Saving" : saveState === "error" ? "Error" : "Saved"}
                </span>
                <button type="button" onClick={handleSave} disabled={saveState === "saving"} className="settings-mobile-icon-button inline-flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-60" aria-label="Save section settings">
                  {saveState === "saving" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                </button>
              </div>
            </header>
          )}
        </div>

        <aside className="hidden min-h-0 overflow-y-auto border-r border-white/8 pr-4 md:block">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search settings" className="h-9 w-full rounded-lg border border-white/8 bg-black/20 pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/70" aria-label="Search settings categories" />
            {search && <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear settings search"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <nav aria-label="Settings categories" className="space-y-0.5">
            {visibleNavigation.map((item) => <NavButton key={item.id} item={item} active={activeSection === item.id} onClick={goToSection} />)}
          </nav>
          {!visibleNavigation.length && <p className="px-3 py-5 text-center text-xs text-muted-foreground">No matching categories.</p>}
        </aside>

        <div className="settings-modal-content min-w-0 min-h-0 overflow-y-auto md:pl-5">
          <div className={cn("min-w-0 space-y-5", mobileSection && "settings-mobile-section-card", mobileSection === null ? "hidden md:block" : "block")}>
            {!visibleNavigation.length ? (
              <EmptyState title="No settings found" description={`No category matches “${search}”. Try a provider, editor option, or notification name.`} action={<button type="button" onClick={() => setSearch("")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-foreground hover:bg-white/5">Clear search</button>} />
            ) : (
              <>
                <ProfileSection settings={settings.profile} updateProfile={updateProfile} profileInitials={profileInitials} errors={profileErrors} mobileSection={mobileSection} activeSection={activeSection} onReset={reset} />
                <ModelsSection settings={settings.models} providers={providerDetails} updateModels={updateModels} mobileSection={mobileSection} activeSection={activeSection} onReset={reset} />
                <ApiKeysSection apiKeys={settings.apiKeys} providers={providerDetails} visibility={settings.security.apiKeyVisibility} onAdd={(provider) => setApiDialog({ provider })} onEdit={(provider, existing) => setApiDialog({ provider, existing })} onDelete={setDeleteProvider} onCopy={copyKey} onTest={testKey} onToggleVisibility={() => updateSecurity({ apiKeyVisibility: settings.security.apiKeyVisibility === "reveal" ? "masked" : "reveal" })} testingProvider={testingProvider} mobileSection={mobileSection} activeSection={activeSection} onReset={reset} />
                <PreferencesSection settings={settings.preferences} updatePreferences={updatePreferences} mobileSection={mobileSection} activeSection={activeSection} onReset={reset} />
                <EditorSection settings={settings.editor} updateEditor={updateEditor} mobileSection={mobileSection} activeSection={activeSection} onReset={reset} />
                <NotificationsSection settings={settings.notifications} updateNotifications={updateNotifications} onPreview={() => { if (!settings.notifications.browser) { showToast("error", "Enable browser notifications first."); return; } showToast("success", "Preview notification queued for this browser."); }} mobileSection={mobileSection} activeSection={activeSection} onReset={reset} />
                <SecuritySection settings={settings.security} updateSecurity={updateSecurity} onDialog={setSessionDialog} mobileSection={mobileSection} activeSection={activeSection} onReset={reset} />
                <AppearanceSection settings={settings.appearance} updateAppearance={updateAppearance} mobileSection={mobileSection} activeSection={activeSection} onReset={reset} />
              </>
            )}
        </div>
        </div>
        </div>
      </div>

      {toast && <div role="status" className={cn("fixed bottom-5 right-5 z-[200] flex max-w-sm items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur", toast.type === "success" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-red-400/25 bg-red-400/10 text-red-100")}><span className={cn("flex h-5 w-5 items-center justify-center rounded-full", toast.type === "success" ? "bg-emerald-400/20" : "bg-red-400/20")}>{toast.type === "success" ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}</span>{toast.message}</div>}

      <ApiKeyDialog provider={apiDialog?.provider ?? null} existing={apiDialog?.existing} open={Boolean(apiDialog)} onOpenChange={(open) => { if (!open) setApiDialog(null); }} onSave={(record) => { if (apiDialog) addKey(apiDialog.provider.id, record); }} />

      <Dialog open={Boolean(deleteProvider)} onOpenChange={(open) => { if (!open) setDeleteProvider(null); }}>
        <DialogContent className="border-white/10 bg-[#101019] sm:max-w-[430px]">
          <DialogHeader><DialogTitle>Remove {providerDetails.find((item) => item.id === deleteProvider)?.name} key?</DialogTitle><DialogDescription>This removes the key from this browser immediately. It does not revoke the key with the provider.</DialogDescription></DialogHeader>
          <DialogFooter><button type="button" onClick={() => setDeleteProvider(null)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground hover:bg-white/5">Cancel</button><button type="button" onClick={removeKey} className="inline-flex items-center gap-2 rounded-lg bg-red-500/85 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"><Trash2 className="h-4 w-4" />Remove key</button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sessionDialog === "sessions" || sessionDialog === "devices"} onOpenChange={(open) => { if (!open) setSessionDialog(null); }}>
        <DialogContent className="border-white/10 bg-[#101019] sm:max-w-[470px]">
          <DialogHeader><DialogTitle>{sessionDialog === "sessions" ? "Active sessions" : "Trusted devices"}</DialogTitle><DialogDescription>There is no account service connected to this imported frontend.</DialogDescription></DialogHeader>
          <EmptyState title={sessionDialog === "sessions" ? "Only this browser session" : "No synced devices"} description={sessionDialog === "sessions" ? "Your settings are isolated to this browser. A server-backed session list will appear when authentication is connected." : "Device management requires an account backend, so nothing is being fabricated here."} />
          <DialogFooter><button type="button" onClick={() => setSessionDialog(null)} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90">Done</button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sessionDialog === "export"} onOpenChange={(open) => { if (!open) setSessionDialog(null); }}>
        <DialogContent className="border-white/10 bg-[#101019] sm:max-w-[470px]">
          <DialogHeader><DialogTitle>Export local data</DialogTitle><DialogDescription>Download your current settings as a JSON file. API keys are included because they are part of your local configuration.</DialogDescription></DialogHeader>
          <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-4 text-xs leading-5 text-amber-100/80"><AlertCircle className="mr-2 inline h-4 w-4 text-amber-300" />Keep the downloaded file private.</div>
          <DialogFooter><button type="button" onClick={() => setSessionDialog(null)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground hover:bg-white/5">Cancel</button><button type="button" onClick={exportData} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"><Download className="h-4 w-4" />Download JSON</button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sessionDialog === "delete"} onOpenChange={(open) => { if (!open) setSessionDialog(null); }}>
        <DialogContent className="border-red-400/20 bg-[#140d12] sm:max-w-[470px]">
          <DialogHeader><DialogTitle className="text-red-200">Delete local account data?</DialogTitle><DialogDescription>This frontend-only action clears NURA X settings, plan selection, and billing-cycle data from this browser. It cannot delete a remote account because no account backend is connected.</DialogDescription></DialogHeader>
          <div className="rounded-xl border border-red-400/15 bg-red-400/[0.05] p-4 text-xs leading-5 text-red-100/80">This cannot be undone unless you exported your settings first.</div>
          <DialogFooter><button type="button" onClick={() => setSessionDialog(null)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground hover:bg-white/5">Keep local data</button><button type="button" onClick={clearLocalData} className="inline-flex items-center gap-2 rounded-lg bg-red-500/85 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"><Trash2 className="h-4 w-4" />Delete local data</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: typeof navigation[number];
  active: boolean;
  onClick: (id: SectionId) => void;
}) {
  const Icon = item.icon;
  return (
    <button type="button" onClick={() => onClick(item.id)} aria-current={active ? "page" : undefined} className={cn("settings-nav-button flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active ? "bg-primary/12 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground")}>
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{item.description}</span></span>
    </button>
  );
}

function MobileSectionButton({
  item,
  onClick,
}: {
  item: typeof navigation[number];
  onClick: (id: SectionId) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      className="flex min-h-[68px] w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] px-4 text-left transition active:scale-[0.99] hover:border-primary/30 hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{item.label}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{item.description}</span>
      </span>
      <ChevronDown className="h-4 w-4 -rotate-90 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}