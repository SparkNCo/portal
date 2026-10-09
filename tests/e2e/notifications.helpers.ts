import { expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// The notification tests call the edge functions like the browser does (anon
// key) and then read portal.events / portal.notifications with the service
// key to check who got what. The service key comes from
// supabase/functions/.env (SERVICE_SECRET_KEY) — never commit it elsewhere.

const ROOT = path.resolve(__dirname, '../..');

// Some keys in these files are written "KEY =value" — trim both sides.
function readEnv(file: string): Record<string, string> {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return {};
  const parsed = dotenv.parse(fs.readFileSync(full));
  return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k.trim(), v.trim()]));
}

const fnEnv = readEnv('supabase/functions/.env');
const appEnv = readEnv('.env');

export const SUPABASE_URL: string = appEnv.NEXT_PUBLIC_SUPABASE_URL || fnEnv.PROJECT_URL || "";
const ANON_KEY: string = appEnv.NEXT_PUBLIC_SUPABASE_KEY ?? "";
const SERVICE_KEY: string = fnEnv.SERVICE_SECRET_KEY ?? "";
const LINEAR_API_KEY: string = fnEnv.LINEAR_API_KEY ?? "";
export const COMETCHAT = {
  appId: fnEnv.COMETCHAT_APP_ID ?? "",
  apiKey: fnEnv.COMETCHAT_API_KEY ?? "",
  region: fnEnv.COMETCHAT_REGION ?? "",
};

export function missingEnv(): string[] {
  return Object.entries({ SUPABASE_URL, ANON_KEY, SERVICE_KEY, LINEAR_API_KEY })
    .filter(([, v]) => !v)
    .map(([k]) => k);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PortalClient = SupabaseClient<any, any, any>;
let _db: PortalClient | null = null;
export function db(): PortalClient {
  _db ??= createClient(SUPABASE_URL, SERVICE_KEY, {
    db: { schema: 'portal' },
    auth: { persistSession: false },
  });
  return _db!;
}

// ── Edge functions ──────────────────────────────────────────────────────────

export async function callFunction(
  name: string,
  init: { method?: string; body?: unknown; query?: string } = {},
): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}${init.query ?? ''}`, {
    method: init.method ?? 'POST',
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'POST'} ${name}${init.query ?? ''} → ${res.status}: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ── Linear ──────────────────────────────────────────────────────────────────

export async function linear(query: string, variables: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: LINEAR_API_KEY },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`Linear: ${JSON.stringify(json.errors)}`);
  return json.data;
}

// ── Events / notifications ─────────────────────────────────────────────────

export type EventRow = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  object_type: string;
  object_id: string;
  object_title: string | null;
  preview: string | null;
  issue_code: string | null;
  issue_id: string | null;
  link: string;
  created_at: string;
};

// Every event a test creates is remembered here and deleted afterwards
// (notifications go with them: ON DELETE CASCADE).
export const createdEventIds = new Set<string>();

// A starting point for waitForEvent. Events are stamped by the database's
// clock, which can be a bit behind this machine's — hence the margin; events
// a test already saw are skipped instead.
export function sinceNow(): string {
  return new Date(Date.now() - 10_000).toISOString();
}

// Waits for a new event with this action/object (created after `since`, not
// one an earlier step already got). Notifications are sent in the background
// (EdgeRuntime.waitUntil, or a webhook), so they show up a little after the
// request returns.
export async function waitForEvent(
  filter: { action: string; objectId: string; since: string },
  timeout = 30_000,
): Promise<EventRow> {
  let found: EventRow | null = null;
  await expect
    .poll(
      async () => {
        const { data, error } = await db()
          .from('events')
          .select('*')
          .eq('action', filter.action)
          .eq('object_id', filter.objectId)
          .gte('created_at', filter.since)
          .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        found = ((data ?? []) as EventRow[]).find((e) => !createdEventIds.has(e.id)) ?? null;
        return !!found;
      },
      { message: `no "${filter.action}" event for ${filter.objectId}`, timeout, intervals: [500, 1000, 2000] },
    )
    .toBe(true);
  createdEventIds.add(found!.id);
  return found!;
}

export async function recipientsOf(eventId: string): Promise<string[]> {
  const { data, error } = await db().from('notifications').select('user_id').eq('event_id', eventId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((n: { user_id: string }) => n.user_id).sort();
}

// The recipients are written one by one after the event, so poll until the
// set matches.
export async function expectRecipients(eventId: string, expected: Iterable<string>) {
  const want = [...new Set(expected)].sort();
  await expect
    .poll(() => recipientsOf(eventId), { message: 'notification recipients', timeout: 20_000 })
    .toEqual(want);
}

// How many unread notifications a user has for one object (chat id, or a
// ticket for issue-scoped types) — grouping keeps this at 1.
export async function unreadCount(userId: string, objectType: string, key: { objectId?: string; issueId?: string }) {
  let q = db()
    .from('notifications')
    .select('id, events!inner(object_type, object_id, issue_id)', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
    .eq('events.object_type', objectType);
  if (key.objectId) q = q.eq('events.object_id', key.objectId);
  if (key.issueId) q = q.eq('events.issue_id', key.issueId);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function deleteEvents(filter: { since: string; issueId?: string; objectIds: string[] }) {
  if (createdEventIds.size) {
    await db().from('events').delete().in('id', [...createdEventIds]);
  }
  // Older events of the same objects whose notifications were re-pointed at a
  // newer one (grouping) are left without notifications — remove them too.
  if (filter.objectIds.length) {
    await db().from('events').delete().gte('created_at', filter.since).in('object_id', filter.objectIds);
  }
  if (filter.issueId) {
    await db().from('events').delete().gte('created_at', filter.since).eq('issue_id', filter.issueId);
  }
}

export function without<T>(items: Iterable<T>, ...remove: T[]): T[] {
  return [...new Set(items)].filter((i) => !remove.includes(i));
}
