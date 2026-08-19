'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emptyResumeContext,
  setCompetencies,
  type ResumeContext,
} from '@/lib/resume/types';

const HISTORY_LIMIT = 50;
const AUTOSAVE_MS = 800;

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type UseResumeStudioStoreArgs = {
  initial?: ResumeContext | null;
  onAutosave?: (draft: ResumeContext) => Promise<void>;
};

function cloneCtx(ctx: ResumeContext): ResumeContext {
  return JSON.parse(JSON.stringify(ctx)) as ResumeContext;
}

function sameCtx(a: ResumeContext, b: ResumeContext): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useResumeStudioStore({ initial, onAutosave }: UseResumeStudioStoreArgs) {
  const [draft, setDraftState] = useState<ResumeContext>(() =>
    cloneCtx(initial && Object.keys(initial).length ? { ...emptyResumeContext(), ...initial } : emptyResumeContext())
  );
  const [history, setHistory] = useState<ResumeContext[]>([]);
  const [future, setFuture] = useState<ResumeContext[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>('');
  const hydratedRef = useRef(false);
  const skipHistoryRef = useRef(false);
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Hydrate when parent profile arrives / changes substantially
  useEffect(() => {
    if (!initial) return;
    const next = { ...emptyResumeContext(), ...cloneCtx(initial) };
    if (!next.studio) next.studio = { template_id: 'ats-professional' };
    const hasContent =
      Boolean(next.candidate?.full_name?.trim()) ||
      (next.experience || []).length > 0 ||
      (next.education || []).length > 0 ||
      Boolean(next.narrative?.headline?.trim());

    if (!hydratedRef.current) {
      hydratedRef.current = true;
      skipHistoryRef.current = true;
      // Intentional: sync local draft once when settings/profile load
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from server props
      setDraftState(next);
      setHistory([]);
      setFuture([]);
      setSaveStatus('idle');
      return;
    }

    // Re-hydrate once when async settings load fills an empty studio
    const currentEmpty =
      !draftRef.current.candidate?.full_name?.trim() &&
      !(draftRef.current.experience || []).length &&
      !(draftRef.current.education || []).length;
    if (currentEmpty && hasContent && saveStatus === 'idle') {
      skipHistoryRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot fill of empty studio
      setDraftState(next);
      setHistory([]);
      setFuture([]);
    }
  }, [initial, saveStatus]);

  const commit = useCallback((updater: (prev: ResumeContext) => ResumeContext) => {
    setDraftState((prev) => {
      const next = updater(prev);
      if (sameCtx(prev, next)) return prev;
      if (!skipHistoryRef.current) {
        setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), cloneCtx(prev)]);
        setFuture([]);
      }
      skipHistoryRef.current = false;
      setSaveStatus('dirty');
      return next;
    });
  }, []);

  const setDraft = useCallback(
    (next: ResumeContext | ((prev: ResumeContext) => ResumeContext)) => {
      commit((prev) => (typeof next === 'function' ? next(prev) : next));
    },
    [commit]
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [cloneCtx(draftRef.current), ...f].slice(0, HISTORY_LIMIT));
      skipHistoryRef.current = true;
      setDraftState(prev);
      setSaveStatus('dirty');
      return h.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const [next, ...rest] = f;
      setHistory((h) => [...h, cloneCtx(draftRef.current)].slice(-HISTORY_LIMIT));
      skipHistoryRef.current = true;
      setDraftState(next);
      setSaveStatus('dirty');
      return rest;
    });
  }, []);

  // Debounced autosave
  useEffect(() => {
    if (saveStatus !== 'dirty' || !onAutosave) return;
    const t = setTimeout(async () => {
      setSaveStatus('saving');
      setSaveError(null);
      try {
        await onAutosave(draftRef.current);
        setSaveStatus('saved');
      } catch (e: unknown) {
        setSaveStatus('error');
        setSaveError(e instanceof Error ? e.message : 'Save failed');
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [draft, saveStatus, onAutosave]);

  // Keyboard undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const updateCandidate = useCallback(
    (patch: Partial<ResumeContext['candidate']>) => {
      setDraft((prev) => ({
        ...prev,
        candidate: { ...(prev.candidate || {}), ...patch },
      }));
    },
    [setDraft]
  );

  const updateNarrative = useCallback(
    (patch: Partial<NonNullable<ResumeContext['narrative']>>) => {
      setDraft((prev) => ({
        ...prev,
        narrative: { ...(prev.narrative || {}), ...patch },
      }));
    },
    [setDraft]
  );

  const updateCompetencies = useCallback(
    (tags: string[]) => {
      setDraft((prev) => setCompetencies(prev, tags));
    },
    [setDraft]
  );

  const updateExperience = useCallback(
    (experience: NonNullable<ResumeContext['experience']>) => {
      setDraft((prev) => ({ ...prev, experience }));
    },
    [setDraft]
  );

  const updateEducation = useCallback(
    (education: NonNullable<ResumeContext['education']>) => {
      setDraft((prev) => ({ ...prev, education }));
    },
    [setDraft]
  );

  const setTemplateId = useCallback(
    (templateId: string) => {
      setDraft((prev) => ({
        ...prev,
        studio: { ...(prev.studio || {}), template_id: templateId },
      }));
    },
    [setDraft]
  );

  const replaceFromImport = useCallback(
    (incoming: ResumeContext) => {
      setDraft((prev) => ({
        ...prev,
        ...incoming,
        candidate: { ...(prev.candidate || {}), ...(incoming.candidate || {}) },
        narrative: { ...(prev.narrative || {}), ...(incoming.narrative || {}) },
        experience: incoming.experience?.length ? incoming.experience : prev.experience,
        education: incoming.education?.length ? incoming.education : prev.education,
        studio: { template_id: 'ats-professional', ...(prev.studio || {}), ...(incoming.studio || {}) },
      }));
    },
    [setDraft]
  );

  return {
    draft,
    setDraft,
    openSection,
    setOpenSection,
    saveStatus,
    saveError,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    updateCandidate,
    updateNarrative,
    updateCompetencies,
    updateExperience,
    updateEducation,
    setTemplateId,
    replaceFromImport,
  };
}
