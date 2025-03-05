import { PineconeResponseBody } from '@/utils/types';

type Params = {
  index: PineconeResponseBody['index'];
  endpoint: PineconeResponseBody['endpoint'];
};

export const getPineconeDefaultValues = ({
  endpoint = 'vectors/upsert',
  index = 'portal',
  vectors,
  vector,
  includeMetadata = true,
  includeValues = true,
  topK = 3,
}: PineconeResponseBody): {
  params: Params;
  body: Partial<PineconeResponseBody>;
} => {
  const params = {
    endpoint,
    index,
  };
  const body = {
    vectors,
    vector,
    includeMetadata,
    includeValues,
    topK,
  };
  return {
    params,
    body,
  };
};
