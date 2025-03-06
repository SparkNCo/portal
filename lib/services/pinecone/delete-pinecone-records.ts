'use server';
import { UpdateReponseType } from '@/lib/types/utils/functions-return-type';
import { supabase } from '@/lib/supabase/client';
import { getPineconeDefaultValues } from './get-default-values';

export const deletePineconeRecords = async (
  ids: string[]
): Promise<UpdateReponseType> => {
  const body = getPineconeDefaultValues({
    index: 'portal',
    endpoint: 'vectors/delete',
    ids,
  });
  const { error: pineconeError } = await supabase.functions.invoke('pinecone', {
    body,
  });
  if (pineconeError) {
    console.log(pineconeError);
    return {
      error:
        'There was an error while executing the function. Please try again later.',
      success: null,
    };
  }

  return {
    error: null,
    success: 'Records deleted successfully!',
  };
};
