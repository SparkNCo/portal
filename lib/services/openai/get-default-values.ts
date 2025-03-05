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
    response_format: functions?.length ? undefined : response_format,
    functions: functions?.length ? functions : undefined,
    messages: [
      ...messages,
      {
        role: 'user',
        content: prompt,
      },
    ],
    ...(functions?.length ? { function_call } : {}),
  };
};
