/** Full notification history page opened from the panel bell “See all entries” link. */
export function platformNotificationsPath(pathname: string): string {
  if (pathname.startsWith('/reseller')) return '/reseller/notifications';
  return '/merchant/notifications';
}

export function isPlatformNotificationsPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/merchant';
  return path === '/merchant/notifications' || path === '/reseller/notifications';
}
