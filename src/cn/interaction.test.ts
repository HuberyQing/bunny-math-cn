import { describe, expect, it } from 'vitest';
import { generate, worksheet, type Method, type Question } from './math';
import { advance, defaults, expected, load, newSession, stats, store, submit } from './state';

const question = (method: Method, a: number, b: number): Question => {
  const q = generate({ topic: method, level: 1, count: 15 }, 7)[0];
  const op = method === 'make10' ? '+' : '−';
  const c = op === '+' ? a + b : a - b;
  return { ...q, kind: 'steps', fact: { a, b, op, c }, answer: String(c), practicedMethod: method };
};

describe('同页三个空格', () => {
  it('每一道方法专项题都使用三个空格，不在中途变回单空题', () => {
    for (const topic of ['make10', 'level10', 'break10'] as const) for (const count of [15, 20] as const) {
      const qs = generate({ topic, count, level: 1 }, 3);
      expect(qs).toHaveLength(count);
      expect(qs.every((q) => q.kind === 'steps' && worksheet(q).answers.length === 3)).toBe(true);
    }
  });
  it('4+7 在 4 下拆出 3 和 1，等号右侧填 11；交换加数时分叉位置随之移动', () => {
    const left = worksheet(question('make10', 4, 7));
    const right = worksheet(question('make10', 7, 4));
    expect(left.target).toBe('a');
    expect(right.target).toBe('b');
    expect(left.answers).toEqual([3, 1, 11]);
    expect(right.answers).toEqual(left.answers);
  });
  it('平十拆减数，破十拆被减数，两个拆分空加一个结果空', () => {
    const level = worksheet(question('level10', 13, 6));
    const broken = worksheet(question('break10', 13, 6));
    expect(level.target).toBe('b');
    expect(level.answers).toEqual([3, 3, 7]);
    expect(broken.target).toBe('a');
    expect(broken.answers).toEqual([10, 3, 7]);
  });
  it.each(['make10', 'level10', 'break10'] as const)('%s 前两格自动移箭头，第三格才触发整题反馈', (method) => {
    const q = method === 'make10' ? question(method, 4, 7) : question(method, 13, 6);
    let s = newSession({ topic: method, count: 15, level: 1 }, 1, [q]);
    for (let slot = 0; slot < 2; slot++) {
      s.input = expected(s);
      s = submit(s);
      expect(s.index).toBe(0);
      expect(s.step).toBe(slot + 1);
      expect(s.feedback).toBe('idle');
      expect(s.input).toBe('');
      expect(s.finished).toBe(false);
      expect(submit(s)).toEqual(s);
    }
    expect(s.records[0].values).toEqual(worksheet(q).parts.map(String));
    s.input = expected(s); s = submit(s);
    expect(s.feedback).toBe('correct');
    expect(s.step).toBe(2);
    expect(s.finished).toBe(false);
    s = advance(s);
    expect(s.finished).toBe(true);
    expect(stats(s).right).toBe(1);
    expect(s.records[0].attempts).toBe(3);
  });
  it('拆分格答错不换题，订正后保留两格内容与首次错误记录', () => {
    let s = newSession({ topic: 'make10', count: 15, level: 1 }, 2, [question('make10', 4, 7)]);
    s.input = '9'; s = submit(s);
    expect(s.step).toBe(0);
    expect(s.feedback).toBe('wrong');
    s.feedback = 'idle'; s.input = expected(s); s = submit(s);
    expect(s.step).toBe(1);
    while (s.feedback === 'idle') { s.input = expected(s); s = submit(s); }
    s = advance(s);
    expect(s.records[0].values).toEqual(['3', '1', '11']);
    expect(s.records[0].firstValues[0]).toBe('9');
    expect(stats(s).right).toBe(0);
    expect(stats(s).corrected).toBe(1);
  });
  it('两次拆分错误可揭示当前格，继续填完后不计为独立订正', () => {
    let s = newSession({ topic: 'break10', count: 15, level: 1 }, 3, [question('break10', 13, 6)]);
    s.input = '9'; s = submit(s); s.feedback = 'idle'; s = submit(s);
    expect(s.feedback).toBe('answer'); s = advance(s);
    expect(s.step).toBe(1);
    expect(s.records[0].values[0]).toBe('10');
    while (s.feedback === 'idle') { s.input = expected(s); s = submit(s); }
    s = advance(s);
    expect(s.records[0].values).toEqual(['10', '3', '7']);
    expect(stats(s).corrected).toBe(0);
  });
});

describe('首页重新开始', () => {
  it('只保存设置和收集记录，不保存或恢复未完成题目，旧存档也忽略当前练习', () => {
    const memory = new Map<string, string>();
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v) } });
    try {
      const saved = { ...defaults(), sound: true, stickers: ['🍓'], current: newSession({ topic: 'make10', count: 15, level: 1 }, 4) };
      saved.current.index = 3;
      store(saved);
      expect(JSON.parse(memory.get('bunny-math-cn:v2')!).current).toBeUndefined();
      expect(load().current).toBeUndefined();
      expect(load().stickers).toEqual(['🍓']);
      expect(load().sound).toBe(true);
      memory.set('bunny-math-cn:v2', JSON.stringify(saved));
      expect(load().current).toBeUndefined();
      const fresh = newSession(saved.config, 5);
      expect(fresh.index).toBe(0);
      expect(fresh.step).toBe(0);
      expect(fresh.records.every((r) => r.attempts === 0)).toBe(true);
    } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else Reflect.deleteProperty(globalThis, 'localStorage'); }
  });
});
