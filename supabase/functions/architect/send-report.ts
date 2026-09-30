// @ts-nocheck
import { Resend } from "https://esm.sh/resend@3";
import { corsHeaders } from "../utils/headers.ts";
import { clampPriority } from "./catalogues.ts";
import { callStructuredOpenAI } from "./openai.ts";

type Answers = {
  productIdea: string;
  buildTypes: string[];
  functionalities: string[];
  languages: string[];
  frameworks: string[];
  hosting: string[];
  priority: { x: number; y: number };
};

function normalizeAnswers(raw: any): Answers {
  return {
    productIdea: typeof raw?.productIdea === "string" ? raw.productIdea : "",
    buildTypes: Array.isArray(raw?.buildTypes) ? raw.buildTypes : [],
    functionalities: Array.isArray(raw?.functionalities)
      ? raw.functionalities
      : [],
    languages: Array.isArray(raw?.languages) ? raw.languages : [],
    frameworks: Array.isArray(raw?.frameworks) ? raw.frameworks : [],
    hosting: Array.isArray(raw?.hosting) ? raw.hosting : [],
    priority: clampPriority(raw?.priority),
  };
}

function buildPrompt(args: {
  stackName: string;
  reasoning: string;
  writeup: string;
  answers: Answers;
}): string {
  const { stackName, reasoning, writeup, answers } = args;
  const list = (values: string[]) =>
    values.length ? values.join(", ") : "(none specified)";

  return `You are a senior consultant at Spark & Co writing a short, warm architecture-diagnostic report email to a founder who just completed the quiz.

Recommended template stack: ${stackName}
Internal reasoning: ${reasoning}
Founder-facing writeup: ${writeup}

Their answers:
- Product idea: ${answers.productIdea || "(not provided)"}
- Build types: ${list(answers.buildTypes)}
- Functionalities: ${list(answers.functionalities)}
- Languages: ${list(answers.languages)}
- Frameworks: ${list(answers.frameworks)}
- Hosting: ${list(answers.hosting)}
- Priority marker: x=${answers.priority.x} (customizability<->speed), y=${answers.priority.y} (integrated<->portability)

Write:
- "subject": a concise, specific email subject line referencing their recommended stack.
- "bodyHtml": a clean, self-contained HTML email body (inline styles only, no <html>/<head> wrapper) that thanks them, restates their idea in one line, presents "${stackName}" as the recommended starting point, weaves in the writeup, and closes with a light call to action to talk to Spark & Co. Keep it skimmable and under ~250 words.
- "bodyText": a plain-text version of the same email.`;
}

async function generateReportContent(args: {
  stackName: string;
  reasoning: string;
  writeup: string;
  answers: Answers;
}) {
  return await callStructuredOpenAI<{
    subject: string;
    bodyHtml: string;
    bodyText: string;
  }>({
    model: "gpt-4.1",
    input: buildPrompt(args),
    schemaName: "architect_report_email",
    schema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        bodyHtml: { type: "string" },
        bodyText: { type: "string" },
      },
      required: ["subject", "bodyHtml", "bodyText"],
      additionalProperties: false,
    },
  });
}

export async function sendReport(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const stackName = typeof body?.stackName === "string" ? body.stackName : "";
    const reasoning = typeof body?.reasoning === "string" ? body.reasoning : "";
    const writeup = typeof body?.writeup === "string" ? body.writeup : "";
    const answers = normalizeAnswers(body?.answers ?? {});

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

    // AI inference: compose the personalised report email from the diagnostic.
    const report = await generateReportContent({
      stackName,
      reasoning,
      writeup,
      answers,
    });

    // Deliver via Resend, matching the pattern used elsewhere in this repo
    // (e.g. project-requests/sendProjectRequestMail.ts). If email isn't
    // configured we still return ok:true so the flow completes, with
    // delivered:false signalling the report wasn't sent.
    let delivered = false;
    const resendKey = Deno.env.get("RESEND_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL");

    if (resendKey && fromEmail) {
      try {
        const resend = new Resend(resendKey);
        const result = await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: report.subject || `Your Spark & Co architecture report`,
          html: report.bodyHtml,
          text: report.bodyText,
        });
        delivered = !result?.error;
        if (result?.error) {
          console.error("[architect-send-report] resend error", result.error);
        }
      } catch (sendErr) {
        console.error("[architect-send-report] send failed", sendErr);
      }
    } else {
      console.warn(
        "[architect-send-report] RESEND_KEY/FROM_EMAIL not set; skipping send",
      );
    }

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
