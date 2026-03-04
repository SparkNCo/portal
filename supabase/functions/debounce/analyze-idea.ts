// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";

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

    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
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
          },
        },
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      throw new Error(errorText);
    }

    const data = await openAIResponse.json();

    // Extract structured output safely
    const raw = data.output?.[0]?.content?.[0]?.text;
    const parsed = JSON.parse(raw);

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
