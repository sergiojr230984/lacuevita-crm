import { ACTIVE_STATUSES } from "./constants";
import { getLeadFlags } from "./followups";
import { LEAD_STATUSES, type DashboardMetrics, type Lead, type StoreId } from "./types";

export function emptyStageCounts(): DashboardMetrics["salesByStage"] {
  return LEAD_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as DashboardMetrics["salesByStage"]);
}

export function buildDashboardMetrics(leads: Lead[], now = new Date()): DashboardMetrics {
  const salesByStage = emptyStageCounts();
  const leadsByStore: Record<StoreId, number> = { hialeah: 0, sw: 0 };
  const salespersonMap = new Map<
    string,
    { user_id: string | null; salesperson: string; total: number; closedWon: number; overdue: number }
  >();

  let closedWon = 0;
  let overdueFollowUps = 0;
  let staleLeads = 0;
  let highFollowUpNoConversion = 0;
  let activeLeads = 0;

  for (const lead of leads) {
    salesByStage[lead.status] += 1;
    leadsByStore[lead.store_id] += 1;

    if (lead.status === "Closed Won") {
      closedWon += 1;
    }

    if (ACTIVE_STATUSES.includes(lead.status)) {
      activeLeads += 1;
    }

    const flags = getLeadFlags(lead, now);
    if (flags.isOverdue) overdueFollowUps += 1;
    if (flags.isStale) staleLeads += 1;
    if (flags.isHighFollowUpNoConversion) highFollowUpNoConversion += 1;

    const salespersonKey = lead.assigned_user_id || "unassigned";
    const salesperson = salespersonMap.get(salespersonKey) || {
      user_id: lead.assigned_user_id,
      salesperson: lead.assigned_user_name || "Unassigned",
      total: 0,
      closedWon: 0,
      overdue: 0
    };

    salesperson.total += 1;
    if (lead.status === "Closed Won") salesperson.closedWon += 1;
    if (flags.isOverdue) salesperson.overdue += 1;
    salespersonMap.set(salespersonKey, salesperson);
  }

  return {
    totalLeads: leads.length,
    conversionRate: leads.length ? Math.round((closedWon / leads.length) * 1000) / 10 : 0,
    leadsByStore,
    salesByStage,
    overdueFollowUps,
    staleLeads,
    highFollowUpNoConversion,
    activeLeads,
    missedFollowUps: overdueFollowUps,
    salespersonPerformance: Array.from(salespersonMap.values()).sort((a, b) => b.total - a.total)
  };
}

