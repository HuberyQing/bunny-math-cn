import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Bunny } from '../components/Bunny';

export function Feedback({ good, title, note, children }: { good: boolean; title: string; note: string; children: ComponentChildren }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} class={`cn-feedback-sheet ${good ? 'good' : 'bad'}`} aria-label="答题结果" aria-labelledby="cn-feedback-title" aria-describedby="cn-feedback-note" onCancel={(e) => e.preventDefault()}>
    <div class="cn-feedback-inner"><Bunny mood={good ? 'happy' : 'think'} /><div class="cn-feedback-copy"><h2 id="cn-feedback-title">{title}</h2><p id="cn-feedback-note">{note}</p></div><div class="cn-feedback-actions">{children}</div></div>
  </dialog>;
}
