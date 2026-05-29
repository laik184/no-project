export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  plan: "free" | "hacker" | "pro" | "teams";
  createdAt: Date;
}

export interface Session {
  sessionId: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  plan: AuthUser["plan"];
  iat?: number;
  exp?: number;
}

export interface OAuthProfile {
  provider: "github" | "google";
  providerId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetPayload {
  token: string;
  newPassword: string;
}
