// @ts-nocheck

import { corsHeaders } from "../utils/headers.ts";
import { requestJson } from "../lib/aiClient.ts";

export async function analyzeCurrentState(req: Request) {
  try {
    const { message } = await req.json();
    console.log("Received current state:", message);

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const prompt = `
You will receive a prospective client’s message describing their CURRENT BUSINESS STATE.

Analyze the input text and determine whether it contains enough information for each of the following four categories:

1. "user": who will use the system
2. "capability": what systems, tools, or capabilities already exist
3. "reason": why they are building or improving this now
4. "limitations": technical, budget, legal, or operational constraints

For each category, output true if the input clearly describes it, or false if it does not.

Return only a JSON object with these four keys and boolean values. Do not include any extra text.

Now analyze the following message:

${message}
`;

    const parsed = await requestJson<{
      user: boolean;
      capability: boolean;
      reason: boolean;
      limitations: boolean;
    }>(prompt, {
      name: "current_state_analysis",
      schema: {
        type: "object",
        properties: {
          user: { type: "boolean" },
          capability: { type: "boolean" },
          reason: { type: "boolean" },
          limitations: { type: "boolean" },
        },
        required: ["user", "capability", "reason", "limitations"],
        additionalProperties: false,
      },
    });

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[AnalyzeCurrentState Error]", error);

    return new Response(
      JSON.stringify({
        user: false,
        capability: false,
        reason: false,
        limitations: false,
      }),
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