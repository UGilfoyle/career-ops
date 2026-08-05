import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import BillingSuccessClient from './BillingSuccessClient';

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
          <Loader2 className="animate-spin text-[#1C1C1E]" size={32} />
        </div>
      }
    >
      <BillingSuccessClient />
    </Suspense>
  );
}
