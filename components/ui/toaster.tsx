'use client';

import { useTheme } from 'next-themes';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import { Toaster as SonnerToaster, toast, ToasterProps } from 'sonner';

export function Toaster(props: Partial<ToasterProps>) {
  const { theme: applicationTheme, systemTheme } = useTheme();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Determine the actual theme to use
  const theme = applicationTheme === 'system' ? systemTheme : applicationTheme;

  React.useEffect(() => {
    const status = searchParams.get('status');
    const status_description = searchParams.get('status_description');
    const error = searchParams.get('error');
    const error_description = searchParams.get('error_description');

    if (error || status) {
      if (error) {
        toast.error(error ?? 'Hmm... Something went wrong', {
          description: error_description,
        });
      } else {
        toast.success(status ?? 'Awesome!', {
          description: status_description,
        });
      }

      // Clear any 'error', 'status', 'status_description', and 'error_description' search params
      // so that the toast doesn't show up again on refresh, but leave any other search params
      // intact.
      const newSearchParams = new URLSearchParams(searchParams.toString());
      const paramsToRemove = [
        'error',
        'status',
        'status_description',
        'error_description',
      ];
      paramsToRemove.forEach((param) => newSearchParams.delete(param));
      const redirectPath = `${pathname}?${newSearchParams.toString()}`;
      router.replace(redirectPath, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  return (
    <SonnerToaster
      {...props}
      theme={theme as 'light' | 'dark' | 'system'}
      position={props.position || 'bottom-right'}
      expand={props.expand ?? true}
      richColors={props.richColors ?? true}
    />
  );
}
