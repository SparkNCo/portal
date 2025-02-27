'use client';

import { signInWithOAuth } from '@/utils/auth-helpers/client';
import { type Provider } from '@supabase/supabase-js';
import { useState } from 'react';
import { Button } from '../button';
import { Lock } from 'lucide-react';
type OAuthProviders = {
  name: Provider;
  displayName: string;
  icon: any;
};

export default function OauthSignIn({ action }: { action: string }) {
  const oAuthProviders: OAuthProviders[] = [
    {
      name: 'google',
      displayName: 'Google',
      icon: <Lock />,
    },
  ];
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true); // Disable the button while the request is being handled
    await signInWithOAuth(e);
    setIsSubmitting(false);
  };

  return (
    <div className="flex w-full">
      {oAuthProviders.map(({ name, displayName, icon: Icon }) => (
        <form
          key={name}
          className=" flex items-center justify-center w-full"
          onSubmit={handleSubmit}
        >
          <>
            <input type="hidden" name="provider" value={name} />
            <Button
              className="border border-gray-400 w-full shadow-md"
              disabled={isSubmitting}
              type="submit"
            >
              {/* <Icon /> */}
              {/* <img src={icon} /> */}
              <span className="">
                {action} with {displayName}
              </span>
            </Button>
          </>
        </form>
      ))}
    </div>
  );
}
