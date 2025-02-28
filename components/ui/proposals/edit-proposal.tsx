'use client';
import DynamicForm from '@/components/ui/form/custom-form';
import React from 'react';
import { Proposal } from '@/lib/types/db/proposals';
import { ProposalFeature } from '@/lib/types/db/proposal_features';
import { LayoutType } from '@/lib/types/utils/form';
import { ErrorSuccessResponseMessage } from '@/lib/types/utils/functions-return-type';
import { Drawer } from '../drawer';
import { Button } from '../button';
import { Edit, LucideIcon, Settings } from 'lucide-react';
import { iconMap } from '../form/components/icon-map';

type Props = {
  layout: LayoutType;
  completeFn: (formData: FormData) => Promise<ErrorSuccessResponseMessage>;
  editSection: string;
  editDescription: string;
  base?: any;
  submitButton?: string;
  icon?: string;
};

export default function EditAddProposal({
  layout,
  completeFn,
  editSection,
  icon = 'edit',
  base,
  editDescription,
  submitButton = 'Update',
}: Props) {
  return (
    <>
      <Drawer
        trigger={
          <Button className="p-2  h-fit " variant="outline">
            {iconMap[icon]}
          </Button>
        }
        title={editSection}
        description={editDescription}
        icon={Settings}
        size="sm"
      >
        {(setOpen) => (
          <DynamicForm
            layout={layout}
            base={base}
            submitButton={submitButton}
            completeFn={completeFn}
            afterCompleteFn={() => setOpen(false)}
            lang="en"
          />
        )}
      </Drawer>
    </>
  );
}
