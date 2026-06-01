/* ============================================================
   hud.js — In-game heads-up display.
   Drawn in screen space (after camera.end()).
   Shows: lives, score, gems, timer, powerup timers, level name.
   ============================================================ */

class HUD {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this._scoreDisplay = 0;  // animated score counter
    this._frame        = 0;
  }

  update(player) {
    this._frame++;
    // Smooth score counter
    this._scoreDisplay = Math.round(MathUtils.lerp(this._scoreDisplay, player.score, 0.12));
  }

  draw(ctx, player, levelName, totalGems) {
    ctx.save();
    ctx.textBaseline = 'top';

    this._drawTopBar(ctx, player, levelName, totalGems);
    this._drawPowerups(ctx, player);

    // Combo display — centred, animated
    if (player.combo > 1 && player._comboTimer > 0) {
      const alpha  = Math.min(1, player._comboTimer / 25);
      const scale  = 1 + Math.sin(this._frame * 0.3) * 0.06;
      const size   = Math.min(14, 9 + player.combo);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(this.w / 2, this.h - 26);
      ctx.scale(scale, scale);
      // Shadow
      ctx.font      = `bold ${size}px "Courier New"`;
      ctx.fillStyle = '#aa4400';
      ctx.textAlign = 'center';
      ctx.fillText('x' + player.combo + ' COMBO!', 2, 2);
      // Main text
      const comboGrad = ctx.createLinearGradient(-40, -size, 40, 0);
      comboGrad.addColorStop(0, '#ffdd44');
      comboGrad.addColorStop(0.5,'#ff9944');
      comboGrad.addColorStop(1, '#ff4400');
      ctx.fillStyle   = comboGrad;
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur  = 8;
      ctx.fillText('x' + player.combo + ' COMBO!', 0, 0);
      ctx.shadowBlur  = 0;
      ctx.restore();
    }

    ctx.restore();
  }

  _drawTopBar(ctx, player, levelName, totalGems) {
    const W = this.w;

    // ── Panel background with gradient ──
    const panelGrad = ctx.createLinearGradient(0, 0, 0, 20);
    panelGrad.addColorStop(0, 'rgba(0,0,0,0.82)');
    panelGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = panelGrad;
    ctx.fillRect(0, 0, W, 20);

    // Red accent line at bottom of HUD
    ctx.fillStyle = '#e8231a';
    ctx.fillRect(0, 19, W, 1);

    // ── LEFT: Half-heart pips (6 pips = 3 full hearts) ──
    const maxH = 6;   // total half-heart slots
    const curH = Math.max(0, player.lives);
    const heartSpacing = 12;
    for (let i = 0; i < 3; i++) {
      const hx  = 6 + i * heartSpacing;
      const hy  = 10;
      const leftFull  = curH >= (i * 2 + 2); // both halves filled
      const leftHalf  = curH >= (i * 2 + 1) && !leftFull; // only left half
      // Full red heart
      if (leftFull) {
        this._drawHeart(ctx, hx, hy, '#e8231a', 1.0);
      } else if (leftHalf) {
        // Half heart — left side red, right side grey
        this._drawHalfHeart(ctx, hx, hy);
      } else {
        // Empty heart
        this._drawHeart(ctx, hx, hy, '#444', 0.5);
      }
    }
    if (player.lives <= 0) {
      ctx.fillStyle = '#ff3322';
      ctx.font      = 'bold 7px "Courier New"';
      ctx.textAlign = 'left';
      ctx.fillText('DEAD', 6, 16);
    }

    // ── CENTRE: Score + level name ──
    ctx.textAlign = 'center';
    ctx.font      = 'bold 9px "Courier New"';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255,255,255,0.3)';
    ctx.shadowBlur  = 3;
    ctx.fillText(Helpers.formatScore(this._scoreDisplay), W / 2, 10);
    ctx.shadowBlur  = 0;
    ctx.font        = '6px "Courier New"';
    ctx.fillStyle   = 'rgba(255,180,60,0.8)';
    ctx.fillText(levelName || 'LEVEL 1', W / 2, 17);

    // ── RIGHT: Gems + Timer stacked ──
    ctx.textAlign = 'right';

    // Gem counter with colour
    const gemFull  = player.gems >= totalGems;
    ctx.fillStyle  = gemFull ? '#44ff88' : '#ffd700';
    ctx.shadowColor= gemFull ? '#44ff88' : '#ffd700';
    ctx.shadowBlur = gemFull ? 5 : 2;
    ctx.font       = 'bold 8px "Courier New"';
    ctx.fillText('◆ ' + player.gems + '/' + totalGems, W - 3, 10);
    ctx.shadowBlur = 0;

    // Timer
    const secs = Math.floor(player.levelTime / 60);
    ctx.fillStyle = 'rgba(200,220,255,0.65)';
    ctx.font      = '7px "Courier New"';
    ctx.fillText('⏱ ' + Helpers.formatTime(secs), W - 3, 18);
  }

  _drawMiniball(ctx, x, y) {
    const g = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.3, x, y, 4);
    g.addColorStop(0, '#ff9988');
    g.addColorStop(0.5, '#e8231a');
    g.addColorStop(1, '#5c0504');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  }

  _heartPath(ctx, x, y, s) {
    // Classic heart shape centred at (x, y), size s
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x,          y - s * 0.5,  x - s * 1.0, y - s * 0.5, x - s * 1.0, y);
    ctx.bezierCurveTo(x - s * 1.0,y + s * 0.6,  x,           y + s * 1.1, x,           y + s * 0.3);
    ctx.closePath();
    // Right half (mirror)
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x,          y - s * 0.5,  x + s * 1.0, y - s * 0.5, x + s * 1.0, y);
    ctx.bezierCurveTo(x + s * 1.0,y + s * 0.6,  x,           y + s * 1.1, x,           y + s * 0.3);
    ctx.closePath();
  }

  _drawHeart(ctx, x, y, col, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = col;
    const s = 4;
    // Simple heart using two bumps + triangle
    ctx.beginPath();
    ctx.arc(x - 2.2, y - 1.5, 2.8, Math.PI, 0);
    ctx.arc(x + 2.2, y - 1.5, 2.8, Math.PI, 0);
    ctx.lineTo(x, y + 5.5);
    ctx.lineTo(x - 5, y + 0.5);
    ctx.closePath();
    ctx.fill();
    if (alpha > 0.7 && col !== '#444') {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.ellipse(x - 1.5, y - 2.5, 1.2, 0.8, -0.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  _drawHalfHeart(ctx, x, y) {
    ctx.save();
    // Left half = red
    ctx.fillStyle = '#e8231a';
    ctx.beginPath();
    ctx.arc(x - 2.2, y - 1.5, 2.8, Math.PI, 0);
    ctx.lineTo(x, y + 5.5);
    ctx.lineTo(x - 5, y + 0.5);
    ctx.closePath();
    ctx.fill();
    // Right half = grey
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(x + 2.2, y - 1.5, 2.8, Math.PI, 0);
    ctx.lineTo(x, y + 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawPowerups(ctx, player) {
    const pu   = player.powerups;
    const keys = Object.keys(pu).filter(k => pu[k] > 0);
    if (keys.length === 0) return;

    const cols = {
      shield:'#4488ff', speed:'#ffaa00', dblj:'#88ff44',
      magnet:'#ff44aa', invinc:'#ffdd00', lowgrav:'#44ffdd',
    };
    const labels = {
      shield:'SHIELD', speed:'SPEED', dblj:'2-JUMP',
      magnet:'MAGNET', invinc:'STAR', lowgrav:'LOW-G',
    };
    const maxDurs = {
      shield:C.PU_SHIELD, speed:C.PU_SPEED, dblj:C.PU_DBLJ,
      magnet:C.PU_MAGNET, invinc:C.PU_INVINC, lowgrav:C.PU_LOWGRAV,
    };

    const barW = 38, barH = 6, rowH = 17;
    const startX = 3, startY = 23;

    keys.forEach((key, i) => {
      const col   = cols[key] || '#fff';
      const lbl   = labels[key] || key;
      const frac  = Math.max(0, pu[key] / (maxDurs[key] || 300));
      const bx    = startX;
      const by    = startY + i * rowH;
      const low   = frac < 0.25;
      const flash = low && Math.floor(this._frame / 6) % 2 === 0;

      // Row bg panel
      ctx.fillStyle = flash ? col + '22' : 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 1, by - 8, barW + 10, rowH - 2);
      ctx.strokeStyle = col + (low ? 'cc' : '55');
      ctx.lineWidth   = 0.8;
      ctx.strokeRect(bx - 1, by - 8, barW + 10, rowH - 2);

      // Colour dot
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(bx + 3, by - 1, 2.5, 0, Math.PI*2); ctx.fill();

      // Label
      ctx.font      = (low ? 'bold ' : '') + '6px "Courier New"';
      ctx.fillStyle = flash ? '#ffffff' : col;
      ctx.textAlign = 'left';
      ctx.fillText(lbl, bx + 8, by + 1);

      // Timer bar track
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx + 8, by + 3, barW, barH);

      // Timer bar fill with gradient
      if (frac > 0) {
        const barGrad = ctx.createLinearGradient(bx + 8, 0, bx + 8 + barW * frac, 0);
        barGrad.addColorStop(0,   col);
        barGrad.addColorStop(0.6, col + 'cc');
        barGrad.addColorStop(1,   col + '88');
        ctx.fillStyle = barGrad;
        ctx.fillRect(bx + 8, by + 3, barW * frac, barH);
      }

      // Remaining seconds
      const secsLeft = Math.ceil(pu[key] / 60);
      ctx.fillStyle  = low ? '#ff4444' : 'rgba(255,255,255,0.5)';
      ctx.font       = '5px "Courier New"';
      ctx.textAlign  = 'right';
      ctx.fillText(secsLeft + 's', bx + barW + 9, by + 9);
    });
  }
}