import { Suspense } from 'react';
import BillingSimulateClient from './BillingSimulateClient';

export default function BillingSimulatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center text-sm text-[#6B6B6B]">Loading demo…</div>}>
      <BillingSimulateClient />
    </Suspense>
  );
}
