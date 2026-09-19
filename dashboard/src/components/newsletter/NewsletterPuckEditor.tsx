import { useState } from 'react';
import { Puck } from '@measured/puck';
import '@measured/puck/puck.css';
import { newsletterPuckConfig } from './newsletter-puck-config';
import type { Data } from '@measured/puck';
import { normalizePuckData } from '@/lib/newsletter/puck-utils';

type NewsletterPuckEditorProps = {
  data: Data;
  onChange: (data: Data) => void;
  fullPage?: boolean;
  headerTitle?: string;
};

export default function NewsletterPuckEditor({
  data,
  onChange,
  fullPage = false,
  headerTitle = 'Newsletter',
}: NewsletterPuckEditorProps) {
  // Puck treats `data` as mount-only. Parent remounts via `key` when the campaign changes.
  const [initialData] = useState(() => normalizePuckData(data));

  return (
    <div
      className={
        fullPage
          ? 'newsletter-puck-editor newsletter-puck-editor--full overflow-hidden rounded-xl border border-[var(--border)] bg-white'
          : 'newsletter-puck-editor min-h-[520px] overflow-hidden rounded-xl border border-[var(--border)] bg-white'
      }
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Puck
        config={newsletterPuckConfig}
        data={initialData}
        onChange={(next) => onChange(normalizePuckData(next))}
        iframe={{ enabled: false }}
        headerTitle={headerTitle}
        overrides={{
          headerActions: () => <span />,
        }}
      />
    </div>
  );
}
