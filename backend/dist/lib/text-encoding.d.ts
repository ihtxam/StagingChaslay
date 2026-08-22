/** Catalog text normalization and mojibake repair (UTF-8 read as Latin-1). */
/** Fix UTF-8 bytes mis-read as ISO-8859-1 (e.g. Snacké ? Snack�). */
export declare function repairUtf8Mojibake(text: string): string;
/** Fold en/em/minus/etc. to ASCII `-` so printers and latin1 paths never emit `?`. */
export declare function normalizeDashes(text: string): string;
/** NFC + diameter symbols + ASCII dashes for catalog and print. */
export declare function normalizeCatalogText(text: string): string;
export declare function repairCatalogText(text: string): string;
//# sourceMappingURL=text-encoding.d.ts.map