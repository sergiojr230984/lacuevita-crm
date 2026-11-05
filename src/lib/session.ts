import { cookies } from "next/headers";
import { shouldUseDemoStore } from "./demo-store";
import { signSessionToken, verifySessionToken } from "./session-token";
import type { User } from "./types";

const COOKIE_NAME = "lacuevita_session";
const DEMO_ONLY_SECRET = "local-demo-secret-change-before-production";

function secret() {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET;
  }

  if (shouldUseDemoStore()) {
    return DEMO_ONLY_SECRET;
  }

  throw new Error("AUTH_SECRET environment variable is required when DATABASE_URL is configured");
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return verifySessionToken(token, secret())?.user || null;
  } catch {
    return null;
  }
}

export async function setSession(user: User) {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12;
  cookieStore.set(COOKIE_NAME, signSessionToken({ user, expiresAt }, secret()), {
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
