import type { LeadStatus, Store, StoreId } from "./types";

export const STORE_WHATSAPP_NUMBERS: Record<StoreId, string> = {
  hialeah: "+17867489064",
  sw: "+13058019649"
};

export const STORE_WHATSAPP_DESTINATION_NUMBERS: Record<StoreId, string[]> = {
  hialeah: [STORE_WHATSAPP_NUMBERS.hialeah, "+13058039820"],
  sw: [STORE_WHATSAPP_NUMBERS.sw]
};

export const STORES: Store[] = [
  {
    id: "hialeah",
    name: "La Cuevita Furniture Hialeah",
    whatsapp_number: STORE_WHATSAPP_NUMBERS.hialeah
  },
  {
    id: "sw",
    name: "La Cuevita Furniture SW",
    whatsapp_number: STORE_WHATSAPP_NUMBERS.sw
  }
];

export const ACTIVE_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Quote Sent",
  "Follow-Up",
  "Negotiation"
];

export const CLOSED_STATUSES: LeadStatus[] = ["Closed Won", "Lost"];
export const HIGH_FOLLOW_UP_THRESHOLD = 5;
export const STALE_ACTIVITY_HOURS = 48;
export const DEFAULT_FOLLOW_UP_HOURS = 48;

export const STATUS_ACCENT: Record<LeadStatus, string> = {
  New: "border-l-fern",
  Contacted: "border-l-honey",
  "Quote Sent": "border-l-coral",
  "Follow-Up": "border-l-blue-500",
  Negotiation: "border-l-violet-500",
  "Closed Won": "border-l-emerald-600",
  Lost: "border-l-zinc-400"
};

// Display-only Spanish labels for the salesperson-facing screens. The underlying
// LeadStatus enum values stay in English so no stage migration is needed.
export const LEAD_STATUS_LABELS_ES: Record<LeadStatus, string> = {
  New: "Nuevo Cliente",
  Contacted: "Contactado",
  "Quote Sent": "Cotización Enviada",
  "Follow-Up": "Seguimiento Pendiente",
  Negotiation: "En Negociación",
  "Closed Won": "Venta Cerrada",
  Lost: "Venta Perdida"
};

export const LOST_REASONS = [
  "Precio",
  "Cliente no responde",
  "Compró en otra tienda",
  "Financiamiento rechazado",
  "Producto no disponible",
  "Otro"
] as const;

export type LostReason = (typeof LOST_REASONS)[number];
