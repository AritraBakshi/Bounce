/* ============================================================
   renderer.js — Canvas 2D drawing utilities.
   Handles: background themes, parallax layers, tile drawing,
   glow helpers, and the debug overlay.
   ============================================================ */

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.w      = canvas.width;
    this.h      = canvas.height;

    /** Parallax scroll factors per layer [0=slowest] */
    this._parallax = [0.1, 0.25, 0.45];

    /** Pre-computed gradient cache keyed by theme+size */
    this._gradCache = {};

    /** Theme palette index (0-4) */
    this.theme = 0;

    this._themes = [
      // 0 Grassland — bright daylight, rolling hills
      { sky: ['#5bbfff','#a8dcf0'], mid: ['#3d9e28','#2a7a18'], bg: ['#5cc940','#3d9e28'], far: ['#8de06a','#5cc940'], ground: '#2a7a18' },
      // 1 Cave — deep purple, bioluminescent
      { sky: ['#0a0a1a','#12102a'], mid: ['#1a1035','#0e0a22'], bg: ['#251848','#180f32'], far: ['#30206a','#1a1040'], ground: '#0e0a22' },
      // 2 Industrial — toxic smog, rust & steel
      { sky: ['#1c1c2a','#141420'], mid: ['#2e2e3c','#1c1c28'], bg: ['#383848','#242430'], far: ['#444458','#2c2c3c'], ground: '#1c1c28' },
      // 3 Lava — hellscape, deep reds & embers
      { sky: ['#100000','#200000'], mid: ['#3a0800','#200400'], bg: ['#5a1200','#380800'], far: ['#7a1e00','#481000'], ground: '#200400' },
      // 4 Sky — high altitude, clouds & aurora
      { sky: ['#1a3a6a','#2a5a9a'], mid: ['#3a7acc','#2260aa'], bg: ['#5090dd','#3a7acc'], far: ['#80b8ff','#60a0ee'], ground: '#2260aa' },
    ];
    this._cloudCache = this._buildClouds();

    this._starCache = this._buildStars();
  }

  /* ── Resize ── */
  resize(w, h) {
    this.w = w; this.h = h;
    this.canvas.width  = w;
    this.canvas.height = h;
  }

  /* ── Clear ── */
  clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  /* ── Background (drawn in screen space, before camera) ── */
  drawBackground(camX, camY, theme = 0) {
    this.theme = theme;
    const t   = this._themes[theme] || this._themes[0];
    const ctx = this.ctx;
    const f   = this._bgFrame = (this._bgFrame || 0) + 1;

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, t.sky[0]);
    grad.addColorStop(1, t.sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    // Theme-specific sky decorations
    if (theme === 0) this._drawClouds(ctx, camX, f);
    if (theme === 1) { this._drawStars(ctx, camX, camY, theme); this._drawStalactites(ctx, camX); }
    if (theme === 2) { this._drawSmogLayers(ctx, camX, f); this._drawFactoryBg(ctx, camX); }
    if (theme === 3) { this._drawStars(ctx, camX, camY, theme); this._drawEmbers(ctx, camX, f); }
    if (theme === 4) { this._drawAurora(ctx, camX, f); this._drawClouds(ctx, camX, f, true); }

    // 3-layer parallax hills
    this._drawParallaxLayer(ctx, camX, camY, 0, t.far[0],  t.far[1],  0.08, 0.82, 22);
    this._drawParallaxLayer(ctx, camX, camY, 1, t.bg[0],   t.bg[1],   0.18, 0.74, 16);
    this._drawParallaxLayer(ctx, camX, camY, 2, t.mid[0],  t.mid[1],  0.32, 0.68, 10);
  }

  _buildStars() {
    const stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({ x: Math.random() * 2000, y: Math.random() * 200,
                   r: Math.random() * 1.2 + 0.2, a: Math.random() * 0.6 + 0.3 });
    }
    return stars;
  }

  _drawStars(ctx, camX, camY, theme) {
    ctx.save();
    for (const s of this._starCache) {
      const sx = ((s.x - camX * 0.05) % this.w + this.w) % this.w;
      const sy = s.y % (this.h * 0.6);
      ctx.globalAlpha = s.a;
      ctx.fillStyle   = theme === 4 ? '#fff' : '#fffde7';
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawParallaxLayer(ctx, camX, camY, layerIdx, color1, color2, factor, baseYFrac, amp) {
    factor    = factor    ?? [0.1, 0.25, 0.45][layerIdx] ?? 0.1;
    baseYFrac = baseYFrac ?? (0.72 - layerIdx * 0.12);
    amp       = amp       ?? (18 - layerIdx * 4);
    const offX  = -(camX * factor) % (this.w * 2);
    const baseY = this.h * baseYFrac;
    const freq  = 0.010 - layerIdx * 0.002;

    ctx.save();
    const grad = ctx.createLinearGradient(0, baseY, 0, this.h);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, this.h);
    for (let x = 0; x <= this.w + 20; x += 3) {
      const wx = x + offX;
      const y  = baseY
        + Math.sin(wx * freq)         * amp
        + Math.sin(wx * freq * 2.1 + 1.2) * amp * 0.35
        + Math.sin(wx * freq * 0.4 + 2.5) * amp * 0.55;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(this.w, this.h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _buildClouds() {
    return Array.from({ length: 12 }, (_, i) => ({
      x: Math.random() * 3000, y: 20 + Math.random() * 80,
      w: 40 + Math.random() * 60, h: 12 + Math.random() * 18,
      speed: 0.04 + Math.random() * 0.06,
    }));
  }

  _drawClouds(ctx, camX, f, hiAlt = false) {
    ctx.save();
    for (const c of this._cloudCache) {
      const cx = ((c.x - camX * c.speed * 0.3 + f * c.speed) % (this.w * 3) + this.w * 3) % (this.w * 3) - this.w * 0.5;
      const cy = hiAlt ? c.y * 0.6 + 10 : c.y;
      ctx.globalAlpha = hiAlt ? 0.55 : 0.72;
      ctx.fillStyle   = hiAlt ? 'rgba(180,210,255,0.6)' : 'rgba(255,255,255,0.8)';
      // Puffy cloud shape
      ctx.beginPath();
      ctx.arc(cx,          cy,          c.h * 0.7, 0, Math.PI * 2);
      ctx.arc(cx + c.w*0.25, cy - c.h*0.2, c.h * 0.55, 0, Math.PI * 2);
      ctx.arc(cx + c.w*0.5, cy + c.h*0.05, c.h * 0.65, 0, Math.PI * 2);
      ctx.arc(cx + c.w*0.75,cy - c.h*0.1, c.h * 0.5, 0, Math.PI * 2);
      ctx.arc(cx + c.w,    cy,            c.h * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawStalactites(ctx, camX) {
    ctx.save();
    ctx.fillStyle = '#1a1035';
    const count = 24;
    for (let i = 0; i < count; i++) {
      const bx = ((i * 53 - camX * 0.12) % (this.w + 40) + this.w + 40) % (this.w + 40) - 20;
      const bh = 18 + (i * 17) % 35;
      ctx.beginPath();
      ctx.moveTo(bx - 8, 0);
      ctx.lineTo(bx + 8, 0);
      ctx.lineTo(bx,     bh);
      ctx.closePath();
      ctx.fill();
      // drip glow
      ctx.fillStyle = 'rgba(120,80,255,0.3)';
      ctx.beginPath(); ctx.arc(bx, bh, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1035';
    }
    ctx.restore();
  }

  _drawSmogLayers(ctx, camX, f) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const offX = ((camX * (0.05 + i * 0.04) + f * (0.2 + i * 0.1)) % (this.w * 2));
      ctx.globalAlpha = 0.12 + i * 0.06;
      ctx.fillStyle   = ['#33ff00','#ffaa00','#00ccff'][i];
      for (let x = -this.w; x < this.w * 2; x += 80) {
        const bx = (x - offX % (this.w * 2) + this.w * 2) % (this.w * 2) - this.w;
        const by = 30 + i * 22 + Math.sin((bx + f) * 0.01) * 12;
        ctx.beginPath();
        ctx.ellipse(bx, by, 55, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawFactoryBg(ctx, camX) {
    ctx.save();
    ctx.fillStyle = '#1e1e2c';
    const chimneys = [80, 180, 310, 420, 560, 700, 840];
    for (const bx of chimneys) {
      const ox = ((bx - camX * 0.15) % (this.w + 100) + this.w + 100) % (this.w + 100) - 50;
      const h  = 40 + (bx % 30);
      ctx.fillRect(ox - 6, this.h * 0.45 - h, 12, h);
      ctx.fillRect(ox - 9, this.h * 0.45 - h - 6, 18, 8);
    }
    ctx.restore();
  }

  _drawEmbers(ctx, camX, f) {
    ctx.save();
    for (let i = 0; i < 20; i++) {
      const t   = (f * 0.01 + i * 0.31) % 1;
      const ex  = ((i * 113 + camX * 0.03) % this.w + this.w) % this.w;
      const ey  = this.h * 0.7 * (1 - t) + Math.sin(i * 2.4 + f * 0.05) * 10;
      const er  = 1.5 * (1 - t * 0.7);
      const ea  = (1 - t) * 0.7;
      ctx.globalAlpha = ea;
      ctx.fillStyle   = t < 0.5 ? '#ff8800' : '#ff4400';
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawAurora(ctx, camX, f) {
    ctx.save();
    const bands = ['rgba(0,255,180,0.06)','rgba(100,80,255,0.07)','rgba(0,200,255,0.05)'];
    bands.forEach((col, i) => {
      const offX = camX * 0.02 + f * (0.3 + i * 0.15);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= this.w; x += 8) {
        const y = 20 + i * 18 + Math.sin((x + offX) * 0.025 + i) * 25;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(this.w, 0);
      ctx.closePath();
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ── Glow helper ── */
  glow(ctx, x, y, r, color, alpha = 0.5) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace(')', `,${alpha})`).replace('rgb', 'rgba'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* ── Glossy ball ── */
  drawBall(ctx, x, y, r, rotation, squashX, squashY, hurtFlash, invuln, frame) {
    ctx.save();
    ctx.translate(x, y);

    // Drop shadow (not rotated)
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(r * 0.15, r * squashY * 0.9 + 2, r * squashX * 0.8, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(rotation);
    ctx.scale(squashX, squashY);

    // Invuln flicker
    if (invuln && Math.floor(frame / 4) % 2 === 0) ctx.globalAlpha = 0.35;

    // Outer ambient glow
    const glow = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.8);
    glow.addColorStop(0,   hurtFlash ? 'rgba(255,200,200,0.35)' : 'rgba(255,80,40,0.28)');
    glow.addColorStop(1,   'rgba(200,20,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2); ctx.fill();

    // Main body — 4-stop gradient for depth
    const body = ctx.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.04, 0, 0, r);
    body.addColorStop(0.00, hurtFlash ? '#ffffff' : '#ffaa99');
    body.addColorStop(0.22, hurtFlash ? '#ff9999' : '#f03020');
    body.addColorStop(0.60, '#b01208');
    body.addColorStop(0.88, '#780a05');
    body.addColorStop(1.00, '#3a0302');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

    // Rubber seam lines (rotate with ball, 2 great circles)
    if (!hurtFlash) {
      ctx.save();
      ctx.clip(); // clip to ball circle
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.clip();
      ctx.strokeStyle = 'rgba(80,0,0,0.35)';
      ctx.lineWidth   = 1.2;
      // Horizontal seam
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.98, r * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Vertical seam
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.22, r * 0.98, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Rim edge darkening
    const rim = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r);
    rim.addColorStop(0, 'rgba(0,0,0,0)');
    rim.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = rim;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

    // Primary specular
    const spec = ctx.createRadialGradient(-r*0.26, -r*0.30, 0, -r*0.26, -r*0.30, r*0.52);
    spec.addColorStop(0,   'rgba(255,255,255,0.92)');
    spec.addColorStop(0.38,'rgba(255,255,255,0.28)');
    spec.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

    // Secondary highlight (lower)
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.beginPath(); ctx.arc(r*0.22, r*0.28, r*0.16, 0, Math.PI*2); ctx.fill();

    // Invincible star burst ring
    if (invuln === false /* powered */) { /* no-op */ }

    ctx.restore();
  }

  /* ── Platform tile drawing ── */
  drawPlatform(ctx, x, y, w, h, style = 'solid', theme = 0) {
    const palettes = [
      // 0 Grassland
      { top: '#88dd55', body: '#4daa30', edge: '#2a7a15', shadow: 'rgba(0,60,0,0.35)', grass: true  },
      // 1 Cave — glowing crystal
      { top: '#5544aa', body: '#2e2460', edge: '#1a1040', shadow: 'rgba(50,0,100,0.5)', crystal: true },
      // 2 Industrial — riveted steel
      { top: '#5a6a7a', body: '#3c4a58', edge: '#222e38', shadow: 'rgba(0,0,0,0.5)',   rivet: true  },
      // 3 Lava — volcanic rock
      { top: '#772200', body: '#4a1400', edge: '#280800', shadow: 'rgba(100,0,0,0.5)', lava: true   },
      // 4 Sky — fluffy cloud platform
      { top: '#e8f6ff', body: '#c8e8ff', edge: '#a0ccee', shadow: 'rgba(0,80,160,0.2)',cloud: true  },
    ];
    const p = palettes[theme] || palettes[0];
    ctx.save();

    // Moving: cyan glow; crumble: orange glow
    if (style === 'moving')  { ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 5; }
    if (style === 'crumble') { ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 4; }

    // Drop shadow
    ctx.fillStyle = p.shadow;
    ctx.fillRect(x + 3, y + 3, w, h);

    if (p.cloud) {
      // Cloud platform — soft rounded look
      ctx.fillStyle = p.body;
      const r = Math.min(h, 8);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      ctx.fillStyle = p.top;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h * 0.45, r);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, w - 2, h - 2, r);
      ctx.stroke();
    } else {
      // Standard block
      ctx.fillStyle = p.body;
      ctx.fillRect(x, y, w, h);

      // Top surface
      ctx.fillStyle = p.top;
      ctx.fillRect(x, y, w, Math.min(5, h));

      // Bevel highlights
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x, y, 2, h);
      ctx.fillStyle = p.edge;
      ctx.fillRect(x, y + h - 2, w, 2);
      ctx.fillRect(x + w - 2, y, 2, h);

      // Theme details
      if (p.grass) {
        // Grass tufts on top
        ctx.fillStyle = '#aae855';
        for (let gx = x + 3; gx < x + w - 3; gx += 8) {
          ctx.beginPath();
          ctx.moveTo(gx,     y);
          ctx.lineTo(gx + 2, y - 4);
          ctx.lineTo(gx + 4, y);
          ctx.closePath();
          ctx.fill();
        }
        // Dirt colour lower
        ctx.fillStyle = '#7a5230';
        ctx.fillRect(x, y + 5, w, h - 5);
        ctx.fillStyle = p.top;
        ctx.fillRect(x, y, w, 5);
      }

      if (p.crystal) {
        // Glowing crystal veins
        ctx.strokeStyle = 'rgba(140,100,255,0.35)';
        ctx.lineWidth   = 1;
        for (let cx2 = x + 6; cx2 < x + w; cx2 += 14) {
          ctx.beginPath();
          ctx.moveTo(cx2, y); ctx.lineTo(cx2 + 3, y + h); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(180,140,255,0.2)';
        ctx.fillRect(x, y, w, h);
      }

      if (p.rivet) {
        // Riveted steel plates
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth   = 1;
        for (let rx = x + C.TILE; rx < x + w; rx += C.TILE) {
          ctx.beginPath(); ctx.moveTo(rx, y); ctx.lineTo(rx, y + h); ctx.stroke();
        }
        // Rivet dots
        ctx.fillStyle = '#7a8a9a';
        for (let rx = x + 4; rx < x + w - 2; rx += 14) {
          ctx.beginPath(); ctx.arc(rx, y + 3,    1.5, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(rx, y + h - 3, 1.5, 0, Math.PI*2); ctx.fill();
        }
      }

      if (p.lava) {
        // Cracked volcanic surface
        ctx.strokeStyle = 'rgba(255,80,0,0.3)';
        ctx.lineWidth   = 1;
        for (let cx2 = x + 8; cx2 < x + w; cx2 += 18) {
          ctx.beginPath();
          ctx.moveTo(cx2, y);
          ctx.lineTo(cx2 + 4, y + h * 0.4);
          ctx.lineTo(cx2 - 2, y + h * 0.7);
          ctx.stroke();
        }
        // Lava glow on top
        const lavag = ctx.createLinearGradient(x, y, x, y + 4);
        lavag.addColorStop(0, 'rgba(255,100,0,0.6)');
        lavag.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = lavag;
        ctx.fillRect(x, y, w, 4);
      }
    }

    // Moving platform: animated rail dots
    if (style === 'moving') {
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = 'rgba(0,255,255,0.55)';
      for (let dx = 4; dx < w; dx += 10) {
        ctx.beginPath(); ctx.arc(x + dx, y + h + 3, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.restore();
  }

  /* ── Phase 6: Offscreen Canvas Cache Pre-rendering ── */
  cacheStaticPlatforms(platforms, worldW, worldH, theme) {
    if (!this._staticCanvas) {
      this._staticCanvas = document.createElement('canvas');
    }
    this._staticCanvas.width = worldW;
    this._staticCanvas.height = worldH;

    const sCtx = this._staticCanvas.getContext('2d');
    sCtx.clearRect(0, 0, worldW, worldH);

    // Filters for non-moving and non-crumbling platforms
    const staticPlatforms = platforms.filter(p => p.type === 'static' || p.type === 'oneWay');

    for (const p of staticPlatforms) {
      const style = p.type === 'oneWay' ? 'oneWay' : 'solid';
      this.drawPlatform(sCtx, p.x, p.y, p.w, p.h, style, p.theme);

      // Render static one-way graphic accents onto cache layer
      if (p.oneWay) {
        sCtx.save();
        sCtx.strokeStyle = 'rgba(255,255,255,0.55)';
        sCtx.lineWidth   = 1.5;
        sCtx.setLineDash([4, 4]);
        sCtx.beginPath();
        sCtx.moveTo(p.x + 2, p.y + 1);
        sCtx.lineTo(p.x + p.w - 2, p.y + 1);
        sCtx.stroke();
        sCtx.setLineDash([]);

        sCtx.fillStyle = 'rgba(200,255,200,0.55)';
        sCtx.font      = '6px sans-serif';
        sCtx.textAlign = 'center';
        for (let i = 10; i < p.w - 4; i += 16) {
          sCtx.fillText('▲', p.x + i, p.y + 9);
        }
        sCtx.restore();
      }
    }
    console.log(`Phase 6: Cached ${staticPlatforms.length} static platforms onto offscreen canvas (${worldW}x${worldH})`);
  }

  /* ── Debug overlay ── */
  drawDebug(ctx, entities, fps, cam) {
    if (!C.DEBUG) return;
    ctx.save();
    ctx.font      = '5px monospace';
    ctx.fillStyle = '#0f0';
    ctx.fillText(`FPS:${fps.toFixed(0)} camX:${cam.x.toFixed(0)} camY:${cam.y.toFixed(0)}`, 4, 10);

    for (const e of entities) {
      if (!e.x) continue;
      ctx.strokeStyle = 'rgba(0,255,0,0.6)';
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(e.x - (e.w || e.r || 4), e.y - (e.h || e.r || 4),
                     e.w || (e.r || 4) * 2, e.h || (e.r || 4) * 2);
    }
    ctx.restore();
  }
}