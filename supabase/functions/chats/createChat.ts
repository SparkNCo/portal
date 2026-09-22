// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { resolveParticipants, seedParticipants } from "./resolveParticipants.ts";

// Creates a direct/group chat (not "issue" — that's getOrCreateIssueChat,
// added alongside the issue_chats migration) and seeds its participants the
// same way CometChat's createSupportGroup did: resolved server-side from
// portal.assignments, not trusted from the client.
export const createChat = async (req: Request) => {
  try {
    const schema = "portal";
    const body = await req.json();
    const { type, title, project_slug, customer_id, profile } = body;

    if (!profile?.id || !profile?.role) {
      return new Response(JSON.stringify({ error: "profile.id and profile.role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalType = type === "direct" ? "direct" : "group";

    const { resolvedCustomerId, participantIds } = await resolveParticipants(profile, customer_id);

    const { data: chat, error } = await supabase.schema(schema)
      .from("chats")
      .insert({
        type: finalType,
        title: title ?? null,
        project_slug: project_slug ?? null,
        created_by: profile.id,
        metadata: resolvedCustomerId ? { customerId: resolvedCustomerId } : {},
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await seedParticipants(chat.id, participantIds);

    return new Response(JSON.stringify(chat), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Create Chat Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
