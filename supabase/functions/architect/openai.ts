// @ts-nocheck

// Thin wrapper over the OpenAI Responses API, matching the client used by the
// other AI functions in this repo (debounce/analyze-idea.ts,
// suggested-features/generateSuggestion.ts): plain fetch + OPENAI_API_KEY +
// structured JSON-schema output.

type StructuredCallArgs = {
  model: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
};

export async function callStructuredOpenAI<T = unknown>({
  model,
  input,
  schemaName,
  schema,
}: StructuredCallArgs): Promise<T> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          schema,
        },
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI error: ${errorText}`);
  }

  const data = await res.json();
  const raw = data.output?.[0]?.content?.[0]?.text;
  if (!raw) throw new Error("OpenAI returned no structured output");
  return JSON.parse(raw) as T;
}
