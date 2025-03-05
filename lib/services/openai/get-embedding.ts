import { extractOpenAIEmbeddingContent } from '@/lib/utils';
import { getGPTDefaultValues } from './get-default-values';
import { supabase } from '@/lib/supabase/client';

export async function handleEmbedding(input: string) {
  const bodyEmbedding = getGPTDefaultValues({
    input: input,
    model: 'text-embedding-ada-002',
    endpoint: 'embeddings',
  });
  if (!bodyEmbedding) return null;

  const { data: openaiEmbedding, error: openaiEmbeddingError } =
    await supabase.functions.invoke('openai', { body: bodyEmbedding });
  if (openaiEmbeddingError) {
    console.log(' Error while calling OPENAI embedding:', openaiEmbeddingError);
    return null;
  }
  return extractOpenAIEmbeddingContent(openaiEmbedding);
}
