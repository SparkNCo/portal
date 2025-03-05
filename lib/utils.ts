import { QueryResponse } from '@pinecone-database/pinecone';
import { clsx, type ClassValue } from 'clsx';
import OpenAI from 'openai';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const extractOpenAIContent = (data: {
  data: OpenAI.Chat.ChatCompletion | undefined;
}) => {
  try {
    const message = data?.data?.choices[0]?.message;
    if (!message) return null;
    if (message.content) {
      return JSON.parse(message?.content);
    } else if (message.function_call?.arguments) {
      return JSON.parse(message.function_call.arguments);
    }

    return null;
  } catch (error) {
    console.error('Error parsing OpenAI response:', error);
    return null;
  }
};

export const extractOpenAIEmbeddingContent = (data: {
  data: {
    data: OpenAI.Embedding[] | undefined;
  };
}) => {
  try {
    if (!Array.isArray(data?.data?.data) || data.data.data.length === 0) {
      return null;
    }
    const embedding = data.data.data[0]?.embedding;
    if (!embedding) return null;
    return embedding;
  } catch (error) {
    console.error('Error parsing OpenAI response:', error);
    return null;
  }
};

export const extractPineconeMatchesContent = (data: {
  data: QueryResponse;
}) => {
  const matches = data?.data?.matches;
  if (!matches || matches.length === 0) return [];
  return matches;
};
