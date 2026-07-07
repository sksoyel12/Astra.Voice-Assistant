/**
 * Astra — Google Gemini-style home screen.
 *
 * Layout:
 *  • White → light-blue gradient background
 *  • Header: hamburger | "Astra  Flash ▾" | edit-pencil
 *  • Body (empty state): GeminiStar centered + "Your move, Sk!"
 *         (listening / processing): SiriOrb replaces the star
 *  • Body (chat state):  Gemini-style clean message list
 *  • Floating pill input bar at the bottom
 *  • Left slide-out SideDrawer
 *  • WakeOverlay (fullscreen) on wake detection
 */

import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, useUser } from "@clerk/expo";
import { CommandLog }    from "@/components/CommandLog";
import { ProfileModal }  from "@/components/ProfileModal";
import { SideDrawer }    from "@/components/SideDrawer";
import { SiriOrb }       from "@/components/SiriOrb";
import { WakeOverlay }   from "@/components/WakeOverlay";
import { LANG_LABELS, useAssistant } from "@/context/AssistantContext";
import { useWakeWord }  from "@/hooks/useWakeWord";

// ─────────────────────────────────────────────────────────────────────────────
// Wake-mode indicator chip (shown above the input pill when armed)
// ─────────────────────────────────────────────────────────────────────────────

function WakeChip({ armed }: { armed: boolean }) {
  const opacity = useSharedValue(0);
  const ty      = useSharedValue(8);

  useEffect(() => {
    opacity.value = withTiming(armed ? 1 : 0, { duration: 300 });
    ty.value      = withSpring(armed ? 0 : 8,  { damping: 14, stiffness: 180 });
  }, [armed]);

  const s = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: ty.value }] }));

  return (
    <Animated.View pointerEvents="none" style={[chipStyles.root, s]}>
      <View style={chipStyles.dot} />
      <Text style={chipStyles.text}>Wake mode — say anything to activate Astra</Text>
    </Animated.View>
  );
}

const chipStyles = StyleSheet.create({
  root: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    marginBottom:   8,
    backgroundColor: "#F5F0FF",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "center",
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: "#7C3AED",
  },
  text: {
    fontSize:   11,
    color:      "#7C3AED",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function AstraScreen() {
  const insets = useSafeAreaInsets();
  const {
    isListening,
    isProcessing,
    torchOn,
    language,
    commandLog,
    sessions,
    batteryLevel,
    wakeMode,
    startListening,
    stopListening,
    processCommand,
    toggleLanguage,
    clearLog,
    loadSession,
    setWakeMode,
    speak,
  } = useAssistant();

  const [inputText,       setInputText]       = useState("");
  const [showWakeOverlay, setShowWakeOverlay] = useState(false);
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [profileOpen,     setProfileOpen]     = useState(false);
  const inputRef = useRef<TextInput>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [audioPermission,  requestAudioPermission]  = Audio.usePermissions();

  // ── Wake word ────────────────────────────────────────────────────────────

  const handleWakeDetected = useCallback(() => {
    setShowWakeOverlay(true);
    speak(language === "en" ? "Yes?" : language === "hi" ? "Haan?" : "Bolun?");
    setTimeout(() => {
      setShowWakeOverlay(false);
      startListening();
      inputRef.current?.focus();
    }, 1800);
  }, [language, speak, startListening]);

  const {
    state:       wakeState,
    volumeLevel: wakeVolume,
    start:       startWake,
    stop:        stopWake,
    rearm,
  } = useWakeWord({ onWakeDetected: handleWakeDetected });

  const handleWakeModeToggle = useCallback(async () => {
    if (wakeMode) { setWakeMode(false); await stopWake(); }
    else          { setWakeMode(true);  await startWake(); }
  }, [wakeMode, startWake, stopWake, setWakeMode]);

  useEffect(() => {
    if (!isProcessing && wakeMode && wakeState === "detected") {
      const t = setTimeout(() => rearm(), 2000);
      return () => clearTimeout(t);
    }
  }, [isProcessing, wakeMode, wakeState, rearm]);

  // ── Interaction ──────────────────────────────────────────────────────────

  const handleMicPress = useCallback(() => {
    if (isProcessing) return;
    if (isListening) stopListening();
    else             { startListening(); inputRef.current?.focus(); }
  }, [isListening, isProcessing, startListening, stopListening]);

  const handleSend = useCallback(async () => {
    const t = inputText.trim();
    if (!t) return;
    setInputText("");
    inputRef.current?.blur();
    await processCommand(t);
  }, [inputText, processCommand]);

  // ── Layout helpers ────────────────────────────────────────────────────────

  const topPad    = Platform.OS === "web" ? 48 : insets.top;
  const botPad    = Platform.OS === "web" ? 12 : insets.bottom;
  const isActive  = isListening || isProcessing;

  // Header subtitle — model name / state
  const modelLabel = isProcessing
    ? (language === "en" ? "Thinking…" : language === "hi" ? "Soch rahi hoon…" : "Vabchhi…")
    : isListening
    ? (language === "en" ? "Listening…" : language === "hi" ? "Sun rahi hoon…" : "Shunchhi…")
    : wakeState === "armed"
    ? "Waiting…"
    : "Flash";

  const homeHint = isListening
    ? (language === "en" ? "Listening…" : language === "hi" ? "Sun rahi hoon…" : "Shunchhi…")
    : isProcessing
    ? (language === "en" ? "Thinking…" : language === "hi" ? "Soch rahi hoon…" : "Vabchhi…")
    : (language === "en" ? "Your move, Sk!" : language === "hi" ? "Bolo, Sk!" : "Bolun, Sk!");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Background gradient: soft lavender → white → sky */}
      <LinearGradient
        colors={["#F5F0FF", "#FFFFFF", "#EDF4FF"]}
        locations={[0, 0.45, 1.0]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Hidden camera for torch */}
      {Platform.OS !== "web" && cameraPermission?.granted && (
        <CameraView style={styles.hiddenCamera} facing="back" enableTorch={torchOn} />
      )}

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        {/* Hamburger menu */}
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          style={styles.headerBtn}
          hitSlop={10}
        >
          <Ionicons name="menu" size={22} color="#6D28D9" />
        </TouchableOpacity>

        {/* Title */}
        <View style={styles.headerTitleArea}>
          <Text style={styles.headerTitle}>Astra</Text>
        </View>

        {/* Right controls */}
        <View style={styles.headerRight}>
          {/* New chat / edit */}
          <TouchableOpacity
            onPress={clearLog}
            style={styles.headerBtn}
            hitSlop={10}
          >
            <Ionicons name="create-outline" size={20} color="#6D28D9" />
          </TouchableOpacity>

          {/* User avatar — opens Profile modal */}
          <TouchableOpacity
            onPress={() => setProfileOpen(true)}
            hitSlop={8}
            style={styles.avatarBtn}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>Sk</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Body ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Chat or home state */}
        {commandLog.length === 0 ? (
          /* ── Home / empty state ── */
          <View style={styles.homeArea}>
            {/* Astra neon orb — premium idle breathing or active pulsing */}
            <TouchableOpacity onPress={handleMicPress} activeOpacity={0.88}>
              <SiriOrb
                size={isActive ? 160 : 120}
                isListening={isListening}
                isProcessing={isProcessing}
                volumeLevel={wakeVolume}
                showPulseRings={isListening}
                idleGlow={!isActive}
              />
            </TouchableOpacity>
            <Text style={[styles.homeHint, isActive && styles.homeHintActive]}>
              {homeHint}
            </Text>
          </View>
        ) : (
          /* ── Chat view ── */
          <View style={styles.chatArea}>
            {/* Listening orb slides in at top of chat */}
            {isActive && (
              <View style={styles.chatOrb}>
                <TouchableOpacity onPress={handleMicPress} activeOpacity={0.9}>
                  <SiriOrb
                    size={88}
                    isListening={isListening}
                    isProcessing={isProcessing}
                    volumeLevel={wakeVolume}
                    showPulseRings={isListening}
                  />
                </TouchableOpacity>
              </View>
            )}
            <CommandLog entries={commandLog} onClear={clearLog} />
          </View>
        )}

        {/* ── Floating pill input bar ── */}
        <View style={[styles.inputArea, { paddingBottom: Math.max(botPad, 12) }]}>
          {/* Mic permission banner */}
          {Platform.OS !== "web" && !audioPermission?.granted && (
            <TouchableOpacity style={styles.permBanner} onPress={requestAudioPermission}>
              <Ionicons name="mic-off-outline" size={13} color="#EA4335" />
              <Text style={styles.permText}>Tap to grant microphone access</Text>
            </TouchableOpacity>
          )}

          {/* Wake mode chip */}
          <WakeChip armed={wakeState === "armed"} />

          {/* The pill */}
          <View style={styles.pill}>
            {/* + button */}
            <TouchableOpacity
              style={styles.pillBtn}
              onPress={handleWakeModeToggle}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Ionicons
                name={wakeState === "armed" ? "radio" : "add"}
                size={22}
                color={wakeState === "armed" ? "#4285F4" : "#555"}
              />
            </TouchableOpacity>

            {/* Text input */}
            <TextInput
              ref={inputRef}
              style={styles.pillInput}
              placeholder={
                isListening
                  ? (language === "en" ? "Listening…" : language === "hi" ? "Sun rahi hoon…" : "Shunchhi…")
                  : "Ask Astra"
              }
              placeholderTextColor={isListening ? "#4285F4" : "#aaa"}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!isProcessing}
              autoCorrect={false}
              autoCapitalize="none"
              multiline={false}
              underlineColorAndroid="transparent"
            />

            {/* Right button: send (typing) ↔ waveform (empty) */}
            {inputText.trim().length > 0 ? (
              /* ── Send button — light-blue circle with ↑ arrow ── */
              <TouchableOpacity
                onPress={handleSend}
                disabled={isProcessing}
                style={styles.sendCircleBtn}
                hitSlop={8}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              /* ── Waveform / mic button — solid blue circle ── */
              <TouchableOpacity
                style={[styles.waveCircleBtn, isListening && styles.waveCircleBtnActive]}
                onPress={handleMicPress}
                disabled={isProcessing}
                activeOpacity={0.75}
                hitSlop={8}
              >
                {isProcessing ? (
                  <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
                ) : isListening ? (
                  /* Animated bars while listening */
                  <View style={styles.liveMicRow}>
                    {[0.4, 0.7, 1.0, 0.7, 0.4].map((h, i) => (
                      <View
                        key={i}
                        style={[styles.waveBar, { height: 6 + h * (6 + wakeVolume * 10) }]}
                      />
                    ))}
                  </View>
                ) : (
                  /* Mic icon — idle state */
                  <Ionicons name="mic" size={22} color="#fff" />
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>Astra can make mistakes · {LANG_LABELS[language]}</Text>
        </View>
      </KeyboardAvoidingView>

      {/* ── Side drawer ── */}
      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        recentChats={commandLog}
        sessions={sessions}
        onNewChat={clearLog}
        onSelectSession={(session) => { loadSession(session); setDrawerOpen(false); }}
        onSettingsPress={() => setProfileOpen(true)}
        onProfilePress={() => setProfileOpen(true)}
      />

      {/* ── Wake fullscreen overlay ── */}
      <WakeOverlay
        visible={showWakeOverlay}
        volumeLevel={wakeVolume}
        onDismiss={() => {
          setShowWakeOverlay(false);
          startListening();
          inputRef.current?.focus();
        }}
      />

      {/* ── Profile modal ── */}
      <ProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        email="sksoyel584845@gmail.com"
        initials="Sk"
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#FFFFFF" },
  flex:        { flex: 1 },
  hiddenCamera: { width: 0, height: 0, position: "absolute" },

  // ── Header ──
  header: {
    flexDirection:  "row",
    alignItems:     "center",
    paddingHorizontal: 16,
    paddingBottom:  14,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EBFF",
  },
  headerBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#F8F5FF",
  },
  headerTitleArea: {
    flex:         1,
    flexDirection: "row",
    alignItems:    "baseline",
    gap:           5,
    paddingLeft:   10,
  },
  headerTitle: {
    fontSize:    20,
    fontFamily:  "Inter_700Bold",
    color:       "#3B1F8C",
    letterSpacing: -0.5,
  },
  headerModel: {
    fontSize:   13,
    color:      "#9B8DC0",
    fontFamily: "Inter_400Regular",
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarBtn: { padding: 2 },
  avatarCircle: {
    width:           34,
    height:          34,
    borderRadius:    17,
    backgroundColor: "#6D28D9",
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     2,
    borderColor:     "#A78BFA",
    shadowColor:     "#7C3AED",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.4,
    shadowRadius:    6,
    elevation:       4,
  },
  avatarInitials: {
    color:      "#fff",
    fontSize:   12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  langBtn: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
    backgroundColor:   "#F0EBFF",
  },
  langText: {
    fontSize:   11,
    color:      "#7C3AED",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },

  // ── Home / empty state ──
  homeArea: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            28,
    paddingBottom:  60,
  },
  homeHint: {
    fontSize:      28,
    fontFamily:    "Inter_700Bold",
    color:         "#1E0B4B",
    textAlign:     "center",
    letterSpacing: -0.5,
  },
  homeHintActive: {
    fontSize:   18,
    fontFamily: "Inter_400Regular",
    color:      "#9B8DC0",
  },

  // ── Chat area ──
  chatArea: { flex: 1 },
  chatOrb: {
    alignItems:     "center",
    justifyContent: "center",
    paddingVertical: 16,
  },

  // ── Input area ──
  inputArea: {
    paddingHorizontal: 14,
    paddingTop:        4,
  },
  permBanner: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    backgroundColor: "#FFF4F4",
    borderRadius:   10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom:  8,
    borderWidth:   1,
    borderColor:   "#FFDADD",
  },
  permText: { fontSize: 12, color: "#EA4335", fontFamily: "Inter_400Regular" },

  // The floating pill
  pill: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: "#FFFFFF",
    borderRadius:    32,
    paddingLeft:     14,
    paddingRight:    5,
    paddingVertical: 5,
    shadowColor:     "#6D28D9",
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.12,
    shadowRadius:    16,
    elevation:       8,
    borderWidth:     1.5,
    borderColor:     "#EDE9FF",
    gap:             6,
  },
  pillBtn: {
    width:          40,
    height:         40,
    alignItems:     "center",
    justifyContent: "center",
    borderRadius:   20,
    flexShrink:     0,
  },
  pillBtnActive: { backgroundColor: "#EDE9FF" },
  pillInput: {
    flex:       1,
    fontSize:   16,
    fontFamily: "Inter_400Regular",
    color:      "#1E0B4B",
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    paddingHorizontal: 4,
    minHeight:  40,
    ...(Platform.OS === "web" ? { outlineWidth: 0, outlineStyle: "none" } : {}),
  },
  // ── Right-side circular buttons — contained inside the pill ──
  sendCircleBtn: {
    width:           40,
    height:          40,
    alignItems:      "center",
    justifyContent:  "center",
    borderRadius:    20,
    backgroundColor: "#7C3AED",
    flexShrink:      0,
    shadowColor:     "#7C3AED",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.4,
    shadowRadius:    6,
  },
  waveCircleBtn: {
    width:           40,
    height:          40,
    alignItems:      "center",
    justifyContent:  "center",
    borderRadius:    20,
    backgroundColor: "#7C3AED",
    flexShrink:      0,
    shadowColor:     "#7C3AED",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.4,
    shadowRadius:    6,
  },
  waveCircleBtnActive: {
    backgroundColor: "#5B21B6",
  },
  // Static 3-bar waveform icon (idle state)
  staticWaveRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           3,
  },
  staticWaveBar: {
    width:           3,
    borderRadius:    2,
    backgroundColor: "#fff",
  },
  // Live waveform inside mic button
  liveMicRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           2,
    height:        22,
  },
  waveBar: {
    width:           3,
    borderRadius:    2,
    backgroundColor: "#fff",
    minHeight:       4,
  },

  disclaimer: {
    fontSize:   10,
    color:      "#C4B5FD",
    fontFamily: "Inter_400Regular",
    textAlign:  "center",
    marginTop:  8,
    letterSpacing: 0.3,
  },
});
