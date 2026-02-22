import React from 'react';
import { Progress } from '../../progress';
import { LayoutType } from '@/lib/types/utils/form';

type Props = {
  page: number;
  layout: LayoutType;
};

export default function ProgressStepper({ page, layout }: Props) {
  return (
    <div className="flex-col-start gap-1 w-full mb-6">
      <span className="">
        Step {page + 1} of {layout?.length}
      </span>
      <Progress value={((page + 1) / layout?.length) * 100} />
    </div>
  );
}
