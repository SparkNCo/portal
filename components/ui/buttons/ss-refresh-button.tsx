'use client';

import { useTransition } from 'react';
import { revalidateSSR } from '@/app/actions';
import { Button } from '../button';
import { LoaderCircle, Lock, RotateCcw, Undo } from 'lucide-react';

export default function RevalidateButton({
  revalidate,
  revalidateOption = 'path',
}: {
  revalidate: string;
  revalidateOption?: 'path' | 'tag';
}) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      revalidateSSR(revalidate, revalidateOption);
    });
  };

  return (
    <Button
      className="p-2  h-fit group"
      variant={'outline'}
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? (
        <LoaderCircle
          size={16}
          className="animate-spin text-muted-foreground icon "
        />
      ) : (
        <RotateCcw
          size={16}
          className="text-muted-foreground icon group-hover:-rotate-45  duration-300"
        />
      )}
    </Button>
  );
}
