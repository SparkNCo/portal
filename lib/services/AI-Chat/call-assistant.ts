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
import { handleEmbedding } from '../openai/get-embedding';
import { JiraIssueType } from '@/lib/types/services/jira';
export type SearchFormData = {
  query: string;
  selectedOptions: string[];
};

export async function callAssistantFn(formData: FormData): Promise<{
  error: string | null;
  matches?: any[] | null;
  success: string | null;
  type: JiraIssueType | null;
}> {
  const {
    query,
    selectedOption,
    filterByStatus,
    searchAttachments,
    sortResults,
    priority,
  } = parseFormData(formData);

  //Generate prompts for OpenAI based on user input and selected options
  const { systemPrompt, userPrompt } = generateClientAssistantPrompt({
    priority: priority,
    option: selectedOption,
    input: query,
  });
  // Generate available function schemas for OpenAI to format responses
  const functions = generateFunctionsArray();
  // Prepare the request body for OpenAI API with system prompt and available functions
  const body = getGPTDefaultValues({
    messages: [{ role: 'system', content: systemPrompt }],
    functions,
    prompt: userPrompt,
  });
  // Check if the request body is empty

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
  // Call OpenAI to analyze the user's request and determine issue type/details

  if (!response) {
    return {
      success: null,
      type: null,
      error:
        'There was an error processing your request. Please try again later.',
    };
  }

  const embedding = await handleEmbedding(response.description);
  // Generate vector embedding of the issue description for semantic search

  if (!embedding) {
    return {
      type: null,
      success: null,
      error:
        'There was an error processing your request. Please try again later.',
    };
  }

  const matches = await queryPinecone(embedding, response.type);
  // Search Pinecone vector database for similar existing issues

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
  type: JiraIssueType;
} | null> {
  const { data, error: openaiError } = await supabase.functions.invoke(
    'openai',
    { body }
  );
  // Call OpenAI through Supabase Edge Function to keep API key secure

  if (openaiError) {
    console.log('Error while calling OPENAI:', openaiError);
    return null;
  }
  return extractOpenAIContent(data);
}

async function queryPinecone(embedding: number[], issuetype: JiraIssueType) {
  const { data: pineconeResponse, error: pineconeEmbeddingError } =
    await supabase.functions.invoke('pinecone', {
      body: getPineconeDefaultValues({
        endpoint: 'query',
        index: 'portal',
        vector: embedding,
        filter: {
          issuetype: issuetype,
        },
      }),
    });
  // Query Pinecone through Supabase Edge Function to find similar issues

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
  // Generate appropriate message based on issue type
};
