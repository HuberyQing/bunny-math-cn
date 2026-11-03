import { useState } from 'preact/hooks';
import { explain, expression, methodName, pool, questionText, story, topicName, type Config, type Question } from './math';
import { Worksheet } from './Worksheet';

export function PrintSheet({ questions, config, onBack }: { questions: Question[]; config: Config; onBack: () => void }) {
  const [answers, setAnswers] = useState(false);
  const exampleFact = config.topic === 'mixed' ? undefined : pool(config).find((f) => !questions.some((q) => expression(q.fact) === expression(f)));
  const example = exampleFact ? explain(exampleFact, config.topic === 'mixed' ? undefined : config.topic) : undefined;
  return <main class="cn-print">
    <div class="cn-print-toolbar"><button class="puffy" onClick={onBack}>← 返回</button><label><input type="checkbox" checked={answers} onChange={(e) => setAnswers(e.currentTarget.checked)} /> 附上独立答案页</label><button class="puffy berry" onClick={() => window.print()}>🖨 打印 / 存为 PDF</button><p>使用 A4 纸打印；手机上的打印选项由系统提供。</p></div>
    <section class="cn-paper"><header><h1>🐰 兔兔数学 · 练习纸</h1><p>{topicName(config)} · {questions.length} 题</p><div class="cn-paper-info">姓名：____________　日期：____________</div></header>
      {example && config.topic !== 'mixed' && <div class="cn-print-example"><b>{methodName(config.topic)}小示例（不计入题数）</b><p>{example.map((s) => s.equation).join('　→　')}</p></div>}
      <ol class={`cn-print-questions ${example ? 'guided' : ''}`}>{questions.map((q) => <li key={q.id}>{q.kind === 'steps' ? <Worksheet question={q} active={0} input="" values={[]} printing /> : <><b>{q.kind === 'story' ? story(q.fact) : questionText(q)}</b>{q.kind === 'story' && <p>答：________________</p>}{q.kind === 'choice' && <p class="cn-print-options">{q.choices.join('　　')}</p>}</>}</li>)}</ol>
      <footer>慢慢想，认真算，兔兔陪你一起进步！</footer>
    </section>
    {answers && <section class="cn-paper cn-answer-paper"><header><h1>兔兔数学 · 答案页</h1><p>{topicName(config)}</p></header><ol class="cn-print-questions">{questions.map((q) => <li key={q.id}><b>{questionText(q)}　答案：{q.answer}</b>{q.kind === 'steps' && q.steps.map((s, i) => <p key={i}>{s.equation}</p>)}</li>)}</ol></section>}
  </main>;
}
