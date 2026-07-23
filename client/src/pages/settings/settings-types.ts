import { Bot, Code2, KeyRound, Mail, Palette, Shield, Sparkles, User, type LucideIcon } from "lucide-react";

export type SectionId =
  | "profile"
  | "models"
  | "keys"
  | "preferences"
  | "editor"
  | "notifications"
  | "security"
  | "appearance";

export type ThemeMode = "dark" | "system" | "light";
export type KeyProvider = "openai" | "gemini" | "claude" | "deepseek" | "openrouter" | "grok" | "ollama";
export type SaveState = "saved" | "dirty" | "saving" | "success" | "error";

export interface ProfileSettings {
  displayName: string;
  username: string;
  email: string;
  avatarUrl: string;
  language: string;
  timezone: string;
}

export interface ModelSettings {
  provider: KeyProvider;
  defaultAI: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  streaming: boolean;
}

export interface ApiKeyRecord {
  value: string;
  label: string;
  status: "untested" | "connected" | "error";
  message?: string;
}

export interface PreferenceSettings {
  customInstructions: string;
  systemPrompt: string;
  codingStyle: string;
  responseStyle: string;
  preferredLanguage: string;
  autoContinue: boolean;
  reasoningLevel: string;
  planningMode: boolean;
}

export interface EditorSettings {
  theme: string;
  fontSize: number;
  fontFamily: string;
  wordWrap: boolean;
  autoSave: boolean;
  formatOnSave: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  cursorStyle: string;
}

export interface NotificationSettings {
  browser: boolean;
  build: boolean;
  deploy: boolean;
  ai: boolean;
  errors: boolean;
}

export interface SecuritySettings {
  apiKeyVisibility: "masked" | "reveal";
}

export interface AppearanceSettings {
  theme: ThemeMode;
  accentColor: string;
  compactMode: boolean;
  sidebar: "expanded" | "collapsed";
  animations: boolean;
  reducedMotion: boolean;
}

export interface SettingsState {
  profile: ProfileSettings;
  models: ModelSettings;
  apiKeys: Partial<Record<KeyProvider, ApiKeyRecord>>;
  preferences: PreferenceSettings;
  editor: EditorSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  appearance: AppearanceSettings;
}

export interface ProviderDetails {
  id: KeyProvider;
  name: string;
  description: string;
  placeholder: string;
  color: string;
  model: string;
}

export const STORAGE_KEY = "nura-x-settings-v2";

export const defaultSettings: SettingsState = {
  profile: {
    displayName: "",
    username: "",
    email: "",
    avatarUrl: "",
    language: "en",
    timezone: "UTC",
  },
  models: {
    provider: "openrouter",
    defaultAI: "NURA Agent",
    defaultModel: "openrouter/auto",
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  },
  apiKeys: {},
  preferences: {
    customInstructions: "",
    systemPrompt: "",
    codingStyle: "pragmatic",
    responseStyle: "balanced",
    preferredLanguage: "typescript",
    autoContinue: true,
    reasoningLevel: "standard",
    planningMode: false,
  },
  editor: {
    theme: "nura-dark",
    fontSize: 14,
    fontFamily: "Inter",
    wordWrap: true,
    autoSave: true,
    formatOnSave: true,
    minimap: false,
    lineNumbers: true,
    cursorStyle: "line",
  },
  notifications: {
    browser: true,
    build: true,
    deploy: true,
    ai: true,
    errors: true,
  },
  security: {
    apiKeyVisibility: "masked",
  },
  appearance: {
    theme: "dark",
    accentColor: "#7c8dff",
    compactMode: false,
    sidebar: "collapsed",
    animations: true,
    reducedMotion: false,
  },
};

export const providerDetails: ProviderDetails[] = [
  { id: "openai", name: "OpenAI", description: "GPT models and embeddings", placeholder: "sk-proj-…", color: "#74aa9c", model: "gpt-4.1" },
  { id: "gemini", name: "Gemini", description: "Google's multimodal models", placeholder: "AIza…", color: "#7c9cff", model: "gemini-2.5-pro" },
  { id: "claude", name: "Claude", description: "Anthropic reasoning models", placeholder: "sk-ant-…", color: "#d4a574", model: "claude-sonnet-4" },
  { id: "deepseek", name: "DeepSeek", description: "Open reasoning and coding models", placeholder: "sk-…", color: "#4f9cf9", model: "deepseek-chat" },
  { id: "openrouter", name: "OpenRouter", description: "One key for many providers", placeholder: "sk-or-v1-…", color: "#a78bfa", model: "openrouter/auto" },
  { id: "grok", name: "Grok", description: "xAI models", placeholder: "xai-…", color: "#f4f4f5", model: "grok-3" },
  { id: "ollama", name: "Ollama", description: "Local models on your machine", placeholder: "http://localhost:11434", color: "#f59e0b", model: "llama3.3" },
];

export const navigation: Array<{ id: SectionId; label: string; description: string; icon: LucideIcon; keywords: string }> = [
  { id: "profile", label: "Profile", description: "Personal details and locale", icon: User, keywords: "profile name username email avatar language timezone" },
  { id: "models", label: "AI Models", description: "Providers and generation defaults", icon: Bot, keywords: "models provider default model temperature tokens streaming" },
  { id: "keys", label: "API Keys", description: "Bring your own model access", icon: KeyRound, keywords: "api keys openai gemini claude deepseek openrouter grok ollama connection" },
  { id: "preferences", label: "AI Preferences", description: "Shape how the agent works", icon: Sparkles, keywords: "preferences instructions prompt coding response language continue reasoning planning" },
  { id: "editor", label: "Editor", description: "Code editor behavior", icon: Code2, keywords: "editor theme font size family wrap save format minimap lines cursor" },
  { id: "notifications", label: "Notifications", description: "Choose what reaches you", icon: Mail, keywords: "notifications browser build deploy ai error" },
  { id: "security", label: "Security", description: "Sessions, devices, and privacy", icon: Shield, keywords: "security sessions devices api key visibility export delete account" },
  { id: "appearance", label: "Appearance", description: "Theme and workspace density", icon: Palette, keywords: "appearance theme accent compact sidebar animations motion" },
];

export const optionSets = {
  languages: [
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "ja", label: "Japanese" },
  ],
  timezones: [
    { value: "UTC", label: "UTC (Coordinated Universal Time)" },
    { value: "America/Los_Angeles", label: "Pacific Time (UTC−08:00)" },
    { value: "America/New_York", label: "Eastern Time (UTC−05:00)" },
    { value: "Europe/London", label: "London (UTC+00:00)" },
    { value: "Europe/Berlin", label: "Berlin (UTC+01:00)" },
    { value: "Asia/Kolkata", label: "India (UTC+05:30)" },
    { value: "Asia/Tokyo", label: "Tokyo (UTC+09:00)" },
  ],
};

export function mergeSettings(value: unknown): SettingsState {
  if (!value || typeof value !== "object") return defaultSettings;
  const saved = value as Partial<SettingsState>;
  return {
    ...defaultSettings,
    ...saved,
    profile: { ...defaultSettings.profile, ...(saved.profile ?? {}) },
    models: { ...defaultSettings.models, ...(saved.models ?? {}) },
    apiKeys: saved.apiKeys ?? {},
    preferences: { ...defaultSettings.preferences, ...(saved.preferences ?? {}) },
    editor: { ...defaultSettings.editor, ...(saved.editor ?? {}) },
    notifications: { ...defaultSettings.notifications, ...(saved.notifications ?? {}) },
    security: { ...defaultSettings.security, ...(saved.security ?? {}) },
    appearance: { ...defaultSettings.appearance, ...(saved.appearance ?? {}) },
  };
}