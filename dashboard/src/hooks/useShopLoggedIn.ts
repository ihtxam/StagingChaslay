import { useEffect, useState } from 'react';
import { loadCustomerToken } from '@/lib/shop-cart';

/** Live shop-customer session for Login vs Account chrome. */
export function useShopLoggedIn(shopKey?: string | null) {
  const [loggedIn, setLoggedIn] = useState(() => !!(shopKey && loadCustomerToken(shopKey)));

  useEffect(() => {
    if (!shopKey) {
      setLoggedIn(false);
      return;
    }
    const sync = () => setLoggedIn(!!loadCustomerToken(shopKey));
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('shop-auth-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('shop-auth-changed', sync);
    };
  }, [shopKey]);

  return loggedIn;
}
