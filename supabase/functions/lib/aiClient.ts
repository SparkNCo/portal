// @ts-nocheck
// Shared LLM client for every edge function (debounce analyzers, suggested-features).
// Config comes from AI_PROVIDER / AI_MODEL / AI_BASE_URL / AI_API_KEY — see
// docs/PORTAL_DOCS.md §12. No AI_API_KEY = AI disabled: requestJson throws and
// callers fall back gracefully.
//
// Raw fetch against the OpenAI-compatible /chat/completions API on purpose:
// the `aisuite` package drops `response_format`, and every caller here needs
// strict schema-enforced JSON.
const AI_PROVIDER = (Deno.env.get("AI_PROVIDER") || "openai").trim();
const AI_MODEL = Deno.env.get("AI_MODEL")?.trim();
const AI_BASE_URL = (Deno.env.get("AI_BASE_URL")?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
const AI_API_KEY = Deno.env.get("AI_API_KEY")?.trim();

export function aiEnabled(): boolean {
  return !!AI_API_KEY;
}

export type JsonSchemaSpec = {
  name: string;
  schema: Record<string, unknown>;
};

// `prompt` becomes the sole user message; `spec` describes the strict JSON
// shape the caller needs back (each caller has its own — boolean flags for
// the debounce analyzers, title/description/milestoneId for suggestions).
export async function requestJson<T>(prompt: string, spec: JsonSchemaSpec): Promise<T> {
  if (!AI_API_KEY) throw new Error("AI features are disabled (no AI_API_KEY configured)");
  if (!AI_MODEL) throw new Error("AI features are disabled (no AI_MODEL configured)");

  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: { name: spec.name, strict: true, schema: spec.schema },
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`${AI_PROVIDER} error: ${errorText}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error(`${AI_PROVIDER} returned no content`);
  return JSON.parse(raw) as T;
}
