/**
 * SideDrawer — Google Gemini-style left slide-out navigation.
 *
 * Sections:
 *  • "Astra" branding header
 *  • Primary nav: New chat / Search chats / Videos / Library
 *  • Recent — persisted sessions from AsyncStorage, newest first
 *  • Fixed footer: avatar + name + PRO badge + settings gear
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Defs, LinearGradient, Stop, Svg, Circle } from "react-native-svg";

import type { CommandEntry, StoredSession } from "@/context/AssistantContext";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DRAWER_W = 305;
const ANIM_MS  = 280;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SideDrawerProps {
  open:               boolean;
  onClose:            () => void;
  recentChats:        CommandEntry[];     // current active session entries
  sessions:           StoredSession[];    // archived past sessions
  onNewChat:          () => void;
  onSelectSession?:   (session: StoredSession) => void;
  onSettingsPress?:   () => void;
  onProfilePress?:    () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar with Google-style rainbow-gradient ring
// ─────────────────────────────────────────────────────────────────────────────

function GradientRingAvatar({ initials, size = 38 }: { initials: string; size?: number }) {
  const R  = size / 2;
  const id = "drawerRing";
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
      <View style={{ width: size - 2, height: size - 2, borderRadius: (size - 2) / 2, backgroundColor: "#4A3F8F", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: size * 0.35, fontFamily: "Inter_700Bold" }}>{initials}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primary nav row
// ─────────────────────────────────────────────────────────────────────────────

function NavRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.navRow} onPress={onPress} activeOpacity={0.6}>
      <Ionicons name={icon} size={22} color="#444" style={styles.navIcon} />
      <Text style={styles.navLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent session row
// ─────────────────────────────────────────────────────────────────────────────

function RecentRow({
  label,
  subtitle,
  active,
  onPress,
}: {
  label: string;
  subtitle?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.recentRow, active && styles.recentRowActive]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {active && <View style={styles.activeBar} />}
      <View style={styles.recentContent}>
        <Text style={[styles.recentText, active && styles.recentTextActive]} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={styles.recentSubtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header label
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: format a date as relative or short date
// ─────────────────────────────────────────────────────────────────────────────

function formatSessionDate(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main drawer
// ─────────────────────────────────────────────────────────────────────────────

export function SideDrawer({
  open,
  onClose,
  recentChats,
  sessions,
  onNewChat,
  onSelectSession,
  onSettingsPress,
  onProfilePress,
}: SideDrawerProps) {
  const insets = useSafeAreaInsets();

  const translateX = useSharedValue(-DRAWER_W);
  const backdropOp = useSharedValue(0);

  useEffect(() => {
    if (open) {
      translateX.value = withTiming(0,         { duration: ANIM_MS, easing: Easing.out(Easing.cubic) });
      backdropOp.value = withTiming(0.45,       { duration: ANIM_MS });
    } else {
      translateX.value = withTiming(-DRAWER_W, { duration: ANIM_MS, easing: Easing.in(Easing.cubic) });
      backdropOp.value = withTiming(0,          { duration: ANIM_MS });
    }
  }, [open]);

  const drawerStyle   = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOp.value }));

  if (!open && Platform.OS !== "web") return null;

  // Current session title: first user message in the active commandLog
  const currentTitle = recentChats.length > 0
    ? (recentChats[recentChats.length - 1]?.command ?? "").slice(0, 55)
    : null;

  const topPad = Platform.OS === "web" ? 48 : insets.top;
  const botPad = Math.max(Platform.OS === "web" ? 16 : insets.bottom, 16);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={open ? "auto" : "none"}>
      {/* ── Dark backdrop ── */}
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={open ? "auto" : "none"}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* ── Drawer panel ── */}
      <Animated.View style={[styles.drawer, drawerStyle]} pointerEvents="auto">

        {/* ── Top branding ── */}
        <View style={[styles.headerRow, { paddingTop: topPad + 18 }]}>
          <Text style={styles.brandTitle}>Astra</Text>
        </View>

        {/* ── Scrollable body ── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Primary nav */}
          <NavRow
            icon="create-outline"
            label="New chat"
            onPress={() => { onNewChat(); onClose(); }}
          />
          <NavRow icon="search-outline"      label="Search chats" />
          <NavRow icon="play-circle-outline" label="Videos" />
          <NavRow icon="grid-outline"        label="Library" />

          {/* Recent section */}
          <View style={styles.sectionSpacer} />
          <SectionLabel label="Recent" />

          {/* Active (current) session */}
          {currentTitle ? (
            <RecentRow
              label={currentTitle}
              subtitle="Active now"
              active
              onPress={onClose}
            />
          ) : null}

          {/* Past archived sessions */}
          {sessions.length === 0 && !currentTitle ? (
            <Text style={styles.noRecent}>No conversations yet</Text>
          ) : (
            sessions.slice(0, 20).map((session) => (
              <RecentRow
                key={session.id}
                label={session.title}
                subtitle={formatSessionDate(session.startedAt)}
                active={false}
                onPress={() => {
                  onSelectSession?.(session);
                  onClose();
                }}
              />
            ))
          )}
        </ScrollView>

        {/* ── Fixed profile footer ── */}
        <View style={[styles.profileFooter, { paddingBottom: botPad }]}>
          <View style={styles.profileDivider} />
          <View style={styles.profileRow}>
            {/* Tapping avatar or name opens profile */}
            <TouchableOpacity
              style={styles.profileTouchable}
              onPress={() => { onProfilePress?.(); onClose(); }}
              activeOpacity={0.7}
              hitSlop={4}
            >
              <GradientRingAvatar initials="Sk" size={38} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Sk Soyel</Text>
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Settings gear */}
            <TouchableOpacity
              hitSlop={12}
              style={styles.settingsBtn}
              onPress={() => { onSettingsPress?.(); onClose(); }}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={21} color="#777" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  drawer: {
    position:        "absolute",
    top:             0,
    left:            0,
    bottom:          0,
    width:           DRAWER_W,
    backgroundColor: "#FFFFFF",
    shadowColor:     "#000",
    shadowOffset:    { width: 6, height: 0 },
    shadowOpacity:   0.15,
    shadowRadius:    16,
    elevation:       20,
    flexDirection:   "column",
  },

  // Header
  headerRow: {
    paddingHorizontal: 20,
    paddingBottom:     14,
  },
  brandTitle: {
    fontSize:      28,
    fontFamily:    "Inter_700Bold",
    color:         "#1a1a1a",
    letterSpacing: -0.5,
  },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 8, paddingBottom: 12 },

  // Nav rows
  navRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   13,
    paddingHorizontal: 12,
    borderRadius:      10,
    gap:               14,
  },
  navIcon:  { width: 24, textAlign: "center" },
  navLabel: {
    fontSize:      15,
    color:         "#1a1a1a",
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.1,
  },

  // Section label
  sectionSpacer: { height: 8 },
  sectionLabel: {
    fontSize:          13,
    color:             "#888",
    fontFamily:        "Inter_600SemiBold",
    letterSpacing:     0.1,
    paddingHorizontal: 14,
    paddingVertical:   6,
  },

  // Recent rows
  noRecent: {
    fontSize:          13,
    color:             "#bbb",
    fontFamily:        "Inter_400Regular",
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  recentRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   10,
    paddingHorizontal: 14,
    borderRadius:      10,
    gap:               8,
  },
  recentRowActive: {
    backgroundColor: "#F0F4FF",
  },
  activeBar: {
    width:        3,
    height:       32,
    borderRadius: 2,
    backgroundColor: "#4285F4",
    marginLeft:   -2,
  },
  recentContent: { flex: 1, gap: 1 },
  recentText: {
    fontSize:   14,
    color:      "#2a2a2a",
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  recentTextActive: {
    fontFamily: "Inter_500Medium",
    color:      "#1a1a1a",
  },
  recentSubtitle: {
    fontSize:   11,
    color:      "#aaa",
    fontFamily: "Inter_400Regular",
  },

  // Profile footer
  profileFooter: {
    backgroundColor: "#FFFFFF",
  },
  profileDivider: {
    height:           1,
    backgroundColor:  "#F0F0F0",
    marginHorizontal: 12,
  },
  profileRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 14,
    paddingVertical:   14,
    gap:               10,
  },
  profileTouchable: {
    flex:          1,
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  profileInfo: { flex: 1, gap: 3 },
  profileName: {
    fontSize:      14,
    fontFamily:    "Inter_600SemiBold",
    color:         "#1a1a1a",
    letterSpacing: -0.1,
  },
  proBadge: {
    alignSelf:         "flex-start",
    backgroundColor:   "#E8F0FE",
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      5,
  },
  proBadgeText: {
    fontSize:      10,
    color:         "#4285F4",
    fontFamily:    "Inter_700Bold",
    letterSpacing: 0.8,
  },
  settingsBtn: { padding: 4 },
});
