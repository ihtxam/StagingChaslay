import { Router, Request, Response } from "express";
import express from "express";
import {
  DOWNLOADS_ROOT,
  LEGACY_PRINT_AGENT_SETUP_FILE,
  PRINT_AGENT_SETUP_FILE,
  PRINT_BRIDGE_APK_FILE,
  describePrintAgentExe,
  describePrintBridgeApk,
  downloadsFilePath,
  fileMagicOk,
  readDownloadManifest,
} from "@/lib/downloads";

const router = Router();

function sendBinary(
  res: Response,
  filePath: string,
  filename: string,
  contentType: string,
  disposition: "attachment" | "inline" = "attachment"
) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  res.setHeader("Content-Encoding", "identity");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const cacheControl =
    filename.endsWith(".apk") ? "no-cache, must-revalidate" : "public, max-age=3600";
  res.setHeader("Cache-Control", cacheControl);
  res.sendFile(filePath);
}

router.get("/reborn-print-bridge.json", (_req: Request, res: Response) => {
  res.json({ success: true, ...describePrintBridgeApk() });
});

router.get("/reborn-print-agent.json", (_req: Request, res: Response) => {
  const manifest = readDownloadManifest("reborn-print-agent");
  res.json({
    success: true,
    ...describePrintAgentExe(),
    ...(manifest || {}),
  });
});

/** @deprecated legacy manifest filename */
router.get("/chaslayreborn-print-agent.json", (_req: Request, res: Response) => {
  res.redirect(302, "/downloads/reborn-print-agent.json");
});

/** @deprecated legacy installer filename — redirect to Reborn download */
router.get(`/${LEGACY_PRINT_AGENT_SETUP_FILE}`, (_req: Request, res: Response) => {
  res.redirect(302, `/downloads/${PRINT_AGENT_SETUP_FILE}`);
});

function sendPrintAgentExe(res: Response, downloadName: string) {
  const filePath = downloadsFilePath(PRINT_AGENT_SETUP_FILE);
  if (!fileMagicOk(filePath, "exe")) {
    return res.status(404).type("text/plain").send("Reborn Print Agent installer is not available on this server.");
  }
  sendBinary(res, filePath, downloadName, "application/octet-stream");
}

router.get(`/${PRINT_AGENT_SETUP_FILE}`, (_req: Request, res: Response) => {
  sendPrintAgentExe(res, PRINT_AGENT_SETUP_FILE);
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
  sendBinary(res, filePath, PRINT_BRIDGE_APK_FILE, "application/vnd.android.package-archive", "inline");
});

router.use(
  express.static(DOWNLOADS_ROOT, {
    fallthrough: true,
    maxAge: "1h",
    setHeaders(res, filePath) {
      if (filePath.endsWith(".exe")) {
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Encoding", "identity");
      } else if (filePath.endsWith(".apk")) {
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        res.setHeader("Content-Encoding", "identity");
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (filePath.endsWith(".apk")) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      } else {
        res.setHeader("Cache-Control", "public, max-age=3600");
      }
    },
  })
);

router.use((_req: Request, res: Response) => {
  res.status(404).type("text/plain").send("Download not found");
});

export default router;
