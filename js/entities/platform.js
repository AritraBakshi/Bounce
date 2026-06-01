/* ============================================================
   platform.js — Platform entity types.
   Platform types: static | moving | falling | oneWay | crumble
   Each platform is a simple AABB with optional movement.
   ============================================================ */

class Platform {
  /**
   * @param {object} def - Level definition object
   *   x, y, w, h       — position & size (world pixels)
   *   type              — 'static' | 'moving' | 'falling' | 'oneWay' | 'crumble'
   *   moveX, moveY      — movement range (moving type)
   *   speed             — movement speed
   *   theme             — visual theme index
   */
  constructor(def) {
    this.x     = def.x;
    this.y     = def.y;
    this.w     = def.w     || 64;
    this.h     = def.h     || 12;
    this.type  = def.type  || 'static';
    this.theme = def.theme ?? 0;
    this.solid = true;

    // Moving platform
    this.vx      = 0;
    this.vy      = 0;
    this._ox     = def.x;
    this._oy     = def.y;
    this._range  = def.moveRange || 60;
    this._speed  = def.speed     || 0.8;
    this._axis   = def.axis      || 'x';  // 'x' | 'y'
    this._phase  = def.phase     || 0;
    this._t      = this._phase;

    // One-way
    this.oneWay  = this.type === 'oneWay';

    // Crumble / falling
    this._crumble      = this.type === 'crumble';
    this._crumbleTimer = 0;
    this._crumbling    = false;
    this._crumbled     = false;
    this._respawnTimer = 0;
    this._RESPAWN      = 300;  // frames until platform returns

    // Original position snapshot for reset
    this._startX = this.x;
    this._startY = this.y;
  }

  /* ── Update ── */
  update(playerOnTop = false) {
    if (this.type === 'moving') {
      this._t += this._speed * 0.03;
      const offset = Math.sin(this._t) * this._range;
      const prevX  = this.x;
      const prevY  = this.y;
      if (this._axis === 'x') {
        this.x  = this._ox + offset;
        this.vx = this.x - prevX;
        this.vy = 0;
      } else {
        this.y  = this._oy + offset;
        this.vy = this.y - prevY;
        this.vx = 0;
      }
    }

    if (this._crumble) {
      if (this._crumbled) {
        this._respawnTimer++;
        if (this._respawnTimer >= this._RESPAWN) {
          this._crumbled    = false;
          this._crumbling   = false;
          this._crumbleTimer = 0;
          this._respawnTimer = 0;
          this.solid        = true;
          this.x            = this._startX;
          this.y            = this._startY;
        }
        return;
      }

      if (playerOnTop) {
        this._crumbleTimer++;
        if (this._crumbleTimer > 40) this._crumbling = true;
        if (this._crumbleTimer > 60) {
          this.solid   = false;
          this._crumbled = true;
        }
      } else if (!this._crumbling) {
        this._crumbleTimer = Math.max(0, this._crumbleTimer - 1);
      }
    }
  }

  /* ── Draw ── */
  draw(ctx, renderer, cam) {
    if (this._crumbled) return;
    if (!cam.isVisible(this.x, this.y, this.w, this.h)) return;

    const style = this.type === 'moving'  ? 'moving'
                : this.type === 'oneWay'  ? 'oneWay'
                : this.type === 'crumble' ? 'crumble'
                : 'solid';

    ctx.save();

    // Crumble shake
    if (this._crumbling) {
      const shk = Math.sin(this._crumbleTimer * 1.8) * (this._crumbleTimer / 10);
      ctx.translate(MathUtils.rand(-shk, shk), 0);
      ctx.globalAlpha = 1 - (this._crumbleTimer - 40) / 25;
    }

    renderer.drawPlatform(ctx, this.x, this.y, this.w, this.h, style, this.theme);

    // One-way platform indicator
    if (this.oneWay) {
      // Dashed top line
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.x + 2, this.y + 1);
      ctx.lineTo(this.x + this.w - 2, this.y + 1);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow chevrons
      ctx.fillStyle = 'rgba(200,255,200,0.55)';
      ctx.font      = '6px sans-serif';
      ctx.textAlign = 'center';
      for (let i = 10; i < this.w - 4; i += 16) {
        ctx.fillText('▲', this.x + i, this.y + 9);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  reset() {
    this.x             = this._startX;
    this.y             = this._startY;
    this._t            = this._phase;
    this._crumbled     = false;
    this._crumbling    = false;
    this._crumbleTimer = 0;
    this._respawnTimer = 0;
    this.solid         = true;
    this.vx            = 0;
    this.vy            = 0;
  }
}