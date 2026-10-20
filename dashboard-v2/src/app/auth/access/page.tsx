import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ProAccessClient from './ProAccessClient';

export default function ProAccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <Loader2 className="animate-spin text-[#0F172A]" size={32} />
        </div>
      }
    >
      <ProAccessClient />
    </Suspense>
  );
}
