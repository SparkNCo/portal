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

type Props = {
  layout: LayoutType;
  completeFn: (formData: FormData) => Promise<ErrorSuccessResponseMessage>;
  editSection: string;
  editDescription: string;
  base?: any;
  submitButton?: string;
  icon?: LucideIcon;
};

export default function EditProposal({
  layout,
  completeFn,
  editSection,
  icon: Icon = Edit,
  base,
  editDescription,
  submitButton = 'Update',
}: Props) {
  return (
    <>
      <Drawer
        trigger={
          <Button className="p-2  h-fit " variant="outline">
            <Icon className="icon" />
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
