import OpenAI from "openai";

export type GPTResponseBody = {
  model: "gpt-4o-2024-08-06";
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  messages: OpenAI.Chat.Completions.ChatCompletionMessage[];
  response_format?: "json" | "text";
};
