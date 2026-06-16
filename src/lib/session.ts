import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "./types";

const COOKIE_NAME = "lacuevita_session";

type SessionPayload = {
  user: User;
  expiresAt: number;
};

function secret() {
  return process.env.AUTH_SECRET || "local-demo-secret-change-before-production";
}

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function makeToken(payload: SessionPayload) {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function readToken(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const expectedBytes = Buffer.from(expected);
  const signatureBytes = Buffer.from(signature);

  if (expectedBytes.length !== signatureBytes.length || !timingSafeEqual(expectedBytes, signatureBytes)) {
    return null;
  }

  const payload = JSON.parse(fromBase64url(body)) as SessionPayload;
  if (!payload.expiresAt || payload.expiresAt < Date.now()) {
    return null;
  }

  return payload;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return readToken(token)?.user || null;
  } catch {
    return null;
  }
}

export async function setSession(user: User) {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12;
  cookieStore.set(COOKIE_NAME, makeToken({ user, expiresAt }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
