import { Puck } from '@measured/puck';
import '@measured/puck/puck.css';
import { newsletterPuckConfig } from './newsletter-puck-config';
import type { Data } from '@measured/puck';
import { normalizePuckData } from '@/lib/newsletter/puck-utils';

type NewsletterPuckEditorProps = {
  data: Data;
  onChange: (data: Data) => void;
  fullPage?: boolean;
};

export default function NewsletterPuckEditor({
  data,
  onChange,
  fullPage = false,
}: NewsletterPuckEditorProps) {
  const safeData = normalizePuckData(data);

  return (
    <div
      className={
        fullPage
          ? 'newsletter-puck-editor newsletter-puck-editor--full overflow-hidden rounded-xl border border-[var(--border)] bg-white'
          : 'newsletter-puck-editor min-h-[520px] overflow-hidden rounded-xl border border-[var(--border)] bg-white'
      }
    >
      <Puck
        config={newsletterPuckConfig}
        data={safeData}
        onChange={(next) => onChange(normalizePuckData(next))}
      />
    </div>
  );
}
