'use server';
import { generateProposalFeaturesPrompt } from '@/lib/generate-prompts';
import { insertProposal } from '@/lib/repositories/proposals/insert';
import { InsertReponseType } from '@/lib/types/utils/functions-return-type';
import { getErrorMessage, parseFormData } from '@/utils/helpers';
import { v4 } from 'uuid';

import { supabase } from '@/lib/supabase/client';
import { Proposal } from '@/lib/types/db/proposals';
import { updateProposalById } from '@/lib/repositories/proposals/update';
import { revalidatePath } from 'next/cache';
import { ProposalFeature } from '@/lib/types/db/proposal_features';

export const updateProposalFn = async (
  formData: FormData
): Promise<InsertReponseType> => {
  const {
    features,
    ...proposalData
  }: Partial<Proposal & { features: ProposalFeature[] }> = parseFormData(
    formData,
    'values'
  );
  if (!proposalData.id) {
    return {
      error: 'Proposal not found',
      success: null,
    };
  }
  const { error } = await updateProposalById(proposalData?.id, proposalData);
  if (error) {
    return {
      error: error,
      success: null,
    };
  }
  revalidatePath(`/proposals/${proposalData.id}`);
  return {
    error: null,
    success: 'Proposal updated successfully',
  };
};
