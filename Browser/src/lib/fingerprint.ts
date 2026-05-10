// fingerprint.ts — Identity generator for anti-fingerprinting browser
// Each Identity object represents a randomized "browser persona" injected into the WebView.

export type Identity = {
  id: string;
  userAgent: string;
  platform: string;
  vendor: string;
  appVersion: string;
  language: string;
  languages: string[];
  acceptLanguage: string;
  timezone: string;
  timezoneOffset: number; // minutes
  screen: { width: number; height: number; availWidth: number; availHeight: number; colorDepth: number; pixelDepth: number };
  devicePixelRatio: number;
  hardwareConcurrency: number;
  deviceMemory: number;
  webglVendor: string;
  webglRenderer: string;
  canvasNoiseSeed: number;
  audioNoiseSeed: number;
  fontsAllowed: string[];
};

const UA_POOL = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];

const TIMEZONES = [
  { name: "America/New_York", offset: 240 },
  { name: "America/Los_Angeles", offset: 420 },
  { name: "America/Chicago", offset: 300 },
  { name: "Europe/London", offset: -60 },
  { name: "Europe/Berlin", offset: -120 },
  { name: "Europe/Paris", offset: -120 },
  { name: "Asia/Tokyo", offset: -540 },
  { name: "Asia/Singapore", offset: -480 },
  { name: "Asia/Kolkata", offset: -330 },
  { name: "Australia/Sydney", offset: -600 },
  { name: "America/Sao_Paulo", offset: 180 },
];

const LANGUAGES = [
  { primary: "en-US", list: ["en-US", "en"], accept: "en-US,en;q=0.9" },
  { primary: "en-GB", list: ["en-GB", "en"], accept: "en-GB,en;q=0.9" },
  { primary: "fr-FR", list: ["fr-FR", "fr", "en"], accept: "fr-FR,fr;q=0.9,en;q=0.7" },
  { primary: "de-DE", list: ["de-DE", "de", "en"], accept: "de-DE,de;q=0.9,en;q=0.7" },
  { primary: "es-ES", list: ["es-ES", "es", "en"], accept: "es-ES,es;q=0.9,en;q=0.7" },
  { primary: "ja-JP", list: ["ja-JP", "ja", "en"], accept: "ja-JP,ja;q=0.9,en;q=0.7" },
  { primary: "pt-BR", list: ["pt-BR", "pt", "en"], accept: "pt-BR,pt;q=0.9,en;q=0.7" },
];

const SCREEN_PROFILES = [
  { width: 390, height: 844, dpr: 3 }, // iPhone 14
  { width: 393, height: 852, dpr: 3 }, // iPhone 15
  { width: 414, height: 896, dpr: 2 }, // iPhone 11
  { width: 412, height: 915, dpr: 2.625 }, // Pixel 7
  { width: 360, height: 800, dpr: 3 }, // Samsung S21
  { width: 1920, height: 1080, dpr: 1 }, // Desktop FHD
  { width: 1440, height: 900, dpr: 2 }, // MacBook
  { width: 1366, height: 768, dpr: 1 }, // Common laptop
];

const WEBGL_PROFILES = [
  { vendor: "Apple Inc.", renderer: "Apple GPU" },
  { vendor: "Google Inc. (Apple)", renderer: "ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)" },
  { vendor: "Google Inc. (Intel)", renderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, OpenGL 4.6)" },
  { vendor: "Google Inc. (NVIDIA)", renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060, OpenGL 4.6)" },
  { vendor: "Google Inc. (AMD)", renderer: "ANGLE (AMD, AMD Radeon RX 6700 XT, OpenGL 4.6)" },
  { vendor: "Qualcomm", renderer: "Adreno (TM) 730" },
  { vendor: "ARM", renderer: "Mali-G78 MP14" },
  { vendor: "Imagination Technologies", renderer: "PowerVR Rogue GE8320" },
];

const PLATFORMS_FROM_UA = (ua: string): { platform: string; vendor: string; appVersion: string } => {
  if (ua.includes("iPhone") || ua.includes("iPad")) {
    return { platform: "iPhone", vendor: "Apple Computer, Inc.", appVersion: ua.split("Mozilla/")[1] || "5.0" };
  }
  if (ua.includes("Android")) {
    return { platform: "Linux armv8l", vendor: "Google Inc.", appVersion: ua.split("Mozilla/")[1] || "5.0" };
  }
  if (ua.includes("Macintosh")) {
    return { platform: "MacIntel", vendor: "Apple Computer, Inc.", appVersion: ua.split("Mozilla/")[1] || "5.0" };
  }
  if (ua.includes("Windows")) {
    return { platform: "Win32", vendor: "Google Inc.", appVersion: ua.split("Mozilla/")[1] || "5.0" };
  }
  return { platform: "Linux x86_64", vendor: "Google Inc.", appVersion: ua.split("Mozilla/")[1] || "5.0" };
};

const COMMON_FONTS = [
  "Arial", "Helvetica", "Times New Roman", "Courier New", "Verdana", "Georgia",
  "Palatino", "Garamond", "Bookman", "Trebuchet MS", "Arial Black", "Impact",
  "Comic Sans MS", "Tahoma", "Lucida Console",
];

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: T[]): T => arr[rand(arr.length)];

export function generateIdentity(): Identity {
  const ua = pick(UA_POOL);
  const { platform, vendor, appVersion } = PLATFORMS_FROM_UA(ua);
  const tz = pick(TIMEZONES);
  const lang = pick(LANGUAGES);
  const scr = pick(SCREEN_PROFILES);
  const gl = pick(WEBGL_PROFILES);
  const fontCount = 4 + rand(8);
  const fonts = [...COMMON_FONTS].sort(() => Math.random() - 0.5).slice(0, fontCount);

  return {
    id: Math.random().toString(36).slice(2, 10).toUpperCase(),
    userAgent: ua,
    platform,
    vendor,
    appVersion,
    language: lang.primary,
    languages: lang.list,
    acceptLanguage: lang.accept,
    timezone: tz.name,
    timezoneOffset: tz.offset,
    screen: {
      width: scr.width,
      height: scr.height,
      availWidth: scr.width,
      availHeight: scr.height - 40,
      colorDepth: 24,
      pixelDepth: 24,
    },
    devicePixelRatio: scr.dpr,
    hardwareConcurrency: pick([2, 4, 6, 8, 12, 16]),
    deviceMemory: pick([2, 4, 8, 16]),
    webglVendor: gl.vendor,
    webglRenderer: gl.renderer,
    canvasNoiseSeed: Math.random(),
    audioNoiseSeed: Math.random(),
    fontsAllowed: fonts,
  };
}

export function shortFingerprint(id: Identity): string {
  // For UI display
  const uaShort = id.userAgent.includes("iPhone")
    ? "iOS Safari"
    : id.userAgent.includes("Android")
    ? "Android Chrome"
    : id.userAgent.includes("Macintosh")
    ? "macOS Safari"
    : id.userAgent.includes("Windows")
    ? "Windows Chrome"
    : "Linux";
  return `${id.id} · ${uaShort} · ${id.timezone}`;
}
