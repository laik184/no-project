import { User } from "lucide-react";
import { SectionCard, SelectField, TextField } from "./settings-primitives";
import { optionSets, type ProfileSettings, type SectionId } from "./settings-types";

export function ProfileSection({ settings, updateProfile, profileInitials, errors, mobileSection, activeSection, onReset }: {
  settings: ProfileSettings;
  updateProfile: (patch: Partial<ProfileSettings>) => void;
  profileInitials: string;
  errors: Record<string, string>;
  mobileSection?: SectionId | null;
  activeSection?: SectionId;
  onReset: (section: SectionId) => void;
}) {
  return <SectionCard id="profile" title="Profile" description="Personal details used across your local workspace." icon={User} onReset={onReset} mobileSection={mobileSection} activeSection={activeSection}>
    <div className="settings-row settings-profile-summary flex flex-col gap-5 rounded-xl border border-white/8 bg-black/10 p-4 sm:flex-row sm:items-center">
      <div className="settings-profile-avatar relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/30 bg-primary/15 text-lg font-semibold text-primary">
        <span aria-hidden="true">{profileInitials}</span>
        {settings.avatarUrl && <img src={settings.avatarUrl} alt="Profile avatar" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
      </div>
      <div className="min-w-0"><p className="settings-profile-title text-sm font-medium text-foreground">{settings.displayName || "Add your display name"}</p><p className="settings-profile-description mt-1 text-xs text-muted-foreground">{settings.username ? `@${settings.username}` : "A profile helps identify your workspace locally."}</p></div>
      <button type="button" onClick={() => updateProfile({ avatarUrl: "" })} className="settings-profile-action sm:ml-auto inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"><User className="h-3.5 w-3.5" />Use initials</button>
    </div>
    <div className="grid gap-5 md:grid-cols-2">
      <TextField label="Display name" description="Shown in your workspace." value={settings.displayName} onChange={(value) => updateProfile({ displayName: value })} placeholder="Your name" maxLength={60} error={errors.displayName} />
      <TextField label="Username" description="Optional handle for local profile links." value={settings.username} onChange={(value) => updateProfile({ username: value.toLowerCase().replace(/\s/g, "") })} placeholder="your-handle" maxLength={30} error={errors.username} />
      <TextField label="Email" description="Used for local account display only in this snapshot." value={settings.email} onChange={(value) => updateProfile({ email: value })} placeholder="you@example.com" type="email" error={errors.email} />
      <TextField label="Avatar URL" description="Optional image URL; initials are used when empty." value={settings.avatarUrl} onChange={(value) => updateProfile({ avatarUrl: value })} placeholder="https://…" error={errors.avatarUrl} />
      <SelectField label="Language" value={settings.language} options={optionSets.languages} onChange={(value) => updateProfile({ language: value })} />
      <SelectField label="Timezone" value={settings.timezone} options={optionSets.timezones} onChange={(value) => updateProfile({ timezone: value })} />
    </div>
  </SectionCard>;
}