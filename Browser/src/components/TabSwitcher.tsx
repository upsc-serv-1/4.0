import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Identity, shortFingerprint } from "../lib/fingerprint";

export type Tab = {
  id: string;
  url: string;
  title: string;
  identity: Identity;
};

type Props = {
  visible: boolean;
  tabs: Tab[];
  activeTabId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
};

export default function TabSwitcher({ visible, tabs, activeTabId, onClose, onSelect, onCloseTab, onNewTab }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.overlay} testID="tab-switcher">
      <View style={styles.header}>
        <Text style={styles.title}>// TABS ({tabs.length})</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={styles.newBtn} onPress={onNewTab} testID="tab-switcher-new-btn">
            <Ionicons name="add" size={16} color="#22C55E" />
            <Text style={styles.newText}>NEW</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} testID="tab-switcher-close-btn">
            <Ionicons name="close" size={22} color="#F5F5F5" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabCard, t.id === activeTabId && styles.tabCardActive]}
            onPress={() => onSelect(t.id)}
            testID={`tab-card-${t.id}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.tabTitle} numberOfLines={1}>{t.title || "New Tab"}</Text>
              <Text style={styles.tabUrl} numberOfLines={1}>{t.url || "ghost://newtab"}</Text>
              <Text style={styles.tabId}>{shortFingerprint(t.identity)}</Text>
            </View>
            <TouchableOpacity
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => onCloseTab(t.id)}
              testID={`tab-close-${t.id}`}
            >
              <Ionicons name="close" size={18} color="#808A93" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050505",
    zIndex: 90,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: "#22C55E40",
  },
  title: {
    color: "#22C55E",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 13,
    letterSpacing: 1.5,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#22C55E40",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  newText: {
    color: "#22C55E",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    letterSpacing: 1,
  },
  tabCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FFFFFF10",
    backgroundColor: "#0A0A0A",
  },
  tabCardActive: { borderColor: "#22C55E" },
  tabTitle: {
    color: "#F5F5F5",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 12,
    letterSpacing: 0.5,
  },
  tabUrl: {
    color: "#808A93",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    marginTop: 2,
  },
  tabId: {
    color: "#22C55E",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 9,
    marginTop: 4,
    letterSpacing: 1,
  },
});
