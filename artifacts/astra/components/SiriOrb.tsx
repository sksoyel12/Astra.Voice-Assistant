/**
 * SiriOrb — Apple iOS-style glowing glass sphere.
 *
 * Visual layers (bottom → top):
 *  1. Soft ambient halo (breathing glow behind the sphere)
 *  2. Three expanding pulse rings (when isListening)
 *  3. SVG orb body:
 *       • Radial-gradient dark base (deep navy/purple)
 *       • Four animated ellipse blobs (cyan, purple, pink, teal)
 *         safely clipped to the sphere via <ClipPath>
 *       • Edge-darkening radial vignette for glass depth
 *       • Rim glow gradient + thin rim border
 *       • Two glass-shine ellipses (top-left specular)
 *
 * Cross-platform note: animated props use the SVG `transform` string
 * attribute (universally valid) instead of react-native-svg's custom
 * rotation/translateX/translateY shorthand props — those leak as unrecognised
 * DOM attributes on web when driven by Reanimated's useAnimatedProps.
 *
 * `volumeLevel` (0–1) scales the orb and intensifies the outer glow so it
 * breathes in real-time with the user's voice.
 */

import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
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
  Ellipse,
  LinearGradient,
  RadialGradient,
  Stop,
  Svg,
} from "react-native-svg";

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SiriOrbProps {
  size?: number;
  isListening?: boolean;
  isProcessing?: boolean;
  /** 0-1 — drives pulse intensity and orb scale */
  volumeLevel?: number;
  onPress?: () => void;
  showPulseRings?: boolean;
  /** When true, show a gentle breathing halo even in the idle (non-active) state */
  idleGlow?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Return an SVG `transform` string combining translate + rotation around (cx,cy). */
function svgTransform(tx: number, ty: number, angle: number, cx: number, cy: number) {
  "worklet";
  return `translate(${tx} ${ty}) rotate(${angle} ${cx} ${cy})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Outer pulse ring
// ─────────────────────────────────────────────────────────────────────────────

interface PulseRingProps {
  size: number;
  color: string;
  delayMs: number;
  active: boolean;
  volumeLevel: number;
}

function PulseRing({ size, color, delayMs, active, volumeLevel }: PulseRingProps) {
  const scale   = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      const maxScale = 1.65 + volumeLevel * 0.3;
      scale.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: 0 }),
          withTiming(maxScale, { duration: 2000, easing: Easing.out(Easing.exp) })
        ),
        -1, false
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0,    { duration: delayMs }),
          withTiming(0.45 + volumeLevel * 0.2, { duration: 200 }),
          withTiming(0,    { duration: 1600, easing: Easing.out(Easing.exp) })
        ),
        -1, false
      );
    } else {
      scale.value   = withTiming(0.85, { duration: 500 });
      opacity.value = withTiming(0,    { duration: 400 });
    }
  }, [active, volumeLevel]);

  const animStyle = useAnimatedStyle(() => ({
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
        animStyle,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient halo (blurred circle behind the sphere)
// ─────────────────────────────────────────────────────────────────────────────

function AmbientHalo({ size, active, volumeLevel, idleGlow }: { size: number; active: boolean; volumeLevel: number; idleGlow?: boolean }) {
  const opacity = useSharedValue(0.18);
  const scale   = useSharedValue(1.0);

  useEffect(() => {
    const targetOpacity = active
      ? 0.35 + volumeLevel * 0.22
      : idleGlow ? 0.22 : 0.10;
    const dur = active ? 900 : idleGlow ? 2800 : 2200;
    opacity.value = withSpring(targetOpacity, { damping: 12, stiffness: 80 });
    scale.value   = withRepeat(
      withSequence(
        withTiming(1.0 + (active ? 0.10 + volumeLevel * 0.07 : idleGlow ? 0.055 : 0), { duration: dur, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0 + (active ? 0.03 : 0),                                           { duration: dur, easing: Easing.inOut(Easing.ease) })
      ),
      -1, true
    );
  }, [active, volumeLevel, idleGlow]);

  const haloSize = size * 1.55;
  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position:        "absolute",
          width:           haloSize,
          height:          haloSize,
          borderRadius:    haloSize / 2,
          backgroundColor: "#6C63FF",
        },
        animStyle,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG orb body — gradients + animated blobs
// ─────────────────────────────────────────────────────────────────────────────

function OrbBody({ size, isActive, volumeLevel }: { size: number; isActive: boolean; volumeLevel: number }) {
  const R  = size / 2;
  const cx = R;
  const cy = R;

  // Shared values — rotation (degrees) and translation offset (px)
  const rotA = useSharedValue(0);
  const txA  = useSharedValue(0);
  const tyA  = useSharedValue(-R * 0.08);

  const rotB = useSharedValue(45);
  const txB  = useSharedValue(R * 0.1);
  const tyB  = useSharedValue(R * 0.12);

  const rotC = useSharedValue(20);
  const txC  = useSharedValue(-R * 0.12);
  const tyC  = useSharedValue(R * 0.18);

  const rotD = useSharedValue(90);
  const txD  = useSharedValue(R * 0.05);
  const tyD  = useSharedValue(-R * 0.2);

  const orbScale = useSharedValue(1);

  useEffect(() => {
    const speedA = isActive ? 9000 : 18000;
    const speedB = isActive ? 7000 : 14000;
    const speedC = isActive ? 4500 : 10000;
    const speedD = isActive ? 12000 : 24000;
    const amp    = isActive ? 1 : 0.6;

    // Rotation: continuous, linear
    rotA.value = withRepeat(withTiming(360,  { duration: speedA, easing: Easing.linear }), -1, false);
    rotB.value = withRepeat(withTiming(-360, { duration: speedB, easing: Easing.linear }), -1, false);
    rotC.value = withRepeat(withTiming(360,  { duration: speedC, easing: Easing.linear }), -1, false);
    rotD.value = withRepeat(withTiming(-360, { duration: speedD, easing: Easing.linear }), -1, false);

    // Translation: sinusoidal drift
    txA.value = withRepeat(withSequence(
      withTiming(-R * 0.22 * amp, { duration: speedA * 0.38, easing: Easing.inOut(Easing.ease) }),
      withTiming( R * 0.18 * amp, { duration: speedA * 0.38, easing: Easing.inOut(Easing.ease) })
    ), -1, true);
    tyA.value = withRepeat(withSequence(
      withTiming(-R * 0.15 * amp, { duration: speedA * 0.42, easing: Easing.inOut(Easing.ease) }),
      withTiming( R * 0.12 * amp, { duration: speedA * 0.42, easing: Easing.inOut(Easing.ease) })
    ), -1, true);

    txB.value = withRepeat(withSequence(
      withTiming( R * 0.18 * amp, { duration: speedB * 0.4,  easing: Easing.inOut(Easing.ease) }),
      withTiming(-R * 0.2  * amp, { duration: speedB * 0.4,  easing: Easing.inOut(Easing.ease) })
    ), -1, true);
    tyB.value = withRepeat(withSequence(
      withTiming( R * 0.22 * amp, { duration: speedB * 0.35, easing: Easing.inOut(Easing.ease) }),
      withTiming(-R * 0.18 * amp, { duration: speedB * 0.35, easing: Easing.inOut(Easing.ease) })
    ), -1, true);

    txC.value = withRepeat(withSequence(
      withTiming( R * 0.28 * amp, { duration: speedC * 0.45, easing: Easing.inOut(Easing.ease) }),
      withTiming(-R * 0.22 * amp, { duration: speedC * 0.45, easing: Easing.inOut(Easing.ease) })
    ), -1, true);
    tyC.value = withRepeat(withSequence(
      withTiming(-R * 0.2  * amp, { duration: speedC * 0.5,  easing: Easing.inOut(Easing.ease) }),
      withTiming( R * 0.25 * amp, { duration: speedC * 0.5,  easing: Easing.inOut(Easing.ease) })
    ), -1, true);

    txD.value = withRepeat(withSequence(
      withTiming(-R * 0.3 * amp, { duration: speedD * 0.5, easing: Easing.inOut(Easing.ease) }),
      withTiming( R * 0.3 * amp, { duration: speedD * 0.5, easing: Easing.inOut(Easing.ease) })
    ), -1, true);
    tyD.value = withRepeat(withSequence(
      withTiming(-R * 0.18 * amp, { duration: speedD * 0.55, easing: Easing.inOut(Easing.ease) }),
      withTiming( R * 0.22 * amp, { duration: speedD * 0.55, easing: Easing.inOut(Easing.ease) })
    ), -1, true);
  }, [isActive]);

  useEffect(() => {
    orbScale.value = withSpring(1.0 + volumeLevel * 0.07, { damping: 10, stiffness: 180 });
  }, [volumeLevel]);

  // Animated SVG transform strings — no custom props leak to DOM
  const propsA = useAnimatedProps(() => ({
    transform: svgTransform(txA.value, tyA.value, rotA.value, cx, cy),
  }));
  const propsB = useAnimatedProps(() => ({
    transform: svgTransform(txB.value, tyB.value, rotB.value, cx, cy),
  }));
  const propsC = useAnimatedProps(() => ({
    transform: svgTransform(txC.value, tyC.value, rotC.value, cx, cy),
  }));
  const propsD = useAnimatedProps(() => ({
    transform: svgTransform(txD.value, tyD.value, rotD.value, cx, cy),
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, scaleStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          {/* Circular clip mask */}
          <ClipPath id="orbClip">
            <Circle cx={cx} cy={cy} r={R - 0.5} />
          </ClipPath>

          {/* Base: dark navy core, near-black edges */}
          <RadialGradient id="base" cx="50%" cy="40%" r="65%">
            <Stop offset="0%"   stopColor="#12073a" />
            <Stop offset="55%"  stopColor="#090520" />
            <Stop offset="100%" stopColor="#030210" />
          </RadialGradient>

          {/* Blob gradient fills */}
          <LinearGradient id="blobCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#00D4FF" stopOpacity="0.92" />
            <Stop offset="50%"  stopColor="#00A8E8" stopOpacity="0.75" />
            <Stop offset="100%" stopColor="#007AFF" stopOpacity="0.55" />
          </LinearGradient>

          <LinearGradient id="blobPurple" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#8B5CF6" stopOpacity="0.9" />
            <Stop offset="50%"  stopColor="#6C63FF" stopOpacity="0.78" />
            <Stop offset="100%" stopColor="#4C35BF" stopOpacity="0.55" />
          </LinearGradient>

          <LinearGradient id="blobPink" x1="100%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%"   stopColor="#FF6EFF" stopOpacity="0.85" />
            <Stop offset="50%"  stopColor="#EC4899" stopOpacity="0.7"  />
            <Stop offset="100%" stopColor="#BE185D" stopOpacity="0.45" />
          </LinearGradient>

          <LinearGradient id="blobTeal" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%"   stopColor="#00FFD1" stopOpacity="0.60" />
            <Stop offset="100%" stopColor="#00B4D8" stopOpacity="0.30" />
          </LinearGradient>

          {/* Edge vignette for depth */}
          <RadialGradient id="vignette" cx="50%" cy="50%" r="50%">
            <Stop offset="52%"  stopColor="#000000" stopOpacity="0"    />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.74" />
          </RadialGradient>

          {/* Rim glow: subtle coloured ring at sphere edge */}
          <RadialGradient id="rimGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="86%"  stopColor="#6C63FF" stopOpacity="0"    />
            <Stop offset="100%" stopColor="#00D4FF" stopOpacity="0.55" />
          </RadialGradient>
        </Defs>

        {/* ── Sphere base ── */}
        <Circle cx={cx} cy={cy} r={R} fill="url(#base)" />

        {/* ── Animated blobs (clipped) ── */}
        {/* @ts-ignore transform string is valid SVG */}
        <AnimatedEllipse cx={cx} cy={cy} rx={R * 1.35} ry={R * 0.82}
          fill="url(#blobCyan)"   clipPath="url(#orbClip)" animatedProps={propsA} />
        {/* @ts-ignore */}
        <AnimatedEllipse cx={cx} cy={cy} rx={R * 1.2}  ry={R * 1.0}
          fill="url(#blobPurple)" clipPath="url(#orbClip)" animatedProps={propsB} />
        {/* @ts-ignore */}
        <AnimatedEllipse cx={cx} cy={cy} rx={R * 0.85} ry={R * 0.65}
          fill="url(#blobPink)"   clipPath="url(#orbClip)" animatedProps={propsC} />
        {/* @ts-ignore */}
        <AnimatedEllipse cx={cx} cy={cy} rx={R * 0.7}  ry={R * 0.45}
          fill="url(#blobTeal)"   clipPath="url(#orbClip)" animatedProps={propsD} />

        {/* ── Glass-depth vignette ── */}
        <Circle cx={cx} cy={cy} r={R} fill="url(#vignette)" />

        {/* ── Rim glow ── */}
        <Circle cx={cx} cy={cy} r={R} fill="url(#rimGlow)" />

        {/* ── Thin rim border ── */}
        <Circle cx={cx} cy={cy} r={R - 1.5}
          fill="none" stroke="#ffffff" strokeWidth={1.5} strokeOpacity={0.18} />

        {/* ── Glass shine: primary (top-left) ── */}
        <Ellipse cx={cx * 0.72} cy={cy * 0.62}
          rx={R * 0.22} ry={R * 0.10} fill="#ffffff" fillOpacity={0.30}
          rotation={-35} originX={cx * 0.72} originY={cy * 0.62} />

        {/* ── Glass shine: secondary (brighter, smaller) ── */}
        <Ellipse cx={cx * 0.60} cy={cy * 0.52}
          rx={R * 0.09} ry={R * 0.045} fill="#ffffff" fillOpacity={0.55}
          rotation={-40} originX={cx * 0.60} originY={cy * 0.52} />
      </Svg>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export function SiriOrb({
  size = 200,
  isListening  = false,
  isProcessing = false,
  volumeLevel  = 0,
  onPress,
  showPulseRings = true,
  idleGlow = false,
}: SiriOrbProps) {
  const isActive = isListening || isProcessing;
  const vol      = Math.max(0, Math.min(1, volumeLevel));

  const ringSize1 = size * 1.15;
  const ringSize2 = size * 1.35;
  const ringSize3 = size * 1.58;

  const wrapperScale = useSharedValue(1);
  useEffect(() => {
    wrapperScale.value = withSpring(isActive ? 1.0 : 0.96, { damping: 14, stiffness: 120 });
  }, [isActive]);
  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wrapperScale.value }],
  }));

  const orbNode = (
    <Animated.View style={[styles.wrapper, { width: size, height: size }, wrapperStyle]}>
      {/* Ambient halo */}
      <View style={styles.center} pointerEvents="none">
        <AmbientHalo size={size} active={isActive} volumeLevel={vol} idleGlow={idleGlow} />
      </View>

      {/* Expanding pulse rings */}
      {showPulseRings && (
        <View style={styles.center} pointerEvents="none">
          <PulseRing size={ringSize1} color="#00D4FF" delayMs={0}   active={isActive} volumeLevel={vol} />
          <PulseRing size={ringSize2} color="#8B5CF6" delayMs={380} active={isActive} volumeLevel={vol} />
          <PulseRing size={ringSize3} color="#FF6EFF" delayMs={680} active={isActive} volumeLevel={vol} />
        </View>
      )}

      {/* SVG orb */}
      <View style={styles.center} pointerEvents="none">
        <OrbBody size={size} isActive={isActive} volumeLevel={vol} />
      </View>
    </Animated.View>
  );

  if (!onPress) return orbNode;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
    >
      {orbNode}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center" },
  center: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
  },
});
