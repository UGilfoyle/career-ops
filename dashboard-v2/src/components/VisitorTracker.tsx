'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Don't mix stealth companion traffic into site-wide page_views
    if (pathname === '/v' || pathname.startsWith('/v/')) return;

    // Fire and forget — don't block rendering
    const track = async () => {
      try {
        await fetch('/api/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: pathname,
            referrer: document.referrer || null,
          }),
        });
      } catch {
        // Silent fail — visitor tracking should never break the app
      }
    };

    // Small delay to avoid tracking bots that bounce instantly
    const timer = setTimeout(track, 500);
    return () => clearTimeout(timer);
  }, [pathname]);

  return null; // Invisible component
}
