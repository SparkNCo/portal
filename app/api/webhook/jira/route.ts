import { handleEmbedding } from '@/lib/services/openai/get-embedding';
import {
  getPineconeDefaultValues,
  PineconeDefaultValuesReturnObject,
} from '@/lib/services/pinecone/get-default-values';
import { supabase } from '@/lib/supabase/client';
import {
  ExtractedIssueData,
  JiraWebhookResponse,
} from '@/lib/types/services/jira';

import { PineconeResponseBody, VectorType } from '@/utils/types';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body: JiraWebhookResponse = await req.json();
    const event = body.webhookEvent;
    //This is the issue ID
    const issueKey = body.issue.key;
    //I initialize all the values to avoid repeating code in each condition.
    let endpoint: PineconeResponseBody['endpoint'] = 'vectors/upsert';
    //extract all the values and assign them to the variables.
    const { metadata, getEmbeddingAgain } = extractJiraIssueData(body);
    let vectors: VectorType[] = [
      {
        id: issueKey,
        metadata,
      },
    ];
    const embeddingValue = `${metadata?.summary}. ${metadata?.description}`;
    //!----------------CREATED---------------------
    if (event == 'jira:issue_created') {
      // const metadata = extractJiraIssueDataForCreation(body);
      const embedding = await handleEmbedding(embeddingValue);
      if (!embedding)
        return NextResponse.json({
          error:
            'There was an error while getting the embedding. Please try again later.',
        });
      vectors[0].values = embedding;
    }
    //!----------------UPDATED---------------------
    if (event == 'jira:issue_updated') {
      //If its an update, then change the endpoint
      endpoint = 'vectors/update';
      // If this is true, then we need to get the embedding again because either the summary or the description has changed.
      if (getEmbeddingAgain) {
        const embeddingValue = `${metadata.summary}. ${metadata.description}`;
        const embedding = await handleEmbedding(embeddingValue);
        if (!embedding)
          return NextResponse.json({
            error:
              'There was an error while getting the embedding. Please try again later.',
          });
        vectors[0].values = embedding;
      }
    }
    //!----------------UPDATED---------------------
    if (event == 'jira:issue_deleted') {
      //If the user deleted an issue, we keep the update endpoint because we'll be doing an update in the metadata object, not deleting the row. We just add "deletedAt" and "deleted" to the metadata object.
      endpoint = 'vectors/update';
      vectors[0].metadata = {
        deletedAt: new Date().toISOString(),
        deleted: true,
        status: 'Deleted',
      };
    }

    //Then at the end we get the body to send to pinecone
    const pineconeBody = getPineconeDefaultValues({
      endpoint: endpoint,
      //I need to define what to do with the index for each project later.
      index: 'portal',
      vectors: vectors,
    });
    const { error: pineconeError } = await supabase.functions.invoke(
      'pinecone',
      { body: pineconeBody }
    );
    if (pineconeError) {
      console.log(pineconeError);
      return NextResponse.json({
        error: 'Pinecone error. Please try again later.',
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Jira webhook:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

function extractJiraIssueData(body: JiraWebhookResponse): {
  getEmbeddingAgain: boolean;
  metadata: Partial<ExtractedIssueData>;
} {
  const items = body?.changelog?.items;
  const created = body?.issue?.fields?.created;
  const issuetype = body?.issue?.fields?.issuetype?.name;
  const project = body?.issue?.fields?.project?.key;
  const metadata: Partial<ExtractedIssueData> = {};
  let getEmbeddingAgain = false;
  const filterValues = ['resolution'];
  const conditionsToGetNewEmbedding = ['description', 'summary'];
  // Iterate over changelog items to collect changes

  items?.forEach((item) => {
    // Only include fields that have actually changed. For creations, this will always be true because it changes from null to something
    const to = item.toString;
    const from = item.fromString;
    const fieldChanged = from !== to;
    const field = item.fieldId;
    if (fieldChanged && to && !filterValues.includes(field)) {
      if (conditionsToGetNewEmbedding.includes(field)) {
        getEmbeddingAgain = true;
      }
      //@ts-ignore
      metadata[field] = to;
    }
  });

  metadata.createdAt = created;
  metadata.issuetype = issuetype;
  metadata.project = project;
  return {
    getEmbeddingAgain,
    metadata,
  };
}
