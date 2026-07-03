/**
 * WakeOverlay — fullscreen Siri activation screen.
 * Shows the SiriOrb at large scale with a cinematic backdrop.
 */

import React, { useEffect } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { SiriOrb } from "./SiriOrb";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Animated backdrop ─────────────────────────────────────────────────────────

function Backdrop({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 380 });
  }, [visible]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View pointerEvents="none" style={[styles.backdrop, style]} />;
}

// ── "I heard you" label ───────────────────────────────────────────────────────

function WakeLabel({ visible }: { visible: boolean }) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (visible) {
      opacity.value    = withTiming(1,  { duration: 450, easing: Easing.out(Easing.ease) });
      translateY.value = withSpring(0,  { damping: 14, stiffness: 160 });
    } else {
      opacity.value    = withTiming(0,  { duration: 280 });
      translateY.value = withTiming(20, { duration: 280 });
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.labelWrapper, style]}>
      <Text style={styles.labelMain}>I heard you</Text>
      <Text style={styles.labelSub}>Speak your command…</Text>
    </Animated.View>
  );
}

// ── Orb container (scales in) ─────────────────────────────────────────────────

function OrbContainer({
  visible,
  volumeLevel,
}: {
  visible: boolean;
  volumeLevel: number;
}) {
  const scale   = useSharedValue(0.55);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value   = withSpring(1.0, { damping: 13, stiffness: 140 });
      opacity.value = withTiming(1,   { duration: 380 });
    } else {
      scale.value   = withSpring(0.55, { damping: 18, stiffness: 200 });
      opacity.value = withTiming(0,    { duration: 280 });
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  return (
    <Animated.View style={style} pointerEvents="none">
      <SiriOrb
        size={260}
        isListening={visible}
        isProcessing={false}
        volumeLevel={volumeLevel}
        showPulseRings
      />
    </Animated.View>
  );
}

// ── Dismiss hint ──────────────────────────────────────────────────────────────

function DismissHint({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(visible ? 0.55 : 0, {
      duration: visible ? 600 : 280,
    });
  }, [visible]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.dismissHint, style]}>
      <Text style={styles.dismissText}>Tap anywhere to cancel</Text>
    </Animated.View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface WakeOverlayProps {
  visible: boolean;
  volumeLevel?: number;
  onDismiss: () => void;
}

export function WakeOverlay({
  visible,
  volumeLevel = 0,
  onDismiss,
}: WakeOverlayProps) {
  if (Platform.OS === "web" && !visible) return null;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onDismiss}
      style={StyleSheet.absoluteFillObject}
      pointerEvents={visible ? "auto" : "none"}
    >
      {/* Dark backdrop */}
      <Backdrop visible={visible} />

      {/* Orb in the upper-center */}
      <View style={styles.orbSection} pointerEvents="none">
        <OrbContainer visible={visible} volumeLevel={volumeLevel} />
      </View>

      {/* Label below orb */}
      <View style={styles.labelSection} pointerEvents="none">
        <WakeLabel visible={visible} />
      </View>

      {/* Dismiss hint at very bottom */}
      <DismissHint visible={visible} />
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000e0",
  },
  orbSection: {
    position:       "absolute",
    top:            SH * 0.2,
    left:           0,
    right:          0,
    alignItems:     "center",
    justifyContent: "center",
  },
  labelSection: {
    position:       "absolute",
    top:            SH * 0.57,
    left:           0,
    right:          0,
    alignItems:     "center",
  },
  labelWrapper: {
    alignItems: "center",
    gap:        10,
  },
  labelMain: {
    color:       "#ffffff",
    fontSize:    28,
    fontFamily:  "Inter_700Bold",
    letterSpacing: 0.3,
    textShadowColor:  "#00D4FF",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  labelSub: {
    color:      "#00D4FF",
    fontSize:   15,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.4,
  },
  dismissHint: {
    position:  "absolute",
    bottom:    SW * 0.12,
    left:      0,
    right:     0,
    alignItems: "center",
  },
  dismissText: {
    color:      "#ffffff",
    fontSize:   13,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
  },
});
