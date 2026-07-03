import { Router } from "express";

const router = Router();

/**
 * GET /api/version
 * Returns the latest app version info for OTA update checks.
 * Update LATEST_VERSION + CHANGELOG here whenever you publish a new APK.
 */

const LATEST_VERSION  = process.env.APP_LATEST_VERSION  ?? "1.1.0";
const MIN_VERSION     = process.env.APP_MIN_VERSION      ?? "1.0.0";
const DOWNLOAD_URL    = process.env.APP_DOWNLOAD_URL     ?? "";
const CHANGELOG       = process.env.APP_CHANGELOG        ?? "Bug fixes and performance improvements.";

router.get("/version", (_req, res) => {
  res.json({
    latestVersion: LATEST_VERSION,
    minVersion:    MIN_VERSION,       // below this → forced update (can't skip)
    downloadUrl:   DOWNLOAD_URL,
    changelog:     CHANGELOG,
    updatedAt:     new Date().toISOString(),
  });
});

export default router;
