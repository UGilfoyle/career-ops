import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import BillingSuccessClient from './BillingSuccessClient';

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <Loader2 className="animate-spin text-[#0F172A]" size={32} />
        </div>
      }
    >
      <BillingSuccessClient />
    </Suspense>
  );
}
