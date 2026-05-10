import { StyleSheet } from "react-native";

export const T = {
  // Surface
  bg: "#0a0e1a",
  surface: "#0f1626",
  surfaceAlt: "#131b2c",
  border: "#1f2a3f",
  borderStrong: "#2a3a55",
  // Text
  text: "#e6edf7",
  textMuted: "#8893ab",
  textDim: "#5e6a82",
  // Accent
  primary: "#7c5cff",
  primaryHover: "#9275ff",
  accent: "#22d3ee",
  // States
  ok: "#22c55e",
  warn: "#f59e0b",
  err: "#ef4444",
  info: "#38bdf8",
};

export const sharedStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: T.bg, padding: 24 },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
  },
  card: {
    backgroundColor: T.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: T.border,
  },
  cardAlt: {
    backgroundColor: T.surfaceAlt,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: T.border,
  },
  h1: { color: T.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.3 },
  h2: { color: T.text, fontSize: 20, fontWeight: "700" },
  h3: { color: T.text, fontSize: 16, fontWeight: "600" },
  pSm: { color: T.textMuted, fontSize: 13, lineHeight: 19 },
  p: { color: T.text, fontSize: 14, lineHeight: 21 },
  label: { color: T.textMuted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: T.bg,
    color: T.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: T.border,
    fontSize: 14,
  },
  button: {
    backgroundColor: T.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  buttonGhost: {
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
  },
  buttonGhostText: { color: T.text, fontWeight: "600", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowGap: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  divider: { height: 1, backgroundColor: T.border, marginVertical: 12 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: T.surfaceAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
  badgeText: { color: T.textMuted, fontSize: 11, fontWeight: "600" },
});
