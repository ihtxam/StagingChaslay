/** Sidebar group ids and route paths a reseller can hide from a merchant panel. */
export declare const PANEL_NAV_GROUP_PATHS: Record<string, string[]>;
export declare const PANEL_NAV_ALLOWED_KEYS: Set<string>;
export declare function normalizePanelNavHidden(raw: unknown): string[];
export declare function isPanelNavHidden(path: string, hidden: string[] | null | undefined): boolean;
export declare function isPanelNavGroupHidden(groupId: string, hidden: string[] | null | undefined): boolean;
//# sourceMappingURL=panel-nav-hidden.d.ts.map