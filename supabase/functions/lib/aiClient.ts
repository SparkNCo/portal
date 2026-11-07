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
function withoutTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") {
    end--;
  }
  return url.slice(0, end);
}
const AI_BASE_URL = withoutTrailingSlashes(Deno.env.get("AI_BASE_URL")?.trim() || "https://api.openai.com/v1");
const AI_API_KEY = Deno.env.get("AI_API_KEY")?.trim();
// Optional. How much a "thinking" model (Gemini flash/pro, OpenAI o-series,
// gpt-5) reasons before answering: e.g. "low", or "none" where the model
// allows it. Thinking can add tens of seconds per call. Unset = not sent, so
// models that don't accept the parameter (gpt-4.1-mini, Qwen) keep working.
const AI_REASONING_EFFORT = Deno.env.get("AI_REASONING_EFFORT")?.trim();
// Optional. Same provider, another model, tried once when AI_MODEL is still
// busy after the retries (e.g. gemini-2.5-flash behind gemini-3.8-flash).
const AI_FALLBACK_MODEL = Deno.env.get("AI_FALLBACK_MODEL")?.trim();

export function aiEnabled(): boolean {
  return !!AI_API_KEY;
}

export type JsonSchemaSpec = {
  name: string;
  schema: Record<string, unknown>;
};

// "Too many requests" / "overloaded, try later" (Gemini answers 503 "high
// demand" at peaks): worth retrying after a short wait.
const BUSY_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 3000];

// The provider stayed busy through every retry. Callers can show the message.
export class AiBusyError extends Error {
  readonly status: number;
  constructor(status: number) {
    super("The AI model is busy right now (high demand). Please try again in a minute.");
    this.status = status;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function requestBody(model: string, prompt: string, spec: JsonSchemaSpec): string {
  return JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    ...(AI_REASONING_EFFORT && { reasoning_effort: AI_REASONING_EFFORT }),
    response_format: {
      type: "json_schema",
      json_schema: { name: spec.name, strict: true, schema: spec.schema },
    },
  });
}

const isBusy = (res: Response) => BUSY_STATUSES.has(res.status);

// Posts the request; while the provider answers "busy", waits and tries again
// (one retry per entry in RETRY_DELAYS_MS, after `attempt`).
async function postWithRetry(model: string, body: string, attempt = 0): Promise<Response> {
  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_API_KEY}` },
    body,
  });
  if (res.ok || !isBusy(res) || attempt >= RETRY_DELAYS_MS.length) {
    return res;
  }
  await res.body?.cancel();
  console.warn(`[ai] ${AI_PROVIDER} ${model} answered ${res.status}, retrying`, { attempt: attempt + 1 });
  await wait(RETRY_DELAYS_MS[attempt]);
  return postWithRetry(model, body, attempt + 1);
}

// AI_MODEL with retries; if it's still busy and AI_FALLBACK_MODEL is set, that
// model once (no retries, so a busy provider doesn't keep the user waiting).
async function postWithFallback(prompt: string, spec: JsonSchemaSpec): Promise<Response> {
  const res = await postWithRetry(AI_MODEL, requestBody(AI_MODEL, prompt, spec));
  if (!AI_FALLBACK_MODEL || !isBusy(res)) {
    return res;
  }
  await res.body?.cancel();
  console.warn(`[ai] ${AI_MODEL} still busy, trying ${AI_FALLBACK_MODEL}`);
  return postWithRetry(AI_FALLBACK_MODEL, requestBody(AI_FALLBACK_MODEL, prompt, spec), RETRY_DELAYS_MS.length);
}

// Some providers (several Hugging Face ones) wrap the JSON in ```json fences
// or put a <think>…</think> block before it, even with a strict schema.
export function parseJsonContent(raw: string): unknown {
  const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error(`${AI_PROVIDER} returned something that isn't JSON`);
  }
}

// `prompt` becomes the sole user message; `spec` describes the strict JSON
// shape the caller needs back (each caller has its own — boolean flags for
// the debounce analyzers, title/description/milestoneId for suggestions).
export async function requestJson<T>(prompt: string, spec: JsonSchemaSpec): Promise<T> {
  if (!AI_API_KEY) throw new Error("AI features are disabled (no AI_API_KEY configured)");
  if (!AI_MODEL) throw new Error("AI features are disabled (no AI_MODEL configured)");

  const res = await postWithFallback(prompt, spec);

  if (!res.ok) {
    const errorText = await res.text();
    if (isBusy(res)) {
      console.error(`[ai] ${AI_PROVIDER} still busy after retries`, { status: res.status, body: errorText });
      throw new AiBusyError(res.status);
    }
    throw new Error(`${AI_PROVIDER} error: ${errorText}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error(`${AI_PROVIDER} returned no content`);
  return parseJsonContent(raw) as T;
}
