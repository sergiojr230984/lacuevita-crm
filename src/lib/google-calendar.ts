import { createSign } from "node:crypto";
import type { Lead, User } from "./types";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const DEFAULT_TIME_ZONE = "America/New_York";

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

type CalendarEventInput = {
  title: string;
  description?: string | null;
  scheduledStart: Date;
  scheduledEnd: Date;
  lead: Lead;
  user: User;
};

type CalendarEventResult = {
  id: string | null;
  htmlLink: string | null;
};

let cachedToken: CachedToken | null = null;

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function getPrivateKey() {
  const base64Key = process.env.GOOGLE_PRIVATE_KEY_BASE64?.trim();
  if (base64Key) {
    return Buffer.from(base64Key, "base64").toString("utf8");
  }

  const key = process.env.GOOGLE_PRIVATE_KEY?.trim();
  if (!key) {
    return null;
  }

  return key.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

function getCalendarConfig() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim();
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const privateKey = getPrivateKey();

  return {
    calendarId,
    clientEmail,
    privateKey,
    timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE?.trim() || DEFAULT_TIME_ZONE
  };
}

export function isGoogleCalendarConfigured() {
  const { calendarId, clientEmail, privateKey } = getCalendarConfig();
  return Boolean(calendarId && clientEmail && privateKey);
}

function requireCalendarConfig() {
  const config = getCalendarConfig();
  const missing = [
    !config.calendarId ? "GOOGLE_CALENDAR_ID" : null,
    !config.clientEmail ? "GOOGLE_CLIENT_EMAIL" : null,
    !config.privateKey ? "GOOGLE_PRIVATE_KEY or GOOGLE_PRIVATE_KEY_BASE64" : null
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Google Calendar is not configured. Missing ${missing.join(", ")} in Railway variables.`);
  }

  return config as {
    calendarId: string;
    clientEmail: string;
    privateKey: string;
    timeZone: string;
  };
}

async function getAccessToken() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const { clientEmail, privateKey } = requireCalendarConfig();
  const unsignedToken = [
    base64UrlJson({ alg: "RS256", typ: "JWT" }),
    base64UrlJson({
      iss: clientEmail,
      scope: GOOGLE_CALENDAR_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600
    })
  ].join(".");

  const signature = createSign("RSA-SHA256").update(unsignedToken).sign(privateKey).toString("base64url");
  const assertion = `${unsignedToken}.${signature}`;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Unable to authorize Google Calendar");
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max((payload.expires_in || 3600) - 60, 60) * 1000
  };

  return cachedToken.accessToken;
}

function buildDescription(input: CalendarEventInput) {
  return [
    input.description?.trim(),
    `Customer: ${input.lead.name || "Unknown Customer"}`,
    `Phone: ${input.lead.whatsapp_number}`,
    `Store: ${input.lead.store_id}`,
    `Scheduled by: ${input.user.name}`,
    `CRM lead ID: ${input.lead.id}`
  ]
    .filter(Boolean)
    .join("\n");
}

export async function createGoogleCalendarEvent(input: CalendarEventInput): Promise<CalendarEventResult> {
  const config = requireCalendarConfig();
  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        summary: input.title,
        description: buildDescription(input),
        start: {
          dateTime: input.scheduledStart.toISOString(),
          timeZone: config.timeZone
        },
        end: {
          dateTime: input.scheduledEnd.toISOString(),
          timeZone: config.timeZone
        }
      })
    }
  );
  const payload = (await response.json()) as {
    id?: string;
    htmlLink?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || "Unable to create Google Calendar event");
  }

  return {
    id: payload.id || null,
    htmlLink: payload.htmlLink || null
  };
}
