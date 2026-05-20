export const TOTP_PERIOD_S = 30;
export const TOTP_WINDOW = 1;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;

export function currentTimeStep(period: number = TOTP_PERIOD_S): number {
  return Math.floor(Date.now() / 1000 / period);
}

export function timeStepsInWindow(period: number = TOTP_PERIOD_S, window: number = TOTP_WINDOW): number[] {
  const now = currentTimeStep(period);
  const steps: number[] = [];
  for (let i = -window; i <= window; i++) {
    steps.push(now + i);
  }
  return steps;
}

export function isOTPExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

export function makeOTPExpiry(): number {
  return Date.now() + OTP_TTL_MS;
}
