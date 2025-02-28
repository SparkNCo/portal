'use server';
import { UpdateReponseType } from '@/lib/types/utils/functions-return-type';

import { revalidateTag } from 'next/cache';

import { deleteProposalFeatureById } from '@/lib/repositories/proposal_features/delete';

export const deleteFeatureFn = async (
  id: string
): Promise<UpdateReponseType> => {
  if (!id) {
    return {
      error: 'Proposal feature not found!',
      success: null,
    };
  }
  const { error, success } = await deleteProposalFeatureById(id);
  if (error) {
    return {
      error: error,
      success: null,
    };
  }
  revalidateTag(`proposal_features`);
  return {
    error: null,
    success: success,
  };
};
