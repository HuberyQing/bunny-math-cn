import { describe, it, expect } from 'vitest';
import { allowedMethods, explain, expression, generate, METHODS, pool, sign, type Config, type Fact } from './math';
import { advance, defaults, expected, finish, load, newSession, stats, store, submit } from './state';

const configs: Config[] = [1, 2, 3].flatMap((level) => [15, 20].map((count) => ({ topic: 'mixed', level, count }) as Config));
configs.push(...METHODS.flatMap((m) => [15, 20].map((count) => ({ topic: m.id, level: 1, count }) as Config)));

describe('低年级出题范围、配额和随机复现', () => {
  it('各模式多个种子均不越界、不重复，且答案唯一正确', () => {
    for (const config of configs) for (let seed = 0; seed < 30; seed++) {
      const qs = generate(config, seed);
      expect(qs).toHaveLength(config.count);
      expect(new Set(qs.map((q) => expression(q.fact))).size).toBe(config.count);
      for (const q of qs) {
        const { a, b, c, op } = q.fact;
        expect(c).toBe(op === '+' ? a + b : a - b);
        expect(Math.min(a, b, c)).toBeGreaterThanOrEqual(0);
        expect(Math.max(a, b, c)).toBeLessThanOrEqual(config.topic === 'mixed' && config.level === 1 ? 10 : 20);
        expect(q.allowedMethods).toEqual(allowedMethods(q.fact));
        if (config.topic !== 'mixed') expect(q.allowedMethods).toContain(config.topic);
        else if (config.level === 2) expect(op === '+' ? a % 10 + b % 10 < 10 : a % 10 >= b % 10).toBe(true);
        else if (config.level === 3) expect(q.allowedMethods.length).toBeGreaterThan(0);
        const answer = q.kind === 'missing' ? String(q.fact[q.hidden!]) : q.kind === 'compare' ? sign(c, q.than!) : String(c);
        expect(q.answer).toBe(answer);
        expect(new Set(q.choices).size).toBe(3);
        expect(q.choices).toContain(q.answer);
      }
      if (config.topic === 'mixed') {
        expect(qs.filter((q) => q.fact.op === '+').length).toBe(Math.ceil(config.count / 2));
        expect(qs.filter((q) => q.kind === 'compare')).toHaveLength(2);
        expect(qs.filter((q) => q.kind === 'story')).toHaveLength(config.count === 15 ? 1 : 2);
      } else {
        expect(qs.filter((q) => q.kind === 'steps')).toHaveLength(config.count === 15 ? 6 : 8);
        expect(qs.filter((q) => q.kind === 'input')).toHaveLength(config.count === 15 ? 6 : 8);
        expect(qs.filter((q) => q.kind === 'choice')).toHaveLength(config.count === 15 ? 3 : 4);
      }
    }
  });
  it('同一种子相同题目，不同种子改变题目，种子 0 也有效', () => {
    for (const c of configs) {
      expect(generate(c, 0)).toEqual(generate(c, 0));
      expect(generate(c, 1)).not.toEqual(generate(c, 2));
    }
  });
  it('方法候选拒绝不进退位及恰好等于 10 的题', () => {
    for (const f of [{ a: 8, b: 2, op: '+', c: 10 }, { a: 13, b: 3, op: '−', c: 10 }, { a: 16, b: 2, op: '−', c: 14 }, { a: 10, b: 6, op: '−', c: 4 }] as Fact[]) expect(allowedMethods(f)).toEqual([]);
  });
});

describe('方法讲解与物品守恒', () => {
  it('每个适用算式的拆数、每步等式与最终答案均正确', () => {
    for (const method of METHODS) for (const f of pool({ topic: method.id, count: 20, level: 1 })) {
      const steps = explain(f, method.id);
      expect(steps).toHaveLength(3);
      const split = steps[0].split!;
      expect(split.whole).toBe(split.left + split.right);
      if (method.id === 'make10') expect(split.whole).toBe(Math.min(f.a, f.b));
      if (method.id === 'level10') expect(split.whole).toBe(f.b);
      if (method.id === 'break10') expect(split.whole).toBe(f.a);
      expect(steps.at(-1)!.answer).toBe(f.c);
      for (const s of steps) {
        const parts = s.equation.match(/^(\d+) ([+−=]) (\d+)(?: [+−] (\d+))?(?: = (\d+))?$/)!;
        expect(parts, s.equation).not.toBeNull();
        if (parts[2] === '=') expect(Number(parts[1])).toBe(Number(parts[3]) + Number(parts[4]));
        else expect(parts[2] === '+' ? Number(parts[1]) + Number(parts[3]) : Number(parts[1]) - Number(parts[3])).toBe(Number(parts[5] ?? parts[4]));
        for (const frame of s.frames) { expect(frame.dots).toBeLessThanOrEqual(10); expect(frame.removed ?? 0).toBeLessThanOrEqual(frame.dots); }
      }
      expect(steps.at(-1)!.frames.reduce((n, frame) => n + frame.dots - (frame.removed ?? 0), 0)).toBe(f.c);
    }
  });
  it('同一道减法在平十、破十方法里拆不同的数', () => {
    const f: Fact = { a: 13, b: 6, c: 7, op: '−' };
    expect(explain(f, 'level10').map((s) => s.equation)).toEqual(['6 = 3 + 3', '13 − 3 = 10', '10 − 3 = 7']);
    expect(explain(f, 'break10').map((s) => s.equation)).toEqual(['13 = 10 + 3', '10 − 6 = 4', '4 + 3 = 7']);
  });
});

describe('作答、订正、恢复和奖励', () => {
  const config: Config = { topic: 'make10', level: 1, count: 15 };
  it('步骤题每步只提交一次，三个空只算一道题，整轮题数固定', () => {
    let s = newSession(config, 4);
    let submitted = 0;
    while (!s.finished) {
      s.input = expected(s);
      const checked = submit(s);
      expect(submit(checked)).toEqual(checked);
      s = advance(checked); submitted++;
    }
    expect(submitted).toBe(6 * 3 + 9);
    expect(stats(s)).toEqual({ right: 15, total: 15, helped: 0, corrected: 0, stars: 3 });
    expect(advance(s)).toEqual(s);
  });
  it('保留首次错误，不因订正或打开帮助抹掉首次结果', () => {
    let s = newSession(config, 8);
    s.input = '99'; s = submit(s);
    expect(s.feedback).toBe('wrong');
    s.feedback = 'idle'; s.input = expected(s); s = advance(submit(s));
    s.records[0].helped = true;
    while (s.index === 0) { s.input = expected(s); s = advance(submit(s)); }
    expect(s.records[0].firstCorrect).toBe(false);
    expect(s.records[0].firstValues[0]).toBe('99');
    expect(stats(s).corrected).toBe(1);
    expect(stats(s).right).toBe(0);
  });
  it('第二次错误才揭示答案，揭示后不算订正成功', () => {
    let s = newSession(config, 12);
    s.input = '99'; s = submit(s); s.feedback = 'idle'; s = submit(s);
    expect(s.feedback).toBe('answer'); s = advance(s);
    while (s.index === 0) { s.input = expected(s); s = advance(submit(s)); }
    expect(s.records[0].revealed).toBe(true);
    expect(stats(s).corrected).toBe(0);
  });
  it('0 是有效答案，空输入不提交；重复完成不重复奖励', () => {
    const q = generate({ topic: 'mixed', level: 1, count: 15 }, 8)[0];
    const zero = { ...q, kind: 'input' as const, answer: '0', fact: { a: 2, b: 2, c: 0, op: '−' as const } };
    let s = newSession({ topic: 'mixed', level: 1, count: 15 }, 1, [zero]);
    expect(submit(s)).toEqual(s);
    s.input = '0'; s = advance(submit(s));
    expect(s.finished).toBe(true);
    const saved = finish(defaults(), s), again = finish(saved, s);
    expect(again).toEqual(saved);
    expect(saved.stickers).toHaveLength(1);
  });
  it('本机保存能恢复题内步骤、首次答案和反馈；损坏/禁用存储仍可用', () => {
    const memory = new Map<string, string>();
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v) } });
    try {
      let s = newSession(config, 2); s.input = expected(s); s = advance(submit(s));
      const saved = { ...defaults(), config, current: s }; store(saved);
      expect(load()).toEqual(saved);
      const broken = structuredClone(saved);
      broken.current!.questions[0].steps[0] = null as never;
      memory.set('bunny-math-cn:v2', JSON.stringify(broken));
      expect(load().current).toBeUndefined();
      memory.set('bunny-math-cn:v2', '{broken'); expect(load()).toEqual(defaults());
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
      expect(() => store(saved)).not.toThrow(); expect(load()).toEqual(defaults());
    } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else Reflect.deleteProperty(globalThis, 'localStorage'); }
  });
  it('错题强化单独保存，不替换完整轮次的原始成绩', () => {
    let original = newSession(config, 42);
    while (!original.finished) { original.input = expected(original); original = advance(submit(original)); }
    const saved = finish(defaults(), original);
    let review = newSession(config, 43, original.questions.slice(0, 2));
    while (!review.finished) { review.input = expected(review); review = advance(submit(review)); }
    const updated = finish(saved, review);
    expect(updated.last).toEqual(saved.last);
    expect(updated.lastReview?.questions).toHaveLength(2);
    expect(updated.lastReview?.review).toBe(true);
    expect(stats(updated.last!).total).toBe(15);
  });
});
