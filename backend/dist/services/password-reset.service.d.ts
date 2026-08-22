import { type JWTPayload } from "@/services/auth.service";
export type ResetAccountRole = "superadmin" | "reseller" | "merchant" | "staff";
type ResetAccount = {
    role: ResetAccountRole;
    accountId: string;
    email: string;
    name: string;
};
export declare class PasswordResetRateLimitError extends Error {
    constructor();
}
export declare class PasswordResetService {
    static genericSentMessage(): string;
    static assertRequestAllowed(ip: string, email: string): void;
    static buildResetUrl(token: string): string;
    static ensureTable(): Promise<void>;
    /**
     * Look up an email across merchant owner, staff, reseller, then superadmin
     * (same order as unified login).
     */
    static findAccountByEmail(email: string): Promise<ResetAccount | null>;
    static requestReset(email: string, ip: string): Promise<{
        success: boolean;
        message: string;
    }>;
    static previewToken(token: string): Promise<{
        email: string;
        role: ResetAccountRole;
        expiresAt: Date;
    }>;
    static applyReset(token: string, newPassword: string): Promise<{
        success: boolean;
        email: string;
        role: string;
    }>;
    static changeOwnPassword(user: JWTPayload, currentPassword: string, newPassword: string): Promise<{
        success: boolean;
    }>;
    private static setPassword;
    private static findValidToken;
    private static sendResetEmail;
}
export {};
//# sourceMappingURL=password-reset.service.d.ts.map