export type GPTResponseBody = {
  model: 'gpt-4o-2024-08-06' | 'text-embedding-ada-002';
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  input?: string;
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
  response_format?: Record<string, any>;
  endpoint: 'embeddings' | 'chat/completions';
  functions?: Record<string, any>[];
  function_call?: 'auto';
};

export type PineconeResponseBody = {
  endpoint: 'vectors/upsert' | 'query';
  vector?: number[];
  includeMetadata?: boolean;
  includeValues?: boolean;
  topK?: number;
  index: 'portal';
  vectors?: {
    id: string;
    values: number[];
    metadata: Record<string, any>;
  }[];
};
