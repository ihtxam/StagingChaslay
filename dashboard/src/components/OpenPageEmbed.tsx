import { useEffect, useRef, useState } from 'react';
import type { OpenPageSiteConfig } from '@/lib/cms/openpage-types';

const PARENT = 'foodtruckpos';
const CHILD = 'openpage';
/** Hash route lands on the editor without relying on Caddy path rewrites. */
const OPENPAGE_SRC = '/openpage/?embed=1#/editor';

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
  const [error, setError] = useState<string | null>(null);
  const onSavedRef = useRef(onSaved);
  const configRef = useRef(config);
  const modeRef = useRef(mode);
  const titleRef = useRef(title);
  onSavedRef.current = onSaved;
  configRef.current = config;
  modeRef.current = mode;
  titleRef.current = title;

  const postInit = () => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: PARENT,
        type: 'openpage:init',
        config: configRef.current || null,
        mode: modeRef.current,
        title: titleRef.current,
      },
      '*'
    );
  };

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
        setError(null);
        postInit();
        return;
      }
      if (data.type === 'openpage:saved' && data.config && typeof data.html === 'string') {
        onSavedRef.current({ config: data.config, html: data.html });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    postInit();
  }, [config, mode, title, ready]);

  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => {
      setError(
        'OpenPage failed to load. Hard-refresh the page. If it persists, redeploy so /openpage/ is included in the dashboard build.'
      );
    }, 12000);
    return () => window.clearTimeout(t);
  }, [ready]);

  const onIframeLoad = () => {
    // Probe: if the iframe loaded the wrong shell, ready will never fire (timeout shows error).
    try {
      const loc = iframeRef.current?.contentWindow?.location;
      if (loc && typeof loc.pathname === 'string' && !loc.pathname.includes('openpage')) {
        // Cross-origin or swapped document — ignore; timeout handles it.
      }
    } catch {
      /* cross-origin opaque — expected when same-origin policy applies oddly */
    }
  };

  const requestSave = () => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: PARENT, type: 'openpage:requestSave' },
      '*'
    );
  };

  return (
    <div
      className={
        className ||
        'relative h-full min-h-[640px] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-stone-950'
      }
    >
      {!ready ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-stone-950 px-4 text-center text-sm text-stone-300">
          <p>{error || 'Loading OpenPage…'}</p>
          {error ? (
            <a className="text-xs underline text-stone-200" href={OPENPAGE_SRC} target="_blank" rel="noreferrer">
              Open builder in new tab
            </a>
          ) : null}
        </div>
      ) : null}
      <iframe
        ref={iframeRef}
        title="OpenPage builder"
        src={OPENPAGE_SRC}
        className="h-full min-h-[640px] w-full border-0"
        allow="clipboard-read; clipboard-write"
        onLoad={onIframeLoad}
      />
      <button type="button" className="hidden" data-openpage-save onClick={requestSave} />
    </div>
  );
}

export function requestOpenPageSave(container?: HTMLElement | null) {
  const host = container || document;
  const btn = host.querySelector('[data-openpage-save]') as HTMLButtonElement | null;
  btn?.click();
}
