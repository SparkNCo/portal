import { GPTResponseBody } from "./types.ts";
type Params = Partial<GPTResponseBody> & {
  prompt: string;
};
export const getGPTDefaultValues = ({
  messages = [
    {
      role: "developer",
      content:
        "You are a professional software developer and software architect.",
    },
  ],
  model = "gpt-4o-2024-08-06",
  stream = false,
  temperature = 0,
  max_tokens = 1500,
  response_format = {},
  prompt,
}: Params): GPTResponseBody | null => {
  if (!prompt) return null;
  return {
    model,
    stream,
    temperature,
    max_tokens,
    response_format,
    messages: [
      ...messages,
      {
        role: "user",
        content: prompt,
      },
    ],
  };
};
