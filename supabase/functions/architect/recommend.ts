// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";

export async function recommend(req: Request) {
  try {
    const answers = await req.json().catch(() => ({}));

    const productIdea =
      typeof answers?.productIdea === "string" ? answers.productIdea : "";
    const buildTypes = Array.isArray(answers?.buildTypes)
      ? answers.buildTypes
      : [];
    const functionalities = Array.isArray(answers?.functionalities)
      ? answers.functionalities
      : [];
    const languages = Array.isArray(answers?.languages) ? answers.languages : [];
    const frameworks = Array.isArray(answers?.frameworks)
      ? answers.frameworks
      : [];
    const hosting = Array.isArray(answers?.hosting) ? answers.hosting : [];
    const priority = answers?.priority ?? {};
    const x = Number.isFinite(priority.x) ? Number(priority.x) : 0;
    const y = Number.isFinite(priority.y) ? Number(priority.y) : 0;

    void productIdea;
    void buildTypes;
    void functionalities;
    void languages;
    void frameworks;
    void hosting;
    void x;
    void y;

    // TODO: pick one template stack and generate reasoning + writeup.
    const response = {
      stack: {
        id: "00000000-0000-0000-0000-000000000000",
        name: "Placeholder Stack",
        tagline: "Replace this with a real template stack.",
        description: "A pre-built template stack.",
        languages: ["typescript"],
        frameworks: ["next.js"],
        hosting: ["vercel"],
        best_for: ["web application"],
        sample_repo_url: null as string | null,
        speed: 3,
        customizability: 3,
        portability: 3,
        integrated: 3,
      },
      reasoning: "Placeholder reasoning for why this stack was chosen.",
      writeup:
        "Placeholder writeup shown on the result step. Reference the founder's answers and that this is one of your pre-built template stacks.",
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
