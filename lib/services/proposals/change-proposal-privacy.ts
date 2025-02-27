'use server';
import { updateProposalById } from '@/lib/repositories/proposals/update';
import { UpdateReponseType } from '@/lib/types/utils/functions-return-type';
import { revalidateTag } from 'next/cache';

export const changeProjectPrivacy = async (
  isPublic: boolean,
  proposalId: string
): Promise<UpdateReponseType> => {
  const { error } = await updateProposalById(proposalId, {
    public: !isPublic,
  });
  if (error) {
    return {
      success: null,
      error:
        'There was an error while updating the proposal. Please try again later.',
    };
  }
  revalidateTag('proposal');
  return {
    success: 'Proposal privacy changed!',
    error: null,
  };
};
