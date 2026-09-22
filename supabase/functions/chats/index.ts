// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { createChat } from "./createChat.ts";
import { getChats } from "./getChats.ts";
import { getExistingIssueChat, getOrCreateIssueChat } from "./getOrCreateIssueChat.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);

    if (req.method === "POST") {
      if (url.searchParams.get("type") === "issue") return getOrCreateIssueChat(req);
      return createChat(req);
    }

    if (req.method === "GET") {
      if (url.searchParams.has("issueId")) return getExistingIssueChat(req);
      return getChats(req);
    }

    return new Response(JSON.stringify({ error: "Route not found" }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[Chats API Error]", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
