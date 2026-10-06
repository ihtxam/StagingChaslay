import { useEffect, useState } from 'react';
import axios from 'axios';
import { PLATFORM_LEGAL_URLS, type PlatformLegalLinks } from '@/lib/brand';

export function usePlatformLegalUrls(): PlatformLegalLinks {
  const [urls, setUrls] = useState<PlatformLegalLinks>(PLATFORM_LEGAL_URLS);

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/api/shop/platform/legal')
      .then((res) => {
        const data = res.data?.data;
        if (cancelled || !data) return;
        setUrls({
          privacy: String(data.privacy || PLATFORM_LEGAL_URLS.privacy),
          terms: String(data.terms || PLATFORM_LEGAL_URLS.terms),
          cookies: String(data.cookies || PLATFORM_LEGAL_URLS.cookies),
        });
      })
      .catch(() => {
        /* defaults from brand.ts */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return urls;
}
