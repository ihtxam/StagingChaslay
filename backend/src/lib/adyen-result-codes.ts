export const ADYEN_SUCCESS_RESULT_CODES = [
  "Authorised",
  "Received",
  "Pending",
  "PresentToShopper",
] as const;

export function isAdyenPaymentSuccess(resultCode: string | null | undefined): boolean {
  const code = String(resultCode || "").trim();
  return ADYEN_SUCCESS_RESULT_CODES.includes(code as (typeof ADYEN_SUCCESS_RESULT_CODES)[number]);
}
