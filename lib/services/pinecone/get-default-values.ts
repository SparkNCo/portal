import { PineconeResponseBody } from '@/utils/types';

type Params = {
  index: PineconeResponseBody['index'];
  endpoint: PineconeResponseBody['endpoint'];
};

export type PineconeDefaultValuesReturnObject = {
  params: Params;
  body: Partial<PineconeResponseBody>;
};
export const getPineconeDefaultValues = ({
  endpoint = 'vectors/upsert',
  index = 'portal',
  vectors,
  vector,
  includeMetadata = true,
  includeValues = true,
  topK = 3,
}: PineconeResponseBody): PineconeDefaultValuesReturnObject => {
  const params = {
    endpoint,
    index,
  };
  if (endpoint == 'vectors/update') {
    const vector = vectors?.[0];
    const { metadata, ...restVector } = vector || {};
    return {
      params,
      body: {
        ...restVector,
        //For updates, the metadata object needs to be renamed to setMetadata.
        setMetadata: metadata,
        includeMetadata,
        includeValues,
      },
    };
  }
  const body = {
    ...(endpoint == 'query' && { topK }),
    ...(vector && { vector }),
    ...(vectors && { vectors }),
    includeMetadata,
    includeValues,
  };
  return {
    params,
    body,
  };
};
