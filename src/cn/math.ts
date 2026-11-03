import { makeRng } from '../lib/rng';

export type Method = 'make10' | 'level10' | 'break10';
export type Topic = 'mixed' | Method;
export type Level = 1 | 2 | 3;
export type Kind = 'input' | 'choice' | 'missing' | 'compare' | 'story' | 'steps';
export type Fact = { a: number; b: number; op: '+' | '−'; c: number };
export type Config = { topic: Topic; level: Level; count: 15 | 20 };
export type Frame = { dots: number; pink?: number; removed?: number; label: string };
export type Step = { caption: string; equation: string; prompt: string; before: string; after: string; answer: number; frames: Frame[]; split?: { whole: number; left: number; right: number } };
export type Question = { id: string; fact: Fact; kind: Kind; answer: string; choices: string[]; than?: number; hidden?: 'a' | 'b'; allowedMethods: Method[]; practicedMethod?: Method; steps: Step[] };

export const METHODS: { id: Method; name: string; short: string; note: string; emoji: string; fact: Fact }[] = [
  { id: 'make10', name: '凑十法', short: '先凑成 10', note: '拆一个加数，凑成十再相加', emoji: '🍓', fact: { a: 8, b: 5, op: '+', c: 13 } },
  { id: 'level10', name: '平十法', short: '先减到 10', note: '拆减数，分两次减', emoji: '🍋', fact: { a: 13, b: 6, op: '−', c: 7 } },
  { id: 'break10', name: '破十法', short: '先从 10 里减', note: '拆被减数，用十减再相加', emoji: '🫐', fact: { a: 13, b: 6, op: '−', c: 7 } },
];
export const LEVELS = [
  { id: 1 as Level, name: '萌芽练习', sub: '10 以内加减法', example: '3 + 4', emoji: '🌱' },
  { id: 2 as Level, name: '慢慢长大', sub: '20 以内 · 不进退位', example: '12 + 3', emoji: '🌷' },
  { id: 3 as Level, name: '小小挑战', sub: '20 以内 · 进退位', example: '8 + 5', emoji: '🌟' },
];
export const methodName = (m: Method) => METHODS.find((x) => x.id === m)!.name;
export const topicName = (c: Config) => c.topic === 'mixed' ? LEVELS[c.level - 1].sub : `${methodName(c.topic)}专项`;
export const expression = (f: Fact) => `${f.a} ${f.op} ${f.b}`;
export const sign = (a: number, b: number) => a < b ? '＜' : a > b ? '＞' : '＝';

/** The two decomposition blanks and final answer stay together on one worksheet. */
export function worksheet(q: Question) {
  const { a, b, c } = q.fact;
  const method = q.practicedMethod!;
  const target = method === 'level10' ? 'b' : method === 'break10' ? 'a' : a <= b ? 'a' : 'b';
  const parts: [number, number] = method === 'make10'
    ? [10 - Math.max(a, b), Math.min(a, b) - (10 - Math.max(a, b))]
    : method === 'level10' ? [a - 10, b - (a - 10)] : [10, a - 10];
  const whole = q.fact[target];
  return {
    target, whole, parts, answers: [...parts, c],
    prompts: method === 'make10' ? ['先凑成 10', '剩下多少？', '一共多少？'] : method === 'level10' ? ['先减到 10', '还要减几？', '还剩多少？'] : ['拆出一个 10', '还有几个一？', '还剩多少？'],
  };
}

export function allowedMethods(f: Fact): Method[] {
  if (f.op === '+' && f.a > 0 && f.a < 10 && f.b > 0 && f.b < 10 && f.c > 10) return ['make10'];
  if (f.op === '−' && f.a > 10 && f.a < 20 && f.b > f.a - 10 && f.b < 10) return ['level10', 'break10'];
  return [];
}

export function pool(config: Config): Fact[] {
  const all: Fact[] = [];
  const max = config.level === 1 ? 10 : 20;
  for (const op of ['+', '−'] as const) for (let a = 0; a <= 20; a++) for (let b = 0; b <= 20; b++) {
    const c = op === '+' ? a + b : a - b;
    if (c < 0 || c > 20) continue;
    const f = { a, b, op, c };
    if (config.topic !== 'mixed') {
      if (allowedMethods(f).includes(config.topic)) all.push(f);
    } else if (Math.max(a, b, c) <= max) {
      if (config.level === 1) all.push(f);
      else if (config.level === 2 && (op === '+' ? a % 10 + b % 10 < 10 : a % 10 >= b % 10)) all.push(f);
      else if (config.level === 3 && allowedMethods(f).length) all.push(f);
    }
  }
  return all;
}

export function explain(f: Fact, method?: Method): Step[] {
  const m = method && allowedMethods(f).includes(method) ? method : allowedMethods(f)[0];
  const { a, b, c } = f;
  if (m === 'make10') {
    const large = Math.max(a, b), small = Math.min(a, b), need = 10 - large, rest = small - need;
    return [
      { caption: `把 ${small} 分成 ${need} 和 ${rest}`, equation: `${small} = ${need} + ${rest}`, prompt: `${small} 可以分成 ${need} 和几？`, before: `${small} = ${need} +`, after: '', answer: rest, split: { whole: small, left: need, right: rest }, frames: [{ dots: large, label: `先留着 ${large} 个` }, { dots: small, pink: small, label: `拆开这 ${small} 个` }] },
      { caption: `先给 ${large} 添上 ${need}，凑成 10`, equation: `${large} + ${need} = 10`, prompt: '先凑成一个十', before: `${large} + ${need} =`, after: '', answer: 10, frames: [{ dots: 10, pink: need, label: '填满十格框啦！' }, { dots: rest, pink: rest, label: `还剩 ${rest} 个` }] },
      { caption: `10 再加 ${rest}，就是 ${c}`, equation: `10 + ${rest} = ${c}`, prompt: '再加上剩下的数', before: `10 + ${rest} =`, after: '', answer: c, frames: [{ dots: 10, pink: need, label: '一个十' }, { dots: rest, pink: rest, label: `${rest} 个一` }] },
    ];
  }
  if (m === 'level10') {
    const ones = a - 10, rest = b - ones;
    return [
      { caption: `把要减的 ${b} 分成 ${ones} 和 ${rest}`, equation: `${b} = ${ones} + ${rest}`, prompt: `把减数 ${b} 分一分`, before: `${b} = ${ones} +`, after: '', answer: rest, split: { whole: b, left: ones, right: rest }, frames: [{ dots: 10, label: '一个十' }, { dots: ones, pink: ones, label: `先拿走这 ${ones} 个` }] },
      { caption: `先减掉 ${ones}，正好到 10`, equation: `${a} − ${ones} = 10`, prompt: '第一步，先减到十', before: `${a} − ${ones} =`, after: '', answer: 10, frames: [{ dots: 10, label: '还剩一个十' }, { dots: ones, pink: ones, removed: ones, label: `先拿走 ${ones} 个` }] },
      { caption: `再减 ${rest}，还剩 ${c}`, equation: `10 − ${rest} = ${c}`, prompt: '再减去剩下的部分', before: `10 − ${rest} =`, after: '', answer: c, frames: [{ dots: 10, removed: rest, label: `再拿走 ${rest} 个，还剩 ${c} 个` }] },
    ];
  }
  if (m === 'break10') {
    const ones = a - 10, rest = 10 - b;
    return [
      { caption: `把 ${a} 分成 10 和 ${ones}`, equation: `${a} = 10 + ${ones}`, prompt: `把被减数 ${a} 分一分`, before: `${a} = 10 +`, after: '', answer: ones, split: { whole: a, left: 10, right: ones }, frames: [{ dots: 10, label: '先从这十个里减' }, { dots: ones, pink: ones, label: `这 ${ones} 个先不动` }] },
      { caption: `先从 10 里减掉 ${b}，剩 ${rest}`, equation: `10 − ${b} = ${rest}`, prompt: '先用十减去减数', before: `10 − ${b} =`, after: '', answer: rest, frames: [{ dots: 10, removed: b, label: `拿走 ${b} 个，剩 ${rest} 个` }, { dots: ones, pink: ones, label: `还有 ${ones} 个` }] },
      { caption: `再加回 ${ones}，就是 ${c}`, equation: `${rest} + ${ones} = ${c}`, prompt: '别忘了加回个位的数', before: `${rest} + ${ones} =`, after: '', answer: c, frames: [{ dots: rest, label: `十里剩下 ${rest} 个` }, { dots: ones, pink: ones, label: `加回 ${ones} 个` }] },
    ];
  }
  const frames = (n: number, label: string, pink = false): Frame[] => n > 10 ? [{ dots: 10, label: '一个十' }, { dots: n - 10, pink: pink ? n - 10 : 0, label }] : [{ dots: n, pink: pink ? n : 0, label }];
  return [
    { caption: f.op === '+' ? `先摆 ${a} 个，再添 ${b} 个` : `先摆 ${a} 个，准备拿走 ${b} 个`, equation: expression(f), prompt: '先看清两个数', before: expression(f), after: '', answer: c, frames: frames(a, `${a} 个`) },
    { caption: f.op === '+' ? `合在一起，一共有 ${c} 个` : `拿走 ${b} 个，还剩 ${c} 个`, equation: `${expression(f)} = ${c}`, prompt: '数一数，一共有多少？', before: `${expression(f)} =`, after: '', answer: c, frames: f.op === '+' ? [...frames(a, `${a} 个`), ...frames(b, `${b} 个`, true)] : a <= 10 ? [{ dots: a, removed: b, label: `还剩 ${c} 个` }] : frames(c, `还剩 ${c} 个`) },
  ];
}

export function generate(config: Config, seed: number): Question[] {
  const rng = makeRng(seed), all = rng.shuffle(pool(config));
  const used = new Set<string>();
  const softUsed = new Set<string>();
  const quotas: Kind[] = config.topic === 'mixed'
    ? [...Array(config.count === 15 ? 6 : 8).fill('input'), ...Array(config.count === 15 ? 4 : 5).fill('choice'), ...Array(config.count === 15 ? 2 : 3).fill('missing'), 'compare', 'compare', ...Array(config.count === 15 ? 1 : 2).fill('story')]
    : Array(config.count).fill('steps');
  const kinds = config.topic === 'mixed' ? rng.shuffle(quotas) : quotas;
  return kinds.map((kind, i) => {
    const op = config.topic === 'mixed' ? (i % 2 ? '−' : '+') : config.topic === 'make10' ? '+' : '−';
    let candidates = all.filter((f) => f.op === op && !used.has(expression(f)));
    const novel = candidates.filter((f) => !softUsed.has(f.op === '+' ? `${Math.min(f.a, f.b)}+${Math.max(f.a, f.b)}` : expression(f)));
    if (novel.length) candidates = novel;
    const nonzero = candidates.filter((f) => f.a > 0 && f.b > 0 && f.c > 0);
    if (nonzero.length && i % 9 !== 8) candidates = nonzero;
    if (i < 3) candidates.sort((a, b) => (a.a + a.b) - (b.a + b.b));
    const fact = candidates[0];
    if (!fact) throw new Error('没有符合当前规则的题目');
    used.add(expression(fact));
    softUsed.add(fact.op === '+' ? `${Math.min(fact.a, fact.b)}+${Math.max(fact.a, fact.b)}` : expression(fact));
    const hidden = rng.chance(0.5) ? 'a' : 'b';
    const than = Math.max(0, Math.min(config.level === 1 && config.topic === 'mixed' ? 10 : 20, fact.c + [-2, 0, 2][i % 3]));
    const answer = kind === 'missing' ? String(fact[hidden]) : kind === 'compare' ? sign(fact.c, than) : String(fact.c);
    const max = config.level === 1 && config.topic === 'mixed' ? 10 : 20;
    const wrongs = rng.shuffle(Array.from({ length: max + 1 }, (_, n) => n).filter((n) => String(n) !== answer));
    wrongs.sort((a, b) => Math.abs(a - Number(answer)) - Math.abs(b - Number(answer)));
    const choices = kind === 'compare' ? ['＜', '＝', '＞'] : rng.shuffle([answer, ...wrongs.slice(0, 2).map(String)]);
    const practicedMethod = config.topic === 'mixed' ? undefined : config.topic;
    return { id: `${seed}-${i}`, fact, kind, answer, choices, hidden, than, allowedMethods: allowedMethods(fact), practicedMethod, steps: explain(fact, practicedMethod) };
  });
}

export function questionText(q: Question): string {
  const f = q.fact;
  if (q.kind === 'missing') return `${q.hidden === 'a' ? '□' : f.a} ${f.op} ${q.hidden === 'b' ? '□' : f.b} = ${f.c}`;
  if (q.kind === 'compare') return `${expression(f)} ○ ${q.than}`;
  return `${expression(f)} = □`;
}

export function story(f: Fact) {
  return f.op === '+' ? `兔兔有 ${f.a} 个苹果，又收到 ${f.b} 个。现在一共有几个？` : `兔兔有 ${f.a} 个苹果，送出 ${f.b} 个。还剩几个？`;
}
