import { Router, Request, Response } from "express";
import express from "express";
import {
  DOWNLOADS_ROOT,
  PRINT_AGENT_SETUP_FILE,
  PRINT_BRIDGE_APK_FILE,
  describePrintAgentExe,
  describePrintBridgeApk,
  downloadsFilePath,
  fileMagicOk,
  readDownloadManifest,
} from "@/lib/downloads";

const router = Router();

function sendBinary(res: Response, filePath: string, filename: string, contentType: string) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Encoding", "identity");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.sendFile(filePath);
}

router.get("/reborn-print-bridge.json", (_req: Request, res: Response) => {
  res.json({ success: true, ...describePrintBridgeApk() });
});

router.get("/chaslayreborn-print-agent.json", (_req: Request, res: Response) => {
  const manifest = readDownloadManifest("chaslayreborn-print-agent");
  res.json({
    success: true,
    ...describePrintAgentExe(),
    ...(manifest || {}),
  });
});

router.get("/reborn-print-bridge.apk", (_req: Request, res: Response) => {
  const filePath = downloadsFilePath(PRINT_BRIDGE_APK_FILE);
  if (!fileMagicOk(filePath, "apk")) {
    return res
      .status(404)
      .type("text/plain")
      .send(
        [
          "Reborn Print Bridge APK is not available on this server.",
          "",
          "Ask your administrator to build print-agent-android/ and deploy:",
          "  backend/public/downloads/reborn-print-bridge.apk",
        ].join("\n")
      );
  }
  sendBinary(res, filePath, PRINT_BRIDGE_APK_FILE, "application/vnd.android.package-archive");
});

router.get(`/${PRINT_AGENT_SETUP_FILE}`, (_req: Request, res: Response) => {
  const filePath = downloadsFilePath(PRINT_AGENT_SETUP_FILE);
  if (!fileMagicOk(filePath, "exe")) {
    return res.status(404).type("text/plain").send("Reborn Print Agent installer is not available on this server.");
  }
  sendBinary(res, filePath, PRINT_AGENT_SETUP_FILE, "application/octet-stream");
});

/** Other files in downloads/ (README, etc.) — missing files return 404, not 500. */
router.use(
  express.static(DOWNLOADS_ROOT, {
    fallthrough: true,
    maxAge: "1h",
    setHeaders(res, filePath) {
      if (filePath.endsWith(".exe")) {
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${PRINT_AGENT_SETUP_FILE}"`);
        res.setHeader("Content-Encoding", "identity");
      } else if (filePath.endsWith(".apk")) {
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        res.setHeader("Content-Disposition", `attachment; filename="${PRINT_BRIDGE_APK_FILE}"`);
        res.setHeader("Content-Encoding", "identity");
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=3600");
    },
  })
);

router.use((_req: Request, res: Response) => {
  res.status(404).type("text/plain").send("Download not found");
});

export default router;
