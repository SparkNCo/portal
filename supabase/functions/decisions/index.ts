// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const pathname = new URL(req.url).pathname;
    let res: Response;

    if (req.method === "GET" && pathname.endsWith("/counts")) {
      res = await handleGetCounts(req);
    } else if (req.method === "POST" && pathname.endsWith("/read")) {
      res = await handleMarkRead(req);
    } else {
      res = Response.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(res.body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Decisions API Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleGetCounts(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const userEmail = url.searchParams.get("user_email");

  if (!userEmail) {
    return Response.json({ error: "user_email is required" }, { status: 400 });
  }

  const [{ data: reads }, { data: decisions }, { data: issueChats }] = await Promise.all([
    supabase
      .from("decision_reads")
      .select("issue_id, read_at")
      .eq("user_email", userEmail),
    supabase.from("decisions").select("id, issue_id, created_at"),
    supabase
      .from("issue_chats")
      .select("issue_id, last_message_at")
      .not("last_message_at", "is", null),
  ]);

  const readMap: Record<string, string> = {};
  for (const r of reads ?? []) {
    readMap[r.issue_id] = r.read_at;
  }

  const countByIssue: Record<string, number> = {};
  for (const d of decisions ?? []) {
    const lastRead = readMap[d.issue_id];
    if (!lastRead || new Date(d.created_at) > new Date(lastRead)) {
      countByIssue[d.issue_id] = (countByIssue[d.issue_id] ?? 0) + 1;
    }
  }

  // Include issues with unread chat messages
  for (const ic of issueChats ?? []) {
    const lastRead = readMap[ic.issue_id];
    if (!lastRead || new Date(ic.last_message_at) > new Date(lastRead)) {
      countByIssue[ic.issue_id] = (countByIssue[ic.issue_id] ?? 0) + 1;
    }
  }

  return Response.json({ countByIssue });
}

async function handleMarkRead(req: Request): Promise<Response> {
  const { issue_id, user_email } = await req.json();

  if (!issue_id || !user_email) {
    return Response.json(
      { error: "issue_id and user_email are required" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("decision_reads")
    .upsert(
      { issue_id, user_email, read_at: new Date().toISOString() },
      { onConflict: "issue_id,user_email" },
    );

  if (error) throw new Error(error.message);

  return Response.json({ success: true });
}
