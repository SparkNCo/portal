import { InfoIcon } from 'lucide-react';
import React from 'react';

type Props = {
  type: 'warning' | 'info' | 'success' | 'error';
  message: string;
};

export default function AlertMessage({ type = 'info', message }: Props) {
  const Icon = icons[type as keyof typeof icons];
  return (
    <div className="bg-muted/50 px-5 py-3 border rounded-md flex gap-4">
      <Icon className="mt-0.5" />
      <div className="flex flex-col gap-1">
        <small className="text-sm text-secondary-foreground">{message}</small>
      </div>
    </div>
  );
}

const icons = {
  info: InfoIcon,
};
