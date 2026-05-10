# GhostBrowse — Anti-Fingerprinting Mobile Browser

## Goal
Build the most anti-fingerprinting mobile browser possible on Expo/React Native.
The browser must defeat tracking via fingerprinting, cookies, WebRTC/DNS leaks, and behavioral signals.

## Architecture
- **Frontend**: Expo SDK 54 + expo-router + `react-native-webview` (WebKit on iOS, Chromium on Android)
- **Backend**: FastAPI (kept minimal — user requested NO persistent storage)
- **Storage**: In-memory only (per-app-session). No AsyncStorage, no cookies persisted.

## Anti-Fingerprinting Strategy

### 1. Native-level spoofing (handled by WebView props)
- `userAgent` — randomized per tab / per click / per session
- `incognito={true}` — no cookies/cache persisted
- `thirdPartyCookiesEnabled={false}`
- `cacheEnabled={false}`
- `sharedCookiesEnabled={false}`
- `domStorageEnabled` — toggled off after each navigation when "per click" mode
- Custom HTTP headers: `DNT: 1`, `Sec-GPC: 1`, randomized `Accept-Language`

### 2. JS-injected spoofing (`injectedJavaScriptBeforeContentLoaded`)
Per identity, spoof:
- `navigator.userAgent`, `navigator.platform`, `navigator.vendor`, `navigator.appVersion`
- `navigator.languages`, `navigator.language`
- `navigator.hardwareConcurrency`, `navigator.deviceMemory`
- `navigator.plugins` → empty
- `navigator.webdriver` → false
- `screen.width/height/availWidth/availHeight/colorDepth/pixelDepth`
- `window.devicePixelRatio`
- `Intl.DateTimeFormat().resolvedOptions().timeZone` + `Date.getTimezoneOffset()`
- **Canvas fingerprint**: add per-identity pixel noise to `toDataURL`/`getImageData`
- **WebGL fingerprint**: spoof `RENDERER`/`VENDOR` strings + noise on `readPixels`
- **AudioContext fingerprint**: noise on `getChannelData`/`getFloatFrequencyData`
- **Fonts**: shuffle/limit `document.fonts.check` responses
- **WebRTC leak block**: stub `RTCPeerConnection`, `RTCDataChannel`, `mozRTCPeerConnection`
- **Battery API**: removed (`navigator.getBattery` → undefined)
- **Permissions API**: always return `denied` for sensitive perms
- **Service workers**: `navigator.serviceWorker` → undefined
- **Storage**: stub `indexedDB`, override `localStorage`/`sessionStorage` with in-memory map cleared per navigation

### 3. Behavioral
- No autofill, no form memory
- Optional "typing jitter" injection (randomized keypress timing)

### 4. Reset modes (user-selectable)
- **PER CLICK** — new identity injected before every navigation
- **PER TAB** — identity persists for tab lifetime
- **PER SESSION** — identity persists until manual reset
- **MANUAL** — only changes when user taps "Rotate Identity"

## Screens
- `/` — Main browser (address bar, WebView, bottom toolbar)
- Identity panel (bottom sheet) — shows currently-spoofed values
- Tab switcher (modal) — grid of open tabs
- Settings (modal) — spoofing aggressiveness, reset mode
- Leak tests launcher — quick links to BrowserLeaks / AmIUnique / EFF Cover Your Tracks

## Tech
- `react-native-webview` 13.15.0 (already installed)
- `@expo/vector-icons` for icons
- `react-native-reanimated` for bottom sheets
- No external storage libs

## File Layout
```
app/
  _layout.tsx          # Stack
  index.tsx            # Main browser screen
src/
  lib/
    fingerprint.ts     # Identity generator + UA pool
    injection.ts       # JS to inject into WebView
  components/
    AddressBar.tsx
    IdentityPanel.tsx
    TabSwitcher.tsx
    SettingsSheet.tsx
    LeakTestSheet.tsx
```

## Disclaimers
- WebView is OS-controlled. Some fingerprints (TLS, HTTP/2, low-level network) cannot be spoofed from JS.
- Passkeys (WebAuthn) work natively in WebView on iOS 16+/Android 9+ — we just don't block it.
- For full anonymity, user MUST also use a reputable VPN with matching timezone.
