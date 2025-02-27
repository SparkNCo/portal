'use client';
import Link from 'next/link';
import { handleRequestFn } from '@/utils/auth-helpers/client';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState } from 'react';
// import OauthSignIn from './OauthSignIn';
import { getURL } from '@/utils/helpers';
import signin_layout from '@/layouts/auth/sign-in.json';
import OauthSignIn from '@/components/ui/auth/oauth';
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
  const searchParams = useSearchParams(); // 🔹 Accede a los parámetros de la URL

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
