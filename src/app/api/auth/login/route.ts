import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getRepository } from "@/lib/repository-provider";
import { handleRouteError } from "@/lib/route-helpers";
import { setSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return jsonError("Email and password are required", 422);
    }

    const user = await getRepository().authenticateUser(email, password);

    if (!user) {
      return jsonError("Invalid login", 401);
    }

    await setSession(user);
    return jsonOk({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
