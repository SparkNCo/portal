'use server';
import { createClient } from '@/utils/supabase/server';
import { User } from '@supabase/supabase-js';
import { User as DBUser } from '@/lib/types/db/user';
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

export const getDatabaseUser = async (id?: string): Promise<DBUser | null> => {
  if (!id) return null;
  const supabase = await createClient();
  const { data: user }: { data: DBUser | null } = await supabase
    .from('users')
    .select()
    .eq('id', id)
    .single();
  return user;
};
