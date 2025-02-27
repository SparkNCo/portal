'use client';
import { handleRequestFn } from '@/utils/auth-helpers/client';
import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
// import OauthSignIn from './OauthSignIn';
import signin_layout from '@/layouts/auth/sign-in.json';
import { signInWithPassword } from '@/utils/auth-helpers/server';
import DynamicForm from '../form/custom-form';
// Define prop type with allowEmail boolean
interface PasswordSignInProps {
  allowPassword: boolean;
  redirectMethod: string;
  redirectTo?: string;
}

export default function PasswordSignIn({
  allowPassword,
  redirectMethod = 'client',
}: PasswordSignInProps) {
  const router = redirectMethod === 'client' ? useRouter() : null;
  const searchParams = useSearchParams();

  const redirectTo = searchParams.get('redirectTo') || '';

  const handleSubmit = async (formData: FormData) => {
    formData.append('redirectTo', redirectTo);
    await handleRequestFn(formData, signInWithPassword, router);
  };

  return (
    <DynamicForm
      layout={signin_layout}
      completeFn={handleSubmit}
      submitButton={'Sign In'}
      base={{}}
      view={'signin'}
      lang="en"
    />
  );
}
