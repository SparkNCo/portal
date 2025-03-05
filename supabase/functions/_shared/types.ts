// deno-lint-ignore-file no-explicit-any
export type GPTResponseBody = {
  model: 'gpt-4o-2024-08-06' | 'text-embedding-ada-002';
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
  response_format?: Record<string, any>;
  endpoint: 'v1/embeddings' | 'chat/completions';
};
