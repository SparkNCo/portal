'use client';
import DynamicForm from '@/components/ui/form/custom-form';
import React from 'react';
import sign_in_layout from '@/layouts/sign-in.json';
import { supabase } from '@/lib/supabase/client';
import { Proposal } from '@/lib/types/db/proposals';
import { ProposalFeature } from '@/lib/types/db/proposal_features';

type Props = {
  id: string;
  proposal: Proposal;
  proposal_features: ProposalFeature[] | null;
};

export default function EditProposal({
  id,
  proposal,
  proposal_features,
}: Props) {
  return (
    <DynamicForm
      layout={sign_in_layout}
      base={{
        ...proposal,
        features: proposal_features,
      }}
      completeFn={() => {}}
      lang="en"
      saveFn={() => {}}
    />
  );
}
