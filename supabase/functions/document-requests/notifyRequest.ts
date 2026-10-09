// @ts-nocheck
import { supabase } from "../client.ts";
import { notifyUsers, resolveDocumentsLink } from "../utils/notify.ts";

type RequestRow = {
  id: string;
  customer_slug: string;
  requested_by: string;
  title: string;
};

// Claimed / unassigned / delivered: tells whoever made the request and every
// admin (minus whoever did it), plus any `alsoNotifyEmails` — e.g. the
// developer an admin just unassigned. Fire-and-forget like notifyProject.
export function notifyRequestUpdate(
  request: RequestRow,
  actorEmail: string | undefined,
  action: "document_request_claimed" | "document_request_released" | "document_request_completed",
  alsoNotifyEmails: (string | null | undefined)[] = [],
): void {
  EdgeRuntime.waitUntil(
    (async () => {
      const emails = [request.requested_by, ...alsoNotifyEmails].filter(Boolean);
      const { data: users, error } = await supabase
        .schema("portal")
        .from("users")
        .select("id")
        .in("email", emails);
      if (error) console.error("[document-requests] recipient lookup failed (non-fatal):", error);

      await notifyUsers({
        userIds: (users ?? []).map((u) => u.id),
        includeAdmins: true,
        actorEmail: actorEmail ?? "",
        action,
        objectType: "document_request",
        objectId: String(request.id),
        link: resolveDocumentsLink(request.customer_slug),
        preview: request.title,
        objectTitle: request.title,
      });
    })(),
  );
}
