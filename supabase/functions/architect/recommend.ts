// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import {
  BUILD_TYPES,
  clampPriority,
  FRAMEWORKS,
  HOSTING,
  LANGUAGES,
  sanitizeToCatalogue,
} from "./catalogues.ts";
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

function buildPrompt(answers: Answers): string {
  const list = (values: string[]) =>
    values.length ? values.join(", ") : "(none specified)";
  const { x, y } = answers.priority;

  return `You are a principal software architect at Spark & Co, an expert consultancy. A founder has completed an architecture-diagnostic quiz. Recommend exactly ONE pre-built template stack that Spark & Co would start them on, tailored to their answers.

Founder's answers:
- Product idea: ${answers.productIdea || "(not provided)"}
- Build types: ${list(answers.buildTypes)}
- Functionalities: ${list(answers.functionalities)}
- Languages they know / want: ${list(answers.languages)}
- Frameworks they know / want: ${list(answers.frameworks)}
- Hosting preferences: ${list(answers.hosting)}
- Priority marker (x from -1 customizability to +1 speed of delivery): ${x}
- Priority marker (y from -1 integrated platform to +1 portability): ${y}

Produce a single template stack recommendation. Requirements:
- "name": a short, product-like name for the template stack (e.g. "Expo Native Starter").
- "tagline": one punchy sentence.
- "description": one or two sentences describing what the template includes.
- "languages", "frameworks", "hosting": choose ONLY from these catalogues (lowercase, verbatim):
  languages: ${LANGUAGES.join(", ")}
  frameworks: ${FRAMEWORKS.join(", ")}
  hosting: ${HOSTING.join(", ")}
- "best_for": which build types this template suits, chosen ONLY from: ${BUILD_TYPES.join(", ")}
- "sample_repo_url": a plausible https GitHub URL for the template, or null.
- "speed", "customizability", "portability", "integrated": integer scores from 1 to 5 that reflect the trade-offs of this stack. Make speed/customizability and integrated/portability consistent with the founder's priority marker.
- "reasoning": 1-3 sentences, addressed to the team, explaining why this stack fits the founder's constraints and priorities.
- "writeup": 2-4 sentences addressed to the founder ("we would start you on ..."), referencing their actual answers and that this is one of Spark & Co's pre-built template stacks.`;
}

export async function recommend(req: Request) {
  try {
    const answers = normalizeAnswers(await req.json().catch(() => ({})));

    const ai = await callStructuredOpenAI<{
      name: string;
      tagline: string;
      description: string;
      languages: string[];
      frameworks: string[];
      hosting: string[];
      best_for: string[];
      sample_repo_url: string | null;
      speed: number;
      customizability: number;
      portability: number;
      integrated: number;
      reasoning: string;
      writeup: string;
    }>({
      // Generating a coherent, grounded recommendation + writeup warrants the
      // more capable model (as in suggested-features/generateSuggestion.ts).
      model: "gpt-4.1",
      input: buildPrompt(answers),
      schemaName: "architect_recommendation",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          tagline: { type: "string" },
          description: { type: "string" },
          languages: {
            type: "array",
            items: { type: "string", enum: [...LANGUAGES] },
          },
          frameworks: {
            type: "array",
            items: { type: "string", enum: [...FRAMEWORKS] },
          },
          hosting: {
            type: "array",
            items: { type: "string", enum: [...HOSTING] },
          },
          best_for: {
            type: "array",
            items: { type: "string", enum: [...BUILD_TYPES] },
          },
          sample_repo_url: { type: ["string", "null"] },
          speed: { type: "integer", minimum: 1, maximum: 5 },
          customizability: { type: "integer", minimum: 1, maximum: 5 },
          portability: { type: "integer", minimum: 1, maximum: 5 },
          integrated: { type: "integer", minimum: 1, maximum: 5 },
          reasoning: { type: "string" },
          writeup: { type: "string" },
        },
        required: [
          "name",
          "tagline",
          "description",
          "languages",
          "frameworks",
          "hosting",
          "best_for",
          "sample_repo_url",
          "speed",
          "customizability",
          "portability",
          "integrated",
          "reasoning",
          "writeup",
        ],
        additionalProperties: false,
      },
    });

    const clampScore = (n: unknown) =>
      Math.max(1, Math.min(5, Math.round(Number(n) || 3)));

    const response = {
      stack: {
        // The stack id is a stable identifier we mint server-side rather than
        // trusting the model to produce a well-formed UUID.
        id: crypto.randomUUID(),
        name: ai.name,
        tagline: ai.tagline,
        description: ai.description,
        languages: sanitizeToCatalogue(ai.languages, LANGUAGES),
        frameworks: sanitizeToCatalogue(ai.frameworks, FRAMEWORKS),
        hosting: sanitizeToCatalogue(ai.hosting, HOSTING),
        best_for: sanitizeToCatalogue(ai.best_for, BUILD_TYPES),
        sample_repo_url:
          typeof ai.sample_repo_url === "string" && ai.sample_repo_url
            ? ai.sample_repo_url
            : null,
        speed: clampScore(ai.speed),
        customizability: clampScore(ai.customizability),
        portability: clampScore(ai.portability),
        integrated: clampScore(ai.integrated),
      },
      reasoning: ai.reasoning,
      writeup: ai.writeup,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("[architect-recommend]", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate a recommendation" }),
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
