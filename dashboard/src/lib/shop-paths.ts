/** Build shop auth paths under a merchant base (/shop/demo or /demo). */
export function joinShopPath(
  base: string,
  segment: 'account' | 'register' | 'forgot-password'
): string {
  const b = (base || '').replace(/\/$/, '') || '';
  if (segment === 'account') return `${b}/account`;
  return `${b}/${segment}`;
}
