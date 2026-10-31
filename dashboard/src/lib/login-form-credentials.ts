/** Read login fields from the DOM so WebView / on-screen keyboard cannot desync react-hook-form. */
export function readLoginFormCredentials(fallback: {
  email: string;
  password: string;
}): { email: string; password: string } {
  if (typeof document === 'undefined') {
    return {
      email: fallback.email.trim().toLowerCase(),
      password: fallback.password,
    };
  }
  const emailEl = document.getElementById('login-email');
  const passEl = document.getElementById('login-password');
  const emailFromDom =
    emailEl instanceof HTMLInputElement ? String(emailEl.value || '').trim() : '';
  const passFromDom =
    passEl instanceof HTMLInputElement ? String(passEl.value || '') : '';
  return {
    email: (emailFromDom || fallback.email).trim().toLowerCase(),
    password: passFromDom || fallback.password,
  };
}
