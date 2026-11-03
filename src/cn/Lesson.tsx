import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { explain, expression, methodName, type Fact, type Frame, type Method, type Step } from './math';

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ComponentChildren; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current!; d.showModal(); return () => d.close(); }, []);
  return <dialog ref={ref} class={`cn-dialog ${wide ? 'wide' : ''}`} aria-label={title} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === ref.current) { const r = ref.current!.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <div class="cn-modal-head"><h2>{title}</h2><button class="puffy icon-btn" onClick={onClose} aria-label="关闭面板">✕</button></div>
    {children}
  </dialog>;
}

function TenFrame({ frame }: { frame: Frame }) {
  return <div class="cn-frame-group" role="img" aria-label={`${frame.label}：${frame.dots} 个，拿走 ${frame.removed ?? 0} 个`}>
    <div class="cn-tenframe" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <span class="cn-cell" key={i}>{i < frame.dots && <i class={`${frame.pink && i >= frame.dots - frame.pink ? 'pink' : ''} ${frame.removed && i >= frame.dots - frame.removed ? 'removed' : ''}`}>{frame.removed && i >= frame.dots - frame.removed ? '×' : ''}</i>}</span>)}</div>
    <small>{frame.label}</small>
  </div>;
}

export function StepPicture({ step, practice = false }: { step: Step; practice?: boolean }) {
  return <div class="cn-picture">
    {step.split && <div class="cn-split" role="img" aria-label={`${step.split.whole} 分成 ${step.split.left} 和${practice ? '几' : step.split.right}`}><b>{step.split.whole}</b><span class="cn-branches" aria-hidden="true">╱ ╲</span><div><b>{step.split.left}</b><b>{practice ? '?' : step.split.right}</b></div></div>}
    <div class="cn-frames">{step.frames.map((frame, i) => <TenFrame frame={practice ? { ...frame, label: frame.label.replace(/(还剩|剩)\s*\d+\s*个/g, '数一数剩下多少') } : frame} key={i} />)}</div>
  </div>;
}

export function Lesson({ fact, methods, initial, onClose, suffix }: { fact: Fact; methods: Method[]; initial?: Method; onClose: () => void; suffix?: ComponentChildren }) {
  const [method, setMethod] = useState<Method | undefined>(initial ?? methods[0]);
  const [index, setIndex] = useState(0);
  const steps = explain(fact, method), step = steps[index];
  return <Modal title={method ? `${methodName(method)} · ${expression(fact)}` : `一起算算 · ${expression(fact)}`} onClose={onClose} wide>
    {methods.length > 1 && <div class="cn-method-toggle" aria-label="选择讲解方法">{methods.map((m) => <button class={`puffy ${method === m ? 'butter' : ''}`} aria-pressed={method === m} onClick={() => { setMethod(m); setIndex(0); }} key={m}>{methodName(m)}</button>)}</div>}
    <p class="cn-step-label">第 {index + 1} / {steps.length} 步 · {['拆一拆', '先算一算', '再算一算'][index]}</p>
    <StepPicture step={step} />
    <p class="cn-lesson-equation">{step.equation}</p>
    <p class="cn-lesson-caption" aria-live="polite">{step.caption}</p>
    <div class="cn-lesson-nav"><button class="puffy" disabled={index === 0} onClick={() => setIndex(index - 1)}>上一步</button><div class="steps" aria-label={`第 ${index + 1} 步`}>{steps.map((_, i) => <span class={index === i ? 'on' : ''} key={i} />)}</div><button class="puffy mint" onClick={() => index === steps.length - 1 ? onClose() : setIndex(index + 1)}>{index === steps.length - 1 ? '我明白啦' : '下一步 →'}</button></div>
    {suffix}
  </Modal>;
}
