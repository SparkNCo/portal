'use server';
import {
  InsertReponseType,
  UpdateReponseType,
} from '@/lib/types/utils/functions-return-type';
import { parseFormData } from '@/utils/helpers';

import { Proposal } from '@/lib/types/db/proposals';
import { updateProposalById } from '@/lib/repositories/proposals/update';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ProposalFeature } from '@/lib/types/db/proposal_features';
import { updateProposalFeatureById } from '@/lib/repositories/proposal_features/update';
import { insertProposalFeatures } from '@/lib/repositories/proposal_features/insert';

export const addProposalFeatureFn = async (
  formData: FormData
): Promise<UpdateReponseType> => {
  const {
    feature_name,
    feature_description,
    feature_priority,
    feature_notes,
    id: proposal_id,
  }: Partial<ProposalFeature> = parseFormData(formData, 'values');
  const featureData = {
    feature_name,
    feature_description,
    feature_priority,
    feature_notes,
    proposal_id,
  };
  const { error, success } = await insertProposalFeatures(featureData);
  if (error) {
    return {
      error: error,
      success: null,
    };
  }
  revalidateTag(`proposal_features`);
  return {
    error: null,
    success,
  };
};
