// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

// Lists chats for the caller: everything they're a chat_participants row
// for, or every chat when admin=true — mirrors useCometChat.ts's
// fetchGroups() `if (!isAdmin) builder.joinedOnly(true)`. `customer_id`
// optionally scopes further to one customer's chats (ChatLayout's
// admin/developer "viewing a specific customer" panel).
export const getChats = async (req: Request) => {
  try {
    const schema = "portal";
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    const isAdmin = url.searchParams.get("admin") === "true";
    const customerId = url.searchParams.get("customer_id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase.schema(schema)
      .from("chats")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (!isAdmin) {
      const { data: participantRows, error: participantError } = await supabase.schema(schema)
        .from("chat_participants")
        .select("chat_id")
        .eq("user_id", userId);
      if (participantError) throw new Error(participantError.message);

      const chatIds = (participantRows ?? []).map((r) => r.chat_id);
      if (!chatIds.length) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      query = query.in("id", chatIds);
    }

    if (customerId) {
      query = query.eq("metadata->>customerId", customerId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return new Response(JSON.stringify(data ?? []), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Get Chats Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
