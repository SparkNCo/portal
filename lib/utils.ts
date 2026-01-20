import { QueryResponse } from '@pinecone-database/pinecone';
import { clsx, type ClassValue } from 'clsx';
import OpenAI from 'openai';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const extractOpenAIContent = (data: {
  data: OpenAI.Chat.ChatCompletion | undefined;
}) => {
  try {
    const message = data?.data?.choices[0]?.message;
    if (!message) return null;

    const content = message.content?.trim();

    if (!content) return null;

    // Validate if the content is a JSON object
    if (content.startsWith('{') || content.startsWith('[')) {
      return JSON.parse(content);
    }

    // If it's not JSON, return the plain text
    return content;
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

dayjs.extend(relativeTime);

export const getTimeAgo = (createdAt: string) => {
  return dayjs(createdAt).fromNow();
};

export const getInitials = (name: string) => {
  const names = name.split(' ');
  let initials = names[0].substring(0, 1).toUpperCase();
  if (names.length > 1) {
    initials += names[names.length - 1].substring(0, 1).toUpperCase();
  }
  return initials;
};
