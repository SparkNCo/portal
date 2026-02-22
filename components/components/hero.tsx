'use client';

import { Button } from './ui/button';
import React from 'react';
import Link from 'next/link';
import { createProposalAndSaveFeaturesFn } from '@/lib/services/proposals/form-functions/create-client-proposal-and-features';

export default function Header() {
  const [loading, setLoading] = React.useState(false);
  const testFn = async () => {
    setLoading(true);
    try {
      const { error } = await createProposalAndSaveFeaturesFn(new FormData());
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-16 items-center">
      <Link
        href={'/proposals/9c8bcc75-f0f0-4189-b3b1-c39da6068237'}
        className="text-primary font-medium underline mb-4 flex items-center gap-2"
      >
        Proposal
      </Link>
      <Button disabled={loading} onClick={testFn}>
        {loading ? 'Loading...' : 'Test Function'}
      </Button>
      <div className="w-full p-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent my-8" />
    </div>
  );
}
