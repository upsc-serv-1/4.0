import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  url: string;
  onSubmit: (url: string) => void;
  onRotate: () => void;
  onMenu: () => void;
  onBack: () => void;
  loading: boolean;
  identityId: string;
};

export default function AddressBar({ url, onSubmit, onRotate, onMenu, onBack, loading, identityId }: Props) {
  const [text, setText] = React.useState(url);

  React.useEffect(() => {
    setText(url);
  }, [url]);

  const submit = () => {
    let v = text.trim();
    if (!v) return;
    // If looks like a URL, prepend https://; else treat as DuckDuckGo search
    const looksLikeUrl = /^[a-z]+:\/\//i.test(v) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(v);
    if (!looksLikeUrl) {
      v = "https://duckduckgo.com/?q=" + encodeURIComponent(v);
    } else if (!/^[a-z]+:\/\//i.test(v)) {
      v = "https://" + v;
    }
    onSubmit(v);
  };

  return (
    <View style={styles.wrap} testID="address-bar">
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.iconBtn, { borderColor: "transparent" }]}
          onPress={onBack}
          testID="exit-browser-btn"
        >
          <Ionicons name="chevron-back" size={24} color="#F5F5F5" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onRotate}
          testID="rotate-identity-btn"
        >
          <Ionicons name="refresh" size={18} color="#22C55E" />
        </TouchableOpacity>

        <View style={styles.inputWrap}>
          <Text style={styles.idTag} testID="identity-id-tag">ID·{identityId}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            placeholder="duckduckgo.com or search"
            placeholderTextColor="#4B5563"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.OS === "ios" ? "url" : "default"}
            returnKeyType="go"
            selectionColor="#22C55E"
            testID="url-input"
          />
          {loading && <View style={styles.loadingDot} />}
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onMenu}
          testID="menu-btn"
        >
          <Ionicons name="menu" size={20} color="#22C55E" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#0A0A0A",
    borderBottomWidth: 1,
    borderBottomColor: "#22C55E40",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: "#22C55E40",
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#22C55E40",
    paddingHorizontal: 8,
    height: 36,
    backgroundColor: "#050505",
  },
  idTag: {
    color: "#22C55E",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 10,
    marginRight: 6,
    letterSpacing: 1,
  },
  input: {
    flex: 1,
    color: "#F5F5F5",
    fontSize: 13,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    padding: 0,
  },
  loadingDot: {
    width: 8,
    height: 8,
    backgroundColor: "#EAB308",
    marginLeft: 6,
  },
});
