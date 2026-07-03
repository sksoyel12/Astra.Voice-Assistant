import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

interface PulsingOrbProps {
  isListening: boolean;
  isProcessing: boolean;
  onPress: () => void;
}

function WaveBar({ delay, isActive }: { delay: number; isActive: boolean }) {
  const height = useSharedValue(4);

  useEffect(() => {
    if (isActive) {
      height.value = withRepeat(
        withSequence(
          withTiming(4 + Math.random() * 20, {
            duration: 200 + delay * 50,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(4, {
            duration: 200 + delay * 50,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1
      );
    } else {
      height.value = withTiming(4, { duration: 300 });
    }
  }, [isActive, delay]);

  const style = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return <Animated.View style={[styles.bar, style]} />;
}

export function PulsingOrb({ isListening, isProcessing, onPress }: PulsingOrbProps) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const outerScale = useSharedValue(1);
  const outerOpacity = useSharedValue(0.4);

  const orbColor = isProcessing
    ? "#FF9F43"
    : isListening
    ? "#00D4FF"
    : "#6C63FF";

  useEffect(() => {
    if (isListening) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
      outerScale.value = withRepeat(
        withSequence(
          withTiming(1.35, { duration: 900, easing: Easing.out(Easing.ease) }),
          withTiming(1.1, { duration: 900, easing: Easing.in(Easing.ease) })
        ),
        -1
      );
      outerOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 900 }),
          withTiming(0.35, { duration: 900 })
        ),
        -1
      );
    } else if (isProcessing) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.97, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
      outerScale.value = withRepeat(
        withSequence(
          withTiming(1.25, { duration: 600 }),
          withTiming(1.05, { duration: 600 })
        ),
        -1
      );
      outerOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 600 }),
          withTiming(0.4, { duration: 600 })
        ),
        -1
      );
    } else {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.98, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
      outerScale.value = withTiming(1, { duration: 300 });
      outerOpacity.value = withTiming(0.15, { duration: 300 });
    }
  }, [isListening, isProcessing]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerScale.value }],
    opacity: outerOpacity.value,
  }));

  const BARS = [0, 1, 2, 3, 4, 5, 6];
  const isActive = isListening || isProcessing;

  return (
    <Pressable onPress={onPress} hitSlop={20}>
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.outerRing,
            { borderColor: orbColor },
            outerStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.orb,
            {
              backgroundColor: orbColor,
              shadowColor: orbColor,
            },
            orbStyle,
          ]}
        >
          <View style={styles.waveform}>
            {BARS.map((i) => (
              <WaveBar key={i} delay={i} isActive={isActive} />
            ))}
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const ORB_SIZE = 160;

const styles = StyleSheet.create({
  container: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  outerRing: {
    position: "absolute",
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    borderWidth: 1.5,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
    opacity: 0.92,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bar: {
    width: 3,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.9)",
    minHeight: 4,
  },
});
