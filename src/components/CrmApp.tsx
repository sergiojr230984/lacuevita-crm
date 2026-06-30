"use client";

import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Lock,
  LogOut,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  Store,
  UserRound
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { STORE_WHATSAPP_NUMBERS } from "@/lib/constants";
import { formatPhone } from "@/lib/phone";
import { LEAD_STATUSES, type Appointment, type DashboardMetrics, type LeadStatus, type LeadWithFlags, type User } from "@/lib/types";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type DashboardResponse = {
  metrics: DashboardMetrics;
  leads: LeadWithFlags[];
};

type AuthResponse = {
  user: User;
};

const emptyMetrics: DashboardMetrics = {
  totalLeads: 0,
  conversionRate: 0,
  leadsByStore: { hialeah: 0, sw: 0 },
  salesByStage: {
    New: 0,
    Contacted: 0,
    "Quote Sent": 0,
    "Follow-Up": 0,
    Negotiation: 0,
    "Closed Won": 0,
    Lost: 0
  },
  overdueFollowUps: 0,
  staleLeads: 0,
  highFollowUpNoConversion: 0,
  activeLeads: 0,
  missedFollowUps: 0,
  salespersonPerformance: []
};

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || "Request failed");
  }

  return payload.data;
}

function buildDashboardUrl(user: User) {
  const params = new URLSearchParams({ role: user.role });

  if (user.role === "manager" && user.store_id) {
    params.set("storeId", user.store_id);
  }

  if (user.role === "salesperson") {
    params.set("userId", user.id);
  }

  return `/api/dashboard?${params.toString()}`;
}

function storeLabel(storeId: "hialeah" | "sw") {
  return storeId === "hialeah" ? "Hialeah" : "SW";
}

function dateShort(value: string | null) {
  if (!value) return "None";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function datetimeLocalValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function defaultAppointmentStart() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(10, 0, 0, 0);
  return datetimeLocalValue(next);
}

function MetricTile({
  icon,
  label,
  value,
  tone = "neutral"
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "neutral" | "good" | "warn" | "hot";
}) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900 ring-amber-100"
        : tone === "hot"
          ? "bg-rose-50 text-rose-800 ring-rose-100"
          : "bg-white text-ink ring-stone-200";

  return (
    <div className={`rounded-lg p-4 shadow-soft ring-1 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-current/70">{label}</span>
        <span className="grid size-9 place-items-center rounded-full bg-white/70">{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-normal">{value}</div>
    </div>
  );
}

function MetricsGrid({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <MetricTile icon={<BarChart3 size={18} />} label="Total Leads" value={metrics.totalLeads} />
      <MetricTile icon={<CheckCircle2 size={18} />} label="Conversion" value={`${metrics.conversionRate}%`} tone="good" />
      <MetricTile icon={<Store size={18} />} label="Active" value={metrics.activeLeads} />
      <MetricTile icon={<Bell size={18} />} label="Overdue" value={metrics.overdueFollowUps} tone="hot" />
      <MetricTile icon={<Clock3 size={18} />} label="No Activity 48h" value={metrics.staleLeads} tone="warn" />
      <MetricTile
        icon={<AlertTriangle size={18} />}
        label="High Follow-Up"
        value={metrics.highFollowUpNoConversion}
        tone="warn"
      />
    </section>
  );
}

function StoreBreakdown({ metrics }: { metrics: DashboardMetrics }) {
  const max = Math.max(metrics.leadsByStore.hialeah, metrics.leadsByStore.sw, 1);

  return (
    <section className="grid gap-3 lg:grid-cols-[1fr_1.3fr]">
      <div className="rounded-lg bg-white p-4 shadow-soft ring-1 ring-stone-200">
        <h2 className="text-sm font-semibold uppercase tracking-normal text-stone-500">Stores</h2>
        {(["hialeah", "sw"] as const).map((storeId) => (
          <div key={storeId} className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-ink">{storeLabel(storeId)}</span>
              <span className="text-stone-500">{metrics.leadsByStore[storeId]} leads</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-stone-100">
              <div
                className="h-2 rounded-full bg-fern"
                style={{ width: `${Math.max((metrics.leadsByStore[storeId] / max) * 100, 4)}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-stone-500">{formatPhone(STORE_WHATSAPP_NUMBERS[storeId])}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-white p-4 shadow-soft ring-1 ring-stone-200">
        <h2 className="text-sm font-semibold uppercase tracking-normal text-stone-500">Salespeople</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase tracking-normal text-stone-500">
              <tr>
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Leads</th>
                <th className="py-2 font-medium">Won</th>
                <th className="py-2 font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {metrics.salespersonPerformance.length ? (
                metrics.salespersonPerformance.map((row) => (
                  <tr key={row.user_id || "unassigned"} className="border-t border-stone-100">
                    <td className="py-2 font-medium text-ink">{row.salesperson}</td>
                    <td className="py-2 text-stone-600">{row.total}</td>
                    <td className="py-2 text-emerald-700">{row.closedWon}</td>
                    <td className="py-2 text-rose-700">{row.overdue}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-5 text-stone-500" colSpan={4}>
                    No leads yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function StageSummary({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <section className="rounded-lg bg-white p-4 shadow-soft ring-1 ring-stone-200">
      <h2 className="text-sm font-semibold uppercase tracking-normal text-stone-500">Pipeline</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
        {LEAD_STATUSES.map((status) => (
          <div key={status} className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
            <div className="text-xs font-medium text-stone-500">{status}</div>
            <div className="mt-1 text-2xl font-semibold text-ink">{metrics.salesByStage[status]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LeadCard({
  lead,
  onOpen,
  onDragStart
}: {
  lead: LeadWithFlags;
  onOpen: (lead: LeadWithFlags) => void;
  onDragStart: (leadId: string) => void;
}) {
  return (
    <button
      draggable
      onDragStart={() => onDragStart(lead.id)}
      onClick={() => onOpen(lead)}
      className="w-full rounded-lg border border-stone-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{lead.name || "Unknown Customer"}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-stone-500">
            <Phone size={13} />
            <span>{formatPhone(lead.whatsapp_number)}</span>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-600">
          {storeLabel(lead.store_id)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {lead.isOverdue && <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700">Overdue</span>}
        {lead.isStale && <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">48h</span>}
        {lead.isHighFollowUpNoConversion && (
          <span className="rounded-full bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-800">Follow-ups {lead.follow_up_count}</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-500">
        <div>
          <span className="block text-stone-400">Next</span>
          <span className="font-medium text-stone-700">{dateShort(lead.next_follow_up_date)}</span>
        </div>
        <div>
          <span className="block text-stone-400">Owner</span>
          <span className="font-medium text-stone-700">{lead.assigned_user_name || "Unassigned"}</span>
        </div>
      </div>
    </button>
  );
}

function KanbanBoard({
  leads,
  onOpenLead,
  onMoveLead
}: {
  leads: LeadWithFlags[];
  onOpenLead: (lead: LeadWithFlags) => void;
  onMoveLead: (leadId: string, status: LeadStatus) => Promise<void>;
}) {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const leadsByStatus = useMemo(() => {
    return LEAD_STATUSES.reduce(
      (acc, status) => {
        acc[status] = leads.filter((lead) => lead.status === status);
        return acc;
      },
      {} as Record<LeadStatus, LeadWithFlags[]>
    );
  }, [leads]);

  return (
    <section className="overflow-x-auto pb-4">
      <div className="grid min-w-[1180px] grid-cols-7 gap-3">
        {LEAD_STATUSES.map((status) => (
          <div
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={async () => {
              if (draggedLeadId) {
                await onMoveLead(draggedLeadId, status);
                setDraggedLeadId(null);
              }
            }}
            className="min-h-[480px] rounded-lg border border-stone-200 bg-stone-100/80 p-2"
          >
            <div className="sticky top-0 z-10 mb-2 flex items-center justify-between rounded-md bg-stone-100/95 px-2 py-2">
              <h3 className="text-sm font-semibold text-ink">{status}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-stone-600">
                {leadsByStatus[status].length}
              </span>
            </div>
            <div className="space-y-2">
              {leadsByStatus[status].map((lead) => (
                <LeadCard key={lead.id} lead={lead} onOpen={onOpenLead} onDragStart={setDraggedLeadId} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LeadPanel({
  lead,
  onClose,
  onLogged
}: {
  lead: LeadWithFlags | null;
  onClose: () => void;
  onLogged: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointmentTitle, setAppointmentTitle] = useState("Furniture consultation");
  const [appointmentStart, setAppointmentStart] = useState(defaultAppointmentStart());
  const [appointmentDuration, setAppointmentDuration] = useState("60");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarSuccessLink, setCalendarSuccessLink] = useState<string | null>(null);

  useEffect(() => {
    setMessage("");
    setNextFollowUpDate("");
    setError(null);
    setAppointmentTitle("Furniture consultation");
    setAppointmentStart(defaultAppointmentStart());
    setAppointmentDuration("60");
    setAppointmentNotes("");
    setAppointments([]);
    setCalendarError(null);
    setCalendarSuccessLink(null);
    if (!lead?.id) {
      return;
    }

    let cancelled = false;
    setAppointmentsLoading(true);
    void apiFetch<{ appointments: Appointment[] }>(`/api/appointments?leadId=${encodeURIComponent(lead.id)}`)
      .then((payload) => {
        if (!cancelled) {
          setAppointments(payload.appointments);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppointments([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAppointmentsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lead?.id]);

  if (!lead) {
    return null;
  }

  async function submitOutbound() {
    if (!lead || !message.trim()) return;
    setSaving(true);
    setError(null);

    try {
      await apiFetch<{ lead: LeadWithFlags }>("/api/messages/outbound", {
        method: "POST",
        body: JSON.stringify({
          lead_id: lead.id,
          body: message.trim(),
          next_follow_up_date: nextFollowUpDate ? new Date(nextFollowUpDate).toISOString() : null
        })
      });
      setMessage("");
      setNextFollowUpDate("");
      await onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log message");
    } finally {
      setSaving(false);
    }
  }

  async function submitAppointment() {
    if (!lead || !appointmentStart) {
      setCalendarError("Choose an appointment date and time");
      return;
    }

    setCalendarSaving(true);
    setCalendarError(null);
    setCalendarSuccessLink(null);

    try {
      const payload = await apiFetch<{ appointment: Appointment; lead: LeadWithFlags }>("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          lead_id: lead.id,
          title: appointmentTitle.trim() || "Customer appointment",
          description: appointmentNotes.trim() || null,
          scheduled_start: new Date(appointmentStart).toISOString(),
          duration_minutes: Number(appointmentDuration)
        })
      });
      setAppointments((current) => [payload.appointment, ...current]);
      setAppointmentNotes("");
      setCalendarSuccessLink(payload.appointment.google_event_link);
      await onLogged();
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "Unable to schedule appointment");
    } finally {
      setCalendarSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink/30 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-md flex-col rounded-lg bg-white shadow-2xl ring-1 ring-stone-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-stone-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">{lead.name || "Unknown Customer"}</h2>
              <div className="mt-1 flex items-center gap-2 text-sm text-stone-500">
                <Phone size={15} />
                {formatPhone(lead.whatsapp_number)}
              </div>
            </div>
            <button className="rounded-md border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-stone-50 p-3">
              <div className="text-xs text-stone-500">Status</div>
              <div className="mt-1 font-semibold text-ink">{lead.status}</div>
            </div>
            <div className="rounded-lg bg-stone-50 p-3">
              <div className="text-xs text-stone-500">Store</div>
              <div className="mt-1 font-semibold text-ink">{storeLabel(lead.store_id)}</div>
            </div>
            <div className="rounded-lg bg-stone-50 p-3">
              <div className="text-xs text-stone-500">Follow-Ups</div>
              <div className="mt-1 font-semibold text-ink">{lead.follow_up_count}</div>
            </div>
            <div className="rounded-lg bg-stone-50 p-3">
              <div className="text-xs text-stone-500">Next</div>
              <div className="mt-1 font-semibold text-ink">{dateShort(lead.next_follow_up_date)}</div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-stone-200 p-3">
            <div className="text-sm font-semibold text-ink">Contact Log</div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="mt-3 min-h-28 w-full resize-none rounded-lg border border-stone-200 bg-white p-3 text-sm text-ink"
              placeholder="Message sent to customer"
            />
            <label className="mt-3 block text-xs font-medium text-stone-500" htmlFor="next-follow-up">
              Next follow-up
            </label>
            <input
              id="next-follow-up"
              value={nextFollowUpDate}
              onChange={(event) => setNextFollowUpDate(event.target.value)}
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-ink"
            />
            {error && <div className="mt-2 text-sm text-rose-700">{error}</div>}
            <button
              onClick={submitOutbound}
              disabled={saving || !message.trim()}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-fern px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              <Send size={16} />
              {saving ? "Saving" : "Log Contact"}
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50/60 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarPlus size={17} className="text-orange-600" />
              Google Calendar
            </div>
            <label className="mt-3 block text-xs font-medium text-stone-500" htmlFor="appointment-title">
              Appointment title
            </label>
            <input
              id="appointment-title"
              value={appointmentTitle}
              onChange={(event) => setAppointmentTitle(event.target.value)}
              className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-ink"
            />
            <div className="mt-3 grid grid-cols-[1fr_104px] gap-2">
              <div>
                <label className="block text-xs font-medium text-stone-500" htmlFor="appointment-start">
                  Date and time
                </label>
                <input
                  id="appointment-start"
                  value={appointmentStart}
                  onChange={(event) => setAppointmentStart(event.target.value)}
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-ink"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500" htmlFor="appointment-duration">
                  Minutes
                </label>
                <select
                  id="appointment-duration"
                  value={appointmentDuration}
                  onChange={(event) => setAppointmentDuration(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-ink"
                >
                  <option value="30">30</option>
                  <option value="60">60</option>
                  <option value="90">90</option>
                  <option value="120">120</option>
                </select>
              </div>
            </div>
            <label className="mt-3 block text-xs font-medium text-stone-500" htmlFor="appointment-notes">
              Notes
            </label>
            <textarea
              id="appointment-notes"
              value={appointmentNotes}
              onChange={(event) => setAppointmentNotes(event.target.value)}
              className="mt-1 min-h-20 w-full resize-none rounded-lg border border-orange-200 bg-white p-3 text-sm text-ink"
              placeholder="Delivery details, items, or showroom visit notes"
            />
            {calendarError && <div className="mt-2 text-sm text-rose-700">{calendarError}</div>}
            {calendarSuccessLink && (
              <a
                href={calendarSuccessLink}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-orange-700"
              >
                Appointment saved
                <ExternalLink size={14} />
              </a>
            )}
            <button
              onClick={submitAppointment}
              disabled={calendarSaving || !appointmentStart}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              <CalendarPlus size={16} />
              {calendarSaving ? "Scheduling" : "Schedule Appointment"}
            </button>

            <div className="mt-4 border-t border-orange-200 pt-3">
              <div className="text-xs font-semibold uppercase tracking-normal text-stone-500">Recent appointments</div>
              {appointmentsLoading ? (
                <div className="mt-2 h-10 animate-pulse rounded-lg bg-white/70" />
              ) : appointments.length ? (
                <div className="mt-2 space-y-2">
                  {appointments.slice(0, 3).map((appointment) => (
                    <div key={appointment.id} className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-orange-100">
                      <div className="font-semibold text-ink">{appointment.title}</div>
                      <div className="mt-1 text-stone-500">{dateShort(appointment.scheduled_start)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-stone-500">None yet</div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function EmptyConnection({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
      <div className="w-full rounded-lg bg-white p-6 shadow-soft ring-1 ring-stone-200">
        <div className="grid size-12 place-items-center rounded-full bg-rose-50 text-rose-700">
          <AlertTriangle size={22} />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-ink">Database Connection Needed</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">{error}</p>
        <div className="mt-5 rounded-lg bg-stone-50 p-4 text-sm text-stone-700">
          <div className="font-semibold text-ink">Setup</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Create PostgreSQL database `lacuevita_crm`.</li>
            <li>Set `DATABASE_URL` in `.env.local`.</li>
            <li>Run `db/schema.sql`.</li>
          </ol>
        </div>
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-fern px-4 py-2 text-sm font-semibold text-white"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    </main>
  );
}

const demoAccounts = [
  { label: "Owner", email: "owner@lacuevitafurniture.com", password: "Owner123!" },
  { label: "Manager", email: "manager@lacuevitafurniture.com", password: "Manager123!" },
  { label: "Hialeah Sales", email: "hialeah.sales@lacuevitafurniture.com", password: "Hialeah123!" },
  { label: "SW Sales", email: "sw.sales@lacuevitafurniture.com", password: "SW123!" }
];

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState(demoAccounts[0].email);
  const [password, setPassword] = useState(demoAccounts[0].password);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = await apiFetch<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      onLogin(payload.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft ring-1 ring-stone-200">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-fern text-white">
            <Lock size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-fern">La Cuevita CRM</div>
            <h1 className="text-2xl font-semibold text-ink">Team Login</h1>
          </div>
        </div>

        <form className="mt-5 space-y-3" onSubmit={submitLogin}>
          <label className="block text-sm font-medium text-stone-600" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm text-ink"
            autoComplete="email"
          />

          <label className="block text-sm font-medium text-stone-600" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm text-ink"
            autoComplete="current-password"
          />

          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</div>}

          <button
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            <Lock size={16} />
            {loading ? "Signing in" : "Sign In"}
          </button>
        </form>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
              }}
              className="rounded-lg border border-stone-200 px-3 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

export function CrmApp() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [leads, setLeads] = useState<LeadWithFlags[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadWithFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountScope = useMemo(() => {
    if (!currentUser) return "";
    if (currentUser.role === "owner") return "Owner: both WhatsApp numbers and analytics";
    if (currentUser.role === "manager") return "Manager: team dashboard";
    if (currentUser.store_id) {
      return `${storeLabel(currentUser.store_id)} Sales: ${formatPhone(STORE_WHATSAPP_NUMBERS[currentUser.store_id])}`;
    }
    return "Salesperson";
  }, [currentUser]);

  const refreshDashboard = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setRefreshing(true);
    try {
      const dashboard = await apiFetch<DashboardResponse>(buildDashboardUrl(currentUser));
      setMetrics(dashboard.metrics);
      setLeads(dashboard.leads);
      setSelectedLead((current) => dashboard.leads.find((lead) => lead.id === current?.id) || current);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.message === "Not logged in") {
        setCurrentUser(null);
      }
      setError(err instanceof Error ? err.message : "Unable to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    async function loadSession() {
      try {
        const payload = await apiFetch<AuthResponse>("/api/auth/me");
        setCurrentUser(payload.user);
      } catch {
        setCurrentUser(null);
        setLoading(false);
      } finally {
        setAuthChecked(true);
      }
    }

    void loadSession();
  }, []);

  useEffect(() => {
    if (authChecked && currentUser) {
      void refreshDashboard();
    }
  }, [authChecked, currentUser, refreshDashboard]);

  async function logout() {
    try {
      await apiFetch<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(null);
      setLeads([]);
      setMetrics(emptyMetrics);
      setSelectedLead(null);
      setLoading(false);
    }
  }

  function handleLogin(user: User) {
    setCurrentUser(user);
    setLoading(true);
    setError(null);
  }

  const moveLead = useCallback(
    async (leadId: string, status: LeadStatus) => {
      const previous = leads;
      const lead = leads.find((item) => item.id === leadId);

      if (!lead || lead.status === status) {
        return;
      }

      setLeads((current) => current.map((item) => (item.id === leadId ? { ...item, status } : item)));

      try {
        await apiFetch<{ lead: LeadWithFlags }>(`/api/leads/${leadId}`, {
          method: "PATCH",
          body: JSON.stringify({ status })
        });
        await refreshDashboard();
      } catch (err) {
        setLeads(previous);
        setError(err instanceof Error ? err.message : "Unable to update lead");
      }
    },
    [leads, refreshDashboard]
  );

  if (!authChecked) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="h-28 w-full max-w-sm animate-pulse rounded-lg bg-white shadow-soft ring-1 ring-stone-200" />
      </main>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (error && !leads.length && !refreshing) {
    return <EmptyConnection error={error} onRetry={() => void refreshDashboard()} />;
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-stone-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-fern">
              <MessageCircle size={18} />
              La Cuevita CRM
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-ink">WhatsApp Lead Desk</h1>
            <div className="mt-1 text-sm text-stone-500">{accountScope}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-stone-700 ring-1 ring-stone-200">
              <UserRound size={16} />
              {currentUser.name}
            </div>
            <button
              onClick={() => void refreshDashboard()}
              className="inline-flex size-10 items-center justify-center rounded-lg bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
              title="Refresh"
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => void logout()}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        {error && leads.length > 0 && (
          <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 ring-1 ring-rose-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-lg bg-white shadow-soft ring-1 ring-stone-200" />
            ))}
          </div>
        ) : (
          <>
            <MetricsGrid metrics={metrics} />
            <StoreBreakdown metrics={metrics} />
            <StageSummary metrics={metrics} />
            <KanbanBoard leads={leads} onOpenLead={setSelectedLead} onMoveLead={moveLead} />
          </>
        )}
      </div>

      <LeadPanel lead={selectedLead} onClose={() => setSelectedLead(null)} onLogged={refreshDashboard} />
    </main>
  );
}
