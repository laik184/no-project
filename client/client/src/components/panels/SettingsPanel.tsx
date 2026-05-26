import { useState, useEffect, useRef } from "react";
import {
  X, Search, Save, Globe, Bell, Sun, Moon, Monitor, Type,
  Layout, Bot, Brain, Package, Zap, CreditCard,
  Github, Key, Webhook, Shield, Smartphone,
  Terminal, Rocket, Plus, RefreshCw,
  FileText, Lock, LogOut, UserX, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PANEL_CSS, Row, Toggle, Select, Slider, UsageBar, SectionTitle, ActionBtn, Toast,
} from "./settings-primitives";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

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

          {(!sq || "general auto save language notifications".includes(sq)) && (
            <section className="mt-4">
              <SectionTitle>General</SectionTitle>
              {(!sq || "auto save".includes(sq)) && (
                <Row icon={Save} iconColor="#7dd3fc" label="Auto Save" sub="Automatically save changes">
                  <Toggle value={autoSave} onChange={wrap(setAutoSave)} />
                </Row>
              )}
              {(!sq || "language".includes(sq)) && (
                <Row icon={Globe} iconColor="#34d399" label="Language" sub="Interface language">
                  <Select value={language} onChange={wrap(setLanguage)} options={[
                    { label: "English", value: "en" },
                    { label: "Hindi", value: "hi" },
                    { label: "Spanish", value: "es" },
                    { label: "French", value: "fr" },
                    { label: "German", value: "de" },
                  ]} />
                </Row>
              )}
              {(!sq || "notifications".includes(sq)) && (
                <Row icon={Bell} iconColor="#fbbf24" label="Notifications" sub="Push and email alerts">
                  <Toggle value={notifications} onChange={wrap(setNotifications)} />
                </Row>
              )}
            </section>
          )}

          {(!sq || "appearance theme font compact".includes(sq)) && (
            <section className="mt-4">
              <SectionTitle>Appearance</SectionTitle>

              {(!sq || "theme".includes(sq)) && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/[0.025] transition-colors -mx-1">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#c084fc15", border: "1px solid #c084fc25" }}>
                    {theme === "dark" ? <Moon style={{ width: 13, height: 13, color: "#c084fc" }} /> : theme === "light" ? <Sun style={{ width: 13, height: 13, color: "#fbbf24" }} /> : <Monitor style={{ width: 13, height: 13, color: "#94a3b8" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-foreground/90">Theme</div>
                    <div className="text-[10.5px] text-muted-foreground/60 mt-0.5">Color scheme</div>
                  </div>
                  <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                    {(["light","dark","system"] as const).map((t) => (
                      <button key={t} onClick={() => { setTheme(t); showToast("Saved"); }} className="px-2.5 py-1 text-[10px] font-medium capitalize transition-all" style={{ background: theme === t ? "rgba(124,141,255,0.2)" : "transparent", color: theme === t ? "#a78bfa" : "rgba(148,163,184,0.55)", borderRight: t !== "system" ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(!sq || "font size".includes(sq)) && (
                <Row icon={Type} iconColor="#fb923c" label="Font Size" sub={`${fontSize}px`}>
                  <Slider value={fontSize} onChange={wrap(setFontSize)} min={10} max={24} />
                </Row>
              )}
              {(!sq || "compact".includes(sq)) && (
                <Row icon={Layout} iconColor="#38bdf8" label="Compact Mode" sub="Tighter spacing">
                  <Toggle value={compactMode} onChange={wrap(setCompactMode)} />
                </Row>
              )}
            </section>
          )}

          {(!sq || "ai agent thinking actions response".includes(sq)) && (
            <section className="mt-4">
              <SectionTitle>AI / Agent</SectionTitle>
              {(!sq || "enable agent".includes(sq)) && (
                <Row icon={Bot} iconColor="#a78bfa" label="Enable Agent" sub="AI-powered assistant">
                  <Toggle value={enableAgent} onChange={wrap(setEnableAgent)} />
                </Row>
              )}
              {(!sq || "thinking".includes(sq)) && (
                <Row icon={Brain} iconColor="#c084fc" label="Show Thinking 🧠" sub="Display reasoning steps">
                  <Toggle value={showThinking} onChange={wrap(setShowThinking)} />
                </Row>
              )}
              {(!sq || "actions".includes(sq)) && (
                <Row icon={Package} iconColor="#fb923c" label="Show Actions 📦💻📁" sub="Display tool usage">
                  <Toggle value={showActions} onChange={wrap(setShowActions)} />
                </Row>
              )}
              {(!sq || "response speed".includes(sq)) && (
                <Row icon={Zap} iconColor="#facc15" label="Response Speed" sub="Balance speed vs quality">
                  <Select value={responseSpeed} onChange={wrap(setResponseSpeed)} options={[
                    { label: "Fast", value: "fast" },
                    { label: "Balanced", value: "balanced" },
                    { label: "Quality", value: "quality" },
                  ]} />
                </Row>
              )}
            </section>
          )}

          {(!sq || "billing plan upgrade payment invoice subscription".includes(sq)) && (
            <section className="mt-4">
              <SectionTitle>Billing & Payments</SectionTitle>

              <div className="mx-0 p-4 rounded-xl mb-2" style={{ background: "linear-gradient(135deg, rgba(124,141,255,0.1) 0%, rgba(167,139,250,0.08) 100%)", border: "1px solid rgba(124,141,255,0.2)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[11px] text-muted-foreground/60 mb-0.5">Current Plan</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-foreground">Free</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(124,141,255,0.15)", color: "#a78bfa", border: "1px solid rgba(124,141,255,0.25)" }}>ACTIVE</span>
                    </div>
                  </div>
                  <ActionBtn variant="primary" onClick={() => showToast("Upgrade coming soon!")}>
                    <Rocket style={{ width: 11, height: 11 }} />
                    Upgrade Plan
                  </ActionBtn>
                </div>

                <div className="flex flex-col gap-2.5 mb-3">
                  <UsageBar label="API Usage"     used={42000}    total={100000}  color="#7c8dff" />
                  <UsageBar label="Storage"       used={1.8}      total={5}       color="#34d399" />
                  <UsageBar label="Compute (hrs)" used={12}       total={50}      color="#fb923c" />
                </div>

                <div className="flex gap-2 flex-wrap">
                  <ActionBtn onClick={() => showToast("Opening subscription portal…")}>
                    <RefreshCw style={{ width: 10, height: 10 }} />
                    Manage Subscription
                  </ActionBtn>
                  <ActionBtn onClick={() => showToast("Fetching invoices…")}>
                    <FileText style={{ width: 10, height: 10 }} />
                    View Invoices
                  </ActionBtn>
                </div>
              </div>

              {(!sq || "email".includes(sq)) && (
                <Row icon={Bell} iconColor="#60a5fa" label="Billing Email" sub="Receive invoice copies">
                  <input
                    value={billingEmail}
                    onChange={(e) => { setBillingEmail(e.target.value); showToast("Saved"); }}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg bg-transparent focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(203,213,225,0.85)", width: 160 }}
                  />
                </Row>
              )}

              {(!sq || "auto renew".includes(sq)) && (
                <Row icon={RefreshCw} iconColor="#34d399" label="Auto-Renew" sub="Renew subscription automatically">
                  <Toggle value={autoRenew} onChange={wrap(setAutoRenew)} />
                </Row>
              )}

              <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/[0.025] transition-colors -mx-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#60a5fa15", border: "1px solid #60a5fa25" }}>
                  <CreditCard style={{ width: 13, height: 13, color: "#60a5fa" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-foreground/90">Payment Method</div>
                  <div className="text-[10.5px] text-muted-foreground/60 mt-0.5">No cards saved</div>
                </div>
                <ActionBtn onClick={() => showToast("Add card — coming soon!")}>
                  <Plus style={{ width: 10, height: 10 }} />
                  Add Card
                </ActionBtn>
              </div>
            </section>
          )}

          {(!sq || "integrations github api webhook".includes(sq)) && (
            <section className="mt-4">
              <SectionTitle>Integrations</SectionTitle>

              {(!sq || "github".includes(sq)) && (
                <Row icon={Github} iconColor="#86efac" label="GitHub" sub={githubConnected ? "Connected" : "Not connected"}>
                  <ActionBtn variant={githubConnected ? "default" : "primary"} onClick={() => { setGithubConnected((v) => !v); showToast(githubConnected ? "Disconnected" : "GitHub connected!"); }}>
                    {githubConnected ? "Disconnect" : (<><Plus style={{ width: 10, height: 10 }} />Connect</>)}
                  </ActionBtn>
                </Row>
              )}

              {(!sq || "api key".includes(sq)) && (
                <Row icon={Key} iconColor="#facc15" label="API Key" sub="External API access">
                  <input value={apiKey} onChange={(e) => { setApiKey(e.target.value); showToast("Saved"); }} placeholder="sk-..." type="password" className="text-[11px] px-2.5 py-1.5 rounded-lg focus:outline-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(203,213,225,0.85)", width: 140 }} />
                </Row>
              )}

              {(!sq || "webhook".includes(sq)) && (
                <Row icon={Webhook} iconColor="#818cf8" label="Webhook URL" sub="Event delivery endpoint">
                  <input value={webhookUrl} onChange={(e) => { setWebhookUrl(e.target.value); showToast("Saved"); }} placeholder="https://…" className="text-[11px] px-2.5 py-1.5 rounded-lg focus:outline-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(203,213,225,0.85)", width: 140 }} />
                </Row>
              )}
            </section>
          )}

          {(!sq || "security 2fa session token".includes(sq)) && (
            <section className="mt-4">
              <SectionTitle>Security</SectionTitle>
              {(!sq || "2fa two factor".includes(sq)) && (
                <Row icon={Smartphone} iconColor="#f472b6" label="Two-Factor Auth (2FA)" sub="Extra login security">
                  <Toggle value={twoFA} onChange={wrap(setTwoFA)} />
                </Row>
              )}
              {(!sq || "session".includes(sq)) && (
                <Row icon={Shield} iconColor="#fb923c" label="Active Sessions" sub="View and revoke access">
                  <ActionBtn onClick={() => showToast("Opening sessions…")}>
                    <Shield style={{ width: 10, height: 10 }} />
                    Manage
                  </ActionBtn>
                </Row>
              )}
              {(!sq || "token api".includes(sq)) && (
                <Row icon={Key} iconColor="#a78bfa" label="API Token" sub="Programmatic access">
                  <ActionBtn onClick={() => showToast("Token generated!")}>
                    <RefreshCw style={{ width: 10, height: 10 }} />
                    Generate
                  </ActionBtn>
                </Row>
              )}
            </section>
          )}

          {(!sq || "deployment deploy environment publish".includes(sq)) && (
            <section className="mt-4">
              <SectionTitle>Deployment</SectionTitle>
              {(!sq || "auto deploy".includes(sq)) && (
                <Row icon={Rocket} iconColor="#60a5fa" label="Auto Deploy" sub="Deploy on every push">
                  <Toggle value={autoDeploy} onChange={wrap(setAutoDeploy)} />
                </Row>
              )}
              {(!sq || "environment".includes(sq)) && (
                <Row icon={Terminal} iconColor="#4ade80" label="Environment" sub="Target deployment env">
                  <Select value={environment} onChange={wrap(setEnvironment)} options={[
                    { label: "Production", value: "production" },
                    { label: "Staging", value: "staging" },
                    { label: "Development", value: "development" },
                  ]} />
                </Row>
              )}
              {(!sq || "publish".includes(sq)) && (
                <Row icon={Rocket} iconColor="#a78bfa" label="Publish App" sub="Deploy current version">
                  <ActionBtn variant="primary" onClick={() => showToast("Deploying…")}>
                    <Rocket style={{ width: 10, height: 10 }} />
                    Publish 🚀
                  </ActionBtn>
                </Row>
              )}
            </section>
          )}

          {(!sq || "account logout log out sign out delete".includes(sq)) && (
            <section className="mt-4 mb-2">
              <SectionTitle>Account</SectionTitle>

              {(!sq || "logout log out sign out".includes(sq)) && (
                <Row icon={LogOut} iconColor="#60a5fa" label="Log Out" sub="Sign out of your account">
                  <ActionBtn onClick={() => showToast("Logging out…")}>
                    <LogOut style={{ width: 10, height: 10 }} />
                    Log Out
                  </ActionBtn>
                </Row>
              )}

              {(!sq || "delete account".includes(sq)) && !showDeleteConfirm && (
                <Row icon={UserX} iconColor="#f87171" label="Delete Account" sub="Permanently remove your account" danger>
                  <ActionBtn variant="danger" onClick={() => { setShowDeleteConfirm(true); setDeleteInput(""); }}>
                    <UserX style={{ width: 10, height: 10 }} />
                    Delete
                  </ActionBtn>
                </Row>
              )}

              {showDeleteConfirm && (!sq || "delete account".includes(sq)) && (
                <div className="mx-0 mt-1 mb-2 p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.22)" }} data-testid="delete-account-confirm">
                  <div className="flex items-start gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <AlertTriangle style={{ width: 13, height: 13, color: "#f87171" }} />
                    </div>
                    <div>
                      <p className="text-[12.5px] font-semibold text-red-400 mb-1">Delete your account?</p>
                      <p className="text-[11px] leading-relaxed" style={{ color: "rgba(148,163,184,0.6)" }}>
                        This will permanently delete all your projects, data, and settings. This action <strong className="text-red-400/80">cannot</strong> be undone.
                      </p>
                    </div>
                  </div>

                  <p className="text-[10.5px] text-muted-foreground/50 mb-1.5">
                    Type <span className="font-mono text-red-400/80 font-semibold">DELETE</span> to confirm
                  </p>
                  <input
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="Type DELETE…"
                    autoFocus
                    className="w-full text-[12px] px-3 py-2 rounded-lg mb-3 focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: deleteInput === "DELETE" ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.08)", color: "rgba(226,232,240,0.9)" }}
                    data-testid="input-delete-confirm"
                  />

                  <div className="flex gap-2">
                    <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }} className="flex-1 py-2 rounded-lg text-[11px] font-medium transition-colors hover:bg-white/5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(148,163,184,0.7)" }}>
                      Cancel
                    </button>
                    <button
                      disabled={deleteInput !== "DELETE"}
                      onClick={() => { showToast("Account deleted"); setShowDeleteConfirm(false); }}
                      className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all"
                      style={{ background: deleteInput === "DELETE" ? "rgba(239,68,68,0.85)" : "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: deleteInput === "DELETE" ? "#fff" : "rgba(248,113,113,0.35)", cursor: deleteInput !== "DELETE" ? "not-allowed" : "pointer", boxShadow: deleteInput === "DELETE" ? "0 0 12px rgba(239,68,68,0.35)" : "none" }}
                      data-testid="button-confirm-delete"
                    >
                      <UserX style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />
                      Confirm Delete
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {sq && !["general","appearance","ai","billing","integrations","security","deployment","account","save","language","notification","theme","font","compact","agent","thinking","action","response","plan","upgrade","payment","invoice","email","renew","card","github","api","webhook","2fa","session","token","deploy","environment","publish","logout","delete","sign"].some((k) => k.includes(sq)) && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Search style={{ width: 28, height: 28, color: "rgba(148,163,184,0.2)" }} />
              <p className="text-[12px] text-muted-foreground/40">No settings match "{search}"</p>
            </div>
          )}

        </div>
      </div>

      {toast && <Toast msg={toast} />}
    </>
  );
}
