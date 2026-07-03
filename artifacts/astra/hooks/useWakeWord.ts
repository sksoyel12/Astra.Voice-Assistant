/**
 * useWakeWord — Voice Activity Detection (VAD) based wake trigger.
 * Now exports a real-time `volumeLevel` (0-1) so the SiriOrb can
 * visually breathe with the user's voice.
 */

import { Audio } from "expo-av";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";

const SEGMENT_MS     = 1500;
const POLL_MS        = 80;
const VAD_THRESHOLD  = -30;    // dBFS — above this = someone talking
const MIN_DETECTIONS = 3;
const WAKE_TAG       = "ASTRA_WAKE";

// Maps raw dBFS (typically -160 to 0) to 0-1 range for UI use
function dbToLevel(db: number): number {
  const clamped = Math.max(-60, Math.min(0, db));
  return (clamped + 60) / 60;
}

export type WakeWordState = "idle" | "armed" | "detected" | "error";

interface UseWakeWordOptions {
  onWakeDetected: () => void;
}

export function useWakeWord({ onWakeDetected }: UseWakeWordOptions) {
  const [state, setState]             = useState<WakeWordState>("idle");
  const [micPermission, setMicPerm]   = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const loopRef      = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const hitsRef      = useRef(0);

  // ── cleanup ────────────────────────────────────────────────────────────────

  const cleanupRecording = useCallback(async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) return;
    try {
      const status = await rec.getStatusAsync();
      if (status.isRecording) await rec.stopAndUnloadAsync();
    } catch {}
  }, []);

  const showNotification = useCallback(async () => {
    if (Platform.OS === "web") return;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: WAKE_TAG,
        content: {
          title: "🎙 Astra is listening",
          body: "Speak — Astra activates when it hears you. Tap to open.",
          sticky: true,
          autoDismiss: false,
        },
        trigger: null,
      });
    } catch {}
  }, []);

  const dismissNotification = useCallback(async () => {
    if (Platform.OS === "web") return;
    try { await Notifications.dismissNotificationAsync(WAKE_TAG); } catch {}
  }, []);

  // ── single recording segment ───────────────────────────────────────────────

  const runSegment = useCallback(async (): Promise<boolean> => {
    hitsRef.current = 0;
    let triggered = false;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (!status.isRecording) return;
          const db = status.metering ?? -160;
          // Expose volume to UI in real-time
          setVolumeLevel(dbToLevel(db));
          if (db > VAD_THRESHOLD) {
            hitsRef.current += 1;
            if (hitsRef.current >= MIN_DETECTIONS) triggered = true;
          } else {
            hitsRef.current = Math.max(0, hitsRef.current - 1);
          }
        },
        POLL_MS
      );

      recordingRef.current = recording;

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, SEGMENT_MS);
        const check   = setInterval(() => {
          if (triggered || !loopRef.current) {
            clearInterval(check);
            clearTimeout(timeout);
            resolve();
          }
        }, 50);
      });

      await cleanupRecording();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch {
      await cleanupRecording();
    }

    if (!triggered) setVolumeLevel(0);
    return triggered;
  }, [cleanupRecording]);

  // ── main loop ──────────────────────────────────────────────────────────────

  const runLoop = useCallback(async () => {
    while (loopRef.current) {
      const detected = await runSegment();
      if (detected && loopRef.current) {
        loopRef.current = false;
        setVolumeLevel(1);
        setState("detected");
        onWakeDetected();
        return;
      }
      if (loopRef.current) await new Promise((r) => setTimeout(r, 100));
    }
    setVolumeLevel(0);
    setState("idle");
  }, [runSegment, onWakeDetected]);

  // ── public API ─────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (Platform.OS === "web") { setState("error"); return; }
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { setState("error"); return; }
      setMicPerm(true);
      loopRef.current = true;
      setState("armed");
      await activateKeepAwakeAsync(WAKE_TAG);
      await showNotification();
      runLoop();
    } catch { setState("error"); }
  }, [runLoop, showNotification]);

  const stop = useCallback(async () => {
    loopRef.current = false;
    await cleanupRecording();
    deactivateKeepAwake(WAKE_TAG);
    await dismissNotification();
    setVolumeLevel(0);
    setState("idle");
  }, [cleanupRecording, dismissNotification]);

  const rearm = useCallback(async () => {
    if (Platform.OS === "web") return;
    loopRef.current = true;
    setState("armed");
    setVolumeLevel(0);
    runLoop();
  }, [runLoop]);

  // ── AppState listener ─────────────────────────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener("change", (_: AppStateStatus) => {
      // loop keeps running; notification is the handle back
    });
    return () => sub.remove();
  }, []);

  // ── cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      loopRef.current = false;
      cleanupRecording();
      deactivateKeepAwake(WAKE_TAG);
      dismissNotification();
    };
  }, []);

  return { state, micPermission, volumeLevel, start, stop, rearm };
}
