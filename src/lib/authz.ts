import type { Lead, User } from "./types";

export function canAccessLead(user: User, lead: Lead): boolean {
  if (user.role === "owner") return true;
  if (user.role === "salesperson") return lead.assigned_user_id === user.id;
  return !user.store_id || lead.store_id === user.store_id;
}
