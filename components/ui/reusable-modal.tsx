'use client';
import * as React from 'react';
import { useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2, X } from 'lucide-react';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ErrorSuccessResponseMessage } from '@/lib/types/utils/functions-return-type';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/helpers';

const modalVariants = cva('', {
  variants: {
    variant: {
      default: '',
      destructive: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const buttonVariants = cva('', {
  variants: {
    variant: {
      default: '',
      destructive:
        'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface ModalProps extends VariantProps<typeof modalVariants> {
  trigger: React.ReactNode;
  title: string;
  subtitle?: string;
  description?: string;
  confirmText?: string;
  confirmIcon?: React.ReactElement;
  headerIcon?: React.ReactElement;
  onConfirm?: (args: any) => Promise<ErrorSuccessResponseMessage | void>;
  onCancel?: () => void;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  args?: any;
}

export function Modal({
  trigger,
  title,
  args,
  subtitle,
  description,
  confirmText = 'Confirm',
  confirmIcon,
  headerIcon,
  onConfirm,
  onCancel,
  variant,
  children,
  defaultOpen,
  onOpenChange,
}: ModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (!onConfirm) return;

    try {
      setIsLoading(true);
      const response = await onConfirm(args);
      if (response?.error) {
        toast.error(response?.error);
      }
      if (response?.success) {
        toast.success(response?.success);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className={cn(
          'sm:max-w-[425px] m-0 p-0 gap-0',
          modalVariants({ variant })
        )}
      >
        <DialogHeader className="py-3 px-5">
          <DialogTitle className="font-semibold text-base p-0 m-0 flex items-center gap-2">
            {headerIcon && (
              <span className="">
                {' '}
                {React.cloneElement(headerIcon, {
                  className: 'w-4 h-4',
                })}
              </span>
            )}
            {title}
          </DialogTitle>

          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <Separator className="m-0 p-0" />
        <div className="px-5 py-4">
          {description && (
            <DialogDescription className="text-sm">
              {description}
            </DialogDescription>
          )}
          {subtitle && (
            <DialogDescription className="text-sm">
              {subtitle}
            </DialogDescription>
          )}
          {children}
        </div>

        <Separator className="p-0 m-0" />

        <DialogFooter className="flex  gap-2 sm:gap-2 px-5 py-5 m-0 flex-row">
          <DialogClose asChild>
            <Button
              variant="outline"
              onClick={() => {
                if (onCancel) onCancel();
              }}
              disabled={isLoading}
              className="w-full"
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            className={cn('w-full', buttonVariants({ variant }))}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className=" h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                {confirmText}
                {confirmIcon && (
                  <span className="">
                    {React.cloneElement(confirmIcon, {
                      className: 'w-4 h-4',
                    })}
                  </span>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
