'use server';

import { supabase } from '@/lib/supabase/client';
import { generateClientAssistantPrompt } from '../openai/generate-prompts';
import { getGPTDefaultValues } from '../openai/get-default-values';
import create_feature_output from '@/response-formats/create-feature-output.json';
import report_bug_output from '@/response-formats/report-bug-output.json';
import {
  extractOpenAIContent,
  extractOpenAIEmbeddingContent,
  extractPineconeMatchesContent,
} from '@/lib/utils';
import { getPineconeDefaultValues } from '../pinecone/get-default-values';
export type SearchFormData = {
  query: string;
  selectedOptions: string[];
};

export async function callAssistantFn(formData: FormData): Promise<{
  error: string | null;
  matches?: any[] | null;
  success: string | null;
  type: 'feature' | 'bug' | null;
}> {
  const {
    query,
    selectedOption,
    filterByStatus,
    searchAttachments,
    sortResults,
    priority,
  } = parseFormData(formData);

  const { systemPrompt, userPrompt } = generateClientAssistantPrompt({
    priority: priority,
    option: selectedOption,
    input: query,
  });
  const functions = generateFunctionsArray();
  const body = getGPTDefaultValues({
    messages: [{ role: 'system', content: systemPrompt }],
    functions,
    prompt: userPrompt,
  });
  if (!body) {
    console.log('body empty', body);
    return {
      success: null,
      type: null,
      error:
        'There was an error processing your request. Please try again later.',
    };
  }
  const response = await invokeOpenAI(body);
  if (!response) {
    return {
      success: null,
      type: null,
      error:
        'There was an error processing your request. Please try again later.',
    };
  }

  const embedding = await handleEmbedding(response.description);
  if (!embedding) {
    return {
      type: null,
      success: null,
      error:
        'There was an error processing your request. Please try again later.',
    };
  }

  const matches = await queryPinecone(embedding);
  if (!matches) {
    return {
      success: null,
      type: null,
      error:
        'There was an error processing your request. Please try again later.',
    };
  }
  return {
    success: getTitleMessage(response?.type),
    error: null,
    matches,
    type: response?.type,
  };
}

function parseFormData(formData: FormData) {
  const query = formData.get('query') as string;
  const selectedOption = formData.get('selectedOption') as string;
  const filterByStatus = formData.get('filterByStatus');
  const searchAttachments = formData.get('searchAttachments');
  const sortResults = formData.get('sortResults');
  const priority = formData.get('priority') as string;

  return {
    query,
    selectedOption,
    filterByStatus,
    searchAttachments,
    sortResults,
    priority,
  };
}

async function invokeOpenAI(body: any): Promise<{
  title: string;
  description: string;
  priority: string;
  type: 'feature' | 'bug';
} | null> {
  const { data, error: openaiError } = await supabase.functions.invoke(
    'openai',
    { body }
  );
  if (openaiError) {
    console.log('Error while calling OPENAI:', openaiError);
    return null;
  }
  return extractOpenAIContent(data);
}

async function handleEmbedding(description: string) {
  const bodyEmbedding = getGPTDefaultValues({
    input: description,
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

async function queryPinecone(embedding: any) {
  const { data: pineconeResponse, error: pineconeEmbeddingError } =
    await supabase.functions.invoke('pinecone', {
      body: getPineconeDefaultValues({
        endpoint: 'query',
        index: 'portal',
        vector: embedding,
      }),
    });
  if (pineconeEmbeddingError) {
    console.log(' Error while calling Pinecone:', pineconeEmbeddingError);
    return null;
  }
  return extractPineconeMatchesContent(pineconeResponse);
}

const generateFunctionsArray = () => {
  return [create_feature_output, report_bug_output];
};

const getTitleMessage = (type: string) => {
  switch (type) {
    case 'bug':
      return 'Is your bug similar to one of these?';
    default:
      return 'Does your request matches one of these?';
  }
};
