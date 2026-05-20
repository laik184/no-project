export interface OTPAuthURIParams {
  readonly secret: string;
  readonly issuer: string;
  readonly accountName: string;
  readonly algorithm?: "SHA1";
  readonly digits?: 6;
  readonly period?: 30;
}

export function buildOTPAuthURI(params: OTPAuthURIParams): string {
  const {
    secret,
    issuer,
    accountName,
    algorithm = "SHA1",
    digits = 6,
    period = 30,
  } = params;

  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm,
    digits: String(digits),
    period: String(period),
  }).toString();

  return `otpauth://totp/${label}?${query}`;
}

export function buildQRCodeDataURI(otpauthUri: string): string {
  const encoded = encodeURIComponent(otpauthUri);
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`;
}
