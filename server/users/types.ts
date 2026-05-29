export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  website?: string;
  plan: "free" | "hacker" | "pro" | "teams";
  storageUsedBytes: number;
  storageQuotaBytes: number;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface UserPreferences {
  userId: string;
  theme: "dark" | "light" | "system";
  editorFontSize: number;
  editorFontFamily: string;
  editorTabSize: number;
  editorWordWrap: boolean;
  terminalFontSize: number;
  keybindings: "default" | "vim" | "emacs";
  language: string;
  timezone: string;
  emailNotifications: boolean;
}

export interface TeamMember {
  userId: string;
  teamId: string;
  role: "owner" | "admin" | "editor" | "viewer";
  joinedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  avatarUrl?: string;
  memberCount: number;
  createdAt: Date;
}

export interface UpdateProfilePayload {
  displayName?: string;
  bio?: string;
  website?: string;
  avatarUrl?: string;
}
