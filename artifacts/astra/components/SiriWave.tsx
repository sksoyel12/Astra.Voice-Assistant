import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// ─── constants ────────────────────────────────────────────────────────────────
const TOTAL_BARS = 38;
const BAR_WIDTH = 3;
const BAR_GAP = 3;
const MAX_HEIGHT = 54;
const MIN_HEIGHT = 3;
const CONTAINER_WIDTH = TOTAL_BARS * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

// ─── helpers ──────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

/** Cyan → Purple → Pink gradient across bar index */
function barColor(index: number): string {
  const t = index / (TOTAL_BARS - 1);
  const stops: [number, number, number][] = [
    [0x00, 0xd4, 0xff], // #00D4FF  cyan
    [0x6c, 0x63, 0xff], // #6C63FF  purple
    [0xff, 0x6e, 0xff], // #FF6EFF  pink
  ];
  const seg = t * (stops.length - 1);
  const i = Math.min(Math.floor(seg), stops.length - 2);
  const f = seg - i;
  return `rgb(${lerp(stops[i][0], stops[i + 1][0], f)},${lerp(
    stops[i][1],
    stops[i + 1][1],
    f
  )},${lerp(stops[i][2], stops[i + 1][2], f)})`;
}

/** Bell curve: short on edges, tall in center */
function maxBarHeight(index: number): number {
  const t = index / (TOTAL_BARS - 1);
  const bell = Math.sin(t * Math.PI);
  return MIN_HEIGHT + bell * (MAX_HEIGHT - MIN_HEIGHT);
}

// ─── single animated bar ─────────────────────────────────────────────────────
interface BarProps {
  index: number;
  color: string;
  isActive: boolean;
}

function EqualizerBar({ index, color, isActive }: BarProps) {
  const height = useSharedValue(MIN_HEIGHT + maxBarHeight(index) * 0.15);

  useEffect(() => {
    const max = maxBarHeight(index);
    // Stagger speed so neighbouring bars don't sync perfectly
    const speed = 180 + ((index * 37) % 140);

    if (isActive) {
      // Each bar oscillates between a random high and low
      const hi = max * (0.45 + ((index * 13) % 10) / 18);
      const lo = MIN_HEIGHT + ((index * 7) % 6);
      height.value = withRepeat(
        withSequence(
          withTiming(hi, { duration: speed, easing: Easing.inOut(Easing.ease) }),
          withTiming(lo, { duration: speed, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      // Idle: settle to a gentle resting height
      const rest = MIN_HEIGHT + maxBarHeight(index) * 0.12;
      height.value = withRepeat(
        withSequence(
          withTiming(rest * 1.4, { duration: 1800 + index * 20, easing: Easing.inOut(Easing.ease) }),
          withTiming(rest * 0.7, { duration: 1800 + index * 20, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [isActive, index]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: BAR_WIDTH,
          borderRadius: BAR_WIDTH,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.95,
          shadowRadius: 5,
          elevation: 6,
        },
        animStyle,
      ]}
    />
  );
}

// ─── glow circle ─────────────────────────────────────────────────────────────
interface GlowProps {
  color: string;
  size: number;
  isActive: boolean;
  speedOffset: number;
}

function GlowOrb({ color, size, isActive, speedOffset }: GlowProps) {
  const opacity = useSharedValue(0.06);
  const scale = useSharedValue(0.85);

  useEffect(() => {
    if (isActive) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.45, { duration: 900 + speedOffset, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 900 + speedOffset, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1100 + speedOffset, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.9, { duration: 1100 + speedOffset, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      opacity.value = withTiming(0.06, { duration: 600 });
      scale.value = withTiming(0.85, { duration: 600 });
    }
  }, [isActive, speedOffset]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: size * 0.4,
          elevation: 0,
        },
        glowStyle,
      ]}
    />
  );
}

// ─── main component ───────────────────────────────────────────────────────────
interface SiriWaveProps {
  isListening: boolean;
  isProcessing: boolean;
  onPress: () => void;
}

// Pre-compute colors once (stable across renders)
const BAR_COLORS = Array.from({ length: TOTAL_BARS }, (_, i) => barColor(i));

export function SiriWave({ isListening, isProcessing, onPress }: SiriWaveProps) {
  const isActive = isListening || isProcessing;

  const containerScale = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      containerScale.value = withTiming(1.05, { duration: 350, easing: Easing.out(Easing.back(1.2)) });
    } else {
      containerScale.value = withTiming(1, { duration: 350 });
    }
  }, [isActive]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: containerScale.value }],
  }));

  return (
    <TouchableOpacity
      style={styles.touchable}
      onPress={onPress}
      activeOpacity={0.85}
      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
    >
      <Animated.View style={[styles.wrapper, containerStyle]}>
        {/* Multi-colour glow layers */}
        <GlowOrb color="#00D4FF" size={80}  isActive={isActive} speedOffset={0}   />
        <GlowOrb color="#9B59FF" size={130} isActive={isActive} speedOffset={200} />
        <GlowOrb color="#FF6EFF" size={80}  isActive={isActive} speedOffset={400} />

        {/* Equalizer bars */}
        <View style={styles.bars}>
          {BAR_COLORS.map((color, i) => (
            <EqualizerBar key={i} index={i} color={color} isActive={isActive} />
          ))}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  touchable: {
    alignSelf: "center",
  },
  wrapper: {
    width: CONTAINER_WIDTH + 40,
    height: MAX_HEIGHT + 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bars: {
    flexDirection: "row",
    alignItems: "center",
    gap: BAR_GAP,
  },
});
