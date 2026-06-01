/* ============================================================
   helpers.js — General utility functions (DOM, storage, etc.)
   ============================================================ */

const Helpers = {

  /** localStorage save with JSON serialisation */
  save(key, data) {
    try { localStorage.setItem('bounce_' + key, JSON.stringify(data)); }
    catch(e) { /* storage unavailable in some sandboxes */ }
  },

  /** localStorage load with JSON deserialisation */
  load(key, fallback = null) {
    try {
      const raw = localStorage.getItem('bounce_' + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch(e) { return fallback; }
  },

  /** Clear a specific save key */
  clear(key) {
    try { localStorage.removeItem('bounce_' + key); } catch(e) {}
  },

  /** Pad number with leading zeroes */
  pad(n, digits = 2) { return String(n).padStart(digits, '0'); },

  /** Format a score as comma-separated thousands */
  formatScore(n) { return n.toLocaleString(); },

  /** Format elapsed seconds as mm:ss */
  formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${Helpers.pad(m)}:${Helpers.pad(s)}`;
  },

  /** Deep clone (simple objects/arrays) */
  clone(obj) { return JSON.parse(JSON.stringify(obj)); },

  /** Schedule a one-shot callback after `frames` game frames */
  after(frames, cb) {
    return { remaining: frames, cb, tick() { if (--this.remaining <= 0) { this.cb(); return true; } return false; } };
  },

  /** Detect touch device */
  isTouchDevice() {
    return (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0));
  },

  /** Create a promise that resolves after ms milliseconds */
  wait(ms) { return new Promise(r => setTimeout(r, ms)); },

  /** Hex colour to RGB components object */
  hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  },

  /** Build rgba() string */
  rgba(r, g, b, a) { return `rgba(${r},${g},${b},${a})`; },
};