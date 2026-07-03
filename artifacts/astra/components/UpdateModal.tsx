/**
 * Astra — OTA Update Modal
 * Shown when a newer version is available on the server.
 * Forced (can't skip) when current version is below minVersion.
 */

import React from "react";
import {
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

interface UpdateModalProps {
  visible:       boolean;
  latestVersion: string;
  changelog:     string;
  downloadUrl:   string;
  forced:        boolean;       // forced = user can't skip
  onDismiss:     () => void;
}

export function UpdateModal({
  visible,
  latestVersion,
  changelog,
  downloadUrl,
  forced,
  onDismiss,
}: UpdateModalProps) {

  const handleUpdate = async () => {
    if (downloadUrl) {
      try { await Linking.openURL(downloadUrl); } catch {}
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={forced ? undefined : onDismiss}
    >
      <View style={s.overlay}>
        {/* Background blur */}
        {Platform.OS !== "web" ? (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.6)" }]} />
        )}

        <View style={s.card}>
          {/* Icon */}
          <View style={s.iconWrap}>
            <Ionicons name="rocket" size={32} color="#4285F4" />
          </View>

          {/* Title */}
          <Text style={s.title}>Update Available</Text>
          <Text style={s.version}>Version {latestVersion}</Text>

          {/* Changelog */}
          <View style={s.changelogBox}>
            <Text style={s.changelogLabel}>What's new</Text>
            <Text style={s.changelogText}>{changelog}</Text>
          </View>

          {/* Buttons */}
          <TouchableOpacity
            style={s.updateBtn}
            onPress={handleUpdate}
            activeOpacity={0.85}
          >
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={s.updateBtnText}>Update Now</Text>
          </TouchableOpacity>

          {!forced && (
            <TouchableOpacity
              style={s.skipBtn}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={s.skipText}>Maybe Later</Text>
            </TouchableOpacity>
          )}

          {forced && (
            <Text style={s.forcedNote}>
              This update is required to continue using Astra.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    width:           "100%",
    backgroundColor: "#0F0A2A",
    borderRadius:    24,
    padding:         28,
    alignItems:      "center",
    gap:             12,
    borderWidth:     1,
    borderColor:     "#2A1A5A",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.5,
    shadowRadius:    24,
    elevation:       12,
  },
  iconWrap: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: "rgba(66,133,244,0.15)",
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  title: {
    fontSize:      22,
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -0.3,
  },
  version: {
    fontSize:   13,
    fontFamily: "Inter_400Regular",
    color:      "#4285F4",
    marginTop:  -6,
  },
  changelogBox: {
    width:           "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius:    12,
    padding:         14,
    gap:             6,
    marginVertical:  4,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.08)",
  },
  changelogLabel: {
    fontSize:      11,
    fontFamily:    "Inter_600SemiBold",
    color:         "#666",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  changelogText: {
    fontSize:   14,
    fontFamily: "Inter_400Regular",
    color:      "#CCC",
    lineHeight: 20,
  },
  updateBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               8,
    width:             "100%",
    backgroundColor:   "#4285F4",
    borderRadius:      14,
    paddingVertical:   15,
    marginTop:         4,
    shadowColor:       "#4285F4",
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.4,
    shadowRadius:      12,
    elevation:         6,
  },
  updateBtnText: {
    fontSize:   16,
    fontFamily: "Inter_600SemiBold",
    color:      "#FFFFFF",
  },
  skipBtn: {
    paddingVertical:   8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize:           13,
    fontFamily:         "Inter_400Regular",
    color:              "#555",
    textDecorationLine: "underline",
  },
  forcedNote: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
    color:      "#EA4335",
    textAlign:  "center",
    lineHeight: 18,
    marginTop:  4,
  },
});
