import { Globe, Bell, Save, Type, Layout, Bot, Brain, Package, Zap, Github, Key, Webhook, Sun, Moon, Monitor } from "lucide-react";
import { Plus } from "lucide-react";
import { Row, Toggle, Select, Slider, SectionTitle, ActionBtn } from "./settings-primitives";

interface SharedSectionProps {
  sq: string;
  wrap: <T>(fn: (v: T) => void, label?: string) => (v: T) => void;
  showToast: (msg: string) => void;
}

interface GeneralSectionProps extends SharedSectionProps {
  autoSave: boolean; setAutoSave: (v: boolean) => void;
  language: string; setLanguage: (v: string) => void;
  notifications: boolean; setNotifications: (v: boolean) => void;
}
export function GeneralSection({ sq, wrap, autoSave, setAutoSave, language, setLanguage, notifications, setNotifications }: GeneralSectionProps) {
  if (sq && !"general auto save language notifications".includes(sq)) return null;
  return (
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
            { label: "English", value: "en" }, { label: "Hindi", value: "hi" },
            { label: "Spanish", value: "es" }, { label: "French", value: "fr" }, { label: "German", value: "de" },
          ]} />
        </Row>
      )}
      {(!sq || "notifications".includes(sq)) && (
        <Row icon={Bell} iconColor="#fbbf24" label="Notifications" sub="Push and email alerts">
          <Toggle value={notifications} onChange={wrap(setNotifications)} />
        </Row>
      )}
    </section>
  );
}

interface AppearanceSectionProps extends SharedSectionProps {
  theme: "light"|"dark"|"system"; setTheme: (v: "light"|"dark"|"system") => void;
  fontSize: number; setFontSize: (v: number) => void;
  compactMode: boolean; setCompactMode: (v: boolean) => void;
}
export function AppearanceSection({ sq, wrap, showToast, theme, setTheme, fontSize, setFontSize, compactMode, setCompactMode }: AppearanceSectionProps) {
  if (sq && !"appearance theme font compact".includes(sq)) return null;
  return (
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
  );
}

interface AISectionProps extends SharedSectionProps {
  enableAgent: boolean; setEnableAgent: (v: boolean) => void;
  showThinking: boolean; setShowThinking: (v: boolean) => void;
  showActions: boolean; setShowActions: (v: boolean) => void;
  responseSpeed: string; setResponseSpeed: (v: string) => void;
}
export function AISection({ sq, wrap, enableAgent, setEnableAgent, showThinking, setShowThinking, showActions, setShowActions, responseSpeed, setResponseSpeed }: AISectionProps) {
  if (sq && !"ai agent thinking actions response".includes(sq)) return null;
  return (
    <section className="mt-4">
      <SectionTitle>AI / Agent</SectionTitle>
      {(!sq || "enable agent".includes(sq)) && <Row icon={Bot} iconColor="#a78bfa" label="Enable Agent" sub="AI-powered assistant"><Toggle value={enableAgent} onChange={wrap(setEnableAgent)} /></Row>}
      {(!sq || "thinking".includes(sq)) && <Row icon={Brain} iconColor="#c084fc" label="Show Thinking 🧠" sub="Display reasoning steps"><Toggle value={showThinking} onChange={wrap(setShowThinking)} /></Row>}
      {(!sq || "actions".includes(sq)) && <Row icon={Package} iconColor="#fb923c" label="Show Actions 📦💻📁" sub="Display tool usage"><Toggle value={showActions} onChange={wrap(setShowActions)} /></Row>}
      {(!sq || "response speed".includes(sq)) && (
        <Row icon={Zap} iconColor="#facc15" label="Response Speed" sub="Balance speed vs quality">
          <Select value={responseSpeed} onChange={wrap(setResponseSpeed)} options={[
            { label: "Fast", value: "fast" }, { label: "Balanced", value: "balanced" }, { label: "Quality", value: "quality" },
          ]} />
        </Row>
      )}
    </section>
  );
}

interface IntegrationsSectionProps extends SharedSectionProps {
  githubConnected: boolean; setGithubConnected: (v: boolean) => void;
  apiKey: string; setApiKey: (v: string) => void;
  webhookUrl: string; setWebhookUrl: (v: string) => void;
}
export function IntegrationsSection({ sq, wrap, showToast, githubConnected, setGithubConnected, apiKey, setApiKey, webhookUrl, setWebhookUrl }: IntegrationsSectionProps) {
  if (sq && !"integrations github api webhook".includes(sq)) return null;
  return (
    <section className="mt-4">
      <SectionTitle>Integrations</SectionTitle>
      {(!sq || "github".includes(sq)) && (
        <Row icon={Github} iconColor="#86efac" label="GitHub" sub={githubConnected ? "Connected" : "Not connected"}>
          <ActionBtn variant={githubConnected ? "default" : "primary"} onClick={() => { setGithubConnected(!githubConnected); showToast(githubConnected ? "Disconnected" : "GitHub connected!"); }}>
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
  );
}
