'use server';
import { generateProposalFeaturesPrompt } from '@/lib/services/openai/generate-prompts';
import { insertProposal } from '@/lib/repositories/proposals/insert';
import { InsertReponseType } from '@/lib/types/utils/functions-return-type';
import { getErrorMessage, parseFormData } from '@/utils/helpers';
import { v4 } from 'uuid';
import proposal_features_output from '@/response-formats/proposal-features-output.json';
import { supabase } from '@/lib/supabase/client';
import { Proposal } from '@/lib/types/db/proposals';
import { saveFeaturesFromOpenAI } from '../../proposal_features/save-features-from-openai';
import {
  OpenAIProposalFeature,
  OpenAIProposalFeaturesOutput,
} from '@/lib/types/utils/openai-outputs';
import { mock_edge_function_data, response } from '@/data';
import { sendSuccessEmailFn } from '../send-success-email';
import { revalidatePath } from 'next/cache';
import { getGPTDefaultValues } from '../../openai/get-default-values';

export const createProposalAndSaveFeaturesFn = async (
  formData: FormData
): Promise<InsertReponseType> => {
  const proposalId = v4();

  const values = parseFormData(formData, 'values');

  const proposalData = mock_edge_function_data as any;

  const { error } = await insertProposal({
    id: proposalId,
    business_name: proposalData.business_name,
    project_description: proposalData.project_description,
    client_email: proposalData.project_owner_email,
    client_name: proposalData.project_owner_name,
    client_phone: proposalData.project_owner_phone,
    project_requirements: proposalData.project_requirements,
    project_budget: proposalData.budget,
    project_requirements_description:
      proposalData.project_requirements_description,
    project_timeline: proposalData.timeline,
    project_status: proposalData.project_status,
  });
  if (error) {
    return {
      error: error,
      success: null,
    };
  }

  const gptPayload = getGPTPayload(proposalData);
  if (!gptPayload) {
    return {
      error: 'Error generating proposal features',
      success: null,
    };
  }
  //! Uncomment the following code to use the real openai data
  const { data, error: openaiError } = await supabase.functions.invoke(
    'openai',
    {
      body: gptPayload,
    }
  );
  if (openaiError) {
    console.log(getErrorMessage(openaiError));
    return {
      error: 'Error generating proposal features',
      success: null,
    };
  }
  const features: OpenAIProposalFeaturesOutput = JSON.parse(
    data?.data?.choices[0]?.message?.content
  );
  //! Uncomment the following line to use the mock data
  // const features = response;
  const { error: insertingProposalFeaturesError } =
    await saveFeaturesFromOpenAI({
      features: features.proposal_features,
      proposalId: proposalId,
    });

  if (insertingProposalFeaturesError) {
    console.log(insertingProposalFeaturesError);
    return {
      error: 'Error saving proposal features',
      success: null,
    };
  }
  const { error: emailError } = await sendSuccessEmailFn({
    call_date: '2023-01-01',
    client_email: proposalData.project_owner_email,
    client_name: proposalData.project_owner_name,
    proposal_id: proposalId,
  });
  if (emailError) {
    return {
      error: emailError,
      success: null,
    };
  }
  revalidatePath('/proposals');
  return {
    error: null,
    success: 'Proposal and features created. Email sent.',
  };
};

const destructureData = (values: any) => {
  const {
    project_owner_name,
    project_owner_email,
    project_owner_phone,
    business_name,
    project_status,
    project_description,
    project_requirements,
    budget,
    timeline,
  } = values;
  return {
    project_owner_name,
    project_owner_email,
    project_owner_phone,
    business_name,
    project_status,
    project_description,
    project_requirements,
    budget,
    timeline,
  };
};

const getGPTPayload = (proposalData: Partial<Proposal>) => {
  const prompt = generateProposalFeaturesPrompt(proposalData);

  return getGPTDefaultValues({
    prompt,
    messages: [
      {
        role: 'system',
        content: 'You are a professional software developer and architect.',
      },
    ],
    model: 'gpt-4o-2024-08-06',
    stream: false,
    temperature: 0,
    max_tokens: 4000,
    response_format: proposal_features_output,
  });
};
