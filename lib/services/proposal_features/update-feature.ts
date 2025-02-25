'use server';
import {
  InsertReponseType,
  UpdateReponseType,
} from '@/lib/types/utils/functions-return-type';
import { parseFormData } from '@/utils/helpers';

import { Proposal } from '@/lib/types/db/proposals';
import { updateProposalById } from '@/lib/repositories/proposals/update';
import { revalidatePath } from 'next/cache';
import { ProposalFeature } from '@/lib/types/db/proposal_features';
import { updateProposalFeatureById } from '@/lib/repositories/proposal_features/update';

export const updateProposalFeatureFn = async (
  formData: FormData
): Promise<UpdateReponseType> => {
  const {
    feature_name,
    feature_description,
    feature_priority,
    feature_id,
    id: proposal_id,
  }: Partial<ProposalFeature & { feature_id: string }> = parseFormData(
    formData,
    'values'
  );

  if (!feature_id) {
    return {
      error: 'Proposal feature not found',
      success: null,
    };
  }

  const featureData = {
    feature_name,
    feature_description,
    feature_priority,
  };
  const { error } = await updateProposalFeatureById(feature_id, featureData);
  if (error) {
    return {
      error: error,
      success: null,
    };
  }
  revalidatePath(`/proposals/${proposal_id}`);
  return {
    error: null,
    success: 'Proposal updated successfully',
  };
};
