'use client';

import { Button } from './ui/button';
import React from 'react';
import Link from 'next/link';
import { createProposalAndSaveFeaturesFn } from '@/lib/services/proposals/form-functions/create-client-proposal-and-features';
import { toast } from 'sonner';

export default function Header() {
  const [loading, setLoading] = React.useState(false);
  const testFn = async () => {
    setLoading(true);
    try {
      const { error, success } = await createProposalAndSaveFeaturesFn(
        new FormData()
      );
      // const { error } = await sendSuccessEmailFn(new FormData());
      if (error) {
        toast.error(error);
      }
      if (success) {
        toast.success(success);
      }
    } catch (error: any) {
      console.log('error catch --->', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-16 items-center">
      <Link
        href={'/proposals/'}
        className="text-primary font-medium underline mb-4 flex items-center gap-2"
      >
        Proposals
      </Link>
      <Link
        href={'/sign-in/'}
        className="text-primary font-medium underline mb-4 flex items-center gap-2"
      >
        Sign In
      </Link>
      {/* <Button disabled={loading} onClick={testFn}>
        {loading ? 'Loading...' : 'Test Function'}
      </Button> */}
    </div>
  );
}
