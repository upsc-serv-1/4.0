// injection.ts — Builds the JS payload injected into every WebView page
// before content loads. Spoofs every fingerprint surface.

import { Identity } from "./fingerprint";

export function buildInjectionScript(id: Identity): string {
  // We stringify the identity once and inject it as a JS literal.
  const idJson = JSON.stringify(id);

  return `
(function() {
  if (window.__ghostInstalled) return;
  window.__ghostInstalled = true;
  var ID = ${idJson};

  // Helper: define non-writable, non-configurable property
  function spoof(obj, prop, value) {
    try {
      Object.defineProperty(obj, prop, {
        get: function() { return value; },
        configurable: true,
      });
    } catch(e) {}
  }
  function spoofFn(obj, prop, fn) {
    try {
      Object.defineProperty(obj, prop, { value: fn, configurable: true, writable: true });
    } catch(e) {}
  }

  // ---------- Navigator ----------
  try { spoof(navigator, 'userAgent', ID.userAgent); } catch(e){}
  try { spoof(navigator, 'platform', ID.platform); } catch(e){}
  try { spoof(navigator, 'vendor', ID.vendor); } catch(e){}
  try { spoof(navigator, 'appVersion', ID.appVersion); } catch(e){}
  try { spoof(navigator, 'language', ID.language); } catch(e){}
  try { spoof(navigator, 'languages', ID.languages); } catch(e){}
  try { spoof(navigator, 'hardwareConcurrency', ID.hardwareConcurrency); } catch(e){}
  try { spoof(navigator, 'deviceMemory', ID.deviceMemory); } catch(e){}
  try { spoof(navigator, 'webdriver', false); } catch(e){}
  try { spoof(navigator, 'plugins', []); } catch(e){}
  try { spoof(navigator, 'mimeTypes', []); } catch(e){}
  try { spoof(navigator, 'doNotTrack', '1'); } catch(e){}
  try { spoof(navigator, 'globalPrivacyControl', true); } catch(e){}

  // Remove sensor / hardware APIs
  try { delete navigator.getBattery; } catch(e){}
  try { delete navigator.bluetooth; } catch(e){}
  try { delete navigator.usb; } catch(e){}
  try { delete navigator.serial; } catch(e){}
  try { delete navigator.hid; } catch(e){}
  try { delete navigator.serviceWorker; } catch(e){}
  try { delete navigator.connection; } catch(e){}

  // Permissions: always denied
  try {
    if (navigator.permissions && navigator.permissions.query) {
      var origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = function(p) {
        return Promise.resolve({ state: 'denied', name: (p && p.name) || 'unknown', onchange: null });
      };
    }
  } catch(e){}

  // ---------- Screen ----------
  try {
    spoof(screen, 'width', ID.screen.width);
    spoof(screen, 'height', ID.screen.height);
    spoof(screen, 'availWidth', ID.screen.availWidth);
    spoof(screen, 'availHeight', ID.screen.availHeight);
    spoof(screen, 'colorDepth', ID.screen.colorDepth);
    spoof(screen, 'pixelDepth', ID.screen.pixelDepth);
  } catch(e){}
  try { spoof(window, 'devicePixelRatio', ID.devicePixelRatio); } catch(e){}
  try { spoof(window, 'outerWidth', ID.screen.width); } catch(e){}
  try { spoof(window, 'outerHeight', ID.screen.height); } catch(e){}

  // ---------- Timezone / Date ----------
  try {
    var OrigDate = Date;
    var offsetMin = ID.timezoneOffset;
    function GhostDate() {
      if (!(this instanceof GhostDate)) return new OrigDate().toString();
      var args = Array.prototype.slice.call(arguments);
      var d = args.length === 0 ? new OrigDate() :
              args.length === 1 ? new OrigDate(args[0]) :
              new (Function.prototype.bind.apply(OrigDate, [null].concat(args)))();
      d.getTimezoneOffset = function() { return offsetMin; };
      return d;
    }
    GhostDate.prototype = OrigDate.prototype;
    GhostDate.now = OrigDate.now;
    GhostDate.parse = OrigDate.parse;
    GhostDate.UTC = OrigDate.UTC;
    // window.Date = GhostDate;  // too aggressive, breaks many sites; keep timezone offset via prototype patch
    var origGetTzOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = function() { return offsetMin; };
  } catch(e){}

  try {
    var OrigDTF = Intl.DateTimeFormat;
    var GhostDTF = function() {
      var inst = new (Function.prototype.bind.apply(OrigDTF, [null].concat(Array.prototype.slice.call(arguments))))();
      var origResolved = inst.resolvedOptions.bind(inst);
      inst.resolvedOptions = function() {
        var r = origResolved();
        r.timeZone = ID.timezone;
        r.locale = ID.language;
        return r;
      };
      return inst;
    };
    GhostDTF.prototype = OrigDTF.prototype;
    GhostDTF.supportedLocalesOf = OrigDTF.supportedLocalesOf;
    Intl.DateTimeFormat = GhostDTF;
  } catch(e){}

  // ---------- Canvas fingerprint noise ----------
  try {
    function noiseImageData(imageData, seed) {
      var d = imageData.data;
      var s = Math.floor(seed * 1e6) % 256;
      for (var i = 0; i < d.length; i += 4) {
        // Tiny noise on R/G/B (±1) — invisible to eye, breaks fingerprint hash
        d[i] = d[i] ^ ((i + s) & 1);
        d[i+1] = d[i+1] ^ ((i + s + 1) & 1);
        d[i+2] = d[i+2] ^ ((i + s + 2) & 1);
      }
      return imageData;
    }
    var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      try {
        var ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          var img = ctx.getImageData(0, 0, this.width, this.height);
          noiseImageData(img, ID.canvasNoiseSeed);
          ctx.putImageData(img, 0, 0);
        }
      } catch(e){}
      return origToDataURL.apply(this, arguments);
    };
    var origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function() {
      var r = origGetImageData.apply(this, arguments);
      return noiseImageData(r, ID.canvasNoiseSeed);
    };
    var origToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(cb) {
      var self = this;
      try {
        var ctx = self.getContext('2d');
        if (ctx && self.width > 0 && self.height > 0) {
          var img = ctx.getImageData(0, 0, self.width, self.height);
          noiseImageData(img, ID.canvasNoiseSeed);
          ctx.putImageData(img, 0, 0);
        }
      } catch(e){}
      return origToBlob.apply(self, arguments);
    };
  } catch(e){}

  // ---------- WebGL fingerprint ----------
  try {
    function patchGL(proto) {
      if (!proto) return;
      var origGetParameter = proto.getParameter;
      proto.getParameter = function(param) {
        // UNMASKED_VENDOR_WEBGL = 0x9245, UNMASKED_RENDERER_WEBGL = 0x9246
        if (param === 0x9245 || param === 37445) return ID.webglVendor;
        if (param === 0x9246 || param === 37446) return ID.webglRenderer;
        if (param === 0x1F00 /* VENDOR */) return ID.webglVendor;
        if (param === 0x1F01 /* RENDERER */) return ID.webglRenderer;
        return origGetParameter.call(this, param);
      };
      var origReadPixels = proto.readPixels;
      proto.readPixels = function() {
        var r = origReadPixels.apply(this, arguments);
        try {
          var pixels = arguments[6];
          if (pixels && pixels.length > 4) {
            var s = Math.floor(ID.canvasNoiseSeed * 1e6) % 256;
            pixels[0] = pixels[0] ^ (s & 1);
            pixels[1] = pixels[1] ^ ((s + 1) & 1);
          }
        } catch(e){}
        return r;
      };
    }
    if (window.WebGLRenderingContext) patchGL(WebGLRenderingContext.prototype);
    if (window.WebGL2RenderingContext) patchGL(WebGL2RenderingContext.prototype);
  } catch(e){}

  // ---------- AudioContext fingerprint ----------
  try {
    function patchAudio(AudioCtor) {
      if (!AudioCtor || !AudioCtor.prototype) return;
      var Ana = window.AnalyserNode && AnalyserNode.prototype;
      if (Ana) {
        var origGetFloat = Ana.getFloatFrequencyData;
        Ana.getFloatFrequencyData = function(arr) {
          origGetFloat.call(this, arr);
          for (var i = 0; i < arr.length; i++) {
            arr[i] = arr[i] + (ID.audioNoiseSeed * 0.0000001 * (i % 7));
          }
        };
      }
      var Buf = window.AudioBuffer && AudioBuffer.prototype;
      if (Buf && Buf.getChannelData) {
        var origGetChan = Buf.getChannelData;
        Buf.getChannelData = function(ch) {
          var data = origGetChan.call(this, ch);
          for (var i = 0; i < data.length; i += 1000) {
            data[i] = data[i] + (ID.audioNoiseSeed * 1e-7);
          }
          return data;
        };
      }
    }
    patchAudio(window.AudioContext);
    patchAudio(window.webkitAudioContext);
    patchAudio(window.OfflineAudioContext);
  } catch(e){}

  // ---------- Fonts ----------
  try {
    if (document.fonts && document.fonts.check) {
      var origCheck = document.fonts.check.bind(document.fonts);
      document.fonts.check = function(spec, txt) {
        // Only allow fonts in our identity's allowed list
        var allowed = ID.fontsAllowed.some(function(f) { return spec && spec.indexOf(f) !== -1; });
        if (!allowed) return false;
        return origCheck(spec, txt);
      };
    }
  } catch(e){}

  // ---------- WebRTC: block leaks ----------
  try {
    var blockedRTC = function() {
      throw new Error('WebRTC blocked by GhostBrowse');
    };
    if (window.RTCPeerConnection) window.RTCPeerConnection = blockedRTC;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = blockedRTC;
    if (window.mozRTCPeerConnection) window.mozRTCPeerConnection = blockedRTC;
    if (window.RTCDataChannel) window.RTCDataChannel = blockedRTC;
    if (navigator.mediaDevices) {
      navigator.mediaDevices.enumerateDevices = function() { return Promise.resolve([]); };
      navigator.mediaDevices.getUserMedia = function() { return Promise.reject(new Error('blocked')); };
    }
  } catch(e){}

  // ---------- Storage: ephemeral in-memory ----------
  try {
    var memLocal = {};
    var memSession = {};
    function makeStorage(store) {
      return {
        getItem: function(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function(k, v) { store[k] = String(v); },
        removeItem: function(k) { delete store[k]; },
        clear: function() { for (var k in store) delete store[k]; },
        key: function(i) { return Object.keys(store)[i] || null; },
        get length() { return Object.keys(store).length; },
      };
    }
    Object.defineProperty(window, 'localStorage', { value: makeStorage(memLocal), configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: makeStorage(memSession), configurable: true });
  } catch(e){}

  // IndexedDB: stub
  try {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  } catch(e){}

  // ---------- Battery / Bluetooth / Sensors ----------
  try { delete window.BluetoothDevice; } catch(e){}
  try { delete window.DeviceMotionEvent; } catch(e){}
  try { delete window.DeviceOrientationEvent; } catch(e){}

  // Mark identity active
  console.log('[GhostBrowse] Identity ' + ID.id + ' active');
  true;
})();
true;
`;
}
