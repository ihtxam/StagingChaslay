import type { MerchantBrevoSettings, MerchantSmtpSettings } from "@/db/schema";
/** Display name shown in From / Reply-To for merchant-facing mail. */
export declare function merchantSenderDisplayName(merchantName: string | null | undefined): string;
/** Merchant inbox for customer replies — settings email first, then configured SMTP/Brevo from. */
export declare function resolveMerchantContactEmail(input: {
    email?: string | null;
    smtpSettings?: MerchantSmtpSettings | null;
    brevoSettings?: MerchantBrevoSettings | null;
}): string | null;
/** RFC-style mailbox for Reply-To / SMTP headers: `"Shop Name" <shop@example.com>`. */
export declare function formatMailAddress(email: string, name?: string | null): string;
//# sourceMappingURL=merchant-email-address.d.ts.map