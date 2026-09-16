import { Puck } from '@measured/puck';
import '@measured/puck/puck.css';
import { newsletterPuckConfig } from './newsletter-puck-config';
import type { Data } from '@measured/puck';

type NewsletterPuckEditorProps = {
  data: Data;
  onChange: (data: Data) => void;
};

export default function NewsletterPuckEditor({ data, onChange }: NewsletterPuckEditorProps) {
  return (
    <div className="newsletter-puck-editor min-h-[520px] overflow-hidden rounded-xl border border-[var(--border)] bg-white">
      <Puck config={newsletterPuckConfig} data={data} onChange={onChange} />
    </div>
  );
}
