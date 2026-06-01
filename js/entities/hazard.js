/* ============================================================
   hazard.js — Hazard entities.
   Types: spike | lava | electric | crusher
   All hazards kill or damage the player on contact.
   ============================================================ */

class Hazard {
  constructor(def) {
    this.x     = def.x;
    this.y     = def.y;
    this.w     = def.w || C.TILE;
    this.h     = def.h || C.TILE;
    this.type  = def.type || 'spike';
    this.theme = def.theme ?? 0;

    // Crusher
    this._crushSpeed  = def.crushSpeed || 1.5;
    this._crushRange  = def.crushRange || 60;
    this._crushDir    = 1;
    this._crushOy     = def.y;
    this._t           = def.phase || 0;

    // Animated
    this._frame  = 0;
    this._phase  = def.phase || 0;

    // Electric pulse timer
    this._elecTimer = Math.random() * 60;
    this._elecOn    = true;
  }

  get active() {
    if (this.type === 'electric') return this._elecOn;
    return true;
  }

  /* ── AABB for collision check ── */
  get hitBox() {
    // Spike: shrink hitbox slightly for forgiveness
    if (this.type === 'spike') {
      return { x: this.x + 2, y: this.y + 3, w: this.w - 4, h: this.h - 3 };
    }
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  update(particles) {
    this._frame++;

    if (this.type === 'crusher') {
      this._t += this._crushSpeed * 0.04;
      this.y   = this._crushOy + Math.sin(this._t) * this._crushRange;
    }

    if (this.type === 'lava') {
      // Occasional lava bubble particles
      if (Math.random() < 0.04 && particles) {
        particles.lavaSplash(
          this.x + MathUtils.rand(4, this.w - 4),
          this.y + 2
        );
      }
    }

    if (this.type === 'electric') {
      this._elecTimer--;
      if (this._elecTimer <= 0) {
        this._elecOn   = !this._elecOn;
        this._elecTimer = this._elecOn ? MathUtils.rand(40, 80) : MathUtils.rand(20, 35);
      }
    }
  }

  draw(ctx, cam) {
    if (!cam.isVisible(this.x, this.y, this.w, this.h)) return;
    const f = this._frame;

    ctx.save();

    if (this.type === 'spike') {
      this._drawSpikes(ctx);
    } else if (this.type === 'lava') {
      this._drawLava(ctx, f);
    } else if (this.type === 'electric') {
      this._drawElectric(ctx, f);
    } else if (this.type === 'crusher') {
      this._drawCrusher(ctx);
    }

    ctx.restore();
  }

  _drawSpikes(ctx) {
    const count = Math.max(1, Math.floor(this.w / 10));
    const sw    = this.w / count;
    for (let i = 0; i < count; i++) {
      const sx = this.x + i * sw;
      // Base plate
      ctx.fillStyle = '#556677';
      ctx.fillRect(sx, this.y + this.h - 3, sw, 3);
      // Spike body
      const grad = ctx.createLinearGradient(sx, this.y + this.h, sx + sw * 0.5, this.y);
      grad.addColorStop(0, '#778899');
      grad.addColorStop(1, '#ccdde8');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(sx + 1,       this.y + this.h - 3);
      ctx.lineTo(sx + sw * 0.5, this.y);
      ctx.lineTo(sx + sw - 1,  this.y + this.h - 3);
      ctx.closePath();
      ctx.fill();
      // Sharp tip highlight
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(sx + sw * 0.5,       this.y);
      ctx.lineTo(sx + sw * 0.5 + 1.5, this.y + 5);
      ctx.lineTo(sx + sw * 0.5 - 0.5, this.y + 5);
      ctx.closePath();
      ctx.fill();
    }
    // SPIKE label above
    ctx.fillStyle = 'rgba(200,220,255,0.75)';
    ctx.font      = 'bold 5px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('SPIKE', this.x + this.w / 2, this.y - 2);
  }

  _drawLava(ctx, f) {
    // Base lava body
    const bg = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.h);
    bg.addColorStop(0,   '#ff5500');
    bg.addColorStop(0.3, '#cc2200');
    bg.addColorStop(1,   '#440000');
    ctx.fillStyle = bg;
    ctx.fillRect(this.x, this.y + 4, this.w, this.h - 4);

    // Animated surface with bright crust
    const surf = ctx.createLinearGradient(this.x, this.y, this.x, this.y + 8);
    surf.addColorStop(0, '#ffaa00');
    surf.addColorStop(1, '#ff4400');
    ctx.fillStyle = surf;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + this.h);
    for (let x = 0; x <= this.w; x += 3) {
      const y = this.y + 3 + Math.sin((x * 0.25 + f * 1.2)) * 3
                          + Math.sin((x * 0.08 + f * 0.5))  * 2;
      ctx.lineTo(this.x + x, y);
    }
    ctx.lineTo(this.x + this.w, this.y + this.h);
    ctx.closePath();
    ctx.fill();

    // Glowing top strip
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = 'rgba(255,180,0,0.4)';
    ctx.fillRect(this.x, this.y, this.w, 3);
    ctx.shadowBlur  = 0;

    // Bubble pops
    const bx = this.x + ((f * 3) % this.w);
    ctx.fillStyle = 'rgba(255,120,0,0.5)';
    ctx.beginPath(); ctx.arc(bx, this.y + 2, 2.5, 0, Math.PI*2); ctx.fill();

    // LAVA label
    ctx.fillStyle = 'rgba(255,180,50,0.85)';
    ctx.font      = 'bold 5px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('LAVA', this.x + this.w / 2, this.y - 2);
  }

  _drawElectric(ctx, f) {
    // Housing frame
    const hue = 180 + Math.sin(f * 0.3) * 20;
    ctx.fillStyle = '#1a2a33';
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // Frame border
    ctx.strokeStyle = this._elecOn ? `hsl(${hue},100%,55%)` : '#334';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(this.x + 0.5, this.y + 0.5, this.w - 1, this.h - 1);

    if (!this._elecOn) {
      // OFF — show OFF indicator
      ctx.fillStyle = 'rgba(0,80,100,0.3)';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.fillStyle = 'rgba(100,180,200,0.4)';
      ctx.font      = 'bold 5px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText('OFF', this.x + this.w / 2, this.y + this.h / 2 + 2);
      ctx.fillText('ELEC', this.x + this.w / 2, this.y - 2);
      return;
    }

    // Active — plasma fill
    ctx.fillStyle = `hsla(${hue},100%,60%,0.1)`;
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // Lightning bolts
    ctx.shadowColor = `hsl(${hue},100%,70%)`;
    ctx.shadowBlur  = 10;
    ctx.strokeStyle = `hsl(${hue},100%,75%)`;
    ctx.lineWidth   = 1.5;
    for (let bolt = 0; bolt < 2; bolt++) {
      const bx0 = this.x + this.w * (0.25 + bolt * 0.5);
      ctx.beginPath();
      ctx.moveTo(bx0, this.y + 1);
      let cy2 = this.y + 1;
      while (cy2 < this.y + this.h - 1) {
        cy2 += 4;
        const nx = bx0 + MathUtils.rand(-this.w * 0.28, this.w * 0.28);
        ctx.lineTo(Math.max(this.x+1, Math.min(this.x+this.w-1, nx)), cy2);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Electrode nodes top & bottom
    for (let side = 0; side < 2; side++) {
      const ey = side === 0 ? this.y + 3 : this.y + this.h - 3;
      ctx.fillStyle = `hsl(${hue},80%,80%)`;
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, ey, 3, 0, Math.PI * 2); ctx.fill();
    }

    // ELEC label
    ctx.fillStyle = `hsla(${hue},100%,75%,0.9)`;
    ctx.font      = 'bold 5px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('ELEC', this.x + this.w / 2, this.y - 2);
  }

  _drawCrusher(ctx) {
    // Body — heavy machined steel
    const bg = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.h);
    bg.addColorStop(0, '#7a8fa0');
    bg.addColorStop(0.5,'#4a5f70');
    bg.addColorStop(1, '#2a3a48');
    ctx.fillStyle = bg;
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(this.x, this.y, this.w, 3);

    // Side bevels
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(this.x, this.y, 2, this.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(this.x + this.w - 2, this.y, 2, this.h);

    // Rivets at corners
    ctx.fillStyle = '#aabbcc';
    const rivets = [[4,4],[this.w-6,4],[4,this.h-6],[this.w-6,this.h-6]];
    for (const [rx, ry] of rivets) {
      ctx.beginPath();
      ctx.arc(this.x + rx, this.y + ry, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(this.x + rx + 0.5, this.y + ry + 0.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aabbcc';
    }

    // Danger stripe on bottom
    const sw = 7;
    for (let i = 0; i < Math.floor(this.w / sw); i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ffcc00' : '#111';
      ctx.fillRect(this.x + i * sw, this.y + this.h - 5, sw, 5);
    }

    // CRUSH label + down arrows
    ctx.fillStyle = '#ffcc00';
    ctx.font      = 'bold 5px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('▼ CRUSH ▼', this.x + this.w / 2, this.y + this.h / 2 + 2);
    ctx.fillText('CRUSHER', this.x + this.w / 2, this.y - 2);
  }
}