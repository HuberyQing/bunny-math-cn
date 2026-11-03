import { worksheet, type Question } from './math';

export function Worksheet({ question, active, input, values, reveal = false, printing = false }: {
  question: Question; active: number; input: string; values: string[]; reveal?: boolean; printing?: boolean;
}) {
  const w = worksheet(question), { a, b, op } = question.fact;
  const answer = (index: number) => index === 1 && values[0] !== undefined ? w.whole - Number(values[0]) : w.answers[index];
  const slot = (index: number) => {
    const current = index === active && !printing;
    const value = printing ? '' : current ? reveal ? String(answer(index)) : input : values[index] ?? '';
    return <span class={`cn-work-slot ${current ? 'active' : ''} ${value && !current ? 'filled' : ''}`} role="group" aria-label={`${['拆数左框', '拆数右框', '得数框'][index]}${current ? '，当前填写' : ''}`} data-slot={index}>
      {current && <span class="cn-work-arrow" aria-hidden="true">↓</span>}
      <span class="cn-work-value">{value || '□'}</span>
    </span>;
  };
  const operand = (part: 'a' | 'b', number: number) => <div class="cn-work-operand"><span class="cn-work-number">{number}</span>{w.target === part && <div class="cn-work-split"><svg viewBox="0 0 120 30" aria-hidden="true"><path d="M60 1 L20 27 M60 1 L100 27" /></svg><div>{slot(0)}{slot(1)}</div></div>}</div>;
  return <div class={`cn-worksheet ${printing ? 'is-printing' : ''}`} aria-label={`${a} ${op} ${b}，拆数两个空，得数一个空`}>
    <div class="cn-work-equation">{operand('a', a)}<span class="cn-work-op">{op}</span>{operand('b', b)}<span class="cn-work-op">=</span><div class="cn-work-result">{slot(2)}</div></div>
    {!printing && <p class="cn-work-prompt" aria-live="polite">{reveal ? `这一格填 ${answer(active)}` : w.prompts[active]}<small>第 {active + 1} / 3 格</small></p>}
  </div>;
}
