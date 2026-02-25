"use client";
import DynamicForm from "@/components/ui/form/custom-form";
import { Proposal } from "@/lib/types/db/proposals";
import { ProposalFeature } from "@/lib/types/db/proposal_features";
import { LayoutType } from "@/lib/types/utils/form";
import { ErrorSuccessResponseMessage } from "@/lib/types/utils/functions-return-type";
import { Drawer } from "../drawer";
import { Edit, Settings } from "lucide-react";
import { Button } from "@/components/components/ui/button";

type Props = {
  proposal: Proposal;
  proposal_features: ProposalFeature[] | null;
  layout: LayoutType;
  completeFn: (formData: FormData) => Promise<ErrorSuccessResponseMessage>;
  editSection: string;
  editDescription: string;
  base?: any;
};

export default function EditProposal({
  proposal,
  proposal_features,
  layout,
  completeFn,
  editSection,
  base,
  editDescription,
}: Props) {
  return (
    <>
      <Drawer
        trigger={
          <Button className="p-1  h-fit " variant="outline">
            <Edit size={20} />
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
            base={{
              ...base,
              ...proposal,
              features: proposal_features,
            }}
            submitButton="Update"
            completeFn={completeFn}
            afterCompleteFn={() => setOpen(false)}
            lang="en"
          />
        )}
      </Drawer>
    </>
  );
}
