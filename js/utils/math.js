/* ============================================================
   math.js — Reusable math helpers used across the engine.
   ============================================================ */

const MathUtils = {

  /** Linear interpolation */
  lerp(a, b, t) { return a + (b - a) * t; },

  /** Clamp a value between min and max */
  clamp(v, min, max) { return v < min ? min : v > max ? max : v; },

  /** Map value from one range to another */
  map(v, a1, b1, a2, b2) { return a2 + (b2 - a2) * ((v - a1) / (b1 - a1)); },

  /** Distance between two points */
  dist(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /** Distance squared (cheaper than dist) */
  dist2(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  },

  /** Angle from point a to point b */
  angle(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },

  /** Normalise a 2-D vector, returns {x,y} */
  normalise(x, y) {
    const len = Math.sqrt(x * x + y * y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  },

  /** Dot product of two 2-D vectors */
  dot(ax, ay, bx, by) { return ax * bx + ay * by; },

  /** Convert degrees to radians */
  toRad(deg) { return deg * Math.PI / 180; },

  /** Random float in [min, max) */
  rand(min, max) { return min + Math.random() * (max - min); },

  /** Random integer in [min, max] */
  randInt(min, max) { return Math.floor(MathUtils.rand(min, max + 1)); },

  /** Random element from array */
  pick(arr) { return arr[MathUtils.randInt(0, arr.length - 1)]; },

  /** Oscillate using a sine wave */
  wave(t, speed, amp) { return Math.sin(t * speed) * amp; },

  /** Smooth step (ease in-out) */
  smoothStep(t) { return t * t * (3 - 2 * t); },

  /** Ease out cubic */
  easeOut(t) { return 1 - Math.pow(1 - t, 3); },

  /** Ease in cubic */
  easeIn(t)  { return t * t * t; },
};