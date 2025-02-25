'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from './separator';

interface DrawerProps {
  children: (setOpen: (open: boolean) => void) => React.ReactNode;
  trigger: React.ReactNode;
  title?: string;
  icon?: LucideIcon;
  description?: string;
  position?: 'left' | 'right';
  size?: 'sm' | 'default' | 'lg' | 'xl' | 'full';
  className?: string;
}

export function Drawer({
  children,
  trigger,
  title,
  icon: Icon,
  position = 'right',
  size = 'default',
  description,
  className,
}: DrawerProps) {
  const [open, setOpen] = React.useState(false);

  const sizes = {
    sm: 'sm:max-w-sm',
    default: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    full: 'sm:max-w-full',
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side={position}
        className={`overflow-y-auto ${sizes[size]} ${className}`}
      >
        {(title || Icon) && (
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {Icon && <Icon className="h-5 w-5" />}
              {title}
            </SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
        )}
        <Separator className="my-4" />
        {children(setOpen)}
      </SheetContent>
    </Sheet>
  );
}
