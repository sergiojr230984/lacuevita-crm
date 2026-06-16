import { STORE_WHATSAPP_NUMBERS } from "./constants";
import { normalizePhone } from "./phone";
import type { StoreId } from "./types";

const numberToStore = new Map<string, StoreId>(
  Object.entries(STORE_WHATSAPP_NUMBERS).map(([storeId, phone]) => [
    normalizePhone(phone),
    storeId as StoreId
  ])
);

export function routeStoreFromToNumber(toNumber: string): StoreId {
  const normalized = normalizePhone(toNumber);
  const storeId = numberToStore.get(normalized);

  if (!storeId) {
    throw new Error(`Unknown WhatsApp destination number: ${toNumber}`);
  }

  return storeId;
}

export function isStoreWhatsappNumber(phone: string): boolean {
  return numberToStore.has(normalizePhone(phone));
}

