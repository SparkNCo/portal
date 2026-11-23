// What one Log Hours entry may hold: more than 0, at most 24, in steps of half
// an hour (0.5, 1, 1.5 … 24). Same rule as the hours_logged_hours_check
// constraint (migration 20261123120000) and the Log Hours modal
// (lib/hours-api.ts). No Deno imports, so the Node unit tests load it.

export const MAX_HOURS_PER_ENTRY = 24;
export const HOURS_STEP = 0.5;

export function isValidHours(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_HOURS_PER_ENTRY &&
    Number.isInteger(value / HOURS_STEP)
  );
}

export const INVALID_HOURS_MESSAGE = `hours must be between ${HOURS_STEP} and ${MAX_HOURS_PER_ENTRY}, in steps of ${HOURS_STEP}`;

// ── Tickets worked on ───────────────────────────────────────────────────────
// Saved with the entry (hours_logged.tickets, migration 20261123130000): the
// code and title as they were when logged, plus the id. Entries from before
// only have issue_ids; their code and title are looked up by id.

export type LoggedTicket = { id: string; code: string | null; title: string | null };

export const MAX_TICKETS_PER_ENTRY = 50;
const MAX_CODE_CHARS = 40;
const MAX_TITLE_CHARS = 300;

const cleanText = (value: unknown, max: number): string | null => {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
};

// A request's `tickets`, checked: every item needs an id; code and title are
// optional (null when unknown) and trimmed; duplicates (same id) are dropped.
// null = not a valid list.
export function normalizeTickets(value: unknown): LoggedTicket[] | null {
  if (!Array.isArray(value) || value.length > MAX_TICKETS_PER_ENTRY) return null;
  const seen = new Set<string>();
  const tickets: LoggedTicket[] = [];
  for (const item of value) {
    const id = cleanText((item as { id?: unknown })?.id, 200);
    if (!id) return null;
    if (seen.has(id)) continue;
    seen.add(id);
    tickets.push({
      id,
      code: cleanText((item as { code?: unknown }).code, MAX_CODE_CHARS),
      title: cleanText((item as { title?: unknown }).title, MAX_TITLE_CHARS),
    });
  }
  return tickets;
}

// An entry's tickets: the saved ones, or (older entries) one per issue id,
// with no code or title yet — those get looked up by id to show them.
export function entryTickets(entry: {
  tickets?: LoggedTicket[] | null;
  issue_ids?: string[] | null;
}): LoggedTicket[] {
  if (entry.tickets?.length) return entry.tickets;
  return (entry.issue_ids ?? []).map((id) => ({ id, code: null, title: null }));
}

// "SPA-123 — Export to PDF" from what's saved; null when there's no title
// saved (an older entry), i.e. it has to be looked up by id.
export function savedTicketLabel(ticket: LoggedTicket): string | null {
  if (!ticket.title) return null;
  return ticket.code ? `${ticket.code} — ${ticket.title}` : ticket.title;
}
