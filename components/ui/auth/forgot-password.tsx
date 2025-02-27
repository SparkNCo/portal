'use client';

import { handleRequestFn } from '@/utils/auth-helpers/client';
import { getURL } from '@/utils/helpers';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { requestPasswordUpdate } from '@/utils/auth-helpers/server';
import Link from 'next/link';
import CustomForm from '../form/custom-form';
import forgot_password_layout from '@/layouts/auth/forgot-password.json';
interface ForgotPasswordProps {
  allowEmail: boolean;
  redirectMethod: string;
}
export default function ForgotPassword({
  allowEmail,
  redirectMethod,
}: ForgotPasswordProps) {
  const router = redirectMethod === 'client' ? useRouter() : null;

  const handleSubmit = async (formData: FormData) => {
    await handleRequestFn(formData, requestPasswordUpdate, router);
  };
  return (
    <>
      <div className="space-y-4">
        <CustomForm
          layout={forgot_password_layout}
          submitButton={'Reset Password'}
          completeFn={handleSubmit}
          view="forgot-password"
          base={{}}
          lang="en"
        />
      </div>
    </>
  );
}
