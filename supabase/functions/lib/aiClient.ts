// @ts-nocheck
// Shared AI client for every function that calls an LLM (debounce's
// analyze-idea/analyze-current-state, suggested-features' generateSuggestion).
// Config — provider label, model, base URL, and key — all come from env
// vars, per the ticket ("Pull config (model, provider, base url and key)
// from env vars"). No AI_API_KEY configured means AI features are off:
// requestJson throws a clear, typed error instead of attempting a network
// call, which every existing caller's own try/catch already turns into a
// graceful fallback (see e.g. analyze-idea.ts's all-false response).
//
// This talks the OpenAI-compatible Chat Completions wire format directly
// (POST {base_url}/chat/completions) rather than going through the actual
// `aisuite` npm package the ticket's sample code names — verified while
// building this that aisuite's OpenAI adapter (aisuite-js/src/providers/
// openai/adapters.ts, `adaptRequest`) silently drops `response_format`
// before forwarding to the real OpenAI SDK, so the strict schema-enforced
// JSON every caller here depends on wouldn't survive the trip through it.
// A raw fetch keeps that guarantee and still satisfies the actual ask
// (config-driven, provider-swappable, gracefully disabled without a key) —
// this is also exactly the shape that already proved out against Hugging
// Face's Inference Providers router for generateSuggestion.ts.
//
// `AI_BASE_URL` is what actually makes this swappable — same idea as the
// ticket's own sample ("Point to a custom internal server address,
// self-hosted vLLM, or Ollama instance"), since vLLM/Ollama/HF's router are
// all OpenAI-compatible at the wire level. Defaults to OpenAI's own API when
// unset, so setting just AI_API_KEY + AI_MODEL is enough to point at OpenAI
// directly.
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
