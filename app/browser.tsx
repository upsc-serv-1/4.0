import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";

import AddressBar from "../src/components/browser/AddressBar";
import IdentityPanel from "../src/components/browser/IdentityPanel";
import MenuSheet, { ResetMode } from "../src/components/browser/MenuSheet";
import TabSwitcher, { Tab } from "../src/components/browser/TabSwitcher";
import { generateIdentity, Identity } from "../src/lib/browser/fingerprint";
import { buildInjectionScript } from "../src/lib/browser/injection";
import { fetchVpnStatus, VpnStatus } from "../src/lib/browser/vpn";

const NEW_TAB_URL = "ghost://newtab";
const HOMEPAGE = "https://duckduckgo.com";
const BG_IMAGE = "https://images.unsplash.com/photo-1721378466905-0375f1e7b879?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMGRhcmslMjB0ZXJtaW5hbCUyMGN5YmVyJTIwc2VjdXJpdHklMjBtYXRyaXh8ZW58MHx8fHwxNzc4NDUwMjI3fDA&ixlib=rb-4.1.0&q=85";

function newTab(): Tab {
  return {
    id: Math.random().toString(36).slice(2, 10),
    url: NEW_TAB_URL,
    title: "New Tab",
    identity: generateIdentity(),
  };
}

export default function GhostBrowseScreen() {
  const [tabs, setTabs] = React.useState<Tab[]>([newTab()]);
  const [activeId, setActiveId] = React.useState<string>(tabs[0].id);
  const [resetMode, setResetMode] = React.useState<ResetMode>("per-session");
  const [showIdentity, setShowIdentity] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showTabs, setShowTabs] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [canGoBack, setCanGoBack] = React.useState(false);
  const [canGoForward, setCanGoForward] = React.useState(false);
  const [vpnStatus, setVpnStatus] = React.useState<VpnStatus | null>(null);
  const [vpnLoading, setVpnLoading] = React.useState(false);
  // Per-site identity lock: hostname -> Identity
  const [lockedHosts, setLockedHosts] = React.useState<Record<string, Identity>>({});

  const refreshVpn = React.useCallback(async () => {
    setVpnLoading(true);
    try {
      const s = await fetchVpnStatus();
      setVpnStatus(s);
    } catch (e) {
      // swallow
    } finally {
      setVpnLoading(false);
    }
  }, []);

  React.useEffect(() => { refreshVpn(); }, [refreshVpn]);

  const webviewRefs = React.useRef<Record<string, WebView | null>>({});

  const active = tabs.find((t) => t.id === activeId) || tabs[0];

  // Extract hostname from current URL
  const currentHost = React.useMemo(() => {
    try {
      if (!active.url || active.url === NEW_TAB_URL) return null;
      const u = new URL(active.url);
      return u.hostname;
    } catch { return null; }
  }, [active.url]);

  const hostLocked = !!(currentHost && lockedHosts[currentHost]);

  const toggleHostLock = () => {
    if (!currentHost) return;
    setLockedHosts((prev) => {
      const next = { ...prev };
      if (next[currentHost]) {
        delete next[currentHost];
      } else {
        next[currentHost] = active.identity;
      }
      return next;
    });
  };

  const updateTab = (id: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const rotateIdentity = (tabId: string = activeId) => {
    const newId = generateIdentity();
    updateTab(tabId, { identity: newId });
  };

  const handleNavigate = (url: string) => {
    // Check if target host has a locked identity -> reuse it
    let lockedId: Identity | null = null;
    try {
      const host = new URL(url).hostname;
      if (lockedHosts[host]) lockedId = lockedHosts[host];
    } catch {}

    if (lockedId) {
      updateTab(active.id, { identity: lockedId, url });
    } else if (resetMode === "per-click") {
      rotateIdentity(active.id);
      updateTab(active.id, { url });
    } else {
      updateTab(active.id, { url });
    }
  };

  const handleNewTab = () => {
    const t = newTab();
    setTabs((prev) => [...prev, t]);
    setActiveId(t.id);
    setShowTabs(false);
    setShowMenu(false);
  };

  const handleCloseTab = (id: string) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      if (filtered.length === 0) {
        const t = newTab();
        setActiveId(t.id);
        return [t];
      }
      if (id === activeId) setActiveId(filtered[0].id);
      return filtered;
    });
  };

  const handleClearAll = () => {
    const t = newTab();
    setTabs([t]);
    setActiveId(t.id);
    setShowMenu(false);
  };

  const openLeakTest = (url: string) => {
    rotateIdentity(active.id);
    updateTab(active.id, { url });
    setShowMenu(false);
  };

  const goBack = () => webviewRefs.current[active.id]?.goBack();
  const goForward = () => webviewRefs.current[active.id]?.goForward();
  const reload = () => {
    if (resetMode === "per-click") rotateIdentity(active.id);
    webviewRefs.current[active.id]?.reload();
  };

  const isNewTab = active.url === NEW_TAB_URL;
  const injection = buildInjectionScript(active.identity);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <AddressBar
          url={isNewTab ? "" : active.url}
          onSubmit={handleNavigate}
          onRotate={() => rotateIdentity(active.id)}
          onMenu={() => setShowMenu(true)}
          loading={loading}
          identityId={active.identity.id}
        />

        <View style={styles.flex}>
          {isNewTab ? (
            <NewTabScreen
              identity={active.identity}
              onOpen={(u) => handleNavigate(u)}
              onShowIdentity={() => setShowIdentity(true)}
            />
          ) : (
            <WebView
              key={active.id + "-" + active.identity.id}
              ref={(r) => {
                webviewRefs.current[active.id] = r;
              }}
              source={{
                uri: active.url,
                headers: {
                  "Accept-Language": active.identity.acceptLanguage,
                  DNT: "1",
                  "Sec-GPC": "1",
                  "Upgrade-Insecure-Requests": "1",
                },
              }}
              userAgent={active.identity.userAgent}
              applicationNameForUserAgent="GhostBrowse/1.0"
              incognito
              sharedCookiesEnabled={false}
              thirdPartyCookiesEnabled={false}
              cacheEnabled={false}
              javaScriptEnabled
              domStorageEnabled={false}
              allowsBackForwardNavigationGestures
              originWhitelist={["https://*", "http://*"]}
              injectedJavaScriptBeforeContentLoaded={injection}
              injectedJavaScript={injection}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onNavigationStateChange={(nav) => {
                setCanGoBack(nav.canGoBack);
                setCanGoForward(nav.canGoForward);
                if (nav.url && nav.url !== active.url && !nav.loading) {
                  if (resetMode === "per-click") {
                    rotateIdentity(active.id);
                  }
                  updateTab(active.id, { url: nav.url, title: nav.title || active.title });
                }
              }}
              renderLoading={() => (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color="#22C55E" />
                  <Text style={styles.loadingText}>{">>> SPOOFING IDENTITY..."}</Text>
                </View>
              )}
              startInLoadingState
              style={styles.flex}
              testID="webview"
            />
          )}
        </View>

        {/* Bottom toolbar */}
        <View style={styles.bottomBar}>
          <ToolBtn icon="arrow-back" onPress={goBack} disabled={!canGoBack} testID="nav-back" />
          <ToolBtn icon="arrow-forward" onPress={goForward} disabled={!canGoForward} testID="nav-forward" />
          <ToolBtn icon="refresh" onPress={reload} testID="nav-reload" />
          <ToolBtn icon="home" onPress={() => handleNavigate(HOMEPAGE)} testID="nav-home" />
          <ToolBtn icon="finger-print" onPress={() => setShowIdentity(true)} testID="nav-identity" accent />
          <ToolBtn icon="copy-outline" onPress={() => setShowTabs(true)} testID="nav-tabs" badge={tabs.length} />
        </View>
      </KeyboardAvoidingView>

      <IdentityPanel
        visible={showIdentity}
        identity={active.identity}
        onClose={() => setShowIdentity(false)}
        onRotate={() => {
          rotateIdentity(active.id);
        }}
      />
      <MenuSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        resetMode={resetMode}
        setResetMode={setResetMode}
        onOpenIdentity={() => {
          setShowMenu(false);
          setShowIdentity(true);
        }}
        onOpenTabs={() => {
          setShowMenu(false);
          setShowTabs(true);
        }}
        onOpenLeakTest={openLeakTest}
        onNewTab={handleNewTab}
        onClearAll={handleClearAll}
        tabCount={tabs.length}
        vpnStatus={vpnStatus}
        vpnLoading={vpnLoading}
        onRefreshVpn={refreshVpn}
        spoofedTimezone={active.identity.timezone}
        currentHost={currentHost}
        hostLocked={hostLocked}
        onToggleHostLock={toggleHostLock}
      />
      <TabSwitcher
        visible={showTabs}
        tabs={tabs}
        activeTabId={activeId}
        onClose={() => setShowTabs(false)}
        onSelect={(id) => {
          setActiveId(id);
          setShowTabs(false);
        }}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
      />
    </SafeAreaView>
  );
}

function ToolBtn({
  icon, onPress, disabled, testID, badge, accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  badge?: number;
  accent?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.toolBtn}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
    >
      <Ionicons
        name={icon}
        size={20}
        color={disabled ? "#4B5563" : accent ? "#22C55E" : "#F5F5F5"}
      />
      {badge !== undefined && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function NewTabScreen({
  identity, onOpen, onShowIdentity,
}: { identity: Identity; onOpen: (u: string) => void; onShowIdentity: () => void }) {
  const quick = [
    { name: "DuckDuckGo", url: "https://duckduckgo.com" },
    { name: "BrowserLeaks", url: "https://browserleaks.com" },
    { name: "Am I Unique?", url: "https://amiunique.org/fingerprint" },
    { name: "EFF Cover Your Tracks", url: "https://coveryourtracks.eff.org" },
    { name: "WebRTC Test", url: "https://browserleaks.com/webrtc" },
    { name: "DNS Leak Test", url: "https://www.dnsleaktest.com" },
  ];
  return (
    <ImageBackground
      source={{ uri: BG_IMAGE }}
      style={styles.newTabBg}
      imageStyle={{ opacity: 0.08 }}
    >
      <View style={styles.newTabInner}>
        <Text style={styles.brand}>// GHOSTBROWSE</Text>
        <Text style={styles.brandSub}>{"> anti_fingerprint_engine.active"}</Text>

        <TouchableOpacity
          style={styles.identityCard}
          onPress={onShowIdentity}
          testID="newtab-identity-card"
        >
          <View style={styles.identityCardRow}>
            <Text style={styles.identityLabel}>ACTIVE IDENTITY</Text>
            <View style={styles.statusDot} />
          </View>
          <Text style={styles.identityId}>{identity.id}</Text>
          <Text style={styles.identityDetail} numberOfLines={2}>{identity.userAgent}</Text>
          <View style={styles.identityRow}>
            <Text style={styles.kv}>TZ <Text style={styles.kvVal}>{identity.timezone}</Text></Text>
            <Text style={styles.kv}>LANG <Text style={styles.kvVal}>{identity.language}</Text></Text>
          </View>
          <View style={styles.identityRow}>
            <Text style={styles.kv}>GPU <Text style={styles.kvVal} numberOfLines={1}>{identity.webglRenderer.slice(0, 28)}</Text></Text>
          </View>
          <Text style={styles.tapHint}>{"> tap for full fingerprint"}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>QUICK LAUNCH</Text>
        <View style={styles.grid}>
          {quick.map((q) => (
            <TouchableOpacity
              key={q.url}
              style={styles.gridItem}
              onPress={() => onOpen(q.url)}
              testID={`quick-${q.name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}`}
            >
              <Text style={styles.gridText}>{q.name}</Text>
              <Ionicons name="arrow-forward" size={12} color="#22C55E" />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.tip}>
          {"// TIP: pair with VPN. set RESET MODE = PER CLICK for maximum stealth.\n// All storage is in-memory. Nothing persists."}
        </Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050505" },
  flex: { flex: 1 },
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#050505",
    gap: 12,
  },
  loadingText: {
    color: "#22C55E",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 11,
    letterSpacing: 1.5,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#0A0A0A",
    borderTopWidth: 1,
    borderTopColor: "#22C55E40",
    paddingVertical: 8,
  },
  toolBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "#22C55E",
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#22C55E",
    fontSize: 9,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
  newTabBg: { flex: 1, backgroundColor: "#050505" },
  newTabInner: { flex: 1, padding: 16 },
  brand: {
    color: "#22C55E",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 22,
    letterSpacing: 2,
    marginTop: 8,
  },
  brandSub: {
    color: "#808A93",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 18,
  },
  identityCard: {
    borderWidth: 1,
    borderColor: "#22C55E",
    padding: 12,
    backgroundColor: "#0A0A0A",
    marginBottom: 16,
  },
  identityCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  identityLabel: {
    color: "#808A93",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 9,
    letterSpacing: 2,
  },
  statusDot: { width: 8, height: 8, backgroundColor: "#22C55E" },
  identityId: {
    color: "#22C55E",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 24,
    letterSpacing: 2,
    marginVertical: 4,
  },
  identityDetail: {
    color: "#F5F5F5",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    marginBottom: 8,
    lineHeight: 14,
  },
  identityRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 3 },
  kv: {
    color: "#808A93",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    letterSpacing: 1,
    flex: 1,
  },
  kvVal: { color: "#F5F5F5" },
  tapHint: {
    color: "#22C55E",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    marginTop: 6,
  },
  sectionLabel: {
    color: "#808A93",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 6,
  },
  grid: { gap: 6 },
  gridItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#22C55E40",
    backgroundColor: "#0A0A0A",
  },
  gridText: {
    color: "#F5F5F5",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 12,
    letterSpacing: 0.5,
  },
  tip: {
    color: "#4B5563",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 9,
    marginTop: 16,
    lineHeight: 14,
  },
});
