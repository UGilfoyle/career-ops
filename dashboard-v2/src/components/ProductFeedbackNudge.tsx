'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const DISMISS_KEY = 'career_ops_feedback_nudge_dismissed';

/**
 * Optional one-line nudge — dismissible, never blocks workflows.
 * Hidden after submit or "Not now" (localStorage).
 */
export default function ProductFeedbackNudge({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DISMISS_KEY) === '1') {
      setChecked(true);
      return;
    }
    void (async () => {
      try {
        const res = await fetch('/api/feedback');
        const data = await res.json();
        if (res.ok && !data.submitted) setVisible(true);
      } catch {
        /* silent — nudge is optional */
      } finally {
        setChecked(true);
      }
    })();
  }, []);

  if (!checked || !visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[#E5E5E0] bg-white px-4 py-3 shadow-lg">
        <p className="text-xs text-[#1C1C1E] flex-1 leading-relaxed">
          Enjoying Career-Ops?{' '}
          <button
            type="button"
            onClick={() => {
              dismiss();
              onOpenSettings();
            }}
            className="font-bold underline underline-offset-2 hover:text-[#6B6B6B]"
          >
            Rate us in Settings
          </button>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 p-1 text-[#9CA3AF] hover:text-[#1C1C1E]"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
