'use client';
import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../tooltip';
import { Button } from '../button';
import { LoaderCircle, LogOut } from 'lucide-react';
import { logOut } from '@/lib/repositories/users/get';

type Props = {
  usage: 'header' | 'sidebar';
};

export default function LogOutButton({}: Props) {
  const [loading, setLoading] = React.useState(false);
  const handleLogout = async () => {
    setLoading(true);
    await logOut();
    setLoading(false);
  };
  const ICON_SIZE = 16;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            disabled={loading}
            onClick={handleLogout}
            variant="outline"
            size={'icon'}
          >
            {loading ? (
              <LoaderCircle
                size={ICON_SIZE}
                className="animate-spin text-muted-foreground"
              />
            ) : (
              <LogOut className={'text-muted-foreground'} size={ICON_SIZE} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Log Out</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
