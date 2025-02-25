import { supabase } from '@/lib/supabase/client';
import { ProposalFeature } from '@/lib/types/db/proposal_features';
import { UpdateReponseType } from '@/lib/types/utils/functions-return-type';
import { getErrorMessage } from '@/utils/helpers';

export const updateProposalFeatureById = async (
  id: string,
  data: Partial<ProposalFeature>
): Promise<UpdateReponseType> => {
  const { error } = await supabase
    .from('proposal_features')
    .update(data)
    .eq('id', id);

  if (error) {
    const errorMessage = getErrorMessage(error);
    console.error(
      'Error updating data in proposal_features table:',
      errorMessage
    );
    return {
      error:
        'There was an error while updating the feature. Please try again later.',
      success: null,
    };
  }
  return {
    success: 'Feature updated successfully',
    error: null,
  };
};
