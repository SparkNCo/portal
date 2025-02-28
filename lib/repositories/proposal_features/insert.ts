import { supabase } from '@/lib/supabase/client';
import { ProposalFeature } from '@/lib/types/db/proposal_features';
import { InsertReponseType } from '@/lib/types/utils/functions-return-type';
import { getErrorMessage } from '@/utils/helpers';

export const insertProposalFeatures = async (
  proposalFeature: Partial<ProposalFeature>
): Promise<InsertReponseType> => {
  const { data, error } = await supabase
    .from('proposal_features')
    .insert(proposalFeature);

  if (error) {
    const errorMessage = getErrorMessage(error);
    console.error(
      'Error inserting data in proposal_features table:',
      errorMessage
    );
    return {
      error:
        'There was an error while creating the feature. Please try again later.',
      success: null,
    };
  }
  return {
    success: 'Feature created successfully1',
    error: null,
  };
};
