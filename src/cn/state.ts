import type { Config, Question } from './math';
import { generate } from './math';
import { STICKERS } from '../lib/storage';

export type Attempt = { firstCorrect: boolean | null; helped: boolean; attempts: number; errors: number[]; values: string[]; firstValues: string[]; revealed: boolean; completed: boolean; solved: boolean };
export type Session = { id: string; config: Config; seed: number; questions: Question[]; records: Attempt[]; index: number; step: number; input: string; feedback: 'idle' | 'correct' | 'wrong' | 'answer'; review: boolean; finished: boolean; sticker?: string };
export type Saved = { version: 2; config: Config; sound: boolean; stickers: string[]; awarded: string[]; current?: Session; last?: Session; lastReview?: Session };
const KEY = 'bunny-math-cn:v2';
export const defaults = (): Saved => ({ version: 2, config: { topic: 'mixed', level: 1, count: 15 }, sound: false, stickers: [], awarded: [] });
const blank = (): Attempt => ({ firstCorrect: null, helped: false, attempts: 0, errors: [], values: [], firstValues: [], revealed: false, completed: false, solved: false });

export function newSession(config: Config, seed: number, questions?: Question[]): Session {
  const qs = questions ?? generate(config, seed);
  return { id: `${seed}-${Date.now()}`, seed, config: { ...config }, questions: qs, records: qs.map(blank), index: 0, step: 0, input: '', feedback: 'idle', review: !!questions, finished: false };
}
export function expected(s: Session) {
  const q = s.questions[s.index];
  return q.kind === 'steps' ? String(q.steps[s.step].answer) : q.answer;
}
export function submit(s: Session): Session {
  if (s.finished || s.feedback !== 'idle' || !s.input) return s;
  const result = structuredClone(s), r = result.records[s.index];
  r.attempts++;
  r.firstValues[s.step] ??= s.input;
  if (s.input === expected(s)) {
    r.values[s.step] = s.input;
    result.feedback = 'correct';
  } else {
    r.firstCorrect = false;
    r.errors[s.step] = (r.errors[s.step] ?? 0) + 1;
    result.feedback = r.errors[s.step] >= 2 ? 'answer' : 'wrong';
    if (result.feedback === 'answer') { r.revealed = true; r.helped = true; }
  }
  return result;
}
export function advance(s: Session): Session {
  if (s.finished || (s.feedback !== 'correct' && s.feedback !== 'answer')) return s;
  const result = structuredClone(s), q = result.questions[result.index], r = result.records[result.index];
  r.values[result.step] = expected(s);
  if (q.kind === 'steps' && result.step < q.steps.length - 1) result.step++;
  else {
    r.completed = true;
    r.solved = !r.revealed;
    r.firstCorrect ??= true;
    if (result.index === result.questions.length - 1) result.finished = true;
    else result.index++;
    result.step = 0;
  }
  result.input = '';
  result.feedback = 'idle';
  return result;
}
export function stats(s: Session) {
  const right = s.records.filter((r) => r.firstCorrect === true).length;
  return { right, total: s.questions.length, helped: s.records.filter((r) => r.helped).length, corrected: s.records.filter((r) => r.firstCorrect === false && r.solved).length, stars: right / s.questions.length >= 0.9 ? 3 : right / s.questions.length >= 0.7 ? 2 : 1 };
}
export function finish(saved: Saved, s: Session): Saved {
  if (!s.finished) return saved;
  const already = saved.awarded.includes(s.id);
  const previous = s.review ? saved.lastReview : saved.last;
  const sticker = already ? s.sticker ?? (previous?.id === s.id ? previous.sticker : undefined) : STICKERS.find((x) => !saved.stickers.includes(x));
  const last = { ...s, sticker };
  return { ...saved, current: undefined, ...(s.review ? { lastReview: last } : { last, lastReview: undefined }), stickers: !already && sticker ? [...saved.stickers, sticker] : saved.stickers, awarded: already ? saved.awarded : [...saved.awarded, s.id].slice(-100) };
}
export function store(saved: Saved) {
  try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* Practice remains available in memory. */ }
}
function validSession(s: unknown): s is Session {
  if (!s || typeof s !== 'object') return false;
  const x = s as Session;
  if (typeof x.id !== 'string' || !validConfig(x.config) || !Array.isArray(x.questions) || !x.questions.length || x.questions.length > 20 || !Array.isArray(x.records) || x.records.length !== x.questions.length) return false;
  if (!Number.isInteger(x.index) || x.index < 0 || x.index >= x.questions.length || !Number.isInteger(x.step) || x.step < 0 || typeof x.input !== 'string' || typeof x.finished !== 'boolean' || typeof x.review !== 'boolean' || !['idle', 'correct', 'wrong', 'answer'].includes(x.feedback)) return false;
  const validQuestions = x.questions.every((q) => {
    if (!q?.fact || typeof q.id !== 'string' || !['input', 'choice', 'missing', 'compare', 'story', 'steps'].includes(q.kind) || !['+', '−'].includes(q.fact.op)) return false;
    if (![q.fact.a, q.fact.b, q.fact.c].every((n) => Number.isInteger(n) && n >= 0 && n <= 20) || q.fact.c !== (q.fact.op === '+' ? q.fact.a + q.fact.b : q.fact.a - q.fact.b)) return false;
    if (typeof q.answer !== 'string' || !Array.isArray(q.choices) || !q.choices.every((n) => typeof n === 'string') || !Array.isArray(q.allowedMethods) || !q.allowedMethods.every((m) => ['make10', 'level10', 'break10'].includes(m))) return false;
    if (q.kind === 'steps' && !q.practicedMethod || q.kind === 'missing' && !['a', 'b'].includes(q.hidden!) || q.kind === 'compare' && !Number.isInteger(q.than)) return false;
    return Array.isArray(q.steps) && q.steps.length >= 2 && q.steps.length <= 3 && q.steps.every((step) => step && typeof step.caption === 'string' && typeof step.equation === 'string' && typeof step.before === 'string' && Number.isInteger(step.answer) && Array.isArray(step.frames) && step.frames.every((f) => f && typeof f.label === 'string' && Number.isInteger(f.dots) && f.dots >= 0 && f.dots <= 10));
  });
  return validQuestions && x.step < x.questions[x.index].steps.length && x.records.every((r) => r && [true, false, null].includes(r.firstCorrect) && typeof r.helped === 'boolean' && typeof r.completed === 'boolean' && typeof r.solved === 'boolean' && typeof r.revealed === 'boolean' && Number.isInteger(r.attempts) && Array.isArray(r.values) && r.values.every((v) => typeof v === 'string') && Array.isArray(r.firstValues) && r.firstValues.every((v) => typeof v === 'string') && Array.isArray(r.errors) && r.errors.every((n) => n === null || Number.isInteger(n)));
}
function validConfig(c: unknown): c is Config {
  const x = c as Config | undefined;
  return !!x && ['mixed', 'make10', 'level10', 'break10'].includes(x.topic) && [1, 2, 3].includes(x.level) && [15, 20].includes(x.count);
}
export function load(): Saved {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved;
    if (!x || x.version !== 2 || !validConfig(x.config)) return defaults();
    const d = defaults();
    return { ...d, config: x.config, sound: x.sound === true, stickers: Array.isArray(x.stickers) ? [...new Set(x.stickers.filter((s) => (STICKERS as readonly string[]).includes(s)))] : [], awarded: Array.isArray(x.awarded) ? x.awarded.filter((s) => typeof s === 'string').slice(-100) : [], current: validSession(x.current) ? x.current : undefined, last: validSession(x.last) && x.last.finished ? x.last : undefined, lastReview: validSession(x.lastReview) && x.lastReview.finished ? x.lastReview : undefined };
  } catch { return defaults(); }
}
