/**
 * ProfileModal — compact floating dropdown card.
 *
 * Appears near the top-right header avatar (not a bottom sheet).
 * Animates: scale 0.88→1 + fade 0→1, origin: top-right corner.
 * Closes on backdrop tap or the × button.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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
import { Defs, LinearGradient, Stop, Svg, Circle } from "react-native-svg";

const SW = Dimensions.get("window").width;
const SH = Dimensions.get("window").height;

// ─────────────────────────────────────────────────────────────────────────────
// Avatar with Google-style rainbow-gradient ring
// ─────────────────────────────────────────────────────────────────────────────

function GradientAvatar({ initials, size = 38 }: { initials: string; size?: number }) {
  const R  = size / 2;
  const id = "aRing";
  return (
    <View style={{ width: size + 4, height: size + 4, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size + 4} height={size + 4} viewBox={`0 0 ${size + 4} ${size + 4}`} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%"   stopColor="#4285F4" />
            <Stop offset="30%"  stopColor="#EA4335" />
            <Stop offset="60%"  stopColor="#FBBC04" />
            <Stop offset="100%" stopColor="#34A853" />
          </LinearGradient>
        </Defs>
        <Circle cx={R + 2} cy={R + 2} r={R + 1} fill="none" stroke={`url(#${id})`} strokeWidth={2.5} />
      </Svg>
      <View style={{
        width: size - 2, height: size - 2, borderRadius: (size - 2) / 2,
        backgroundColor: "#4A3F8F", alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ color: "#fff", fontSize: size * 0.35, fontFamily: "Inter_700Bold" }}>
          {initials}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Divider / row helpers
// ─────────────────────────────────────────────────────────────────────────────

function Divider() {
  return <View style={styles.divider} />;
}

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: string;
  onPress?: () => void;
  last?: boolean;
}

function MenuRow({ icon, label, badge, onPress, last }: RowProps) {
  return (
    <>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color="#444" />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={14} color="#ccc" />
        )}
      </TouchableOpacity>
      {!last && <Divider />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dropdown card (the actual content)
// ─────────────────────────────────────────────────────────────────────────────

interface DropdownProps {
  visible: boolean;
  onClose: () => void;
  email: string;
  initials: string;
}

function Dropdown({ visible, onClose, email, initials }: DropdownProps) {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 48 : insets.top;

  // Animate scale + opacity; transform origin is top-right corner
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.88);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1,   { duration: 180 });
      scale.value   = withSpring(1.0, { damping: 18, stiffness: 280 });
    } else {
      opacity.value = withTiming(0,    { duration: 140 });
      scale.value   = withTiming(0.88, { duration: 140 });
    }
  }, [visible]);

  const cardAnim = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const backdropAnim = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.28,
  }));

  const cardWidth  = Math.min(SW - 24, 300);
  const cardTop    = topPad + 52;     // just below the header avatar
  const cardRight  = 8;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? "auto" : "none"}>
      {/* Tap-away backdrop */}
      <Animated.View style={[styles.backdrop, backdropAnim]} pointerEvents={visible ? "auto" : "none"}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Floating card */}
      <Animated.View
        style={[
          styles.card,
          { top: cardTop, right: cardRight, width: cardWidth, maxHeight: SH * 0.72 },
          cardAnim,
        ]}
        pointerEvents={visible ? "auto" : "none"}
      >
        {/* ── Header row ── */}
        <View style={styles.cardHeader}>
          <GradientAvatar initials={initials} size={34} />
          <Text style={styles.email} numberOfLines={1}>{email}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color="#444" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Card group 1 */}
          <View style={styles.menuCard}>
            <MenuRow icon="star-outline"         label="Manage subscription" badge="PRO" />
            <MenuRow icon="speedometer-outline"  label="Usage limits" />
            <MenuRow icon="time-outline"         label="App activity" />
            <MenuRow icon="person-outline"       label="Personal Intelligence" />
            <MenuRow icon="cloud-upload-outline" label="Import memory" />
            <MenuRow icon="happy-outline"        label="Avatar" />
            <MenuRow icon="alarm-outline"        label="Scheduled actions" />
            <MenuRow icon="shield-outline"       label="Privacy Help Hub" last />
          </View>

          {/* Card group 2 */}
          <View style={[styles.menuCard, { marginTop: 10 }]}>
            <MenuRow icon="settings-outline"    label="Settings" />
            <MenuRow icon="chatbubble-outline"  label="Feedback" />
            <MenuRow icon="help-circle-outline" label="Help" last />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity hitSlop={8}>
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <TouchableOpacity hitSlop={8}>
              <Text style={styles.footerLink}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  email?: string;
  initials?: string;
}

export function ProfileModal({
  visible,
  onClose,
  email    = "sksoyel584845@gmail.com",
  initials = "Sk",
}: ProfileModalProps) {
  // Render inline on both web and native — the Dropdown uses absoluteFillObject
  // and a tap-away backdrop, so no native Modal wrapper is needed.
  return (
    <Dropdown visible={visible} onClose={onClose} email={email} initials={initials} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },

  // Floating card
  card: {
    position:        "absolute",
    backgroundColor: "#F2F4F8",
    borderRadius:    20,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.16,
    shadowRadius:    24,
    elevation:       20,
    overflow:        "hidden",
  },

  // Card header
  cardHeader: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 14,
    paddingVertical:   12,
    gap:               8,
    backgroundColor:   "#F2F4F8",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  email: {
    flex:          1,
    fontSize:      13,
    fontFamily:    "Inter_500Medium",
    color:         "#1a1a1a",
    letterSpacing: -0.1,
  },
  closeBtn: {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: "#FFFFFF",
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.08,
    shadowRadius:    3,
    elevation:       2,
  },

  scrollContent: {
    paddingHorizontal: 10,
    paddingTop:        10,
    paddingBottom:     16,
  },

  // Menu card (white rounded block)
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius:    14,
    overflow:        "hidden",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    4,
    elevation:       2,
  },

  row: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   12,
    paddingHorizontal: 14,
    gap:               12,
  },
  rowIcon: { width: 24, alignItems: "center" },
  rowLabel: {
    flex:          1,
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    color:         "#1a1a1a",
    letterSpacing: -0.1,
  },

  badge: {
    backgroundColor:  "#E8F0FE",
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      6,
  },
  badgeText: {
    fontSize:      10,
    color:         "#4285F4",
    fontFamily:    "Inter_700Bold",
    letterSpacing: 0.5,
  },

  divider: {
    height:          1,
    backgroundColor: "#F5F5F5",
    marginLeft:      50,
  },

  footer: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             6,
    paddingVertical: 14,
  },
  footerLink: { fontSize: 11, color: "#888", fontFamily: "Inter_400Regular" },
  footerDot:  { fontSize: 11, color: "#bbb" },
});
