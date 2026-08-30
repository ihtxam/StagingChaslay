import { lazy, Suspense, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { I18nProvider, PANEL_LANG_KEY, SHOP_LANG_KEY, shopLangStorageKey } from '@/lib/i18n';
import { resolveShopKey } from '@/lib/shop-cart';
import { initClientErrorReporting } from '@/lib/client-error-report';
import ShopLocaleSync from '@/components/shop/ShopLocaleSync';

import LoginPage from '@/pages/LoginPage';
import SetPasswordPage from '@/pages/SetPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import SuperadminDashboard from '@/pages/superadmin/Dashboard';
import MerchantDashboard from '@/pages/merchant/Dashboard';
import ResellerDashboard from '@/pages/reseller/Dashboard';
import OrderingPage from '@/pages/shop/OrderingPage';
import CheckoutPage from '@/pages/shop/CheckoutPage';
import TableOrderPage from '@/pages/shop/TableOrderPage';
import OrderConfirmationPage from '@/pages/shop/OrderConfirmationPage';
import GiftCardsPage from '@/pages/shop/GiftCardsPage';
import GiftCardConfirmPage from '@/pages/shop/GiftCardConfirmPage';
import GiftCardViewPage from '@/pages/shop/GiftCardViewPage';
import AccountPage from '@/pages/shop/AccountPage';
import ReservationsPage from '@/pages/shop/ReservationsPage';
import ReceiptPage from '@/pages/ReceiptPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import PosEmbedPage from '@/pages/PosEmbedPage';
import PosViewportManager from '@/components/PosViewportManager';
import KdsDisplayPage from '@/pages/KdsDisplayPage';
import OdsDisplayPage from '@/pages/OdsDisplayPage';
import KioskApp from '@/pages/kiosk/KioskApp';
import KioskLaunchRedirect from '@/pages/kiosk/KioskLaunchRedirect';
import KioskTokenAdminPage from '@/pages/kiosk/KioskTokenAdminPage';
import SignageDisplayPage from '@/pages/SignageDisplayPage';
import StatusPage from '@/pages/StatusPage';
import PwaLaunchGuide from '@/components/PwaLaunchGuide';

const ShopEntry = lazy(() => import('@/pages/shop/ShopEntry'));

function LegacyReceiptRedirect() {
  const { saleId } = useParams();
  if (!saleId) return <Navigate to="/" replace />;
  return <Navigate to={`/receipt/${encodeURIComponent(saleId)}`} replace />;
}

function isWebPosRoute(pathname: string): boolean {
  return (
    /\/merchant\/(?:pos|waiter)(?:\/|$)/.test(pathname) ||
    /^\/kds(?:\/|$)/.test(pathname) ||
    /^\/tv(?:\/|$)/.test(pathname)
  );
}

/** WebPOS uses center-top toasts so they do not cover the right-side menu. */
function AppToaster() {
  const { pathname } = useLocation();
  const webPos = isWebPosRoute(pathname);

  return (
    <Toaster
      position={webPos ? 'top-center' : 'top-right'}
      containerClassName={webPos ? 'webpos-toast-container' : undefined}
      containerStyle={
        webPos
          ? {
              bottom: 'auto',
              height: 'auto',
              pointerEvents: 'none',
              left: '50%',
              right: 'auto',
              width: 'min(92vw, 22rem)',
              transform: 'translateX(-50%)',
              zIndex: 60,
            }
          : undefined
      }
      toastOptions={
        webPos
          ? {
              style: {
                maxWidth: 'min(92vw, 22rem)',
                fontSize: '0.875rem',
              },
            }
          : undefined
      }
    />
  );
}

function ShopRoutes({ children }: { children: React.ReactNode }) {
  const { merchantSlug } = useParams();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const storageKey = shopKey ? shopLangStorageKey(shopKey) : SHOP_LANG_KEY;

  useEffect(() => {
    document.documentElement.classList.add('shop-shell');
    return () => document.documentElement.classList.remove('shop-shell');
  }, []);

  return (
    <I18nProvider storageKey={storageKey}>
      <ShopLocaleSync shopKey={shopKey} />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-stone-500">…</div>
        }
      >
        {children}
      </Suspense>
    </I18nProvider>
  );
}

const MAIN_HOST = (
  import.meta.env.VITE_PUBLIC_DOMAIN ||
  'manupos.webprintmedia.swiss'
).toLowerCase();

/** Reserved hosts that must never be treated as a merchant shop subdomain. */
const RESERVED_SUBDOMAINS = new Set(['admin', 'api', 'pay', 'www', 'app', 'panel', 'status']);

/** Local dev hosts should use panel routes (/login, /merchant), not shop subdomain mode. */
const DEV_PANEL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

function hostParts() {
  const host = window.location.hostname.toLowerCase();
  if (DEV_PANEL_HOSTS.has(host)) return { host, kind: 'main' as const, label: '' };
  if (host === MAIN_HOST) return { host, kind: 'main' as const, label: '' };
  if (!host.endsWith(`.${MAIN_HOST}`)) return { host, kind: 'custom_domain' as const, label: host };
  const label = host.slice(0, -(MAIN_HOST.length + 1));
  if (label === 'shop') return { host, kind: 'shop_hub' as const, label };
  if (label === 'status') return { host, kind: 'status' as const, label };
  if (RESERVED_SUBDOMAINS.has(label)) return { host, kind: 'reserved' as const, label };
  return { host, kind: 'merchant_subdomain' as const, label };
}

function App() {
  const { hydrate } = useAuthStore();
  const { kind } = hostParts();
  const statusMode = kind === 'status';
  const shopHub = kind === 'shop_hub';
  const merchantSubdomain = kind === 'merchant_subdomain';
  const customDomain = kind === 'custom_domain';
  const shopMode = shopHub || merchantSubdomain || customDomain;

  useEffect(() => {
    hydrate();
    initClientErrorReporting();
  }, [hydrate]);

  return (
    <>
      <BrowserRouter>
        <PosViewportManager />
        <Routes>
          {statusMode && (
            <>
              <Route path="/" element={<StatusPage />} />
              <Route path="*" element={<StatusPage />} />
            </>
          )}

          {!shopMode && !statusMode && (
            <Route
              path="/login"
              element={
                <I18nProvider storageKey={PANEL_LANG_KEY}>
                  <LoginPage />
                </I18nProvider>
              }
            />
          )}
          {!shopMode && (
            <Route
              path="/signin"
              element={
                <I18nProvider storageKey={PANEL_LANG_KEY}>
                  <LoginPage />
                </I18nProvider>
              }
            />
          )}
          {!shopMode && (
            <Route
              path="/superadmin/login"
              element={
                <I18nProvider storageKey={PANEL_LANG_KEY}>
                  <LoginPage />
                </I18nProvider>
              }
            />
          )}
          {!shopMode && (
            <Route
              path="/reseller/login"
              element={
                <I18nProvider storageKey={PANEL_LANG_KEY}>
                  <LoginPage />
                </I18nProvider>
              }
            />
          )}
          {!shopMode && (
            <Route
              path="/merchant/login"
              element={
                <I18nProvider storageKey={PANEL_LANG_KEY}>
                  <LoginPage />
                </I18nProvider>
              }
            />
          )}
          {!shopMode && !statusMode && <Route path="/set-password" element={<SetPasswordPage />} />}
          {!shopMode && !statusMode && (
            <Route
              path="/reset-password"
              element={
                <I18nProvider storageKey={PANEL_LANG_KEY}>
                  <ResetPasswordPage />
                </I18nProvider>
              }
            />
          )}
          {!shopMode && !statusMode && (
            <Route
              path="/forgot-password"
              element={
                <I18nProvider storageKey={PANEL_LANG_KEY}>
                  <LoginPage />
                </I18nProvider>
              }
            />
          )}
          {!shopMode && !statusMode && <Route path="/pos-embed" element={<PosEmbedPage />} />}
          <Route
            path="/receipt/:saleId"
            element={
              <I18nProvider storageKey={PANEL_LANG_KEY}>
                <ReceiptPage />
              </I18nProvider>
            }
          />
          <Route path="/receipts/:saleId" element={<LegacyReceiptRedirect />} />
          <Route
            path="/kds/:token"
            element={
              <I18nProvider storageKey={PANEL_LANG_KEY}>
                <KdsDisplayPage />
              </I18nProvider>
            }
          />
          <Route
            path="/kiosk/"
            element={
              <I18nProvider storageKey="reborn-kiosk-lang">
                <KioskLaunchRedirect />
              </I18nProvider>
            }
          />
          <Route
            path="/kiosk"
            element={
              <I18nProvider storageKey="reborn-kiosk-lang">
                <KioskLaunchRedirect />
              </I18nProvider>
            }
          />
          <Route
            path="/kiosk/:token"
            element={
              <I18nProvider storageKey="reborn-kiosk-lang">
                <KioskApp />
              </I18nProvider>
            }
          />
          <Route
            path="/kiosk/:token/admin"
            element={
              <I18nProvider storageKey="reborn-kiosk-lang">
                <KioskTokenAdminPage />
              </I18nProvider>
            }
          />
          <Route
            path="/ods/:token"
            element={
              <I18nProvider storageKey={PANEL_LANG_KEY}>
                <OdsDisplayPage />
              </I18nProvider>
            }
          />
          <Route
            path="/tv/:token"
            element={
              <I18nProvider storageKey={PANEL_LANG_KEY}>
                <SignageDisplayPage />
              </I18nProvider>
            }
          />
          <Route
            path="/shop/:merchantSlug/l/:locationSlug/menu"
            element={
              <ShopRoutes>
                <OrderingPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/l/:locationSlug"
            element={
              <ShopRoutes>
                <ShopEntry />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/l/:locationSlug/checkout"
            element={
              <ShopRoutes>
                <CheckoutPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/l/:locationSlug/order/:orderId"
            element={
              <ShopRoutes>
                <OrderConfirmationPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug"
            element={
              <ShopRoutes>
                <ShopEntry />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/menu"
            element={
              <ShopRoutes>
                <OrderingPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/table/:tableId"
            element={
              <ShopRoutes>
                <TableOrderPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/checkout"
            element={
              <ShopRoutes>
                <CheckoutPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/order/:orderId"
            element={
              <ShopRoutes>
                <OrderConfirmationPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/account"
            element={
              <ShopRoutes>
                <AccountPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/reservations"
            element={
              <ShopRoutes>
                <ReservationsPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/gift-cards"
            element={
              <ShopRoutes>
                <GiftCardsPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/gift-cards/confirm/:purchaseId"
            element={
              <ShopRoutes>
                <GiftCardConfirmPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/gift/:code"
            element={
              <ShopRoutes>
                <GiftCardViewPage />
              </ShopRoutes>
            }
          />

          {/* shop.domain/{slug} - Reborn-style path shops */}
          {shopHub && (
            <>
              <Route
                path="/:merchantSlug/menu"
                element={
                  <ShopRoutes>
                    <OrderingPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug/table/:tableId"
                element={
                  <ShopRoutes>
                    <TableOrderPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug/checkout"
                element={
                  <ShopRoutes>
                    <CheckoutPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug/order/:orderId"
                element={
                  <ShopRoutes>
                    <OrderConfirmationPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug/account"
                element={
                  <ShopRoutes>
                    <AccountPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug/reservations"
                element={
                  <ShopRoutes>
                    <ReservationsPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug/gift-cards"
                element={
                  <ShopRoutes>
                    <GiftCardsPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug/gift-cards/confirm/:purchaseId"
                element={
                  <ShopRoutes>
                    <GiftCardConfirmPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug/gift/:code"
                element={
                  <ShopRoutes>
                    <GiftCardViewPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug"
                element={
                  <ShopRoutes>
                    <ShopEntry />
                  </ShopRoutes>
                }
              />
              <Route
                path="/"
                element={
                  <ShopRoutes>
                    <ShopEntry />
                  </ShopRoutes>
                }
              />
            </>
          )}

          {/* {slug}.domain - merchant subdomain shops */}
          {merchantSubdomain && (
            <>
              <Route
                path="/menu"
                element={
                  <ShopRoutes>
                    <OrderingPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/table/:tableId"
                element={
                  <ShopRoutes>
                    <TableOrderPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/checkout"
                element={
                  <ShopRoutes>
                    <CheckoutPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/order/:orderId"
                element={
                  <ShopRoutes>
                    <OrderConfirmationPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/account"
                element={
                  <ShopRoutes>
                    <AccountPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/reservations"
                element={
                  <ShopRoutes>
                    <ReservationsPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/gift-cards"
                element={
                  <ShopRoutes>
                    <GiftCardsPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/gift-cards/confirm/:purchaseId"
                element={
                  <ShopRoutes>
                    <GiftCardConfirmPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/gift/:code"
                element={
                  <ShopRoutes>
                    <GiftCardViewPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/"
                element={
                  <ShopRoutes>
                    <ShopEntry />
                  </ShopRoutes>
                }
              />
              <Route
                path="*"
                element={
                  <ShopRoutes>
                    <ShopEntry />
                  </ShopRoutes>
                }
              />
            </>
          )}

          {/* Custom merchant domain (apex / www) */}
          {customDomain && (
            <>
              <Route
                path="/menu"
                element={
                  <ShopRoutes>
                    <OrderingPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/table/:tableId"
                element={
                  <ShopRoutes>
                    <TableOrderPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/checkout"
                element={
                  <ShopRoutes>
                    <CheckoutPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/order/:orderId"
                element={
                  <ShopRoutes>
                    <OrderConfirmationPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/account"
                element={
                  <ShopRoutes>
                    <AccountPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/reservations"
                element={
                  <ShopRoutes>
                    <ReservationsPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/gift-cards"
                element={
                  <ShopRoutes>
                    <GiftCardsPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/gift-cards/confirm/:purchaseId"
                element={
                  <ShopRoutes>
                    <GiftCardConfirmPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/gift/:code"
                element={
                  <ShopRoutes>
                    <GiftCardViewPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/"
                element={
                  <ShopRoutes>
                    <ShopEntry />
                  </ShopRoutes>
                }
              />
              <Route
                path="*"
                element={
                  <ShopRoutes>
                    <ShopEntry />
                  </ShopRoutes>
                }
              />
            </>
          )}

          {!shopMode && !statusMode && (
            <>
              <Route
                path="/superadmin/*"
                element={
                  <ProtectedRoute requiredRole="superadmin">
                    <SuperadminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reseller/*"
                element={
                  <ProtectedRoute requiredRole="reseller">
                    <ResellerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/merchant/*"
                element={
                  <ProtectedRoute requiredRole="merchant">
                    <MerchantDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          )}
        </Routes>
        <PwaLaunchGuide />
        <AppToaster />
      </BrowserRouter>
    </>
  );
}

export default App;
