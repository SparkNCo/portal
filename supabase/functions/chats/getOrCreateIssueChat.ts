// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { resolveCustomerUserIdBySlug } from "../utils/slug.ts";
import { resolveParticipants, seedParticipants } from "./resolveParticipants.ts";

// Realtime equivalent of CometChat's getOrCreateIssueGroup.ts. Mirrors its
// two-step shape: GET looks up an existing issue chat without creating one
// (the Chat tab shouldn't spin up a chat — and add every assignee to it —
// just from being opened; only sending the first message should), POST
// creates it lazily. Idempotent via idx_chats_issue_id_unique (see
// 20260922100000_add_issue_id_to_chats.sql) — a unique-violation on insert
// means someone else's request won the race, so this just re-selects
// whatever they created instead of erroring.
export const getExistingIssueChat = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const issueId = url.searchParams.get("issueId");
    if (!issueId) {
      return new Response(JSON.stringify({ error: "issueId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.schema("portal")
      .from("chats")
      .select("*")
      .eq("issue_id", issueId)
      .eq("type", "issue")
      .maybeSingle();
    if (error) throw new Error(error.message);

    return new Response(JSON.stringify(data ?? null), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Get Existing Issue Chat Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

export const getOrCreateIssueChat = async (req: Request) => {
  try {
    const schema = "portal";
    const body = await req.json();
    const { issueId, issueTitle, slug, profile } = body;

    if (!issueId || !profile?.id || !profile?.role) {
      return new Response(
        JSON.stringify({ error: "issueId, profile.id and profile.role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: existing, error: existingError } = await supabase.schema(schema)
      .from("chats")
      .select("*")
      .eq("issue_id", issueId)
      .eq("type", "issue")
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      return new Response(JSON.stringify(existing), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Developer/admin have no customerId of their own for this issue — only
    // the project route's slug — so resolve it the same way notifyProject
    // does. A customer/stakeholder's own resolution doesn't need it at all
    // (resolveParticipants derives it from their own role/id).
    const customerId =
      profile.role === "developer" || profile.role === "admin"
        ? await resolveCustomerUserIdBySlug(schema, slug ?? "")
        : undefined;

    const { resolvedCustomerId, participantIds } = await resolveParticipants(profile, customerId);

    const { data: created, error: insertError } = await supabase.schema(schema)
      .from("chats")
      .insert({
        type: "issue",
        issue_id: issueId,
        title: issueTitle ?? null,
        project_slug: slug ?? null,
        created_by: profile.id,
        metadata: resolvedCustomerId ? { customerId: resolvedCustomerId } : {},
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        // Lost the race — someone else's request already created this
        // issue's chat between our SELECT above and this INSERT.
        const { data: raceWinner, error: raceError } = await supabase.schema(schema)
          .from("chats")
          .select("*")
          .eq("issue_id", issueId)
          .eq("type", "issue")
          .single();
        if (raceError) throw new Error(raceError.message);
        return new Response(JSON.stringify(raceWinner), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(insertError.message);
    }

    await seedParticipants(created.id, participantIds);

    return new Response(JSON.stringify(created), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Get Or Create Issue Chat Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
