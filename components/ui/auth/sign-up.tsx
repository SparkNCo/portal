'use client';
import Link from 'next/link';
import { handleRequestFn } from '@/utils/auth-helpers/client';
import OauthSignIn from '@/components/ui/auth/oauth';
import { getURL } from '@/utils/helpers';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import user_sign_up_layout from '@/layouts/auth/user-sign-up.json';
import CustomForm from '../form/custom-form';
import { signUp } from '@/utils/auth-helpers/sign-up';
interface SignUpProps {
  allowEmail: boolean;
  redirectMethod: string;
  proposalId?: string;
}

export default function SignUp({
  allowEmail,
  redirectMethod,
  proposalId,
}: SignUpProps) {
  const router = redirectMethod === 'client' ? useRouter() : null;

  const handleSubmit = async (formData: FormData) => {
    formData.append('proposalId', String(proposalId));
    await handleRequestFn(formData, signUp, router);
  };
  const saveFn = async (formData: FormData) => {
    //This is to simulate a save function that takes time.
    await new Promise((resolve) => setTimeout(resolve, 500));
  };
  return (
    <>
      <div className="space-y-4">
        <CustomForm
          layout={user_sign_up_layout}
          submitButton={'Sign Up'}
          view={'signup'}
          thirdPartyAuth
          completeFn={handleSubmit}
          base={{
            proposalId,
          }}
          lang="en"
        />
      </div>
    </>
  );
}
