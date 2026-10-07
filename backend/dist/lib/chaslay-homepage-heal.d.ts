/** Wrap legacy OpenPage HTML in a single CustomHTML Craft.js node. */
export declare function buildCustomHtmlEditorState(htmlContent: string): string;
export declare function editorStateFromLegacyCmsBlocks(blocks: unknown, title: string): string | null;
export type HomepageHealResult = {
    resolved: string | null;
    healed: boolean;
};
/** Resolve homepage editor state and persist builder→page heal when the page row is empty. */
export declare function maybePersistHomepagePageHeal(homepagePageId: number | null | undefined, pageState: string | null, builderState: string | null, pageLastGood?: string | null, builderLastGood?: string | null): Promise<HomepageHealResult>;
/** Persist page→builder heal when the builder row is empty but the homepage page has content. */
export declare function maybePersistHomepageBuilderHeal(builderId: number | null | undefined, pageState: string | null, builderState: string | null, pageLastGood?: string | null, builderLastGood?: string | null): Promise<HomepageHealResult>;
/** Heal split-brain in both directions (page row vs builder.editor_state). */
export declare function maybePersistHomepageSplitBrainHeal(homepagePageId: number | null | undefined, builderId: number | null | undefined, pageState: string | null, builderState: string | null, pageLastGood?: string | null, builderLastGood?: string | null): Promise<HomepageHealResult>;
export type MerchantHomepageRepairResult = {
    merchantId: string;
    action: "ok" | "split_brain_healed" | "empty_refilled" | "restored_from_backup" | "bootstrapped_from_legacy" | "bootstrapped_default";
};
/**
 * Repair one merchant's Chaslay homepage:
 * - bootstrap missing builder from legacy CMS or default template
 * - heal split-brain (builder has content, homepage page row empty)
 * - refill fully empty active builder from legacy CMS when available
 */
export declare function repairMerchantChaslayHomepage(merchantId: string): Promise<MerchantHomepageRepairResult | null>;
/** Repair Chaslay homepages for merchants matched by shop slug (e.g. demo, brazza-pizza). */
export declare function repairChaslayHomepagesBySlug(slugs: string[]): Promise<MerchantHomepageRepairResult[]>;
/** Scan merchants with CMS homepage enabled and repair Chaslay builder state. */
export declare function repairAllChaslayHomepages(): Promise<{
    scanned: number;
    repaired: MerchantHomepageRepairResult[];
}>;
//# sourceMappingURL=chaslay-homepage-heal.d.ts.map