import { schema } from "@/db";
import { SIGNAGE_ORIENTATIONS, SIGNAGE_TEMPLATES, type SignageSchedule } from "@/db/schema";
export declare class SignageLicenseError extends Error {
    constructor(message?: string);
}
export type SignageScreenInput = {
    name: string;
    orientation?: string;
    template?: string;
    playlistId?: string | null;
    screenSizeIn?: number;
};
export declare const SIGNAGE_SCREEN_SIZES: readonly [10, 15, 23, 32, 43, 55, 65];
export type SignagePlaylistInput = {
    name: string;
    template?: string;
    schedule?: SignageSchedule;
};
export type SignageSlideInput = {
    type?: string;
    durationSec?: number;
    sortOrder?: number;
    categoryIds?: string[];
    headline?: string | null;
    body?: string | null;
    imageUrl?: string | null;
    showPrices?: boolean;
    showPhotos?: boolean;
};
export declare function scheduleIsActive(schedule: SignageSchedule | null | undefined, now?: Date): boolean;
export declare class SignageService {
    static overview(merchantId: string): Promise<{
        enabled: boolean;
        screenLimit: number;
        screenCount: number;
    }>;
    static listScreens(merchantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        shortCode: string | null;
        template: string;
        orientation: string;
        screenSizeIn: number;
        playlistId: string | null;
    }[]>;
    static createScreen(merchantId: string, input: SignageScreenInput): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        shortCode: string | null;
        template: string;
        orientation: string;
        screenSizeIn: number;
        playlistId: string | null;
    }>;
    static updateScreen(merchantId: string, id: string, input: Partial<SignageScreenInput>): Promise<{
        id: string;
        merchantId: string;
        name: string;
        token: string;
        shortCode: string | null;
        orientation: string;
        template: string;
        screenSizeIn: number;
        playlistId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static deleteScreen(merchantId: string, id: string): Promise<{
        ok: boolean;
    }>;
    static rotateToken(merchantId: string, id: string): Promise<{
        id: string;
        merchantId: string;
        name: string;
        token: string;
        shortCode: string | null;
        orientation: string;
        template: string;
        screenSizeIn: number;
        playlistId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static listPlaylists(merchantId: string): Promise<{
        slides: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            sortOrder: number;
            imageUrl: string | null;
            categoryIds: string[];
            type: string;
            playlistId: string;
            durationSec: number;
            headline: string | null;
            body: string | null;
            showPrices: boolean;
            showPhotos: boolean;
        }[];
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        template: string;
        schedule: schema.SignageSchedule;
    }[]>;
    static createPlaylist(merchantId: string, input: SignagePlaylistInput): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        template: string;
        schedule: schema.SignageSchedule;
    }>;
    static updatePlaylist(merchantId: string, id: string, input: Partial<SignagePlaylistInput>): Promise<{
        id: string;
        merchantId: string;
        name: string;
        template: string;
        schedule: schema.SignageSchedule;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static deletePlaylist(merchantId: string, id: string): Promise<{
        ok: boolean;
    }>;
    static createSlide(merchantId: string, playlistId: string, input: SignageSlideInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        sortOrder: number;
        imageUrl: string | null;
        categoryIds: string[];
        type: string;
        playlistId: string;
        durationSec: number;
        headline: string | null;
        body: string | null;
        showPrices: boolean;
        showPhotos: boolean;
    }>;
    static updateSlide(merchantId: string, id: string, input: Partial<SignageSlideInput>): Promise<{
        id: string;
        playlistId: string;
        type: string;
        durationSec: number;
        sortOrder: number;
        categoryIds: string[];
        headline: string | null;
        body: string | null;
        imageUrl: string | null;
        showPrices: boolean;
        showPhotos: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static deleteSlide(merchantId: string, id: string): Promise<{
        ok: boolean;
    }>;
    static listCatalog(merchantId: string): Promise<{
        categories: {
            id: string;
            name: string;
        }[];
    }>;
    static playerForToken(token: string): Promise<{
        screen: {
            id: string;
            name: string;
            orientation: "landscape" | "portrait";
            template: "dark_pizza" | "kebab_green" | "cafe_cream" | "portrait_poster" | "lunch_special";
            screenSizeIn: number;
        };
        merchant: {
            name: string;
            logoUrl: string | null;
        };
        playlist: {
            id: string;
            name: string;
            schedule: schema.SignageSchedule;
        } | null;
        slides: {
            id: string;
            type: "menu" | "image" | "image_text";
            durationSec: number;
            categoryIds: string[];
            headline: string | null;
            body: string | null;
            imageUrl: string | null;
            showPrices: boolean;
            showPhotos: boolean;
        }[];
        menu: {
            categories: {
                id: string;
                name: string;
                imageUrl: string | null;
                products: ({
                    id: string;
                    name: string;
                    description: string;
                    price: number;
                    imageUrl: string | null;
                } | null)[];
            }[];
        };
        currency: string;
        serverTime: string;
    }>;
}
export { SIGNAGE_TEMPLATES, SIGNAGE_ORIENTATIONS };
//# sourceMappingURL=signage.service.d.ts.map