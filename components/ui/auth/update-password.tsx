'use client';

import { updatePassword } from '@/utils/auth-helpers/server';
import { handleRequestFn } from '@/utils/auth-helpers/client';
import { useRouter } from 'next/navigation';
import React from 'react';
import { ArrowRight } from 'lucide-react';
import update_password_layout from '@/layouts/auth/update-password.json';
import DynamicForm from '../form/custom-form';
interface UpdatePasswordProps {
  redirectMethod: string;
}

export default function UpdatePassword({
  redirectMethod,
}: UpdatePasswordProps) {
  const router = redirectMethod === 'client' ? useRouter() : null;

  const handleSubmit = async (formData: FormData) => {
    await handleRequestFn(formData, updatePassword, router);
  };

  return (
    <DynamicForm
      layout={update_password_layout}
      submitButton={'Reset password'}
      submitButtonIcon={<ArrowRight />}
      view={'update-password'}
      completeFn={handleSubmit}
      base={{}}
      lang="en"
    />
  );
}
