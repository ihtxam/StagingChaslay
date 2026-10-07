export declare function isGrowthSkuAddonEnabled(value: unknown): boolean;
export type GrowthSkuAddonApi = {
    readEnabled: (merchantId: string) => Promise<boolean>;
    writeEnabled: (merchantId: string, enabled: boolean) => Promise<boolean>;
    merchantHasLicense: (merchantId: string) => Promise<boolean>;
};
export declare function createGrowthSkuAddon(config: {
    columnSnake: string;
    columnCamel: string;
    ensureColumn: () => Promise<void>;
}): GrowthSkuAddonApi;
//# sourceMappingURL=growth-sku-addon-lib.d.ts.map