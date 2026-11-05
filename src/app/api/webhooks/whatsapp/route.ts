import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { processWhatsappWebhook } from "@/lib/crm-service";
import { shouldUseDemoStore } from "@/lib/demo-store";
import { getCrmRepository } from "@/lib/repository-provider";
import { handleRouteError } from "@/lib/route-helpers";
import { isValidWhatsappSignature } from "@/lib/webhook-signature";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge || "", { status: 200 });
  }

  return jsonError("Webhook verification failed", 403);
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    if (!shouldUseDemoStore()) {
      const appSecret = process.env.WHATSAPP_APP_SECRET;
      if (!appSecret) {
        return jsonError("Webhook is not configured (missing WHATSAPP_APP_SECRET)", 503);
      }

      const signatureHeader = request.headers.get("x-hub-signature-256");
      if (!isValidWhatsappSignature(rawBody, signatureHeader, appSecret)) {
        return jsonError("Invalid webhook signature", 401);
      }
    }

    const payload = JSON.parse(rawBody);
    const result = await processWhatsappWebhook(payload, getCrmRepository());
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
