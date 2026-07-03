/**
 * CommandLog — Google Gemini-style clean chat view.
 *
 * Layout:
 *   User    → right-aligned text in a subtle rounded chip (#F0F4FF)
 *   Astra   → full-width, no background, GeminiStar icon left of name,
 *              clean body text, action row below (👍 👎 📋 ⋯ 🔊)
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Defs, LinearGradient, Path, Stop, Svg } from "react-native-svg";

import type { CommandEntry } from "@/context/AssistantContext";

// ─────────────────────────────────────────────────────────────────────────────
// Inline mini star icon (matches GeminiStar but tiny, no animation)
// ─────────────────────────────────────────────────────────────────────────────

function StarIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="minigrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%"   stopColor="#4285F4" />
          <Stop offset="40%"  stopColor="#EA4335" />
          <Stop offset="75%"  stopColor="#FBBC04" />
          <Stop offset="100%" stopColor="#34A853" />
        </LinearGradient>
      </Defs>
      <Path
        d="M12,0 C12,2 2,12 0,12 C2,12 12,22 12,24 C12,22 22,12 24,12 C22,12 12,2 12,0 Z"
        fill="url(#minigrad)"
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single chat entry
// ─────────────────────────────────────────────────────────────────────────────

function ChatEntry({ entry }: { entry: CommandEntry }) {
  const [liked,    setLiked]    = useState<boolean | null>(null);
  const [copied,   setCopied]   = useState(false);

  const time = entry.timestamp.toLocaleTimeString([], {
    hour:   "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.entryGroup}>
      {/* ── User message ── */}
      <View style={styles.userRow}>
        <View style={styles.userChip}>
          <Text style={styles.userText}>{entry.command}</Text>
        </View>
      </View>

      {/* ── Astra response ── */}
      <View style={styles.astraBlock}>
        {/* Name row */}
        <View style={styles.astraNameRow}>
          <StarIcon size={16} />
          <Text style={styles.astraName}>Astra</Text>
          <Text style={styles.astraTime}>{time}</Text>
        </View>

        {/* Response body */}
        <Text
          style={[
            styles.astraText,
            entry.type === "error"   && styles.textError,
            entry.type === "warning" && styles.textWarning,
          ]}
        >
          {entry.response}
        </Text>

        {/* Action row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setLiked(true)}
            hitSlop={8}
          >
            <Ionicons
              name={liked === true ? "thumbs-up" : "thumbs-up-outline"}
              size={16}
              color={liked === true ? "#4285F4" : "#888"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setLiked(false)}
            hitSlop={8}
          >
            <Ionicons
              name={liked === false ? "thumbs-down" : "thumbs-down-outline"}
              size={16}
              color={liked === false ? "#EA4335" : "#888"}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleCopy} hitSlop={8}>
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={16}
              color={copied ? "#34A853" : "#888"}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={16} color="#888" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRight]} hitSlop={8}>
            <Ionicons name="volume-medium-outline" size={16} color="#888" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

interface CommandLogProps {
  entries: CommandEntry[];
  onClear: () => void;
}

export function CommandLog({ entries, onClear }: CommandLogProps) {
  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatEntry entry={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        inverted
        ListHeaderComponent={
          entries.length > 0 ? (
            <TouchableOpacity
              onPress={onClear}
              style={styles.clearBtn}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={13} color="#aaa" />
              <Text style={styles.clearText}>Clear conversation</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    paddingHorizontal: 16,
    paddingBottom:     8,
    paddingTop:        24,   // inverted list: this is the visual BOTTOM — clears the input pill
    gap:               4,
  },

  // Entry group
  entryGroup: { gap: 8, marginBottom: 16 },

  // User chip (right-aligned)
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingLeft: 56,
  },
  userChip: {
    backgroundColor: "#F0F4FF",
    borderRadius:    20,
    paddingHorizontal: 16,
    paddingVertical:   10,
    maxWidth:          "92%",
  },
  userText: {
    fontSize:   15,
    color:      "#1a1a1a",
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },

  // Astra block (full width, no bg)
  astraBlock: {
    paddingRight: 8,
  },
  astraNameRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    marginBottom:  6,
  },
  astraName: {
    fontSize:   13,
    color:      "#444",
    fontFamily: "Inter_600SemiBold",
  },
  astraTime: {
    fontSize:   11,
    color:      "#aaa",
    fontFamily: "Inter_400Regular",
    marginLeft: "auto",
  },
  astraText: {
    fontSize:   15,
    color:      "#1a1a1a",
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
    marginBottom: 10,
  },
  textError:   { color: "#EA4335" },
  textWarning: { color: "#FBBC04" },

  // Action row
  actionRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 8,
  },
  actionBtnRight: { marginLeft: "auto" },

  // Clear
  clearBtn: {
    flexDirection: "row",
    alignItems:    "center",
    justifyContent: "center",
    gap:           5,
    paddingVertical: 12,
  },
  clearText: {
    fontSize:   12,
    color:      "#aaa",
    fontFamily: "Inter_400Regular",
  },
});
