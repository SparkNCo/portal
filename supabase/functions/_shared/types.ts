// deno-lint-ignore-file no-explicit-any
export type GPTResponseBody = {
  model: "gpt-4o-2024-08-06";
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  messages: { role: "system" | "user" | "developer"; content: string }[];
  response_format?: Record<string, any>;
};
