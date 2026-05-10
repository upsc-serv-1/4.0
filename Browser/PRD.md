# GhostBrowse — Product Requirements

## Vision
The most aggressive anti-fingerprinting mobile browser possible inside an Expo/React Native shell. Lets users log in to websites with a fresh, randomized "browser persona" so trackers, anti-abuse engines, and risk-scoring systems cannot link sessions to a device or prior history.

## Users
Privacy-conscious users who already use a VPN and want a hardened mobile browser that defeats fingerprinting + cookie tracking + WebRTC/DNS leaks + behavioral signals.

## Core Features
1. **Per-tab randomized identity** — every tab gets a unique Identity (UA, platform, vendor, screen, timezone, language, hardwareConcurrency, deviceMemory, WebGL vendor/renderer, canvas noise seed, audio noise seed, font subset).
2. **4 reset modes** — `per-click` (new identity before every navigation), `per-tab` (per tab lifetime), `per-session` (until manual rotate), `manual`.
3. **JS injection engine** that spoofs at the WebView level:
   - navigator.* properties (UA, platform, languages, hardwareConcurrency, deviceMemory, plugins=[], webdriver=false, DNT=1, GPC=true)
   - Removes battery, bluetooth, usb, serial, hid, serviceWorker, connection APIs
   - permissions.query → denied
   - screen.* and devicePixelRatio
   - Timezone offset + Intl.DateTimeFormat
   - **Canvas** noise on toDataURL/getImageData/toBlob
   - **WebGL** UNMASKED_VENDOR/RENDERER spoof + readPixels noise
   - **AudioContext** noise on getFloatFrequencyData/getChannelData
   - **Fonts** restricted via document.fonts.check
   - **WebRTC** → stubbed (no IP leaks)
   - **Storage** → localStorage/sessionStorage replaced with in-memory map; indexedDB undefined
4. **Multi-tab** browsing with tab switcher
5. **Built-in leak tests** — BrowserLeaks, AmIUnique, EFF Cover Your Tracks, WebRTC, DNS Leak Test, IP Check
6. **No storage** — incognito WebView, no cookies, no cache, sharedCookiesEnabled=false, thirdPartyCookiesEnabled=false; nothing persists across app restart.
7. **Burn everything** — wipe all tabs + identities in one tap.
8. **Identity panel** — terminal-style inspector showing every currently-spoofed value.

## Non-features (explicit)
- No bookmarks, no history, no autofill (by design — leaks).
- No accounts, no sync, no telemetry.

## Tech
- Expo SDK 54, expo-router, react-native-webview 13.15
- Pure React Native components (no web libs)
- FastAPI backend unused (kept default; nothing to store)
- MongoDB unused

## Business / Smart Enhancement
- "Rotate stats" counter on identity panel: number of rotations this session — gamifies privacy and gives users feedback that the engine is working. (Can be added in v2.)
- Future: integrate VPN-status check via public IP API to warn user when their VPN drops (high-value paid feature).

## Limitations / Disclaimers
- WebView is OS-controlled. TLS / HTTP/2 / low-level network fingerprints cannot be spoofed from JS — VPN required.
- WebAuthn / passkeys still work (we don't block credential APIs).
- Web preview shows "WebView not supported on web" — works only on real iOS / Android devices (Expo Go or built app).
