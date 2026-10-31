import { normalizePhone } from "./phone";
import type { LeadSource, ParsedWhatsappMessage, ParsedWhatsappReferral } from "./types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readBody(message: Record<string, unknown>): string {
  const text = message.text as { body?: unknown } | undefined;
  const interactive = message.interactive as
    | { button_reply?: { title?: unknown }; list_reply?: { title?: unknown } }
    | undefined;

  return (
    asString(text?.body) ||
    asString(message.body) ||
    asString(interactive?.button_reply?.title) ||
    asString(interactive?.list_reply?.title) ||
    ""
  );
}

function parseSource(value: unknown, hasReferral: boolean): LeadSource {
  if (value === "meta_ads" || value === "whatsapp" || value === "walk_in" || value === "other") {
    return value;
  }

  // Meta attaches a `referral` object to the first inbound message of a Click-to-WhatsApp
  // ad conversation — its presence is the signal that this lead came from a Meta ad.
  return hasReferral ? "meta_ads" : "whatsapp";
}

/** Meta's `referral` object, present on the first inbound message of a Click-to-WhatsApp
 * ad conversation. Only `source_id` (the ad id) and `source_url`/`headline` are ever sent —
 * campaign name isn't part of this payload and would need a separate Marketing API lookup. */
function readReferral(value: unknown): ParsedWhatsappReferral | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const referral = value as Record<string, unknown>;
  const sourceId = asString(referral.source_id);
  const sourceType = asString(referral.source_type);
  const sourceUrl = asString(referral.source_url);
  const headline = asString(referral.headline);

  if (!sourceId && !sourceType && !sourceUrl && !headline) {
    return null;
  }

  return { sourceType, sourceId, sourceUrl, headline };
}

export function parseWhatsappWebhook(payload: unknown): ParsedWhatsappMessage[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("Webhook payload must be an object");
  }

  const simplePayload = payload as Record<string, unknown>;
  const simpleTo = asString(simplePayload.to_number) || asString(simplePayload.to);
  const simpleFrom = asString(simplePayload.from_number) || asString(simplePayload.from);

  if (simpleTo && simpleFrom) {
    const simpleReferral = readReferral(simplePayload.referral);

    return [
      {
        toNumber: normalizePhone(simpleTo),
        fromNumber: normalizePhone(simpleFrom),
        body: asString(simplePayload.body) || asString(simplePayload.message) || "",
        customerName: asString(simplePayload.name),
        messageId: asString(simplePayload.message_id) || asString(simplePayload.id),
        source: parseSource(simplePayload.source, Boolean(simpleReferral)),
        referral: simpleReferral,
        raw: payload
      }
    ];
  }

  const entries = Array.isArray(simplePayload.entry) ? simplePayload.entry : [];
  const parsed: ParsedWhatsappMessage[] = [];

  for (const entry of entries) {
    const changes = Array.isArray((entry as { changes?: unknown }).changes)
      ? ((entry as { changes: unknown[] }).changes)
      : [];

    for (const change of changes) {
      const value = (change as { value?: unknown }).value as Record<string, unknown> | undefined;
      if (!value) {
        continue;
      }

      const metadata = value.metadata as Record<string, unknown> | undefined;
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const toNumber = asString(metadata?.display_phone_number) || asString(metadata?.phone_number_id);

      for (const message of messages) {
        const messageRecord = message as Record<string, unknown>;
        const fromNumber = asString(messageRecord.from);

        if (!toNumber || !fromNumber) {
          continue;
        }

        const contact = contacts.find((item) => {
          const contactRecord = item as { wa_id?: unknown };
          return normalizePhone(asString(contactRecord.wa_id) || "") === normalizePhone(fromNumber);
        }) as { profile?: { name?: unknown } } | undefined;

        const referral = readReferral(messageRecord.referral);

        parsed.push({
          toNumber: normalizePhone(toNumber),
          fromNumber: normalizePhone(fromNumber),
          body: readBody(messageRecord),
          customerName: asString(contact?.profile?.name),
          messageId: asString(messageRecord.id),
          source: parseSource(undefined, Boolean(referral)),
          referral,
          raw: payload
        });
      }
    }
  }

  if (!parsed.length) {
    throw new Error("No supported WhatsApp messages found in payload");
  }

  return parsed;
}

