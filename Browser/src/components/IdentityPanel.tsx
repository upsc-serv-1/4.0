import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Identity } from "../lib/fingerprint";

type Props = {
  visible: boolean;
  identity: Identity | null;
  onClose: () => void;
  onRotate: () => void;
};

export default function IdentityPanel({ visible, identity, onClose, onRotate }: Props) {
  if (!visible || !identity) return null;

  const rows: { label: string; value: string; spoofed: boolean }[] = [
    { label: "USER-AGENT", value: identity.userAgent, spoofed: true },
    { label: "PLATFORM", value: identity.platform, spoofed: true },
    { label: "VENDOR", value: identity.vendor, spoofed: true },
    { label: "LANGUAGE", value: identity.language + " (" + identity.languages.join(",") + ")", spoofed: true },
    { label: "TIMEZONE", value: identity.timezone + " · offset " + identity.timezoneOffset, spoofed: true },
    { label: "SCREEN", value: identity.screen.width + "×" + identity.screen.height + " @" + identity.devicePixelRatio + "x", spoofed: true },
    { label: "CPU CORES", value: String(identity.hardwareConcurrency), spoofed: true },
    { label: "MEMORY (GB)", value: String(identity.deviceMemory), spoofed: true },
    { label: "WEBGL VENDOR", value: identity.webglVendor, spoofed: true },
    { label: "WEBGL RENDERER", value: identity.webglRenderer, spoofed: true },
    { label: "CANVAS NOISE", value: identity.canvasNoiseSeed.toFixed(8), spoofed: true },
    { label: "AUDIO NOISE", value: identity.audioNoiseSeed.toFixed(8), spoofed: true },
    { label: "FONTS ALLOWED", value: identity.fontsAllowed.length + " (" + identity.fontsAllowed.slice(0, 3).join(", ") + "…)", spoofed: true },
    { label: "WEBRTC", value: "BLOCKED", spoofed: true },
    { label: "INDEXED DB", value: "STUBBED", spoofed: true },
    { label: "SERVICE WORKER", value: "DISABLED", spoofed: true },
    { label: "BATTERY API", value: "REMOVED", spoofed: true },
    { label: "STORAGE", value: "IN-MEMORY ONLY", spoofed: true },
  ];

  return (
    <View style={styles.overlay} testID="identity-panel">
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>// IDENTITY · {identity.id}</Text>
          <TouchableOpacity onPress={onClose} testID="identity-close-btn">
            <Ionicons name="close" size={22} color="#F5F5F5" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 16 }}>
          {rows.map((r) => (
            <View key={r.label} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.label}>{r.label}</Text>
                <View style={styles.spoofTag}>
                  <Ionicons name="checkmark" size={10} color="#22C55E" />
                  <Text style={styles.spoofText}>SPOOFED</Text>
                </View>
              </View>
              <Text style={styles.value} numberOfLines={3}>{r.value}</Text>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.rotateBtn} onPress={onRotate} testID="rotate-identity-from-panel">
          <Ionicons name="refresh" size={16} color="#EF4444" />
          <Text style={styles.rotateText}>ROTATE IDENTITY NOW</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "85%",
    backgroundColor: "#0A0A0A",
    borderTopWidth: 1,
    borderColor: "#22C55E40",
    padding: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: "#22C55E40",
    marginBottom: 8,
  },
  title: {
    color: "#22C55E",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 13,
    letterSpacing: 1.5,
  },
  list: { maxHeight: 480 },
  row: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#FFFFFF10",
  },
  rowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  label: {
    color: "#808A93",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    letterSpacing: 1.5,
  },
  spoofTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderColor: "#22C55E40",
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  spoofText: {
    color: "#22C55E",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 8,
    letterSpacing: 1,
  },
  value: {
    color: "#F5F5F5",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 11,
    lineHeight: 15,
  },
  rotateBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#EF4444",
    paddingVertical: 12,
  },
  rotateText: {
    color: "#EF4444",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 12,
    letterSpacing: 1.5,
  },
});
