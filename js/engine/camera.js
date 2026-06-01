/* ============================================================
   camera.js — Smooth follow camera with lookahead,
   screen-shake, zoom, and world-bounds clamping.
   ============================================================ */

class Camera {
  constructor(canvasW, canvasH) {
    this.cw = canvasW;
    this.ch = canvasH;

    /** Actual rendered offset (top-left corner of view in world space) */
    this.x = 0;
    this.y = 0;

    /** Smooth interpolation target */
    this._tx = 0;
    this._ty = 0;

    /** World bounds (set per level) */
    this.worldW = 0;
    this.worldH = 0;

    /** Shake state */
    this._shakeAmt   = 0;
    this._shakeDecay = C.SHAKE_DECAY;

    /** Zoom (1 = native) */
    this.zoom   = 1;
    this._tzoom = 1;

    /** Flash (white overlay alpha) */
    this.flashAlpha = 0;
  }

  /* ── Configure ── */
  setBounds(w, h) { this.worldW = w; this.worldH = h; }

  setZoom(z, instant = false) {
    this._tzoom = z;
    if (instant) this.zoom = z;
  }

  /* ── Shake ── */
  shake(amount = 4) {
    this._shakeAmt = Math.max(this._shakeAmt, amount);
  }

  /* ── Flash ── */
  flash(alpha = 0.8) { this.flashAlpha = alpha; }

  /* ── Update: call once per frame before drawing ── */
  update(target) {
    if (!target) return;

    // Lookahead: peek in the direction the player is moving
    const lookX = target.vx * C.CAM_LOOKAHEAD * 0.18;
    const lookY = target.vy *  8;

    // Target = centre player on screen
    this._tx = target.x - this.cw / (2 * this.zoom) + lookX;
    this._ty = target.y - this.ch / (2 * this.zoom) + lookY;

    // Smooth follow
    const smooth = C.CAM_SMOOTH;
    this.x = MathUtils.lerp(this.x, this._tx, smooth);
    this.y = MathUtils.lerp(this.y, this._ty, smooth);

    // Clamp to world bounds
    const viewW = this.cw / this.zoom;
    const viewH = this.ch / this.zoom;
    if (this.worldW > 0) this.x = MathUtils.clamp(this.x, 0, Math.max(0, this.worldW - viewW));
    if (this.worldH > 0) this.y = MathUtils.clamp(this.y, 0, Math.max(0, this.worldH - viewH));

    // Smooth zoom
    this.zoom = MathUtils.lerp(this.zoom, this._tzoom, 0.08);

    // Shake decay
    this._shakeAmt *= this._shakeDecay;
    if (this._shakeAmt < 0.1) this._shakeAmt = 0;

    // Flash decay
    this.flashAlpha = Math.max(0, this.flashAlpha - 0.04);
  }

  /* ── Apply transform to canvas context ── */
  begin(ctx) {
    ctx.save();

    // Shake offset
    const sx = this._shakeAmt > 0 ? MathUtils.rand(-this._shakeAmt, this._shakeAmt) : 0;
    const sy = this._shakeAmt > 0 ? MathUtils.rand(-this._shakeAmt, this._shakeAmt) : 0;

    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-Math.round(this.x) + sx, -Math.round(this.y) + sy);
  }

  end(ctx) {
    ctx.restore();
  }

  /* ── Draw post-process overlays (flash) — called in screen space ── */
  drawOverlays(ctx) {
    if (this.flashAlpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.flashAlpha;
    ctx.fillStyle   = '#fff';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();
  }

  /* ── Convert screen coords to world coords ── */
  screenToWorld(sx, sy) {
    return {
      x: sx / this.zoom + this.x,
      y: sy / this.zoom + this.y,
    };
  }

  /* ── Check if a world rect is visible ── */
  isVisible(wx, wy, ww, wh, margin = 16) {
    const vx = this.x - margin;
    const vy = this.y - margin;
    const vw = this.cw / this.zoom + margin * 2;
    const vh = this.ch / this.zoom + margin * 2;
    return !(wx + ww < vx || wx > vx + vw || wy + wh < vy || wy > vy + vh);
  }
}