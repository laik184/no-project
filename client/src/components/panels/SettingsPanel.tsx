import { useState, useEffect, useRef } from "react";
import { X, Search, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL_CSS, Toast } from "./settings-primitives";
import { GeneralSection, AppearanceSection, AISection, IntegrationsSection } from "./settings-sections-a";
import { BillingSection, SecuritySection, DeploymentSection, AccountSection } from "./settings-sections-b";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [closing, setClosing] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [autoSave, setAutoSave]             = useState(true);
  const [language, setLanguage]             = useState("en");
  const [notifications, setNotifications]   = useState(true);
  const [theme, setTheme]                   = useState<"light"|"dark"|"system">("dark");
  const [fontSize, setFontSize]             = useState(14);
  const [compactMode, setCompactMode]       = useState(false);
  const [enableAgent, setEnableAgent]       = useState(true);
  const [showThinking, setShowThinking]     = useState(true);
  const [showActions, setShowActions]       = useState(true);
  const [responseSpeed, setResponseSpeed]   = useState("balanced");
  const [autoDeploy, setAutoDeploy]         = useState(false);
  const [environment, setEnvironment]       = useState("production");
  const [twoFA, setTwoFA]                   = useState(false);
  const [autoRenew, setAutoRenew]           = useState(true);
  const [billingEmail, setBillingEmail]     = useState("mohd@example.com");
  const [apiKey, setApiKey]                 = useState("");
  const [webhookUrl, setWebhookUrl]         = useState("");
  const [githubConnected, setGithubConnected] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };

  const wrap = <T,>(fn: (v: T) => void, label = "Saved") => (v: T) => { fn(v); showToast(label); };

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose(); }, 240);
  };

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  if (!open && !closing) return null;

  const sq = search.toLowerCase();
  const sharedProps = { sq, wrap, showToast };

  return (
    <>
      <style>{PANEL_CSS}</style>

      <div
        className={cn("fixed inset-0 z-[100]", closing ? "sp-overlay-out" : "sp-overlay-in")}
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        onClick={handleClose}
        data-testid="settings-overlay"
      />

      <div
        className={cn("fixed top-0 right-0 h-full z-[101] flex flex-col overflow-hidden", closing ? "sp-slide-out" : "sp-slide-in")}
        style={{ width: "min(460px, 100vw)", background: "rgba(9,9,20,0.97)", borderLeft: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(24px)", boxShadow: "-8px 0 48px rgba(0,0,0,0.6)" }}
        data-testid="settings-panel"
      >
        <div className="flex-shrink-0 px-5 pt-5 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c8dff,#a78bfa)", boxShadow: "0 0 12px rgba(124,141,255,0.4)" }}>
                <Lock style={{ width: 13, height: 13, color: "#fff" }} />
              </div>
              <span className="text-[15px] font-semibold text-foreground">Settings</span>
            </div>
            <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors" data-testid="settings-close">
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 h-8 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Search style={{ width: 12, height: 12, color: "rgba(148,163,184,0.5)", flexShrink: 0 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search settings…" className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none" data-testid="settings-search" />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                <X style={{ width: 10, height: 10 }} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>

          <GeneralSection {...sharedProps} autoSave={autoSave} setAutoSave={setAutoSave} language={language} setLanguage={setLanguage} notifications={notifications} setNotifications={setNotifications} />

          <AppearanceSection {...sharedProps} theme={theme} setTheme={setTheme} fontSize={fontSize} setFontSize={setFontSize} compactMode={compactMode} setCompactMode={setCompactMode} />

          <AISection {...sharedProps} enableAgent={enableAgent} setEnableAgent={setEnableAgent} showThinking={showThinking} setShowThinking={setShowThinking} showActions={showActions} setShowActions={setShowActions} responseSpeed={responseSpeed} setResponseSpeed={setResponseSpeed} />

          <BillingSection {...sharedProps} billingEmail={billingEmail} setBillingEmail={setBillingEmail} autoRenew={autoRenew} setAutoRenew={setAutoRenew} />

          <IntegrationsSection {...sharedProps} githubConnected={githubConnected} setGithubConnected={setGithubConnected} apiKey={apiKey} setApiKey={setApiKey} webhookUrl={webhookUrl} setWebhookUrl={setWebhookUrl} />

          <SecuritySection {...sharedProps} twoFA={twoFA} setTwoFA={setTwoFA} />

          <DeploymentSection {...sharedProps} autoDeploy={autoDeploy} setAutoDeploy={setAutoDeploy} environment={environment} setEnvironment={setEnvironment} />

          <AccountSection {...sharedProps} />

          {sq && !["general","appearance","ai","billing","integrations","security","deployment","account","save","language","notification","theme","font","compact","agent","thinking","action","response","plan","upgrade","payment","invoice","email","renew","card","github","api","webhook","2fa","session","token","deploy","environment","publish","logout","delete","sign"].some((k) => k.includes(sq)) && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Search style={{ width: 28, height: 28, color: "rgba(148,163,184,0.2)" }} />
              <p className="text-[12px] text-muted-foreground/40">No settings match &ldquo;{search}&rdquo;</p>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast msg={toast} />}
    </>
  );
}
