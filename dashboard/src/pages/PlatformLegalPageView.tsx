import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import DOMPurify from 'isomorphic-dompurify';
import { APP_NAME, getRebornLogoWhiteUrl, PLATFORM_LEGAL_URLS } from '@/lib/brand';

const SLUG_TITLES: Record<string, string> = {
  'privacy-policy': 'Privacy policy',
  'terms-of-use': 'Terms of use',
  'cookie-policy': 'Cookie policy',
};

export default function PlatformLegalPageView() {
  const { pageSlug = 'privacy-policy' } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(SLUG_TITLES[pageSlug] || 'Legal');
  const [htmlContent, setHtmlContent] = useState('');

  const sanitizedHtml = useMemo(
    () =>
      DOMPurify.sanitize(htmlContent, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target', 'rel'],
      }),
    [htmlContent]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get(`/api/shop/platform/legal/pages/${encodeURIComponent(pageSlug)}`)
      .then((res) => {
        if (cancelled) return;
        const page = res.data?.data;
        if (!page?.htmlContent) {
          setError('not_found');
          return;
        }
        setTitle(String(page.title || SLUG_TITLES[pageSlug] || 'Legal'));
        setHtmlContent(String(page.htmlContent));
      })
      .catch(() => {
        if (!cancelled) setError('not_found');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageSlug]);

  const logoUrl = getRebornLogoWhiteUrl();

  return (
    <div className="min-h-screen bg-[#f6f5f2] text-stone-900">
      <header className="border-b border-white/10 bg-[#1a2332]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/login" className="inline-flex shrink-0 items-center" aria-label={APP_NAME}>
            <img
              src={logoUrl}
              alt={APP_NAME}
              className="h-9 w-auto max-w-[160px] object-contain"
              width={160}
              height={40}
            />
          </Link>
          <Link to="/login" className="text-sm text-white/80 underline-offset-2 hover:text-white hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {loading ? (
          <p className="text-sm text-stone-500">Loading…</p>
        ) : error || !sanitizedHtml ? (
          <div className="space-y-3 rounded-2xl border border-stone-200 bg-white px-6 py-8 shadow-sm">
            <h1 className="text-xl font-semibold m-0">{SLUG_TITLES[pageSlug] || 'Legal'}</h1>
            <p className="text-sm text-stone-600 m-0">
              This page is not published yet. Platform administrators can add content under Superadmin →
              Settings → Platform legal.
            </p>
            <p className="text-sm m-0">
              <a
                href={
                  pageSlug === 'terms-of-use'
                    ? PLATFORM_LEGAL_URLS.terms
                    : pageSlug === 'cookie-policy'
                      ? PLATFORM_LEGAL_URLS.cookies
                      : PLATFORM_LEGAL_URLS.privacy
                }
                className="text-[#b91c1c] underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                View default legal page
              </a>
            </p>
          </div>
        ) : (
          <article
            className="rounded-2xl border border-stone-200 bg-white px-6 py-8 shadow-sm sm:px-10 [&_a]:text-[#b91c1c] [&_a]:underline [&_a]:underline-offset-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-1 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5"
            aria-labelledby="platform-legal-title"
          >
            <h1 id="platform-legal-title" className="text-2xl font-bold mb-6">
              {title}
            </h1>
            <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
          </article>
        )}
      </main>
    </div>
  );
}
