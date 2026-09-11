'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface VoiceMessage {
  id: string;
  role: 'interviewer' | 'candidate';
  text: string;
  timestamp: string;
}

export interface ScorecardData {
  score: number;
  verdict: string;
  summary: string;
  categoryScores: {
    clarity: number;
    technicalDepth: number;
    starStructure: number;
    roleAlignment: number;
  };
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
}

export interface VoiceInterviewConfig {
  company: string;
  role: string;
  roundType: 'behavioral' | 'system-design' | 'technical' | 'hiring-manager';
  difficulty: 'easy' | 'medium' | 'hard';
  durationMinutes: number;
  jdText?: string;
}

export type InterviewStatus =
  | 'idle'
  | 'greeting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'completed';

// Augment window for Web Speech API
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function useVoiceInterview(config: VoiceInterviewConfig) {
  const [status, setStatus] = useState<InterviewStatus>('idle');
  const [transcript, setTranscript] = useState<VoiceMessage[]>([]);
  const [interimText, setInterimText] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(config.durationMinutes * 60);
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isListeningRef = useRef(false);
  const accumulatedCandidateTextRef = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize Speech Synthesis and Voices
  useEffect(() => {
    if (typeof window === 'undefined') return;
    synthRef.current = window.speechSynthesis;

    const updateVoices = () => {
      if (!synthRef.current) return;
      const allVoices = synthRef.current.getVoices();
      const englishVoices = allVoices.filter((v) => v.lang.startsWith('en'));
      const list = englishVoices.length > 0 ? englishVoices : allVoices;
      setVoices(list);

      // Prefer high-quality standard voices
      const preferred = list.find(
        (v) =>
          v.name.includes('Natural') ||
          v.name.includes('Google US English') ||
          v.name.includes('Google UK English Female') ||
          v.name.includes('Samantha') ||
          v.name.includes('Daniel') ||
          v.name.includes('Karen'),
      );
      setSelectedVoice(preferred || list[0] || null);
    };

    updateVoices();
    if (synthRef.current?.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = updateVoices;
    }
  }, []);

  // Check Speech Recognition support
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as unknown as IWindow;
    const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const rec = new Recognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let interim = '';
        let finalized = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalized += trans + ' ';
          } else {
            interim += trans;
          }
        }

        if (finalized) {
          accumulatedCandidateTextRef.current = (
            accumulatedCandidateTextRef.current + ' ' + finalized
          ).trim();
        }
        setInterimText(interim);
      };

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        if (event.error === 'not-allowed') {
          setError('Microphone access was denied. Please allow microphone permissions in browser.');
        }
      };

      rec.onend = () => {
        if (isListeningRef.current) {
          try {
            rec.start();
          } catch {
            // Already started
          }
        }
      };

      recognitionRef.current = rec;
    } catch {
      setSpeechSupported(false);
    }
  }, []);

  // Setup Web Audio Analyser for mic waveform visualization
  const setupAudioAnalyser = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      if (!micStreamRef.current) {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      const source = audioContextRef.current.createMediaStreamSource(micStreamRef.current);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch {
      // Audio level fallback (simulated level while talking)
    }
  }, []);

  const stopAudioAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // TTS speak helper
  const speakText = useCallback(
    (text: string, onDone?: () => void) => {
      if (!synthRef.current || typeof window === 'undefined') {
        onDone?.();
        return;
      }
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = 1.02;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setStatus('speaking');
      };

      utterance.onend = () => {
        setStatus('listening');
        onDone?.();
      };

      utterance.onerror = () => {
        setStatus('listening');
        onDone?.();
      };

      currentUtteranceRef.current = utterance;
      synthRef.current.speak(utterance);
    },
    [selectedVoice],
  );

  // Request next question from API
  const fetchNextQuestion = useCallback(
    async (currentTranscript: VoiceMessage[]) => {
      setStatus('thinking');
      try {
        const res = await fetch('/api/practice/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'next_question',
            company: config.company,
            role: config.role,
            roundType: config.roundType,
            difficulty: config.difficulty,
            transcript: currentTranscript,
            jdText: config.jdText,
          }),
        });

        if (!res.ok) throw new Error('Failed to generate next interview question');
        const data = await res.json();
        const questionText = data.question || 'Could you walk me through your recent project?';

        const newMessage: VoiceMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          role: 'interviewer',
          text: questionText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setTranscript((prev) => {
          const updated = [...prev, newMessage];
          speakText(questionText);
          return updated;
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error reaching AI interviewer';
        setError(msg);
        setStatus('listening');
      }
    },
    [config, speakText],
  );

  // Scoring request
  const evaluateInterview = useCallback(async () => {
    setStatus('thinking');
    if (synthRef.current) synthRef.current.cancel();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    stopAudioAnalyser();

    try {
      const res = await fetch('/api/practice/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'score',
          company: config.company,
          role: config.role,
          roundType: config.roundType,
          difficulty: config.difficulty,
          transcript,
          jdText: config.jdText,
        }),
      });

      if (!res.ok) throw new Error('Scoring failed');
      const data = await res.json();
      setScorecard(data.scorecard);
      setStatus('completed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error scoring interview';
      setError(msg);
      setStatus('completed');
    }
  }, [config, transcript, stopAudioAnalyser]);

  // Start interview session
  const startInterview = useCallback(async () => {
    setError(null);
    setTranscript([]);
    setScorecard(null);
    accumulatedCandidateTextRef.current = '';
    setTimeRemaining(config.durationMinutes * 60);

    // Warm up audio
    void setupAudioAnalyser();

    // Start countdown
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Trigger opening greeting
    await fetchNextQuestion([]);
  }, [config.durationMinutes, fetchNextQuestion, setupAudioAnalyser]);

  // End interview early or automatically when timer hits 0
  useEffect(() => {
    if (timeRemaining === 0 && status !== 'completed' && status !== 'idle' && status !== 'thinking') {
      void evaluateInterview();
    }
  }, [timeRemaining, status, evaluateInterview]);

  // Hold-to-talk controls
  const startListening = useCallback(() => {
    if (status === 'completed' || status === 'thinking') return;
    if (synthRef.current) {
      synthRef.current.cancel(); // Stop interviewer if interrupted
    }

    isListeningRef.current = true;
    accumulatedCandidateTextRef.current = '';
    setInterimText('');
    setStatus('listening');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        // Recognition already running
      }
    }
  }, [status]);

  const stopListeningAndSend = useCallback(() => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const fullCandidateText = (
      accumulatedCandidateTextRef.current + ' ' + interimText
    ).trim();

    setInterimText('');
    accumulatedCandidateTextRef.current = '';

    if (!fullCandidateText || fullCandidateText.length < 2) {
      // User tapped without speaking
      setStatus('listening');
      return;
    }

    const candidateMsg: VoiceMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: 'candidate',
      text: fullCandidateText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTranscript((prev) => {
      const updated = [...prev, candidateMsg];
      void fetchNextQuestion(updated);
      return updated;
    });
  }, [interimText, fetchNextQuestion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (synthRef.current) synthRef.current.cancel();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return {
    status,
    transcript,
    interimText,
    timeRemaining,
    scorecard,
    error,
    speechSupported,
    voices,
    selectedVoice,
    setSelectedVoice,
    audioLevel,
    startInterview,
    startListening,
    stopListeningAndSend,
    evaluateInterview,
    reset: () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (synthRef.current) synthRef.current.cancel();
      setStatus('idle');
      setTranscript([]);
      setScorecard(null);
      setError(null);
    },
  };
}
