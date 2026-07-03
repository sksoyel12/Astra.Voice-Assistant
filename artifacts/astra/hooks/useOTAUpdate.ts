/**
 * useOTAUpdate — checks the API server for a newer app version.
 * Returns update info and a dismiss handler.
 *
 * Version comparison: semver-like (major.minor.patch integers).
 * Forced update when currentVersion < minVersion.
 */

import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CURRENT_VERSION = "1.1.0";           // keep in sync with app.json
const SKIP_KEY        = "@astra_skipped_version";

const API_BASE =
  process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
    : "/api";

interface VersionInfo {
  latestVersion: string;
  minVersion:    string;
  downloadUrl:   string;
  changelog:     string;
}

interface OTAState {
  showModal:     boolean;
  latestVersion: string;
  changelog:     string;
  downloadUrl:   string;
  forced:        boolean;
  dismiss:       () => void;
}

/** Compare semver strings. Returns -1 / 0 / 1 */
function semverCompare(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function useOTAUpdate(enabled = true): OTAState {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [show, setShow] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (!enabled || checked.current) return;
    checked.current = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/version`, { method: "GET" });
        if (!res.ok) return;
        const data: VersionInfo = await res.json();
        const isNewer = semverCompare(data.latestVersion, CURRENT_VERSION) > 0;
        if (!isNewer) return;

        // If forced (below minVersion) always show; otherwise respect skip
        const isForced = semverCompare(CURRENT_VERSION, data.minVersion) < 0;
        if (!isForced) {
          const skipped = await AsyncStorage.getItem(SKIP_KEY).catch(() => null);
          if (skipped === data.latestVersion) return; // user already skipped this version
        }

        setInfo(data);
        setShow(true);
      } catch {
        // Silent — no update check available, app works normally
      }
    })();
  }, [enabled]);

  const dismiss = () => {
    if (info) {
      AsyncStorage.setItem(SKIP_KEY, info.latestVersion).catch(() => {});
    }
    setShow(false);
  };

  const forced = info
    ? semverCompare(CURRENT_VERSION, info.minVersion) < 0
    : false;

  return {
    showModal:     show && !!info,
    latestVersion: info?.latestVersion ?? "",
    changelog:     info?.changelog     ?? "",
    downloadUrl:   info?.downloadUrl   ?? "",
    forced,
    dismiss,
  };
}
