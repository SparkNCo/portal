'use client';
import { GalleryVerticalEnd, Lock } from 'lucide-react';
import { usePathname } from 'next/navigation';
import React from 'react';
import Logo from '../icons/logo';
import { iconMap } from '../form/components/icon-map';

type Props = {
  children: React.ReactNode;
  bgImage: string;
  title: string | null;
};

export default function AuthFormLayout({ children, bgImage, title }: Props) {
  const path = usePathname();

  return (
    <div className="grid min-h-screen lg:grid-cols-2 overflow-hidden">
      <div className="flex flex-col gap-4 p-6 md:p-10 overflow-y-auto h-screen">
        <div className="flex justify-center ">
          {/* <div className="dark:bg-white p-2 rounded-md">
            <Logo />
          </div> */}
          <h3 className="text-2xl font-bold">Spark & Co</h3>
        </div>
        <div className="flex flex-1 flex-col items-center gap-y-10  justify-center">
          {title && (
            <h1 className="font-bold text-3xl inline-flex gap-4 items-center justify-center  leading-[45px]">
              {title}
            </h1>
          )}
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      <div className="relative hidden bg-muted lg:block overflow-hidden">
        {bgImage && (
          <img
            src={bgImage}
            alt="Image"
            className="fixed right-0 top-0 h-screen w-1/2 object-cover dark:brightness-[0.2] dark:grayscale"
          />
        )}
      </div>
    </div>
  );
}
