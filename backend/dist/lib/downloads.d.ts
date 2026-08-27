export declare const DOWNLOADS_ROOT: string;
export declare const PRINT_AGENT_SETUP_FILE = "reborn-print-agent-setup.exe";
export declare const LEGACY_PRINT_AGENT_SETUP_FILE = "chaslayreborn-print-agent-setup.exe";
export declare const PRINT_BRIDGE_APK_FILE = "reborn-print-bridge.apk";
export declare function downloadsFilePath(filename: string): string;
export declare function readDownloadManifest(baseName: string): Record<string, unknown> | null;
export declare function fileMagicOk(filePath: string, kind: "apk" | "exe"): boolean;
export type DownloadDescriptor = {
    id: string;
    name: string;
    filename: string;
    available: boolean;
    sizeBytes: number;
    version: string | null;
    downloadUrl: string | null;
    message?: string;
};
export declare function describePrintBridgeApk(): DownloadDescriptor;
export declare function describePrintAgentExe(): DownloadDescriptor;
//# sourceMappingURL=downloads.d.ts.map