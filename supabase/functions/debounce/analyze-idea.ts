// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { requestJson } from "../lib/aiClient.ts";

export async function analyzeIdea(req: Request) {
  try {
    const { message } = await req.json();
    console.log("Received message analyzeIdea:", message);

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
You will receive a prospective client’s message describing their product idea and business.

Analyze the input text and determine whether it contains enough information for each of the following four categories:

1. "audience": the target audience for the product
2. "problem": the problem the product solves
3. "idea": a high-level description of what the product does
4. "stage": the stage of the business' development

For each category, output true if the input clearly describes it, or false if it does not.

Return only a JSON object with these four keys and boolean values. Do not include any extra text.

Now analyze the following prospective client message:

${message}
`;

    const parsed = await requestJson<{
      audience: boolean;
      problem: boolean;
      idea: boolean;
      stage: boolean;
    }>(prompt, {
      name: "idea_analysis",
      schema: {
        type: "object",
        properties: {
          audience: { type: "boolean" },
          problem: { type: "boolean" },
          idea: { type: "boolean" },
          stage: { type: "boolean" },
        },
        required: ["audience", "problem", "idea", "stage"],
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
    console.error("[AnalyzeIdea Error]", error);

    return new Response(
      JSON.stringify({
        audience: false,
        problem: false,
        idea: false,
        stage: false,
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
