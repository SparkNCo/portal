// @ts-nocheck
import { supabase } from "../client.ts";

// Shared by editDocumentRequest.ts and deleteDocumentRequest.ts — both only
// let the original requester act, and only while the request is still
// unclaimed and not done (no admin bypass for either). Centralized so the
// two handlers don't carry two copies of the same fetch-then-guard sequence.
const ACTION_LABELS = {
  edit: { verb: "edit", pastParticiple: "edited" },
  delete: { verb: "delete", pastParticiple: "deleted" },
} as const;

export async function authorizeRequesterAction(
  schema: string,
  id: string,
  actorEmail: string,
  action: keyof typeof ACTION_LABELS,
): Promise<Response | null> {
  const { verb, pastParticiple } = ACTION_LABELS[action];

  const { data: existing, error: fetchError } = await supabase
    .schema(schema)
    .from("document_requests")
    .select("requested_by, status, claimed_by")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return Response.json(
      { error: "Failed to load document request", details: fetchError.message },
      { status: 500 },
    );
  }
  if (!existing) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }
  if (existing.status === "done") {
    return Response.json(
      { error: `This request has already been fulfilled and can no longer be ${pastParticiple}` },
      { status: 400 },
    );
  }
  if (existing.claimed_by) {
    return Response.json(
      { error: `This request has been claimed by ${existing.claimed_by} and can no longer be ${pastParticiple}` },
      { status: 400 },
    );
  }
  if (existing.requested_by !== actorEmail) {
    return Response.json(
      { error: `Only the person who requested this can ${verb} it` },
      { status: 403 },
    );
  }

  return null;
}
