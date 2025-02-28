import { supabase } from '@/lib/supabase/client';
import { UpdateReponseType } from '@/lib/types/utils/functions-return-type';
import { getErrorMessage } from '@/utils/helpers';

export const deleteProposalFeatureById = async (
  id: string
): Promise<UpdateReponseType> => {
  if (!id) {
    return {
      error: 'Please, provide a valid ID.',
      success: null,
    };
  }
  const { error } = await supabase
    .from('proposal_features')
    .delete()
    .eq('id', id);

  if (error) {
    const errorMessage = getErrorMessage(error);
    console.error(
      'Error deleting data in proposal_features table:',
      errorMessage
    );
    return {
      error:
        'There was an error while deleting the feature. Please try again later.',
      success: null,
    };
  }
  return {
    success: 'Feature deleted successfully!',
    error: null,
  };
};
