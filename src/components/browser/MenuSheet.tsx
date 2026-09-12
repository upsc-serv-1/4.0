import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VpnStatus, timezoneMismatch } from "../../lib/browser/vpn";
import { Identity, shortFingerprint } from "../../lib/browser/fingerprint";

export type ResetMode = "per-click" | "per-tab" | "per-session" | "manual";

type Props = {
  visible: boolean;
  onClose: () => void;
  resetMode: ResetMode;
  setResetMode: (m: ResetMode) => void;
  onOpenIdentity: () => void;
  onOpenTabs: () => void;
  onOpenLeakTest: (url: string) => void;
  onNewTab: () => void;
  onClearAll: () => void;
  tabCount: number;
  vpnStatus: VpnStatus | null;
  vpnLoading: boolean;
  onRefreshVpn: () => void;
  spoofedTimezone: string;
  currentHost: string | null;
  hostLocked: boolean;
  onToggleHostLock: () => void;
};

const RESET_MODES: { id: ResetMode; label: string; desc: string }[] = [
  { id: "per-click", label: "PER CLICK", desc: "New identity before every navigation" },
  { id: "per-tab", label: "PER TAB", desc: "Identity persists for tab lifetime" },
  { id: "per-session", label: "PER SESSION", desc: "Identity persists until manual rotate" },
  { id: "manual", label: "MANUAL", desc: "Only rotate when you tap rotate" },
];

const LEAK_TESTS = [
  { name: "BrowserLeaks", url: "https://browserleaks.com" },
  { name: "AmIUnique", url: "https://amiunique.org/fingerprint" },
  { name: "Cover Your Tracks (EFF)", url: "https://coveryourtracks.eff.org" },
  { name: "WebRTC IP Leak", url: "https://browserleaks.com/webrtc" },
  { name: "DNS Leak Test", url: "https://www.dnsleaktest.com" },
  { name: "IP Address Check", url: "https://browserleaks.com/ip" },
];

export default function MenuSheet({
  visible, onClose, resetMode, setResetMode, onOpenIdentity, onOpenTabs,
  onOpenLeakTest, onNewTab, onClearAll, tabCount,
  vpnStatus, vpnLoading, onRefreshVpn, spoofedTimezone,
  currentHost, hostLocked, onToggleHostLock,
}: Props) {
  if (!visible) return null;
  const tzMismatch = vpnStatus ? timezoneMismatch(vpnStatus.timezone, spoofedTimezone) : false;
  return (
    <View style={styles.overlay} testID="menu-sheet">
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>// GHOSTBROWSE · CONTROL</Text>
          <TouchableOpacity onPress={onClose} testID="menu-close-btn">
            <Ionicons name="close" size={22} color="#F5F5F5" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Quick actions */}
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={onNewTab} testID="new-tab-btn">
              <Ionicons name="add" size={18} color="#22C55E" />
              <Text style={styles.quickText}>NEW TAB</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={onOpenTabs} testID="open-tabs-btn">
              <Ionicons name="copy-outline" size={16} color="#22C55E" />
              <Text style={styles.quickText}>TABS · {tabCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={onOpenIdentity} testID="open-identity-btn">
              <Ionicons name="finger-print" size={16} color="#22C55E" />
              <Text style={styles.quickText}>IDENTITY</Text>
            </TouchableOpacity>
          </View>

          {/* VPN / IP status */}
          <View style={styles.vpnHeader}>
            <Text style={styles.sectionLabel}>VPN · NETWORK STATUS</Text>
            <TouchableOpacity onPress={onRefreshVpn} testID="vpn-refresh-btn">
              <Ionicons name="refresh" size={14} color="#22C55E" />
            </TouchableOpacity>
          </View>
          <View style={[styles.vpnCard, tzMismatch && styles.vpnCardWarn]}>
            {vpnLoading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator size="small" color="#22C55E" />
                <Text style={styles.vpnLoading}>{"> checking exit node…"}</Text>
              </View>
            ) : vpnStatus ? (
              <>
                <View style={styles.vpnRow}>
                  <Text style={styles.vpnKey}>IP</Text>
                  <Text style={styles.vpnVal} testID="vpn-ip">{vpnStatus.ip}</Text>
                </View>
                <View style={styles.vpnRow}>
                  <Text style={styles.vpnKey}>LOCATION</Text>
                  <Text style={styles.vpnVal}>{vpnStatus.city}, {vpnStatus.country} ({vpnStatus.countryCode})</Text>
                </View>
                <View style={styles.vpnRow}>
                  <Text style={styles.vpnKey}>ISP</Text>
                  <Text style={styles.vpnVal} numberOfLines={1}>{vpnStatus.isp}</Text>
                </View>
                <View style={styles.vpnRow}>
                  <Text style={styles.vpnKey}>REAL TZ</Text>
                  <Text style={styles.vpnVal}>{vpnStatus.timezone}</Text>
                </View>
                <View style={styles.vpnRow}>
                  <Text style={styles.vpnKey}>SPOOF TZ</Text>
                  <Text style={[styles.vpnVal, tzMismatch && { color: "#EF4444" }]}>{spoofedTimezone}</Text>
                </View>
                {tzMismatch ? (
                  <Text style={styles.warnText}>{"⚠ MISMATCH — websites may flag this. Match VPN region to spoofed TZ."}</Text>
                ) : (
                  <Text style={styles.okText}>{"✓ continent match"}</Text>
                )}
              </>
            ) : (
              <Text style={styles.vpnLoading}>{"> tap refresh to check"}</Text>
            )}
          </View>

          {/* Per-site identity lock */}
          {currentHost && (
            <>
              <Text style={styles.sectionLabel}>PER-SITE IDENTITY LOCK</Text>
              <TouchableOpacity
                style={[styles.lockRow, hostLocked && styles.lockRowActive]}
                onPress={onToggleHostLock}
                testID="toggle-host-lock-btn"
              >
                <Ionicons
                  name={hostLocked ? "lock-closed" : "lock-open"}
                  size={16}
                  color={hostLocked ? "#22C55E" : "#808A93"}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lockLabel, hostLocked && { color: "#22C55E" }]}>
                    {hostLocked ? "LOCKED" : "UNLOCKED"} · {currentHost}
                  </Text>
                  <Text style={styles.lockDesc}>
                    {hostLocked
                      ? "Same identity will be reused for this site"
                      : "Tap to pin current identity to this site"}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Reset mode */}
          <Text style={styles.sectionLabel}>RESET MODE</Text>
          {RESET_MODES.map((m) => {
            const active = m.id === resetMode;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.modeRow, active && styles.modeRowActive]}
                onPress={() => setResetMode(m.id)}
                testID={`reset-mode-${m.id}`}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeLabel, active && { color: "#22C55E" }]}>{m.label}</Text>
                  <Text style={styles.modeDesc}>{m.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Leak tests */}
          <Text style={styles.sectionLabel}>LEAK TESTS</Text>
          {LEAK_TESTS.map((t) => (
            <TouchableOpacity
              key={t.url}
              style={styles.linkRow}
              onPress={() => onOpenLeakTest(t.url)}
              testID={`leak-test-${t.name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}`}
            >
              <Ionicons name="bug" size={14} color="#EAB308" />
              <Text style={styles.linkText}>{t.name}</Text>
              <Ionicons name="arrow-forward" size={14} color="#808A93" />
            </TouchableOpacity>
          ))}

          {/* Danger zone */}
          <Text style={styles.sectionLabel}>DANGER ZONE</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={onClearAll} testID="clear-all-btn">
            <Ionicons name="trash" size={14} color="#EF4444" />
            <Text style={styles.dangerText}>BURN EVERYTHING (CLOSE ALL TABS + WIPE)</Text>
          </TouchableOpacity>

          {/* Info */}
          <Text style={styles.footer}>
            {"// REMINDER: pair with a reputable VPN. Match VPN timezone with spoofed timezone for best results."}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "88%",
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
  quickRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#22C55E40",
    paddingVertical: 10,
  },
  quickText: {
    color: "#F5F5F5",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    letterSpacing: 1,
  },
  sectionLabel: {
    color: "#808A93",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 14,
    marginBottom: 6,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#FFFFFF10",
    marginBottom: 4,
  },
  modeRowActive: { borderColor: "#22C55E", backgroundColor: "#22C55E10" },
  radio: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 1, borderColor: "#808A93",
    alignItems: "center", justifyContent: "center",
  },
  radioActive: { borderColor: "#22C55E" },
  radioDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" },
  modeLabel: {
    color: "#F5F5F5",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 12,
    letterSpacing: 1.2,
  },
  modeDesc: {
    color: "#808A93",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    marginTop: 2,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#FFFFFF10",
    marginBottom: 4,
  },
  linkText: {
    flex: 1,
    color: "#F5F5F5",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 11,
    letterSpacing: 0.5,
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#EF4444",
    paddingVertical: 12,
    marginBottom: 12,
  },
  dangerText: {
    color: "#EF4444",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    letterSpacing: 1.2,
  },
  footer: {
    color: "#4B5563",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 9,
    marginTop: 8,
    lineHeight: 14,
  },
  vpnHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, marginBottom: 6 },
  vpnCard: {
    borderWidth: 1,
    borderColor: "#22C55E40",
    padding: 10,
    marginBottom: 4,
  },
  vpnCardWarn: { borderColor: "#EF4444" },
  vpnRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  vpnKey: {
    color: "#808A93",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    letterSpacing: 1.5,
    width: 80,
  },
  vpnVal: {
    color: "#F5F5F5",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 11,
    flex: 1,
    textAlign: "right",
  },
  vpnLoading: {
    color: "#808A93",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 11,
  },
  warnText: {
    color: "#EF4444",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 9,
    marginTop: 8,
    lineHeight: 13,
  },
  okText: {
    color: "#22C55E",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    marginTop: 6,
  },
  lockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#FFFFFF10",
    marginBottom: 4,
  },
  lockRowActive: { borderColor: "#22C55E", backgroundColor: "#22C55E10" },
  lockLabel: {
    color: "#F5F5F5",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 11,
    letterSpacing: 1,
  },
  lockDesc: {
    color: "#808A93",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 9,
    marginTop: 2,
  },
});
