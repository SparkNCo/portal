import { API_JSON_HEADERS } from "@/lib/api-headers";

// Mirrors BulkDraft in supabase/functions/suggested-features/bulkImportPrompt.ts.
export type BulkDraft = {
  type: "feature" | "bug";
  title: string;
  description: string;
  // Features: acceptance criteria. Bugs: steps to reproduce.
  items: string[];
  expected: string;
  actual: string;
  projectId: string | null;
  milestoneId: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  sourceExcerpt: string;
};

export const MAX_BULK_NOTES_CHARS = 20000;

// Pasted notes → draft tickets for review. Creates nothing (see
// suggested-features/bulkImport.ts). Rate-limited server-side; the error
// says how long to wait.
export async function analyzeBulkNotes(slug: string, notes: string, actorEmail: string): Promise<BulkDraft[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/suggested-features/bulk-import`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify({ slug, notes, actorEmail }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "Couldn't analyze the notes");
  return body?.drafts ?? [];
}

// ── Saved in the browser ─────────────────────────────────────────────────
// The notes and drafts survive closing the dialog and reloading the page for
// a few hours, so nobody has to re-analyze (another AI call, counted by the
// rate limit) after an accidental click outside. Per customer and user.

export const BULK_IMPORT_TTL_MS = 8 * 60 * 60 * 1000;

export const INTERRUPTED_ERROR =
  "The page closed while this ticket was being created. Check it doesn't already exist before trying again.";

export type SavedBulkImport<Row> = {
  notes: string;
  step: "paste" | "review";
  rows: Row[];
  index: number;
  savedAt: number;
};

export const bulkImportStorageKey = (slug: string, userId?: string | null) =>
  `portal:bulk-import:${slug}:${userId ?? "anon"}`;

// What was saved, or null when there's nothing usable (missing, expired,
// from the future, malformed). A ticket that was mid-creation when the page
// went away may or may not exist: it comes back as failed, with a warning,
// rather than as pending (retrying blindly could file it twice).
export function parseSavedBulkImport<Row extends { status: string; error?: string }>(
  raw: string | null,
  now = Date.now(),
): SavedBulkImport<Row> | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Partial<SavedBulkImport<Row>>;
    if (typeof saved.savedAt !== "number" || now - saved.savedAt > BULK_IMPORT_TTL_MS || saved.savedAt > now) {
      return null;
    }
    if (typeof saved.notes !== "string" || !Array.isArray(saved.rows)) return null;
    const rows = saved.rows.map((r) => (r.status === "creating" ? { ...r, status: "failed", error: INTERRUPTED_ERROR } : r));
    const step = saved.step === "review" && rows.length ? "review" : "paste";
    const index = typeof saved.index === "number" ? Math.min(Math.max(0, saved.index), Math.max(0, rows.length - 1)) : 0;
    return { notes: saved.notes, step, rows, index, savedAt: saved.savedAt };
  } catch {
    return null;
  }
}

const cleanList = (items: string[]) => items.map((i) => i.trim()).filter(Boolean);

// Same sections as the Feature Request and Bug Report panels, so imported
// tickets read like hand-filed ones, plus the notes they came from.
export function buildBulkDescription(draft: Omit<BulkDraft, "projectId" | "milestoneId" | "priority" | "title">): string {
  const items = cleanList(draft.items);
  const sections =
    draft.type === "bug"
      ? [
          draft.description.trim() ? `### Description\n${draft.description.trim()}` : null,
          items.length ? `### Steps to Reproduce\n${items.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : null,
          draft.expected.trim() ? `### Expected Behavior\n${draft.expected.trim()}` : null,
          draft.actual.trim() ? `### Actual Behavior\n${draft.actual.trim()}` : null,
        ]
      : [
          draft.description.trim() ? `### Feature Description\n${draft.description.trim()}` : null,
          items.length ? `### Criteria\n${items.map((c) => `- ${c}`).join("\n")}` : null,
        ];

  const excerpt = draft.sourceExcerpt.trim();
  if (excerpt) {
    sections.push(`### From the notes\n${excerpt.split("\n").map((line) => `> ${line}`).join("\n")}`);
  }
  return sections.filter(Boolean).join("\n\n");
}
