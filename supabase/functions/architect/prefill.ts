// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";

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

    // TODO: map productIdea onto the option catalogues (lowercase values).
    const response = {
      buildTypes: [] as string[],
      functionalities: [] as string[],
      languages: [] as string[],
      frameworks: [] as string[],
      hosting: [] as string[],
      priority: { x: 0, y: 0 },
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
    return new Response(
      JSON.stringify({
        error: "Could not analyze that idea. You can fill the form manually.",
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
