import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ProAccessClient from './ProAccessClient';

export default function ProAccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
          <Loader2 className="animate-spin text-[#1C1C1E]" size={32} />
        </div>
      }
    >
      <ProAccessClient />
    </Suspense>
  );
}
