import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import ChaslayShopPageView from './ChaslayShopPageView';

/**
 * Public shop homepage rendered from an active Chaslay Craft.js layout.
 */
export default function ChaslayShopHomePage() {
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);

  if (!shopKey) return null;

  return <ChaslayShopPageView shopKey={shopKey} base={base} pageSlug="home" />;
}
