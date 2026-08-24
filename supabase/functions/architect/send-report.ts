// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";

export async function sendReport(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const stackName = typeof body?.stackName === "string" ? body.stackName : "";
    const reasoning = typeof body?.reasoning === "string" ? body.reasoning : "";
    const writeup = typeof body?.writeup === "string" ? body.writeup : "";
    const answers = body?.answers ?? {};

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address." }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!stackName) {
      return new Response(JSON.stringify({ error: "Unknown stack." }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    void reasoning;
    void writeup;
    void answers;

    // TODO: capture the lead, generate PDF, send email.
    const delivered = false;

    return new Response(JSON.stringify({ ok: true, delivered }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("[architect-send-report]", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong sending your report." }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
}
