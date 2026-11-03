import { useEffect, useRef, useState } from 'preact/hooks';
import { Bunny, Star } from '../components/Bunny';
import { sounds, setSound } from '../lib/sound';
import { smallBurst, bigParty } from '../lib/celebrate';
import { STICKERS } from '../lib/storage';
import { randomSeed } from '../lib/rng';
import { LEVELS, METHODS, generate, methodName, questionText, story, topicName, type Config, type Fact, type Method, type Question } from './math';
import { advance, expected, finish, load, newSession, stats, store, submit, type Saved, type Session } from './state';
import { Lesson, Modal, StepPicture } from './Lesson';
import { PrintSheet } from './Print';
import './style.css';

type Screen = 'home' | 'quiz' | 'results' | 'reviewResults' | 'stickers' | 'print';
type View = { saved: Saved; screen: Screen };
type Help = { fact: Fact; methods: Method[]; initial?: Method };
const label = (q: Question) => ({ input: '算一算，把答案填进去', choice: '选一选，哪个答案对？', missing: '想一想，方框里填几？', compare: '比一比，选对小符号', story: '小故事，大智慧', steps: '跟着方法，一步一步来' })[q.kind];

export function App() {
  const [view, setView] = useState<View>(() => { let saved = load(); if (saved.current?.finished) saved = finish(saved, saved.current); return { saved, screen: saved.current ? 'quiz' : 'home' }; });
  const { saved, screen } = view;
  const [help, setHelp] = useState<Help | null>(null);
  const [quit, setQuit] = useState(false);
  const [printData, setPrintData] = useState<{ questions: Question[]; config: Config } | null>(null);
  const [printBack, setPrintBack] = useState<Screen>('home');
  const current = saved.current;
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { store(saved); setSound(saved.sound); }, [saved]);
  useEffect(() => { titleRef.current?.focus(); }, [screen]);
  const go = (next: Screen) => { setHelp(null); setView((v) => ({ ...v, screen: next })); window.scrollTo(0, 0); };
  const config = (patch: Partial<Config>) => setView((v) => ({ ...v, saved: { ...v.saved, config: { ...v.saved.config, ...patch } } }));
  const changeSession = (fn: (s: Session) => Session) => setView((v) => v.saved.current ? { ...v, saved: { ...v.saved, current: fn(v.saved.current) } } : v);
  const start = (questions?: Question[], selectedConfig?: Config) => {
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
    if (correct) { sounds.right(); smallBurst(); } else sounds.wrong();
  };
  const next = () => {
    setView((v) => {
      if (!v.saved.current) return v;
      const s = advance(v.saved.current);
      return s.finished ? { screen: s.review ? 'reviewResults' : 'results', saved: finish(v.saved, s) } : { ...v, saved: { ...v.saved, current: s } };
    });
  };
  useEffect(() => { if (screen === 'results' || screen === 'reviewResults') { sounds.done(); bigParty(); } }, [screen]);
  const resumeRef = useRef({ check, next, keyInput });
  resumeRef.current = { check, next, keyInput };
  useEffect(() => {
    if (screen !== 'quiz' || help || quit) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const button = (e.target as HTMLElement)?.closest('button');
      if (button && (e.key === 'Enter' || e.key === ' ') && !button.closest('.cn-pad, .cn-choices')) return;
      const q = current?.questions[current.index];
      if (!q) return;
      if (e.key === 'Enter') { e.preventDefault(); current?.feedback === 'correct' || current?.feedback === 'answer' ? resumeRef.current.next() : resumeRef.current.check(); }
      else if (e.key === 'Backspace') { e.preventDefault(); resumeRef.current.keyInput('delete'); }
      else if (e.key === 'Escape') resumeRef.current.keyInput('clear');
      else if (/^\d$/.test(e.key) && q.kind !== 'compare' && q.kind !== 'choice') { e.preventDefault(); resumeRef.current.keyInput(e.key); }
    };
    addEventListener('keydown', handler);
    return () => removeEventListener('keydown', handler);
  }, [screen, help, quit, current?.feedback, current?.index]);

  const header = <header class="cn-topbar"><button class="cn-brand" aria-label="兔兔数学，回首页" onClick={() => screen === 'quiz' ? setQuit(true) : go('home')}><span>🐰</span><b>兔兔数学</b><small>一起长大，一起算！</small></button><nav aria-label="工具"><button class="puffy cn-tool" onClick={() => openPrint(screen === 'results' ? saved.last : screen === 'reviewResults' ? saved.lastReview : undefined)} aria-label="打印练习纸">🖨<span>练习纸</span></button><button class="puffy cn-tool" onClick={() => go('stickers')} aria-label="打开贴纸册">🎀<span>贴纸册</span></button><button class="puffy cn-tool" aria-label={saved.sound ? '关闭音效' : '开启音效'} aria-pressed={saved.sound} onClick={() => setView((v) => ({ ...v, saved: { ...v.saved, sound: !v.saved.sound } }))}>{saved.sound ? '🔊' : '🔇'}</button></nav></header>;

  let body;
  if (screen === 'print' && printData) body = <PrintSheet {...printData} onBack={() => go(printBack)} />;
  else if (screen === 'quiz' && current) {
    const q = current.questions[current.index], r = current.records[current.index], guided = q.kind === 'steps';
    const step = guided ? q.steps[current.step] : undefined;
    const selected = current.feedback === 'answer' ? expected(current) : current.input;
    const done = current.feedback === 'correct' || current.feedback === 'answer';
    const equation = q.kind === 'missing' ? <>{q.hidden === 'a' ? <span class="cn-slot">{selected || '?'}</span> : q.fact.a}<em>{q.fact.op}</em>{q.hidden === 'b' ? <span class="cn-slot">{selected || '?'}</span> : q.fact.b}<em>=</em>{q.fact.c}</> : q.kind === 'compare' ? <>{q.fact.a}<em>{q.fact.op}</em>{q.fact.b}<span class="cn-slot">{selected || '?'}</span>{q.than}</> : step ? <>{step.before}<span class="cn-slot">{selected || '?'}</span>{step.after}</> : <>{q.fact.a}<em>{q.fact.op}</em>{q.fact.b}<em>=</em><span class="cn-slot">{selected || '?'}</span></>;
    body = <main class="cn-shell cn-quiz">
      <header class="cn-quiz-header"><button class="puffy icon-btn" aria-label="暂停练习" onClick={() => setQuit(true)}>✕</button><div class="cn-progress-wrap"><p>{current.review ? '错题小练习' : topicName(current.config)}<span>第 {current.index + 1} / {current.questions.length} 题</span></p><progress aria-label="练习进度" max={current.questions.length} value={current.index} /></div><span class="cn-progress-flower">🌸</span></header>
      <div class="cn-quiz-layout"><section class="cn-question-side"><div class="cn-quiz-bunny"><span>{done ? '你在认真进步呢！' : '慢慢想，我陪你～'}</span><Bunny mood={done ? 'happy' : r.firstCorrect === false ? 'think' : 'normal'} /></div><div class="cn-question-card"><span class="tape" /><p class="cn-eyebrow">{guided ? `${methodName(q.practicedMethod!)} · 第 ${current.step + 1} / 3 步` : label(q)}</p>
        {q.kind === 'story' && <div class="cn-story"><span aria-hidden="true">🐰 🍎</span><p>{story(q.fact)}</p></div>}
        {step && <><p class="cn-original">{q.fact.a} {q.fact.op} {q.fact.b} = ?</p><h2 class="cn-guided-prompt">{step.prompt}</h2><StepPicture step={step} practice /><div class="cn-step-history">{q.steps.slice(0, current.step).map((s, i) => <span key={i}>✓ {s.equation}</span>)}</div></>}
        <h1 class={`cn-equation ${guided ? 'guided' : ''}`} ref={titleRef} tabIndex={-1} aria-label={step ? `${step.before}空格` : questionText(q)}>{equation}</h1>
        <button class="puffy cn-hint" onClick={() => showHelp(q)}>💡 帮帮我，看图解</button>
      </div></section><section class="cn-answer-side" aria-label="答案输入">
        <p class="cn-pad-label">{q.kind === 'choice' || q.kind === 'compare' ? '轻轻一点，选好再检查' : '点数字，填进小方框'}</p>
        {q.kind === 'choice' || q.kind === 'compare' ? <div class="cn-choices">{q.choices.map((value) => <button class={`puffy ${selected === value ? 'lilac' : ''}`} key={value} aria-pressed={selected === value} disabled={current.feedback !== 'idle'} onClick={() => setInput(value)}>{value}</button>)}</div> : <div class="cn-pad">{['7', '8', '9', '4', '5', '6', '1', '2', '3', 'delete', '0', 'clear'].map((value) => <button class={`puffy ${value.length > 1 ? 'cn-side-key' : ''}`} key={value} aria-label={value === 'delete' ? '退格' : value === 'clear' ? '清空' : value} disabled={current.feedback !== 'idle'} onClick={() => keyInput(value)}>{value === 'delete' ? '⌫' : value === 'clear' ? '清空' : value}</button>)}</div>}
        {current.feedback === 'idle' && <button class="puffy berry cn-submit" disabled={!selected} onClick={check}>检查答案 ✓</button>}
        {current.feedback !== 'idle' && <div class={`cn-feedback ${current.feedback === 'correct' ? 'good' : 'bad'}`} role="status" aria-live="polite"><h2>{current.feedback === 'correct' ? '✓ 真棒，算对啦！' : current.feedback === 'wrong' ? '再想一想，兔兔陪你！' : `这一步的答案是 ${expected(current)}`}</h2><p>{current.feedback === 'correct' ? guided && current.step < 2 ? '接着完成下一步吧。' : '每一次认真思考，都在进步。' : current.feedback === 'wrong' ? '可以再试一次，也可以看看图解。' : '看懂图解，再继续也很棒。'}</p><div>{current.feedback === 'wrong' ? <><button class="puffy" onClick={() => changeSession((s) => ({ ...s, feedback: 'idle', input: '' }))}>再试一次</button><button class="puffy butter" onClick={() => showHelp(q)}>看图解</button></> : <button class="puffy mint" onClick={next}>{guided && current.step < 2 ? '继续下一步 →' : current.index === current.questions.length - 1 ? '看看我的收获 →' : '下一题 →'}</button>}</div></div>}
        <small class="cn-kind-note">不用着急，这里没有倒计时 ♡</small>
      </section></div>
    </main>;
  } else if ((screen === 'results' && saved.last) || (screen === 'reviewResults' && saved.lastReview)) {
    const s = (screen === 'reviewResults' ? saved.lastReview : saved.last)!, result = stats(s), missed = s.questions.filter((_, i) => s.records[i].firstCorrect === false);
    body = <div class="cn-shell">{header}<main class="cn-results"><div class="cn-result-hero"><Bunny mood="cheer" /><div><p class="cn-eyebrow">{s.review ? '错题小练习' : topicName(s.config)} · 今日小收获</p><h1 ref={titleRef} tabIndex={-1}>完成啦，你真棒！</h1><div class="cn-result-stars" aria-label={`${result.stars} 颗星`}>{[1, 2, 3].map((n) => <Star empty={n > result.stars} key={n} />)}</div></div>{s.sticker && <div class="cn-reward"><span>{s.sticker}</span><b>收好这枚小贴纸</b><small>奖励认真完成的你</small></div>}</div>
      <div class="cn-stats"><div><strong>{result.right}<small> / {result.total}</small></strong><span>第一次就答对</span></div><div><strong>{result.corrected}<small> 题</small></strong><span>订正成功</span></div><div><strong>{result.helped}<small> 题</small></strong><span>使用了帮助</span></div></div>
      {s.config.topic !== 'mixed' && <div class="cn-summary-note"><b>{methodName(s.config.topic)}小记录</b><p>步骤题首次完成 {s.questions.filter((q, i) => q.kind === 'steps' && s.records[i].firstCorrect === true).length} / {s.questions.filter((q) => q.kind === 'steps').length} 题；结果题首次答对 {s.questions.filter((q, i) => q.kind !== 'steps' && s.records[i].firstCorrect === true).length} / {s.questions.filter((q) => q.kind !== 'steps').length} 题。</p><small>结果题只记录计算结果，不推断用了哪种方法。</small></div>}
      <div class="cn-skill-grid">{(['+', '−'] as const).map((op) => { const qs = s.questions.map((q, i) => ({ q, r: s.records[i] })).filter(({ q }) => q.fact.op === op); return qs.length > 0 && <div key={op}><span>{op === '+' ? '🍓 加法' : '🫐 减法'}</span><b>{qs.filter(({ r }) => r.firstCorrect).length} / {qs.length}</b><small>{qs.length < 3 ? '再练练，慢慢熟悉' : '按首次作答统计'}</small></div>; })}</div>
      <div class="cn-result-actions"><button class="puffy berry" onClick={() => start(undefined, s.config)}>再来一轮 →</button>{missed.length > 0 && <button class="puffy butter" onClick={() => start(missed.slice(0, 5), s.config)}>练练错题（{Math.min(missed.length, 5)} 题）</button>}<button class="puffy" onClick={() => openPrint(s)}>打印本轮题目</button>{s.review && saved.last && <button class="puffy butter" onClick={() => go('results')}>回到本轮结果</button>}<button class="puffy" onClick={() => go('home')}>回首页</button></div>
      <section class="cn-review"><h2>{missed.length ? '这些小题，再看看就会啦' : '每一道题都值得回味'}</h2>{s.questions.map((q, i) => <div class="cn-review-row" key={q.id}><span class={s.records[i].firstCorrect ? 'cn-correct-mark' : ''}>{s.records[i].firstCorrect ? '✓' : '♡'}</span><div><b>{questionText(q)}</b><small>正确答案：{q.answer}{s.records[i].helped ? ' · 使用帮助' : ''}{s.records[i].firstCorrect === false ? ` · ${q.kind === 'steps' ? '首次步骤作答' : '首次答案'}：` + (s.records[i].firstValues.join('、') || '未填') : ''}</small></div><button class="puffy" onClick={() => showHelp(q)}>看图解</button></div>)}</section>
    </main></div>;
  } else if (screen === 'stickers') body = <div class="cn-shell">{header}<main class="cn-sticker-screen"><p class="cn-eyebrow">一点点努力，一点点收集</p><h1 ref={titleRef} tabIndex={-1}>我的贴纸小花园 🎀</h1><p>已收集 {saved.stickers.length} / {STICKERS.length} 枚 · 每完成一轮，就有小惊喜</p><div class="cn-sticker-book">{STICKERS.map((s) => <div class={saved.stickers.includes(s) ? 'owned' : ''} key={s} aria-label={saved.stickers.includes(s) ? `已获得贴纸 ${s}` : '尚未获得的贴纸'}>{saved.stickers.includes(s) ? s : '？'}</div>)}</div><button class="puffy mint" onClick={() => go('home')}>回去和兔兔一起练习 →</button><small>贴纸保存在这个浏览器里，清理浏览器数据后会消失。</small></main></div>;
  else {
    const c = saved.config;
    const picked = METHODS.find((x) => x.id === c.topic);
    body = <div class="cn-shell">{header}<main class="cn-home"><section class="cn-welcome"><div class="cn-little-label">给每一位好奇的小小数学家</div><div class="cn-hero-title"><h1 ref={titleRef} tabIndex={-1}>和兔兔一起，<br /><span>把数学变可爱。</span></h1><span class="cn-floating-flower" aria-hidden="true">✿</span></div><p>每天一点点，算出大进步。<br />动动小手，开启今天的数学小冒险！</p><div class="cn-hero-art"><div class="cn-art-ring" /><span class="cn-art-star">✦</span><span class="cn-art-sum">8 + 5 = <b>13</b></span><Bunny mood="happy" /><span class="cn-art-carrot">🥕</span><div class="cn-art-caption">不着急，兔兔陪你一起想 ♡</div></div><div class="cn-benefits"><span>🌱 适合低年级</span><span>✧ 无需登录</span><span>🖨 可打印</span></div></section>
      <section class="cn-practice-card"><span class="cn-card-sticker" aria-hidden="true">🎀</span><p class="cn-eyebrow">今天的数学小冒险</p><h2>今天，想练习什么？</h2><div class="cn-tabs" aria-label="练习模式"><button aria-pressed={c.topic === 'mixed'} onClick={() => config({ topic: 'mixed' })}>✏️ 综合练习</button><button aria-pressed={c.topic !== 'mixed'} onClick={() => config({ topic: c.topic === 'mixed' ? 'make10' : c.topic })}>💡 方法小课堂</button></div>
      <div class="cn-pick-list" aria-label={c.topic === 'mixed' ? '选择难度' : '选择计算方法'}>{c.topic === 'mixed' ? LEVELS.map((l) => <button class={`cn-pick pick-${l.id}`} key={l.id} aria-pressed={c.level === l.id} onClick={() => config({ level: l.id })}><span class="cn-pick-icon">{l.emoji}</span><span><b>{l.name}</b><small>{l.sub}</small></span><strong>{l.example}</strong><i>{c.level === l.id ? '✓' : ''}</i></button>) : METHODS.map((m, i) => <button class={`cn-pick pick-${i + 1}`} key={m.id} aria-pressed={c.topic === m.id} onClick={() => config({ topic: m.id })}><span class="cn-pick-icon">{m.emoji}</span><span><b>{m.name}</b><small>{m.short}</small></span><i>{c.topic === m.id ? '✓' : ''}</i></button>)}</div>
      {picked && <div class="cn-method-preview"><span>{picked.note}</span><button onClick={() => setHelp({ fact: picked.fact, methods: [picked.id], initial: picked.id })}>先看 3 步示例 →</button></div>}
      <div class="cn-count-picker"><span>今天练几题？</span><div class="seg" aria-label="选择练习题数">{([15, 20] as const).map((n) => <button aria-pressed={c.count === n} class={c.count === n ? 'selected' : ''} onClick={() => config({ count: n })} key={n}>{n} 题</button>)}</div></div>
      {saved.current ? <div class="cn-resume"><p>🌷 上次练到第 {saved.current.index + 1} 题啦</p><button class="puffy mint" onClick={() => go('quiz')}>继续上次练习 →</button><button class="cn-text-button" onClick={() => setQuit(true)}>重新开始</button></div> : <button class="puffy berry cn-start" onClick={() => start()}>开始小冒险 <span>→</span></button>}
      <p class="cn-card-note">每次都有新题目 · 慢慢算，不限时</p>{saved.last && <button class="cn-text-button" onClick={() => go('results')}>看看上次的小收获</button>}</section>
    </main><footer class="cn-site-footer"><span>用一点耐心，陪伴每一次小小成长。</span><span>进度只保存在本机 · 纯前端运行</span></footer></div>;
  }
  return <>{body}{screen !== 'print' && <p class="cn-signature">Designed by <span>杨慕筱</span></p>}{help && <Lesson {...help} onClose={() => setHelp(null)} />}{quit && <Modal title={screen === 'quiz' ? '休息一下吗？' : '开始新的小冒险？'} onClose={() => setQuit(false)}><div class="cn-quit"><Bunny mood="think" /><p>{screen === 'quiz' ? '进度已经记好啦，下次还能接着练。' : '重新开始会替换上次未完成的练习。'}</p><div><button class="puffy" onClick={() => setQuit(false)}>继续练习</button><button class="puffy mint" onClick={() => { setQuit(false); if (screen === 'quiz') go('home'); else start(); }}>{screen === 'quiz' ? '保存并回首页' : '重新开始'}</button></div></div></Modal>}</>;
}
