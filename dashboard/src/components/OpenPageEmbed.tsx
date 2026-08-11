import { useEffect, useRef, useState } from 'react';
import type { OpenPageSiteConfig } from '@/lib/cms/openpage-types';

const PARENT = 'foodtruckpos';
const CHILD = 'openpage';

type Props = {
  mode?: 'page' | 'newsletter';
  title?: string;
  config?: OpenPageSiteConfig | null;
  className?: string;
  /** Called when the OpenPage editor posts a Save. */
  onSaved: (payload: { config: OpenPageSiteConfig; html: string }) => void;
};

/**
 * Embeds the self-hosted OpenPage builder (buildingopen/openpage) via iframe.
 * Built assets are served from /openpage/ (copied from openpage/dist).
 */
export default function OpenPageEmbed({
  mode = 'page',
  title,
  config,
  className,
  onSaved,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data as {
        source?: string;
        type?: string;
        config?: OpenPageSiteConfig;
        html?: string;
      };
      if (!data || data.source !== CHILD) return;
      if (data.type === 'openpage:ready') {
        setReady(true);
        iframeRef.current?.contentWindow?.postMessage(
          {
            source: PARENT,
            type: 'openpage:init',
            config: config || null,
            mode,
            title,
          },
          '*'
        );
        return;
      }
      if (data.type === 'openpage:saved' && data.config && typeof data.html === 'string') {
        onSavedRef.current({ config: data.config, html: data.html });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [config, mode, title]);

  useEffect(() => {
    if (!ready) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: PARENT,
        type: 'openpage:init',
        config: config || null,
        mode,
        title,
      },
      '*'
    );
  }, [config, mode, title, ready]);

  const requestSave = () => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: PARENT, type: 'openpage:requestSave' },
      '*'
    );
  };

  return (
    <div className={className || 'relative h-full min-h-[640px] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-stone-950'}>
      {!ready ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-950 text-sm text-stone-300">
          Loading OpenPage…
        </div>
      ) : null}
      <iframe
        ref={iframeRef}
        title="OpenPage builder"
        src="/openpage/?embed=1"
        className="h-full min-h-[640px] w-full border-0"
        allow="clipboard-read; clipboard-write"
      />
      {/* Hidden helper for parents that want to trigger save programmatically */}
      <button type="button" className="hidden" data-openpage-save onClick={requestSave} />
    </div>
  );
}

export function requestOpenPageSave(container?: HTMLElement | null) {
  const host = container || document;
  const btn = host.querySelector('[data-openpage-save]') as HTMLButtonElement | null;
  btn?.click();
}
