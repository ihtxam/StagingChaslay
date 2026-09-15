export declare class ChaslayPagebuilderService {
    /** Prefer the homepage row in chaslay_homepage_builder_pages; fall back to builder.editor_state. */
    private static resolvePublishedEditorState;
    /** Keep builder.editor_state aligned with the homepage page row (editor saves to pages). */
    private static syncHomepagePageToBuilder;
    static list(merchantId: string): Promise<{
        id: number;
        name: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
    }[]>;
    static get(merchantId: string, id: number): Promise<{
        id: number;
        name: string;
        editor_state: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
    }>;
    static getActive(merchantId: string): Promise<{
        id: number;
        name: string;
        editor_state: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
    } | null>;
    static create(merchantId: string, input: {
        name: string;
        editor_state?: string | null;
    }): Promise<{
        id: number;
        name: string;
        editor_state: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
    }>;
    static update(merchantId: string, id: number, input: {
        name?: string;
        editor_state?: string;
    }): Promise<{
        id: number;
        name: string;
        editor_state: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
    }>;
    static remove(merchantId: string, id: number): Promise<void>;
    static activate(merchantId: string, id: number): Promise<{
        id: number;
        name: string;
        is_active: boolean;
    }>;
    static deactivate(merchantId: string, id: number): Promise<{
        id: number;
        name: string;
        is_active: boolean;
    }>;
    static listPages(merchantId: string, builderId: number): Promise<{
        id: number;
        homepage_builder_id: number;
        title: string;
        slug: string;
        editor_state: string | null;
        is_homepage: boolean;
        sort_order: number;
    }[]>;
    static createPage(merchantId: string, builderId: number, input: {
        title: string;
        slug: string;
        editor_state?: string | null;
        is_homepage?: boolean;
        sort_order?: number;
    }): Promise<{
        id: number;
        homepage_builder_id: number;
        title: string;
        slug: string;
        editor_state: string | null;
        is_homepage: boolean;
        sort_order: number;
    }>;
    static updatePage(merchantId: string, builderId: number, pageId: number, input: Partial<{
        title: string;
        slug: string;
        editor_state: string;
        is_homepage: boolean;
        sort_order: number;
    }>): Promise<{
        id: number;
        homepage_builder_id: number;
        title: string;
        slug: string;
        editor_state: string | null;
        is_homepage: boolean;
        sort_order: number;
    }>;
    static removePage(merchantId: string, builderId: number, pageId: number): Promise<void>;
    private static assertBuilder;
    /** Published pages from the merchant's active builder layout (empty when none active). */
    static listActivePublishedPages(merchantId: string): Promise<{
        id: number;
        title: string;
        slug: string;
        is_homepage: boolean;
        sort_order: number;
        updated_at: string;
        builder_id: number;
        builder_name: string;
        builder_updated_at: string;
    }[]>;
    /** Resolve one published page from the active builder by slug (`home` maps to homepage row). */
    static getActivePublishedPage(merchantId: string, pageSlug: string): Promise<{
        builder_id: number;
        builder_name: string;
        id: number;
        title: string;
        slug: string;
        is_homepage: boolean;
        editor_state: string;
        updated_at: string;
    } | null>;
}
//# sourceMappingURL=chaslay-pagebuilder.service.d.ts.map