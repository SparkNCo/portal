'use client';
import React from 'react';
import { Button } from '../button';
import { updateProposalById } from '@/lib/repositories/proposals/update';
import { toast } from 'sonner';
import { LoaderCircle, Lock, LockOpen } from 'lucide-react';
import { revalidateTag } from 'next/cache';
import { changeProjectPrivacy } from '@/lib/services/proposals/change-proposal-privacy';
import { getErrorMessage } from '@/utils/helpers';

type Props = {
  isPublic: boolean;
  proposalId: string;
};

export default function ChangePrivacyButton({ isPublic, proposalId }: Props) {
  const [isLoading, setIsLoading] = React.useState(false);
  const handleChangePrivacy = async () => {
    setIsLoading(true);
    try {
      const { error, success } = await changeProjectPrivacy(
        isPublic,
        proposalId
      );
      if (error) {
        toast.error(error);
      } else {
        toast.success(success);
      }
    } catch (error) {
      const errorMesage = getErrorMessage(error);
      toast.error(errorMesage);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Button
      disabled={isLoading}
      onClick={handleChangePrivacy}
      className="p-2 h-fit "
      variant="outline"
    >
      {isLoading ? (
        <LoaderCircle className="animate-spin text-muted-foreground icon" />
      ) : isPublic ? (
        <Lock className="icon" />
      ) : (
        <LockOpen className="icon" />
      )}
    </Button>
  );
}
