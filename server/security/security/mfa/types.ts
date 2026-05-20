export type MFAMethod = "TOTP" | "OTP" | "BACKUP";

export type MFAStatus = "IDLE" | "ENROLLING" | "VERIFYING" | "ENABLED" | "FAILED";

export type OTPChannel = "SMS" | "EMAIL";

export interface TOTPSecret {
  readonly userId: string;
  readonly secret: string;
  readonly algorithm: "SHA1";
  readonly digits: 6;
  readonly period: 30;
  readonly issuer: string;
  readonly accountName: string;
  readonly qrCodeUri: string;
  readonly createdAt: number;
}

export interface OTPPayload {
  readonly userId: string;
  readonly code: string;
  readonly channel: OTPChannel;
  readonly destination: string;
  readonly expiresAt: number;
  readonly used: boolean;
}

export interface BackupCode {
  readonly codeHash: string;
  readonly used: boolean;
  readonly usedAt?: number;
}

export interface MFAUserRecord {
  readonly userId: string;
  readonly mfaEnabled: boolean;
  readonly enrolledMethod?: MFAMethod;
  readonly totpSecretHash?: string;
  readonly backupCodes: readonly BackupCode[];
  readonly lastVerifiedAt?: number;
  readonly attempts: number;
}

export interface MFARequest {
  readonly userId: string;
  readonly method: MFAMethod;
  readonly code?: string;
  readonly channel?: OTPChannel;
  readonly destination?: string;
  readonly issuer?: string;
}

export interface MFAResponse {
  readonly success: boolean;
  readonly method: MFAMethod;
  readonly verified: boolean;
  readonly logs: readonly string[];
  readonly error?: string;
  readonly qrCodeUri?: string;
  readonly backupCodes?: readonly string[];
}

export interface VerificationResult {
  readonly verified: boolean;
  readonly method: MFAMethod;
  readonly reason?: string;
}

export interface MFAState {
  readonly users: readonly MFAUserRecord[];
  readonly pendingTOTP: readonly TOTPSecret[];
  readonly pendingOTPs: readonly OTPPayload[];
  readonly status: MFAStatus;
  readonly logs: readonly string[];
  readonly errors: readonly string[];
}

export interface StatePatch {
  readonly users?: readonly MFAUserRecord[];
  readonly pendingTOTP?: readonly TOTPSecret[];
  readonly pendingOTPs?: readonly OTPPayload[];
  readonly status?: MFAStatus;
  readonly appendLog?: string;
  readonly appendError?: string;
}

export interface AgentResult {
  readonly nextState: Readonly<MFAState>;
  readonly output: Readonly<MFAResponse>;
}
