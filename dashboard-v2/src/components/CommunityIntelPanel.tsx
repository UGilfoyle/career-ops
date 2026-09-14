'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input, Button, Tag, Modal, Form, Select, message, Spin } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  LikeOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  BulbOutlined,
  FireOutlined,
  TeamOutlined,
  FilterOutlined,
  CodeOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

export type IntelItem = {
  id: number;
  company: string;
  company_slug: string;
  role: string;
  round_type: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questions: string[];
  tips?: string | null;
  offer_outcome?: string | null;
  upvotes: number;
  created_at: string;
};

const ROUND_LABELS: Record<string, { label: string; color: string }> = {
  system_design: { label: 'System Design', color: 'blue' },
  coding_dsa: { label: 'Coding / DSA', color: 'cyan' },
  bar_raiser: { label: 'Bar-Raiser / Behavioral', color: 'purple' },
  hiring_manager: { label: 'Hiring Manager', color: 'gold' },
  take_home: { label: 'Take-Home Project', color: 'green' },
};

export function CommunityIntelPanel({ onPractice }: { onPractice?: () => void } = {}) {
  const [items, setItems] = useState<IntelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchIntel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/intel');
      const data = await res.json();
      if (data?.items) {
        setItems(data.items);
      }
    } catch {
      message.error('Failed to load interview intel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchIntel();
  }, []);

  const handleUpvote = async (id: number) => {
    // Optimistic UI update
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, upvotes: item.upvotes + 1 } : item))
    );

    try {
      const res = await fetch(`/api/intel/${id}/upvote`, { method: 'POST' });
      if (!res.ok) {
        // Rollback
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, upvotes: item.upvotes - 1 } : item))
        );
      }
    } catch {
      // Rollback
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, upvotes: item.upvotes - 1 } : item))
      );
    }
  };

  const handleCopyQuestions = (item: IntelItem) => {
    const text = item.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    void navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    message.success('Questions copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const questionsList = String(values.questions || '')
        .split('\n')
        .map((q) => q.trim())
        .filter((q) => q.length > 5);

      if (questionsList.length === 0) {
        message.error('Please enter at least one interview question');
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: values.company,
          role: values.role,
          round_type: values.round_type,
          difficulty: values.difficulty || 'medium',
          questions: questionsList,
          tips: values.tips,
          offer_outcome: values.offer_outcome || 'pending',
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to submit intel');
      }

      message.success('Thank you for contributing to the community!');
      form.resetFields();
      setModalOpen(false);
      void fetchIntel();
    } catch (err: any) {
      message.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchesRound = selectedRound === 'all' || item.round_type === selectedRound;
      const matchesQuery =
        !q ||
        item.company.toLowerCase().includes(q) ||
        item.role.toLowerCase().includes(q) ||
        item.questions.some((ques) => ques.toLowerCase().includes(q)) ||
        (item.tips || '').toLowerCase().includes(q);
      return matchesRound && matchesQuery;
    });
  }, [items, searchQuery, selectedRound]);

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <h2 className="text-base font-extrabold text-zinc-900 m-0">Community Interview Intel Exchange</h2>
            <Tag color="purple" className="text-[10px] font-mono font-bold uppercase m-0">
              Crowdsourced
            </Tag>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed m-0">
            Real questions, system design briefs, and bar-raiser debriefs from recent interviews at top tech companies.
          </p>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
          className="bg-zinc-900 hover:bg-zinc-800 text-xs font-bold rounded-xl h-9"
        >
          Share Recent Round
        </Button>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <Input
            prefix={<SearchOutlined className="text-zinc-400" />}
            placeholder="Search company (Google, Uber, Swiggy...) or architecture topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            className="rounded-xl h-10 text-xs"
          />
        </div>

        {/* Round Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedRound('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              selectedRound === 'all'
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            All Rounds
          </button>
          {Object.entries(ROUND_LABELS).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedRound(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                selectedRound === key
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* Intel Feed */}
      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <Spin size="large" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center space-y-3 bg-zinc-50/50">
          <TeamOutlined className="text-3xl text-zinc-400" />
          <h3 className="text-sm font-bold text-zinc-800">No interview debriefs found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Be the first to share questions from your recent interview and help fellow engineers prepare!
          </p>
          <Button
            type="primary"
            onClick={() => setModalOpen(true)}
            className="bg-zinc-900 text-xs font-semibold"
          >
            Contribute Round Questions
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const roundMeta = ROUND_LABELS[item.round_type] || {
              label: item.round_type,
              color: 'default',
            };

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-zinc-300 transition-all"
              >
                <div className="space-y-3">
                  {/* Top Bar: Company, Role & Tags */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-zinc-900">{item.company}</span>
                        <Tag color={roundMeta.color} className="text-[10px] font-mono font-bold uppercase m-0">
                          {roundMeta.label}
                        </Tag>
                        {item.difficulty && (
                          <Tag
                            color={
                              item.difficulty === 'hard'
                                ? 'red'
                                : item.difficulty === 'medium'
                                ? 'orange'
                                : 'green'
                            }
                            className="text-[9px] font-mono uppercase m-0"
                          >
                            {item.difficulty}
                          </Tag>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-zinc-600 mt-0.5">{item.role}</div>
                    </div>

                    {item.offer_outcome === 'offer' && (
                      <Tag color="green" className="text-[10px] font-mono uppercase m-0">
                        Offer Verified
                      </Tag>
                    )}
                  </div>

                  {/* Questions Box */}
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                      <span>Interview Questions</span>
                      <button
                        type="button"
                        onClick={() => handleCopyQuestions(item)}
                        className="inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-900 cursor-pointer"
                        title="Copy all questions"
                      >
                        {copiedId === item.id ? (
                          <CheckCircleOutlined className="text-emerald-600" />
                        ) : (
                          <CopyOutlined />
                        )}
                        <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <ul className="space-y-1.5 text-xs text-zinc-800 list-decimal list-inside font-normal">
                      {item.questions.map((q, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Insider Architecture / Bar-Raiser Tips */}
                  {item.tips && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                        <BulbOutlined className="text-amber-600" />
                        <span>Candidate Tip & Focus Areas</span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed m-0">{item.tips}</p>
                    </div>
                  )}
                </div>

                {/* Card Footer: Upvote & Date */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs text-zinc-400">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleUpvote(item.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-mono text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <LikeOutlined className="text-purple-600" />
                      <span>{item.upvotes}</span>
                    </button>

                    {onPractice && (
                      <button
                        type="button"
                        onClick={onPractice}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer"
                        title="Practice these questions in Mock Studio"
                      >
                        <ThunderboltOutlined />
                        <span>Practice in Voice AI Studio →</span>
                      </button>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-zinc-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Contribute Recent Round */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={560}
        title={
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
            <TeamOutlined className="text-purple-600" />
            <span>Share Interview Questions (Community Intel)</span>
          </div>
        }
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="pt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item
              label="Company Name"
              name="company"
              rules={[{ required: true, message: 'Company is required' }]}
              className="m-0"
            >
              <Input placeholder="e.g. Google, Atlassian, Zepto" />
            </Form.Item>

            <Form.Item
              label="Target Role"
              name="role"
              rules={[{ required: true, message: 'Role is required' }]}
              className="m-0"
            >
              <Input placeholder="e.g. Senior Backend Engineer" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Form.Item
              label="Round Type"
              name="round_type"
              initialValue="system_design"
              rules={[{ required: true }]}
              className="m-0"
            >
              <Select>
                <Select.Option value="system_design">System Design</Select.Option>
                <Select.Option value="coding_dsa">Coding / DSA</Select.Option>
                <Select.Option value="bar_raiser">Bar-Raiser / Behavioral</Select.Option>
                <Select.Option value="hiring_manager">Hiring Manager</Select.Option>
                <Select.Option value="take_home">Take-Home Project</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="Difficulty" name="difficulty" initialValue="medium" className="m-0">
              <Select>
                <Select.Option value="easy">Easy</Select.Option>
                <Select.Option value="medium">Medium</Select.Option>
                <Select.Option value="hard">Hard</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="Outcome" name="offer_outcome" initialValue="pending" className="m-0">
              <Select>
                <Select.Option value="offer">Offer Received</Select.Option>
                <Select.Option value="rejected">Round Cleared</Select.Option>
                <Select.Option value="pending">Pending</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            label="Questions Asked (One question per line)"
            name="questions"
            rules={[{ required: true, message: 'Please enter at least one question' }]}
            className="m-0"
          >
            <Input.TextArea
              rows={4}
              placeholder="1. Design an idempotent payment webhook receiver&#10;2. How do you handle dead-letter queues with exponential backoff?"
            />
          </Form.Item>

          <Form.Item label="Insider Tips / Architecture Focus Areas (Optional)" name="tips" className="m-0">
            <Input.TextArea
              rows={2}
              placeholder="e.g. Interviewer cared heavily about database locks vs idempotency keys..."
            />
          </Form.Item>

          <div className="pt-2 flex justify-end gap-2">
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              className="bg-zinc-900 hover:bg-zinc-800"
            >
              Submit Intel
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
