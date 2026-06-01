/* ============================================================
   particles.js — Object-pooled particle system.
   Uses a fixed-size pool to avoid GC pressure. Particles are
   "recycled" rather than created/destroyed each frame.
   ============================================================ */

class Particle {
  constructor() { this.active = false; }

  init(x, y, vx, vy, life, size, r, g, b, a, gravity = 0.08, decay = 1) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size = size; this.startSize = size;
    this.r = r; this.g = g; this.b = b; this.a = a;
    this.gravity = gravity;
    this.decay = decay;   // size shrink per frame
    this.active = true;
  }

  update() {
    this.vx *= 0.97;
    this.vy  = this.vy * 0.97 + this.gravity;
    this.x  += this.vx;
    this.y  += this.vy;
    this.life--;
    this.a   = (this.life / this.maxLife) * 0.9;
    this.size = this.startSize * (this.life / this.maxLife) * this.decay + this.startSize * (1 - this.decay);
    if (this.life <= 0) this.active = false;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.a);
    ctx.fillStyle   = `rgb(${this.r},${this.g},${this.b})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.1, this.size), 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ── Float text labels (score popups) ── */
class FloatText {
  constructor() { this.active = false; }

  init(x, y, text, color = '#fff', size = 7) {
    this.x = x; this.y = y;
    this.text  = text;
    this.color = color;
    this.size  = size;
    this.vy    = -0.9;
    this.life  = 55;
    this.maxLife = 55;
    this.active = true;
  }

  update() {
    this.y  += this.vy;
    this.vy *= 0.95;
    this.life--;
    if (this.life <= 0) this.active = false;
  }

  draw(ctx) {
    const alpha = Math.min(1, this.life / 20);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = this.color;
    ctx.font        = `bold ${this.size}px "Courier New"`;
    ctx.textAlign   = 'center';
    ctx.fillText(this.text, this.x, this.y);
  }
}

/* ── Particle System ── */
class ParticleSystem {
  constructor() {
    this._pool      = Array.from({ length: C.PARTICLE_POOL }, () => new Particle());
    this._floats    = Array.from({ length: 40 },             () => new FloatText());
  }

  /* Get a free particle from the pool */
  _get() {
    for (const p of this._pool) if (!p.active) return p;
    // Pool exhausted — overwrite oldest (first)
    this._pool[0].active = false;
    return this._pool[0];
  }

  _getFloat() {
    for (const f of this._floats) if (!f.active) return f;
    this._floats[0].active = false;
    return this._floats[0];
  }

  /* ── Emit helpers ── */

  emit(x, y, vx, vy, life, size, r, g, b, a = 1, gravity = 0.08, decay = 1) {
    this._get().init(x, y, vx, vy, life, size, r, g, b, a, gravity, decay);
  }

  burst(x, y, count, r, g, b, speed = 2, life = 30, size = 2, gravity = 0.1) {
    for (let i = 0; i < count; i++) {
      const angle = MathUtils.rand(0, Math.PI * 2);
      const spd   = MathUtils.rand(speed * 0.3, speed);
      this.emit(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd,
                MathUtils.randInt(life * 0.6, life), MathUtils.rand(size * 0.5, size),
                r, g, b, 1, gravity);
    }
  }

  /* Dust cloud on landing */
  dust(x, y, velX = 0) {
    for (let i = 0; i < 6; i++) {
      const vx = MathUtils.rand(-1.5, 1.5) + velX * 0.15;
      const vy = MathUtils.rand(-1.5, -0.2);
      this.emit(x, y, vx, vy, MathUtils.randInt(18, 30), MathUtils.rand(1, 2.5),
                210, 200, 180, 0.7, 0.04);
    }
  }

  /* Sparkles on gem collect */
  collectGem(x, y) {
    this.burst(x, y, 10, 255, 215, 0, 3, 35, 2.5, 0);
    this.burst(x, y, 5,  255, 255, 200, 1.5, 20, 1.5, 0);
  }

  /* Sparks on hitting spikes / hazard */
  sparks(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = MathUtils.rand(0, Math.PI * 2);
      const spd   = MathUtils.rand(1.5, 4);
      this.emit(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd,
                MathUtils.randInt(20, 45), MathUtils.rand(1, 2.5),
                255, MathUtils.randInt(80, 200), 0, 1, 0.15);
    }
  }

  /* Trail behind player */
  trail(x, y, vx, vy, color = { r: 232, g: 60, b: 40 }) {
    this.emit(x, y,
              MathUtils.rand(-0.3, 0.3) - vx * 0.2,
              MathUtils.rand(-0.3, 0.3) - vy * 0.15,
              MathUtils.randInt(8, 18),
              MathUtils.rand(1, 2.5),
              color.r, color.g, color.b, 0.55, 0.02, 0.9);
  }

  /* Lava splash */
  lavaSplash(x, y) {
    for (let i = 0; i < 8; i++) {
      const vx = MathUtils.rand(-2, 2);
      const vy = MathUtils.rand(-3, -0.5);
      this.emit(x, y, vx, vy, MathUtils.randInt(25, 50), MathUtils.rand(1.5, 3.5),
                255, MathUtils.randInt(60, 140), 0, 1, 0.18);
    }
  }

  /* Star burst on level exit */
  victory(x, y) {
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const spd   = MathUtils.rand(2, 5);
      this.emit(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd,
                MathUtils.randInt(50, 90), MathUtils.rand(2, 4),
                MathUtils.randInt(200, 255), MathUtils.randInt(200, 255), 50, 1, 0.05);
    }
  }

  /* Float score text */
  floatText(x, y, text, color = '#fff') {
    this._getFloat().init(x, y, text, color);
  }

  /* ── Update & Draw ── */
  update() {
    for (const p of this._pool)   if (p.active) p.update();
    for (const f of this._floats) if (f.active) f.update();
  }

  draw(ctx) {
    ctx.save();
    for (const p of this._pool)   if (p.active) p.draw(ctx);
    ctx.globalAlpha = 1;
    for (const f of this._floats) if (f.active) f.draw(ctx);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.restore();
  }
}