import type { NextRequest } from "next/server";
import { jsonError } from "./api-response";
import type { StoreId } from "./types";

export const runtime = "nodejs";

export function getSearchParam(request: NextRequest, key: string): string | null {
  const value = request.nextUrl.searchParams.get(key);
  return value && value.trim() ? value.trim() : null;
}

export function parseStoreId(value: string | null): StoreId | null {
  return value === "hialeah" || value === "sw" ? value : null;
}

export function handleRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = message.includes("DATABASE_URL") ? 503 : 400;
  return jsonError(message, status);
}
