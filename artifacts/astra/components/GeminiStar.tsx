/**
 * GeminiStar — Animated 4-pointed sparkle star, like Google Gemini's logo.
 *
 * The star is drawn with cubic-bezier curves giving it the characteristic
 * "thin concave arms" sparkle shape.  Gradient goes diagonally through the
 * four Google brand colours: blue → red → yellow → green.
 *
 * Behaviour:
 *   idle       → gentle breathing scale, soft outer glow
 *   listening  → fast breathing + 3 pulse rings
 *   processing → slow 360° spin + medium breathing
 */

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Circle,
  ClipPath,
  Defs,
  LinearGradient,
  Path,
  Stop,
  Svg,
} from "react-native-svg";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GeminiStarProps {
  size?: number;
  isListening?: boolean;
  isProcessing?: boolean;
  /** Override glow colour (default #4285F4) */
  glowColor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pulse ring (for listening state)
// ─────────────────────────────────────────────────────────────────────────────

function PulseRing({
  size,
  color,
  delay,
  active,
}: {
  size: number;
  color: string;
  delay: number;
  active: boolean;
}) {
  const scale   = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(0.9,  { duration: 0 }),
          withTiming(2.0,  { duration: 1800, easing: Easing.out(Easing.exp) })
        ), -1, false
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0,    { duration: delay }),
          withTiming(0.45, { duration: 200 }),
          withTiming(0,    { duration: 1400, easing: Easing.out(Easing.exp) })
        ), -1, false
      );
    } else {
      scale.value   = withTiming(0.9, { duration: 400 });
      opacity.value = withTiming(0,   { duration: 300 });
    }
  }, [active]);

  const s = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position:     "absolute",
          width:        size,
          height:       size,
          borderRadius: size / 2,
          borderWidth:  1.5,
          borderColor:  color,
        },
        s,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient glow (soft coloured halo behind the star)
// ─────────────────────────────────────────────────────────────────────────────

function Halo({
  size,
  active,
  color,
}: {
  size: number;
  active: boolean;
  color: string;
}) {
  const opacity = useSharedValue(0.06);
  const scale   = useSharedValue(1);

  useEffect(() => {
    opacity.value = withSpring(active ? 0.22 : 0.06, { damping: 12 });
    scale.value   = withRepeat(
      withSequence(
        withTiming(1.08, { duration: active ? 800 : 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.97, { duration: active ? 800 : 1800, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    );
  }, [active]);

  const s = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const h = size * 1.6;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position:        "absolute",
          width:           h,
          height:          h,
          borderRadius:    h / 2,
          backgroundColor: color,
        },
        s,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function GeminiStar({
  size      = 80,
  isListening  = false,
  isProcessing = false,
  glowColor    = "#4285F4",
}: GeminiStarProps) {
  const isActive = isListening || isProcessing;

  // Scale: breathe in/out
  const scale = useSharedValue(1);
  // Rotation: spin when processing
  const rot   = useSharedValue(0);

  useEffect(() => {
    const dur = isListening ? 700 : isProcessing ? 1100 : 1900;
    scale.value = withRepeat(
      withSequence(
        withTiming(isActive ? 1.08 : 1.02, { duration: dur, easing: Easing.inOut(Easing.ease) }),
        withTiming(isActive ? 0.94 : 0.98, { duration: dur, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    );
  }, [isListening, isProcessing]);

  useEffect(() => {
    if (isProcessing) {
      rot.value = withRepeat(
        withTiming(360, { duration: 3200, easing: Easing.linear }), -1, false
      );
    } else {
      rot.value = withTiming(0, { duration: 600 });
    }
  }, [isProcessing]);

  const starStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rot.value}deg` }],
  }));

  const ring1 = size * 1.2;
  const ring2 = size * 1.45;
  const ring3 = size * 1.75;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {/* Glow halo */}
      <View style={styles.center} pointerEvents="none">
        <Halo size={size} active={isActive} color={glowColor} />
      </View>

      {/* Pulse rings (listening) */}
      <View style={styles.center} pointerEvents="none">
        <PulseRing size={ring1} color="#4285F4" delay={0}   active={isListening} />
        <PulseRing size={ring2} color="#EA4335" delay={350} active={isListening} />
        <PulseRing size={ring3} color="#34A853" delay={650} active={isListening} />
      </View>

      {/* Star body */}
      <View style={styles.center} pointerEvents="none">
        <Animated.View style={starStyle}>
          <Svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
          >
            <Defs>
              <LinearGradient id="gstar" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%"   stopColor="#4285F4" />
                <Stop offset="30%"  stopColor="#8B5CF6" />
                <Stop offset="60%"  stopColor="#EA4335" />
                <Stop offset="80%"  stopColor="#FBBC04" />
                <Stop offset="100%" stopColor="#34A853" />
              </LinearGradient>
            </Defs>
            {/* Gemini-style 4-pointed sparkle: concave bezier arms */}
            <Path
              d="M12,0 C12,2 2,12 0,12 C2,12 12,22 12,24 C12,22 22,12 24,12 C22,12 12,2 12,0 Z"
              fill="url(#gstar)"
            />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center" },
  center: {
    position:       "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems:     "center",
    justifyContent: "center",
  },
});
