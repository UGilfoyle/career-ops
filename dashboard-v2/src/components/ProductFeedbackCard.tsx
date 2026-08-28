'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, Rate, Input, Button, Alert, Spin, Typography } from 'antd';
import { HeartOutlined, MessageOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { FEEDBACK_SCORE_LABELS } from '@/lib/feedback/validate';

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
      setError('Please pick a rating first.');
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
    <Card
      size="small"
      className="border-zinc-200 shadow-xs mb-5"
      title={
        <div className="flex items-center gap-2">
          <HeartOutlined className="text-zinc-900" />
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            Rate Career-Ops
          </span>
        </div>
      }
    >
      <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
        Optional — helps us improve Resume Studio, tailoring, and Copilot. Takes 10 seconds.
      </p>

      {loading ? (
        <div className="py-6 text-center">
          <Spin size="small" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Rate
              value={score || 0}
              onChange={(val) => setScore(val)}
              style={{ fontSize: 22 }}
            />
            {score && (
              <span className="text-xs font-semibold text-zinc-700">
                {FEEDBACK_SCORE_LABELS[score as 1 | 2 | 3 | 4 | 5]}
              </span>
            )}
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              <MessageOutlined className="mr-1" /> Comments (Optional)
            </div>
            <Input.TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What’s working well? What should we improve?"
            />
          </div>

          {error && <Alert type="error" message={error} showIcon />}
          {thanks && (
            <Alert
              type="success"
              message="Thanks for your feedback — we review every submission."
              showIcon
            />
          )}

          <Button
            type="primary"
            loading={saving}
            disabled={score == null}
            onClick={() => void submit()}
          >
            {state.submitted ? 'Update Feedback' : 'Submit Feedback'}
          </Button>
        </div>
      )}
    </Card>
  );
}
