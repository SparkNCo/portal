'use server';
import { createClient } from '@/utils/supabase/server';
import { User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

export const getLoggedInUser = async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  return user?.user;
};

export const logOut = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/sign-in?status=You have been signed out.');
};
