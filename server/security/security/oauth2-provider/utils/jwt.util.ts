import { createHmac, randomBytes } from "crypto";

const JWT_SECRET = process.env["JWT_SECRET"] ?? randomBytes(64).toString("hex");
const ALGORITHM = "HS256";

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export interface JwtPayload {
  readonly sub: string;
  readonly client_id: string;
  readonly scope: string;
  readonly iat: number;
  readonly exp: number;
  readonly jti: string;
  readonly [key: string]: unknown;
}

export function signJwt(payload: Omit<JwtPayload, "iat" | "jti"> & { iat?: number; jti?: string }): string {
  const header = base64UrlEncode(JSON.stringify({ alg: ALGORITHM, typ: "JWT" }));

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: payload.iat ?? now,
    jti: payload.jti ?? randomBytes(16).toString("hex"),
  } as JwtPayload;

  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${header}.${body}`;
  const signature = createHmac("sha256", JWT_SECRET).update(signingInput).digest("base64url");

  return `${signingInput}.${signature}`;
}

export function verifyJwt(token: string): Readonly<JwtPayload> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts as [string, string, string];
    const signingInput = `${header}.${body}`;
    const expectedSig = createHmac("sha256", JWT_SECRET).update(signingInput).digest("base64url");

    if (expectedSig !== signature) return null;

    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) return null;

    return Object.freeze(payload);
  } catch {
    return null;
  }
}
