// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { createQuestion } from "./createQuestion.ts";
import { getQuestions } from "./getQuestions.ts";
import { markRead } from "./markRead.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const pathname = new URL(req.url).pathname;
    let res: Response;

    if (req.method === "GET") {
      res = await getQuestions(req);
    } else if (req.method === "POST" && pathname.endsWith("/read")) {
      res = await markRead(req);
    } else if (req.method === "POST") {
      res = await createQuestion(req);
    } else {
      res = Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    return new Response(res.body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[issue-questions Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
