import { GPTResponseBody } from '@/utils/types';

type Params = Partial<GPTResponseBody> & {
  prompt?: string;
};

export const getGPTDefaultValues = ({
  messages = [
    {
      role: 'system',
      content:
        'You are a professional software developer and software architect.',
    },
  ],
  model = 'gpt-4o-2024-08-06',
  stream = false,
  temperature = 0,
  endpoint = 'chat/completions',
  max_tokens = 1500,
  functions,
  response_format = {},
  prompt,
  input,
  function_call = 'auto',
}: Params): Partial<GPTResponseBody> | null => {
  if (input) {
    return {
      endpoint,
      model,
      input,
    };
  }
  if (!prompt) return null;

  return {
    endpoint,
    model,
    stream,
    temperature,
    max_tokens,
    ...(functions?.length ? { functions } : {}),
    ...(response_format && !functions?.length ? { response_format } : {}),
    ...(functions?.length ? { function_call } : {}),
    messages: [
      ...messages,
      {
        role: 'user',
        content: prompt,
      },
    ],
  };
};
