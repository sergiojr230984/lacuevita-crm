import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { processWhatsappWebhook } from "@/lib/crm-service";
import { getCrmRepository } from "@/lib/repository-provider";
import { handleRouteError } from "@/lib/route-helpers";

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
    const payload = await request.json();
    const result = await processWhatsappWebhook(payload, getCrmRepository());
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
