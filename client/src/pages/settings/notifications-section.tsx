import { Mail, Zap } from "lucide-react";
import { SectionCard, ToggleField } from "./settings-primitives";
import type { NotificationSettings, SectionId } from "./settings-types";

export function NotificationsSection({ settings, updateNotifications, onPreview, mobileSection, activeSection, onReset }: {
  settings: NotificationSettings;
  updateNotifications: (patch: Partial<NotificationSettings>) => void;
  onPreview: () => void;
  mobileSection?: SectionId | null;
  activeSection?: SectionId;
  onReset: (section: SectionId) => void;
}) {
  return <SectionCard id="notifications" title="Notifications" description="Keep the signals you need and mute the rest." icon={Mail} onReset={onReset} mobileSection={mobileSection} activeSection={activeSection}>
    <div className="space-y-3">
      <ToggleField label="Browser notifications" description="Allow this workspace to request browser-level alerts." value={settings.browser} onChange={(value) => updateNotifications({ browser: value })} />
      <ToggleField label="Build notifications" description="Notify when a local build starts, passes, or fails." value={settings.build} onChange={(value) => updateNotifications({ build: value })} />
      <ToggleField label="Deploy notifications" description="Notify when a deployment changes state." value={settings.deploy} onChange={(value) => updateNotifications({ deploy: value })} />
      <ToggleField label="AI notifications" description="Notify when a background agent run needs your attention." value={settings.ai} onChange={(value) => updateNotifications({ ai: value })} />
      <ToggleField label="Error notifications" description="Always surface errors even when other notifications are muted." value={settings.errors} onChange={(value) => updateNotifications({ errors: value })} />
    </div>
    <div className="settings-row settings-info-row flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/10 p-4"><div><p className="text-sm font-medium text-foreground">Notification preview</p><p className="mt-1 text-xs text-muted-foreground">Check how this browser handles permission prompts.</p></div><button type="button" onClick={onPreview} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-foreground hover:bg-white/5"><Zap className="h-3.5 w-3.5 text-primary" />Send preview</button></div>
  </SectionCard>;
}