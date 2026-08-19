'use client';

import type { ReactNode } from 'react';
import AuthBrandPanel, { AuthMobileBrand } from './AuthBrandPanel';

type AuthShellProps = {
  children: ReactNode;
};

export default function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#FAFAF8] font-sans text-[#1C1C1E] lg:flex">
      <AuthBrandPanel />
      <div className="relative flex flex-1 flex-col justify-center overflow-hidden p-6 sm:p-8 lg:p-12 xl:p-16">
        <div className="pointer-events-none absolute top-[-20%] right-[-10%] h-[50%] w-[50%] rounded-full bg-[#f59e0b]/5 blur-[150px]" />
        <div className="relative z-10 mx-auto w-full max-w-md">
          <AuthMobileBrand />
          {children}
        </div>
      </div>
    </div>
  );
}
