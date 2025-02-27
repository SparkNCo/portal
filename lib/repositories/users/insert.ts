import { supabase } from '@/lib/supabase/client';
import { User } from '@/lib/types/db/user';
import { InsertReponseType } from '@/lib/types/utils/functions-return-type';
import { getErrorMessage } from '@/utils/helpers';

export const insertUser = async (
  user: Partial<User>
): Promise<InsertReponseType> => {
  const { data, error } = await supabase.from('users').insert(user);
  if (error) {
    const errorMessage = getErrorMessage(error);
    console.error('Error inserting data in user table:', errorMessage);
    return {
      error:
        'There was an error while creating the user. Please try again later.',
      success: null,
    };
  }
  return {
    success: 'User created successfully',
    error: null,
  };
};
