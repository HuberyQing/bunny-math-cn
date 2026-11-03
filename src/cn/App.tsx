import { useEffect, useRef, useState } from 'preact/hooks';
import { Bunny, Star } from '../components/Bunny';
import { sounds, setSound } from '../lib/sound';
import { smallBurst, bigParty } from '../lib/celebrate';
import { STICKERS } from '../lib/storage';
import { randomSeed } from '../lib/rng';
import { LEVELS, METHODS, generate, methodName, questionText, story, topicName, type Config, type Fact, type Method, type Question } from './math';
import { advance, expected, finish, load, newSession, stats, store, submit, type Saved, type Session } from './state';
import { Lesson, Modal } from './Lesson';
import { Worksheet } from './Worksheet';
import { Feedback } from './Feedback';
import { PrintSheet } from './Print';
import './style.css';

type Screen = 'home' | 'quiz' | 'results' | 'reviewResults' | 'stickers' | 'print';
type View = { saved: Saved; screen: Screen };
type Help = { fact: Fact; methods: Method[]; initial?: Method };

export function App() {
  const [view, setView] = useState<View>(() => ({ saved: load(), screen: 'home' }));
  const { saved, screen } = view;
  const [help, setHelp] = useState<Help | null>(null);
  const [quit, setQuit] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [printData, setPrintData] = useState<{ questions: Question[]; config: Config } | null>(null);
  const [printBack, setPrintBack] = useState<Screen>('home');
  const current = saved.current;
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { store(saved); setSound(saved.sound); }, [saved]);
  useEffect(() => { titleRef.current?.focus(); }, [screen]);
  const go = (next: Screen) => { setHelp(null); setReviewOpen(false); setView((v) => ({ screen: next, saved: next === 'home' ? { ...v.saved, current: undefined } : v.saved })); window.scrollTo(0, 0); };
  const config = (patch: Partial<Config>) => setView((v) => ({ ...v, saved: { ...v.saved, config: { ...v.saved.config, ...patch } } }));
  const changeSession = (fn: (s: Session) => Session) => setView((v) => v.saved.current ? { ...v, saved: { ...v.saved, current: fn(v.saved.current) } } : v);
  const start = (questions?: Question[], selectedConfig?: Config) => {
    setReviewOpen(false);
    const param = new URLSearchParams(location.search).get('seed');
    const seed = param !== null && /^\d+$/.test(param) && !questions ? Number(param) >>> 0 : randomSeed();
    setView((v) => ({ screen: 'quiz', saved: { ...v.saved, current: newSession(selectedConfig ?? v.saved.config, seed, questions) } }));
    sounds.tap();
  };
  const openPrint = (session?: Session) => {
    setPrintData(session ? { questions: session.questions, config: session.config } : { questions: generate(saved.config, randomSeed()), config: saved.config });
    setPrintBack(screen);
    go('print');
  };
  const showHelp = (q: Question) => {
    if (screen === 'quiz') changeSession((s) => { const copy = structuredClone(s); copy.records[copy.index].helped = true; return copy; });
    setHelp({ fact: q.fact, methods: q.practicedMethod ? [q.practicedMethod] : q.allowedMethods, initial: q.practicedMethod });
  };
  const setInput = (value: string) => changeSession((s) => s.feedback !== 'idle' ? s : { ...s, input: value });
  const keyInput = (key: string) => changeSession((s) => {
    if (s.feedback !== 'idle') return s;
    if (key === 'clear') return { ...s, input: '' };
    if (key === 'delete') return { ...s, input: s.input.slice(0, -1) };
    if (!/^\d$/.test(key)) return s;
    return { ...s, input: (s.input === '0' ? key : s.input + key).slice(0, 2) };
  });
  const check = () => {
    if (!current || current.feedback !== 'idle' || !current.input) return;
    const correct = current.input === expected(current);
    changeSession(submit);
    if (correct) { if (current.questions[current.index].kind === 'steps' && current.step < 2) sounds.tap(); else { sounds.right(); smallBurst(); } } else sounds.wrong();
  };
  const next = () => {
    setView((v) => {
      if (!v.saved.current) return v;
      const s = advance(v.saved.current);
      return s.finished ? { screen: s.review ? 'reviewResults' : 'results', saved: finish(v.saved, s) } : { ...v, saved: { ...v.saved, current: s } };
    });
  };
  useEffect(() => { if (screen === 'results' || screen === 'reviewResults') { sounds.done(); bigParty(); } }, [screen]);
  const controlsRef = useRef({ check, next, keyInput });
  controlsRef.current = { check, next, keyInput };
  useEffect(() => {
    if (screen !== 'quiz' || help || quit) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const button = (e.target as HTMLElement)?.closest('button');
      if (button && (e.key === 'Enter' || e.key === ' ') && !button.closest('.cn-pad, .cn-choices')) return;
      const q = current?.questions[current.index];
      if (!q) return;
      if (e.key === 'Enter') { e.preventDefault(); current?.feedback === 'correct' || current?.feedback === 'answer' ? controlsRef.current.next() : controlsRef.current.check(); }
      else if (e.key === 'Backspace') { e.preventDefault(); controlsRef.current.keyInput('delete'); }
      else if (e.key === 'Escape') controlsRef.current.keyInput('clear');
      else if (/^\d$/.test(e.key) && q.kind !== 'compare' && q.kind !== 'choice') { e.preventDefault(); controlsRef.current.keyInput(e.key); }
    };
    addEventListener('keydown', handler);
    return () => removeEventListener('keydown', handler);
  }, [screen, help, quit, current?.feedback, current?.index]);

  const header = <header class="cn-topbar"><button class="cn-brand" aria-label="兔兔数学，回首页" onClick={() => screen === 'quiz' ? setQuit(true) : go('home')}><span>🐰</span><b>兔兔数学</b></button><nav aria-label="工具"><button class="puffy cn-tool" onClick={() => openPrint(screen === 'results' ? saved.last : screen === 'reviewResults' ? saved.lastReview : undefined)} aria-label="打印练习纸">🖨<span>练习纸</span></button><button class="puffy cn-tool" onClick={() => go('stickers')} aria-label="打开贴纸册">🎀<span>贴纸册</span></button><button class="puffy cn-tool" aria-label={saved.sound ? '关闭音效' : '开启音效'} aria-pressed={saved.sound} onClick={() => setView((v) => ({ ...v, saved: { ...v.saved, sound: !v.saved.sound } }))}>{saved.sound ? '🔊' : '🔇'}</button></nav></header>;

  let body;
  if (screen === 'print' && printData) body = <PrintSheet {...printData} onBack={() => go(printBack)} />;
  else if (screen === 'quiz' && current) {
    const q = current.questions[current.index], r = current.records[current.index], guided = q.kind === 'steps';
    const selected = current.feedback === 'answer' ? expected(current) : current.input;
    const done = current.feedback === 'correct' || current.feedback === 'answer';
    const earlyError = guided && current.step < 2 && current.feedback !== 'idle';
    const equation = q.kind === 'missing'
      ? <>{q.hidden === 'a' ? <span class="cn-slot">{selected || '?'}</span> : q.fact.a}<em>{q.fact.op}</em>{q.hidden === 'b' ? <span class="cn-slot">{selected || '?'}</span> : q.fact.b}<em>=</em>{q.fact.c}</>
      : q.kind === 'compare'
        ? <>{q.fact.a}<em>{q.fact.op}</em>{q.fact.b}<span class="cn-slot">{selected || '?'}</span>{q.than}</>
        : <>{q.fact.a}<em>{q.fact.op}</em>{q.fact.b}<em>=</em><span class="cn-slot">{selected || '?'}</span></>;
    const retry = () => changeSession((s) => ({ ...s, feedback: 'idle', input: '' }));
    const actions = current.feedback === 'wrong'
      ? <><button class="puffy" onClick={retry}>再试试</button>{!earlyError && <button class="puffy butter" onClick={() => showHelp(q)}>💡 图解</button>}</>
      : <button class="puffy mint" onClick={next}>{earlyError ? '下一格 →' : current.index === current.questions.length - 1 ? '看结果 →' : '下一题 →'}</button>;
    body = <main class={`cn-shell cn-quiz ${guided ? 'is-guided' : ''}`}>
      <header class="cn-quiz-header"><button class="puffy icon-btn" aria-label="返回首页" onClick={() => setQuit(true)}>✕</button><div class="cn-progress-wrap"><p>{current.review ? '错题练习' : topicName(current.config)}<span>{current.index + 1} / {current.questions.length}</span></p><progress aria-label="练习进度" max={current.questions.length} value={current.index} /></div><Bunny mood={done ? 'happy' : 'normal'} class="cn-progress-bunny" /></header>
      <div class="cn-quiz-layout"><section class="cn-question-side"><div class="cn-question-card"><span class="tape" />
        <div class="cn-question-heading"><p class="cn-eyebrow">{guided ? methodName(q.practicedMethod!) : { input: '算一算', choice: '选一选', missing: '填一填', compare: '比一比', story: '小故事', steps: '' }[q.kind]}</p></div>
        {q.kind === 'story' && <div class="cn-story"><span aria-hidden="true">🐰 🍎</span><p>{story(q.fact)}</p></div>}
        {guided
          ? <Worksheet question={q} active={current.step} input={current.input} values={r.values} reveal={current.feedback === 'answer'} />
          : <h1 class="cn-equation" ref={titleRef} tabIndex={-1} aria-label={questionText(q)}>{equation}</h1>}
        {earlyError && <div class="cn-inline-error" role="status"><b>{current.feedback === 'wrong' ? '再想想这一格' : `这一格填 ${expected(current)}`}</b><div>{actions}</div></div>}
      </div><div class="cn-hint-row"><button class="puffy butter cn-hint" onClick={() => showHelp(q)}>💡 图解</button></div></section><section class="cn-answer-side" aria-label="答案输入">
        {q.kind === 'choice' || q.kind === 'compare'
          ? <div class="cn-choices">{q.choices.map((value) => <button class={`puffy ${selected === value ? 'lilac' : ''}`} key={value} aria-pressed={selected === value} disabled={current.feedback !== 'idle'} onClick={() => setInput(value)}>{value}</button>)}</div>
          : <div class="cn-pad">{['7', '8', '9', '4', '5', '6', '1', '2', '3', 'delete', '0', 'clear'].map((value) => <button class={`puffy ${value.length > 1 ? 'cn-side-key' : ''}`} key={value} aria-label={value === 'delete' ? '退格' : value === 'clear' ? '清空' : value} disabled={current.feedback !== 'idle'} onClick={() => keyInput(value)}>{value === 'delete' ? '⌫' : value === 'clear' ? '清空' : value}</button>)}</div>}
        <button class="puffy berry cn-submit" disabled={!selected || current.feedback !== 'idle'} onClick={check}>{guided && current.step < 2 ? '填好这格 ✓' : '检查答案 ✓'}</button>
      </section></div>
      {current.feedback !== 'idle' && !earlyError && <Feedback good={current.feedback === 'correct'} title={current.feedback === 'correct' ? '✓ 答对啦！' : current.feedback === 'wrong' ? '再试试' : `答案是 ${expected(current)}`} note={current.feedback === 'wrong' ? '可以看看图解' : current.feedback === 'answer' ? '看懂图解，再继续' : ''}>{actions}</Feedback>}
    </main>;
  } else if ((screen === 'results' && saved.last) || (screen === 'reviewResults' && saved.lastReview)) {
    const s = (screen === 'reviewResults' ? saved.lastReview : saved.last)!, result = stats(s), missed = s.questions.filter((_, i) => s.records[i].firstCorrect === false);
    body = <div class="cn-shell cn-results-shell">{header}<main class="cn-results">
      <div class="cn-result-hero"><Bunny mood="cheer" /><div><h1 ref={titleRef} tabIndex={-1}>完成啦！</h1><div class="cn-result-stars" aria-label={`${result.stars} 颗星`}>{[1, 2, 3].map((n) => <Star empty={n > result.stars} key={n} />)}</div></div>{s.sticker && <div class="cn-reward"><span>{s.sticker}</span><small>新贴纸</small></div>}</div>
      <div class="cn-stats"><div><strong>{result.right}<small> / {result.total}</small></strong><span>首次答对</span></div><div><strong>{result.corrected}<small> 题</small></strong><span>订正成功</span></div><div><strong>{result.helped}<small> 题</small></strong><span>使用帮助</span></div></div>
      {s.config.topic !== 'mixed' && <div class="cn-summary-note"><b>{methodName(s.config.topic)}</b><span>拆数题 {s.questions.filter((q, i) => q.kind === 'steps' && s.records[i].firstCorrect === true).length}/{s.questions.filter((q) => q.kind === 'steps').length}{s.questions.some((q) => q.kind !== 'steps') && <> · 算式题 {s.questions.filter((q, i) => q.kind !== 'steps' && s.records[i].firstCorrect === true).length}/{s.questions.filter((q) => q.kind !== 'steps').length}</>}</span></div>}
      <div class="cn-skill-grid">{(['+', '−'] as const).map((op) => { const qs = s.questions.map((q, i) => ({ q, r: s.records[i] })).filter(({ q }) => q.fact.op === op); return qs.length > 0 && <div key={op}><span>{op === '+' ? '🍓 加法' : '🫐 减法'}</span><b>{qs.filter(({ r }) => r.firstCorrect).length}/{qs.length}</b></div>; })}</div>
      <div class="cn-result-actions"><button class="puffy berry" onClick={() => start(undefined, s.config)}>再来一轮 →</button><button class="puffy" onClick={() => go('home')}>回首页</button>{missed.length > 0 && <button class="puffy butter" onClick={() => start(missed.slice(0, 5), s.config)}>练练错题</button>}<button class="puffy lilac" onClick={() => setReviewOpen(true)}>📖 题目回顾</button>{s.review && saved.last && <button class="puffy" onClick={() => go('results')}>本轮结果</button>}</div>
      {reviewOpen && <Modal title="题目回顾" onClose={() => setReviewOpen(false)} wide><div class="cn-review">{s.questions.map((q, i) => <div class="cn-review-row" key={q.id}><span class={s.records[i].firstCorrect ? 'cn-correct-mark' : ''}>{s.records[i].firstCorrect ? '✓' : '♡'}</span><div><b>{questionText(q)}</b><small>答案：{q.answer}{s.records[i].firstCorrect === false ? ' · 我填：' + (s.records[i].firstValues.join('、') || '未填') : ''}</small></div><button class="puffy" onClick={() => showHelp(q)}>💡 图解</button></div>)}</div></Modal>}
    </main></div>;
  } else if (screen === 'stickers') body = <div class="cn-shell">{header}<main class="cn-sticker-screen"><p class="cn-eyebrow">一点点努力，一点点收集</p><h1 ref={titleRef} tabIndex={-1}>我的贴纸小花园 🎀</h1><p>已收集 {saved.stickers.length} / {STICKERS.length} 枚 · 每完成一轮，就有小惊喜</p><div class="cn-sticker-book">{STICKERS.map((s) => <div class={saved.stickers.includes(s) ? 'owned' : ''} key={s} aria-label={saved.stickers.includes(s) ? `已获得贴纸 ${s}` : '尚未获得的贴纸'}>{saved.stickers.includes(s) ? s : '？'}</div>)}</div><button class="puffy mint" onClick={() => go('home')}>回去和兔兔一起练习 →</button><small>贴纸保存在这个浏览器里，清理浏览器数据后会消失。</small></main></div>;
  else {
    const c = saved.config, picked = METHODS.find((x) => x.id === c.topic);
    body = <div class="cn-shell cn-simple-shell">{header}<main class="cn-home cn-home-simple">
      <div class="cn-home-intro"><Bunny mood="happy" /><h1 ref={titleRef} tabIndex={-1}>兔兔<span>数学</span></h1></div>
      <section class="cn-practice-card">
        <div class="cn-tabs" aria-label="练习模式"><button aria-pressed={c.topic === 'mixed'} onClick={() => config({ topic: 'mixed' })}>✏️ 综合练习</button><button aria-pressed={c.topic !== 'mixed'} onClick={() => config({ topic: c.topic === 'mixed' ? 'make10' : c.topic })}>💡 方法小课堂</button></div>
        <div class="cn-pick-list" aria-label={c.topic === 'mixed' ? '选择难度' : '选择计算方法'}>{c.topic === 'mixed'
          ? LEVELS.map((l) => <button class={`cn-pick pick-${l.id}`} key={l.id} aria-pressed={c.level === l.id} onClick={() => config({ level: l.id })}><span class="cn-pick-icon">{l.emoji}</span><span><b>{l.sub}</b><small>{l.example}</small></span><i>{c.level === l.id ? '✓' : ''}</i></button>)
          : METHODS.map((m, i) => <button class={`cn-pick pick-${i + 1}`} key={m.id} aria-pressed={c.topic === m.id} onClick={() => config({ topic: m.id })}><span class="cn-pick-icon">{m.emoji}</span><span><b>{m.name}</b><small>{m.short}</small></span><i>{c.topic === m.id ? '✓' : ''}</i></button>)}</div>
        <div class="cn-simple-actions"><div class="cn-count-picker"><span>练几题？</span><div class="seg" aria-label="选择练习题数">{([15, 20] as const).map((n) => <button aria-pressed={c.count === n} class={c.count === n ? 'selected' : ''} onClick={() => config({ count: n })} key={n}>{n} 题</button>)}</div></div><button class="puffy berry cn-start" onClick={() => start()}>开始 →</button></div>
        {(picked || saved.last) && <div class="cn-home-extras">{picked && <button class="cn-text-button" onClick={() => setHelp({ fact: picked.fact, methods: [picked.id], initial: picked.id })}>💡 看示例</button>}{saved.last && <button class="cn-text-button" onClick={() => go('results')}>⭐ 上次结果</button>}</div>}
      </section>
    </main></div>;
  }
  return <>{body}{screen !== 'print' && <p class="cn-signature">Designed by <span>杨慕筱</span></p>}{help && <Lesson {...help} onClose={() => setHelp(null)} />}{quit && <Modal title="回首页？" onClose={() => setQuit(false)}><div class="cn-quit"><Bunny mood="think" /><p>本轮结束，下次重新开始。</p><div><button class="puffy" onClick={() => setQuit(false)}>继续答题</button><button class="puffy mint" onClick={() => { setQuit(false); go('home'); }}>回首页</button></div></div></Modal>}</>;
}
