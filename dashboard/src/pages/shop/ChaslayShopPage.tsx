import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import ChaslayShopPageView from './ChaslayShopPageView';

/** Public Chaslay builder page by slug (not homepage). */
export default function ChaslayShopPage() {
  const { merchantSlug, pageSlug } = useParams<{ merchantSlug?: string; pageSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);
  const slug = pageSlug?.trim() || '';

  if (!shopKey || !slug) {
    return null;
  }

  return <ChaslayShopPageView shopKey={shopKey} base={base} pageSlug={slug} />;
}
