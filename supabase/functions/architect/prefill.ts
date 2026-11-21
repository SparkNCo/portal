// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import {
  BUILD_TYPES,
  clampPriority,
  FRAMEWORKS,
  FUNCTIONALITIES,
  HOSTING,
  LANGUAGES,
  sanitizeToCatalogue,
} from "./catalogues.ts";
import { callStructuredOpenAI } from "./openai.ts";

function buildPrompt(productIdea: string): string {
  return `You are an expert software architect helping a founder pre-fill an architecture-diagnostic form based on a free-text product idea.

Read the product idea and map it onto the fixed option catalogues below. Only ever return values that appear verbatim in these catalogues (all lowercase). Select every option that is clearly implied by the idea, but do not invent requirements that are not supported by the text. It is fine to leave an array empty when nothing applies.

buildTypes: ${BUILD_TYPES.join(", ")}
functionalities: ${FUNCTIONALITIES.join(", ")}
languages: ${LANGUAGES.join(", ")}
frameworks: ${FRAMEWORKS.join(", ")}
hosting: ${HOSTING.join(", ")}

Also infer a "priority" marker on a square where:
- x ranges from -1 (the founder values deep customizability) to +1 (they value speed of delivery)
- y ranges from -1 (they prefer an integrated all-in-one platform) to +1 (they prefer portability across vendors)
If the idea gives no signal about a priority axis, return 0 for it.

Product idea:
${productIdea}`;
}

export async function prefill(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const productIdea =
      typeof body?.productIdea === "string" ? body.productIdea.trim() : "";

    if (productIdea.length < 10) {
      return new Response(
        JSON.stringify({
          error: "Please describe your product idea in a bit more detail.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const enumArray = (catalogue: readonly string[]) => ({
      type: "array",
      items: { type: "string", enum: [...catalogue] },
    });

    const ai = await callStructuredOpenAI<{
      buildTypes: string[];
      functionalities: string[];
      languages: string[];
      frameworks: string[];
      hosting: string[];
      priority: { x: number; y: number };
    }>({
      // Mapping free text onto closed catalogues is a light classification task,
      // so the cheaper model (as in debounce/analyze-idea.ts) is plenty.
      model: "gpt-4.1-mini",
      input: buildPrompt(productIdea),
      schemaName: "architect_prefill",
      schema: {
        type: "object",
        properties: {
          buildTypes: enumArray(BUILD_TYPES),
          functionalities: enumArray(FUNCTIONALITIES),
          languages: enumArray(LANGUAGES),
          frameworks: enumArray(FRAMEWORKS),
          hosting: enumArray(HOSTING),
          priority: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
            },
            required: ["x", "y"],
            additionalProperties: false,
          },
        },
        required: [
          "buildTypes",
          "functionalities",
          "languages",
          "frameworks",
          "hosting",
          "priority",
        ],
        additionalProperties: false,
      },
    });

    const response = {
      buildTypes: sanitizeToCatalogue(ai.buildTypes, BUILD_TYPES),
      functionalities: sanitizeToCatalogue(ai.functionalities, FUNCTIONALITIES),
      languages: sanitizeToCatalogue(ai.languages, LANGUAGES),
      frameworks: sanitizeToCatalogue(ai.frameworks, FRAMEWORKS),
      hosting: sanitizeToCatalogue(ai.hosting, HOSTING),
      priority: clampPriority(ai.priority),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("[architect-prefill]", err);
    // Degrade gracefully: the form is fully usable without a prefill, so hand
    // back empty selections and a neutral priority instead of failing the step.
    return new Response(
      JSON.stringify({
        buildTypes: [],
        functionalities: [],
        languages: [],
        frameworks: [],
        hosting: [],
        priority: { x: 0, y: 0 },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
}
