import { supabase } from '@/lib/supabase/client';
import { Proposal } from '@/lib/types/db/proposals';
import { UpdateReponseType } from '@/lib/types/utils/functions-return-type';
import { getErrorMessage } from '@/utils/helpers';

export const updateProposalById = async (
  id: string,
  data: Partial<Proposal>
): Promise<UpdateReponseType> => {
  const { error } = await supabase.from('proposals').update(data).eq('id', id);

  if (error) {
    const errorMessage = getErrorMessage(error);
    console.error('Error updating data in proposals table:', errorMessage);
    return {
      error:
        'There was an error while updating the proposal. Please try again later.',
      success: null,
    };
  }
  return {
    success: 'Proposal updated successfully',
    error: null,
  };
};
