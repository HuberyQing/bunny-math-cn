import { expect, it } from 'vitest';
import { generate, worksheet, type Method, type Question } from './math';
import { advance, expected, isCorrect, newSession, submit } from './state';

it('每轮题序随机，首题不再固定为最小算式', () => {
  const first = new Set(Array.from({ length: 30 }, (_, seed) => JSON.stringify(generate({ topic: 'mixed', level: 1, count: 15 }, seed)[0].fact)));
  expect(first.size).toBeGreaterThan(10);
});
it('综合练习的进退位题都带计算方法和三个框', () => {
  for (const level of [1, 2, 3] as const) for (let seed = 0; seed < 20; seed++) {
    for (const q of generate({ topic: 'mixed', level, count: 20 }, seed)) if (q.allowedMethods.length) {
      expect(q.kind).toBe('steps');
      expect(q.allowedMethods).toContain(q.practicedMethod);
      expect(worksheet(q).answers).toHaveLength(3);
      expect(q.answer).toBe(String(q.fact.c));
    }
  }
});
it.each(['make10','level10','break10'] as Method[])('%s 拆分数正序和倒序均可，第二格严格校验补数', method => {
  const q: Question = generate({ topic: method, level: 1, count: 15 }, 4)[0];
  const w = worksheet(q);
  for (const parts of [w.parts, [...w.parts].reverse()]) {
    let s = newSession({ topic: method, level: 1, count: 15 }, 4, [q]);
    s.input = String(parts[0]); expect(isCorrect(s)).toBe(true); s = submit(s);
    expect(expected(s)).toBe(String(parts[1]));
    s.input = '99'; expect(isCorrect(s)).toBe(false);
    s.input = String(parts[1]); s = submit(s);
    expect(s.step).toBe(2); expect(s.feedback).toBe('idle');
    s.input = String(q.fact.c); s = advance(submit(s));
    expect(s.finished).toBe(true); expect(s.records[0].firstCorrect).toBe(true);
    expect(s.records[0].values).toEqual([...parts.map(String), String(q.fact.c)]);
  }
});
