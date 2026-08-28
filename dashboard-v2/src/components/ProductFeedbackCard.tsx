'use client';

import { useCallback, useEffect, useState } from 'react';
import { Heart, Loader2, MessageSquare } from 'lucide-react';
import { FEEDBACK_SCORE_LABELS } from '@/lib/feedback/validate';

const SCORES = [1, 2, 3, 4, 5] as const;

type FeedbackState = {
  submitted: boolean;
  score?: number;
  comment?: string | null;
  updatedAt?: string | null;
};

export default function ProductFeedbackCard({ context = 'settings' }: { context?: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState(false);
  const [state, setState] = useState<FeedbackState>({ submitted: false });
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/feedback');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load feedback');
      if (data.submitted) {
        setState({
          submitted: true,
          score: data.score,
          comment: data.comment,
          updatedAt: data.updatedAt,
        });
        setScore(data.score);
        setComment(data.comment || '');
      } else {
        setState({ submitted: false });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (score == null) {
      setError('Pick a rating first.');
      return;
    }
    setSaving(true);
    setError('');
    setThanks(false);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, comment: comment.trim() || undefined, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save feedback');
      setState({
        submitted: true,
        score: data.score,
        comment: data.comment,
        updatedAt: data.updatedAt,
      });
      setThanks(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="break-inside-avoid mb-5">
      <div className="bg-white border border-[#E5E5E0] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Heart size={18} className="text-[#1C1C1E]" />
          <h3 className="text-sm font-bold text-[#1C1C1E] uppercase tracking-wider">
            Rate Career-Ops
          </h3>
        </div>
        <p className="text-xs text-[#6B6B6B] mb-4 leading-relaxed">
          Optional — helps us improve Resume Studio, tailoring, and Copilot. Takes 10 seconds.
        </p>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-[#9CA3AF]" size={20} />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {SCORES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  className={`flex flex-col items-center min-w-[3.25rem] px-2 py-2 rounded-xl border text-xs font-bold transition ${
                    score === n
                      ? 'bg-[#1C1C1E] text-white border-[#1C1C1E]'
                      : 'bg-[#FAFAF8] text-[#6B6B6B] border-[#E5E5E0] hover:border-[#1C1C1E]'
                  }`}
                  aria-label={`${n} — ${FEEDBACK_SCORE_LABELS[n]}`}
                >
                  <span className="text-base leading-none mb-0.5">{n === 5 ? '★' : n}</span>
                  <span className="text-[9px] font-semibold normal-case tracking-normal opacity-90">
                    {FEEDBACK_SCORE_LABELS[n]}
                  </span>
                </button>
              ))}
            </div>

            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
              <MessageSquare size={11} className="inline mr-1 -mt-0.5" />
              Comment (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What’s working? What should we fix?"
              className="w-full rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-2 text-sm text-[#1C1C1E] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#1C1C1E] resize-none"
            />

            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            {thanks && (
              <p className="text-xs text-emerald-700 mt-2 font-semibold">Thanks — we read every response.</p>
            )}
            {state.submitted && !thanks && state.updatedAt && (
              <p className="text-[10px] text-[#9CA3AF] mt-2">
                Last saved {new Date(state.updatedAt).toLocaleString('en-IN')}
              </p>
            )}

            <button
              type="button"
              disabled={saving || score == null}
              onClick={() => void submit()}
              className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#1C1C1E] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {state.submitted ? 'Update feedback' : 'Submit feedback'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
