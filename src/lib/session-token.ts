import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "./types";

export type SessionPayload = {
  user: User;
  expiresAt: number;
};

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function signSessionToken(payload: SessionPayload, secret: string): string {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export function verifySessionToken(token: string, secret: string, now = Date.now()): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body, secret);
  const expectedBytes = Buffer.from(expected);
  const signatureBytes = Buffer.from(signature);

  if (expectedBytes.length !== signatureBytes.length || !timingSafeEqual(expectedBytes, signatureBytes)) {
    return null;
  }

  const payload = JSON.parse(fromBase64url(body)) as SessionPayload;
  if (!payload.expiresAt || payload.expiresAt < now) {
    return null;
  }

  return payload;
}
