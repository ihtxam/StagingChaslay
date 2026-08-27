/** Where a staff member lands after email/password sign-in. */
export type StaffLoginHome = "auto" | "panel" | "pos";
export declare function normalizeStaffLoginHome(raw: unknown): StaffLoginHome;
export declare function loginHomeFromPermissions(permissions: string[], canAccessPanel: boolean): StaffLoginHome;
export declare function assertLoginHomeAllowed(loginHome: StaffLoginHome, permissions: string[], canAccessPanel: boolean): void;
//# sourceMappingURL=staff-login-home.d.ts.map