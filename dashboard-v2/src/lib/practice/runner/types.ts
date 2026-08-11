export type PracticeRunLanguage =
  | 'python'
  | 'typescript'
  | 'javascript'
  | 'java'
  | 'cpp'
  | 'c'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'php';

export type PracticeRunRequest = {
  language: PracticeRunLanguage;
  code: string;
  stdin?: string;
};

export type PracticeRunResult = {
  ok: boolean;
  provider: string;
  language: PracticeRunLanguage;
  compiler?: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  timeSec: number | null;
  memoryKb: number | null;
  status: string;
  error?: string;
};

export const PRACTICE_RUN_LANGUAGES: {
  id: PracticeRunLanguage;
  label: string;
}[] = [
  { id: 'python', label: 'Python' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'c', label: 'C' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'php', label: 'PHP' },
];

export const PRACTICE_RUN_MAX_CODE_BYTES = 100_000;
export const PRACTICE_RUN_MAX_STDIN_BYTES = 100_000;

export function isPracticeRunLanguage(value: string): value is PracticeRunLanguage {
  return PRACTICE_RUN_LANGUAGES.some((l) => l.id === value);
}
