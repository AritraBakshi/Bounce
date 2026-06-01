/* ============================================================
   collectible.js — Collectible entities.
   Types: gem | coin | powerup | exit | checkpoint
   ============================================================ */

class Collectible {
  constructor(def) {
    this.x       = def.x;
    this.y       = def.y;
    this.w       = def.w || 12;
    this.h       = def.h || 12;
    this.type    = def.type    || 'gem';
    this.subType = def.subType || null;  // powerup variant
    this.color   = def.color   || null;
    this.value   = def.value   || (this.type === 'gem' ? C.GEM_SCORE : C.COIN_SCORE);
    this.hidden  = def.hidden  || false;

    this.collected = false;
    this.active    = true;   // false while activated (exit/checkpoint used)

    // Animation
    this._frame    = Math.random() * 100;
    this._bobY     = 0;
    this._glowPulse= Math.random() * Math.PI * 2;
    this._spinAngle= 0;

    // Checkpoint state
    this.activated = false;  // checkpoint already hit

    // Exit: requires all gems to open
    this.open = def.open !== undefined ? def.open : (this.type !== 'exit');
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2 + this._bobY; }

  get hitR() {
    if (this.type === 'exit')       return 14;
    if (this.type === 'checkpoint') return 10;
    return 7;
  }

  update(frame) {
    this._frame++;
    this._bobY     = Math.sin(this._frame * 0.07) * 2.5;
    this._glowPulse= this._frame * 0.08;
    this._spinAngle+= 0.04;
    if (this.type === 'exit' && this.open) {
      this._spinAngle += 0.02;
    }
  }

  collect(particles, audio, score) {
    if (this.collected) return 0;
    this.collected = true;

    if (this.type === 'gem') {
      particles.collectGem(this.cx, this.cy);
      particles.floatText(this.cx, this.cy - 8, `+${this.value}`, '#ffd700');
      audio.playCollect();
      return this.value;
    }
    if (this.type === 'coin') {
      particles.burst(this.cx, this.cy, 5, 255, 215, 0, 2, 20, 2, 0);
      audio.playCollect();
      return this.value;
    }
    if (this.type === 'powerup') {
      particles.burst(this.cx, this.cy, 12, 180, 100, 255, 3, 35, 3, 0);
      particles.floatText(this.cx, this.cy - 10,
        this._puLabel(), '#cc88ff');
      audio.playPowerup();
      return 0;
    }
    return 0;
  }

  _puLabel() {
    const map = {
      shield: 'SHIELD!', speed: 'SPEED!', dblj: '2x JUMP!',
      magnet: 'MAGNET!', invinc: 'STAR!',  lowgrav: 'LOW-G!',
    };
    return map[this.subType] || 'POWERUP!';
  }

  draw(ctx, cam) {
    if (this.collected) return;
    if (!cam.isVisible(this.x - 4, this.y - 10, this.w + 8, this.h + 14)) return;

    ctx.save();
    const cx = this.cx, cy = this.cy;

    if (this.type === 'gem')        this._drawGem(ctx, cx, cy);
    else if (this.type === 'coin')  this._drawCoin(ctx, cx, cy);
    else if (this.type === 'powerup') this._drawPowerup(ctx, cx, cy);
    else if (this.type === 'exit')  this._drawExit(ctx, cx, cy);
    else if (this.type === 'checkpoint') this._drawCheckpoint(ctx, cx, cy);

    ctx.restore();
  }

  _drawGem(ctx, cx, cy) {
    const colors = {
      red:    { base:'#ff3333', light:'#ff9999', dark:'#aa0000' },
      blue:   { base:'#3377ff', light:'#99bbff', dark:'#0044cc' },
      green:  { base:'#22ee66', light:'#88ffbb', dark:'#008833' },
      yellow: { base:'#ffdd00', light:'#ffee88', dark:'#cc9900' },
      purple: { base:'#cc33ff', light:'#ee99ff', dark:'#880099' },
    };
    const c     = this.color ? colors[this.color] || colors.blue : colors.blue;
    const pulse = Math.sin(this._glowPulse) * 0.35 + 0.65;
    const r     = this._spinAngle;
    const s     = 6;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(r * 0.7) * 0.25); // gentle rock

    // Outer glow
    ctx.shadowColor = c.base;
    ctx.shadowBlur  = 10 * pulse;

    // Gem facets — hexagonal diamond
    // Main body
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(0,      -s * 1.3);  // top
    ctx.lineTo( s,     -s * 0.2);  // upper-right
    ctx.lineTo( s * 0.7, s * 0.9); // lower-right
    ctx.lineTo(0,       s * 1.0);  // bottom
    ctx.lineTo(-s * 0.7, s * 0.9); // lower-left
    ctx.lineTo(-s,     -s * 0.2);  // upper-left
    ctx.closePath();
    ctx.fill();

    // Left face (darker)
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.moveTo(0,      -s * 1.3);
    ctx.lineTo(-s,     -s * 0.2);
    ctx.lineTo(-s * 0.7, s * 0.9);
    ctx.lineTo(0,       s * 1.0);
    ctx.closePath();
    ctx.fill();

    // Top facet highlight
    ctx.fillStyle = c.light;
    ctx.beginPath();
    ctx.moveTo(0,      -s * 1.3);
    ctx.lineTo( s * 0.5, -s * 0.5);
    ctx.lineTo(0,      -s * 0.1);
    ctx.lineTo(-s * 0.5,-s * 0.5);
    ctx.closePath();
    ctx.fill();

    // White sparkle
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(-1, -s * 1.15);
    ctx.lineTo( 1, -s * 1.15);
    ctx.lineTo( 0.5, -s * 0.8);
    ctx.lineTo(-0.5, -s * 0.8);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    // GEM label
    ctx.fillStyle = `rgba(${c.base.slice(1).match(/../g).map(x=>parseInt(x,16)).join(',')},0.8)`;
    ctx.font      = '5px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('GEM', cx, cy + s + 8);
  }

  _drawCoin(ctx, cx, cy) {
    const spin   = Math.abs(Math.cos(this._spinAngle));   // 0=edge, 1=face
    const wid    = Math.max(0.6, spin * 5.5);
    const pulse  = Math.sin(this._glowPulse) * 0.3 + 0.7;

    ctx.save();
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur  = 6 * pulse;

    // Coin edge (dark when edge-on)
    ctx.fillStyle = '#c8880a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, wid + 1, 6, 0, 0, Math.PI*2);
    ctx.fill();

    // Coin face
    if (spin > 0.15) {
      const face = ctx.createRadialGradient(cx - wid*0.3, cy - 2, 0.3, cx, cy, wid);
      face.addColorStop(0,   '#fff0a0');
      face.addColorStop(0.5, '#ffd700');
      face.addColorStop(1,   '#cc9900');
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.ellipse(cx, cy, wid, 5.5, 0, 0, Math.PI*2);
      ctx.fill();

      // $ symbol when facing
      if (spin > 0.6) {
        ctx.fillStyle = 'rgba(180,120,0,0.7)';
        ctx.font      = `bold ${Math.round(wid * 1.4)}px "Courier New"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', cx, cy);
        ctx.textBaseline = 'alphabetic';
      }
    }

    ctx.shadowBlur = 0;
    ctx.restore();

    // COIN label
    ctx.fillStyle = 'rgba(255,200,50,0.8)';
    ctx.font      = '5px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('COIN', cx, cy + 9);
  }

  _drawPowerup(ctx, cx, cy) {
    const CFG = {
      shield:  { col:'#4488ff', bg:'#001a44', sym:'SH', label:'SHIELD',   desc:'Absorbs 1 hit' },
      speed:   { col:'#ffaa00', bg:'#442200', sym:'SP', label:'SPEED',    desc:'Move 1.6x faster' },
      dblj:    { col:'#88ff44', bg:'#1a4400', sym:'2J', label:'DBL JUMP', desc:'Jump twice' },
      magnet:  { col:'#ff44aa', bg:'#440022', sym:'MG', label:'MAGNET',   desc:'Pulls gems' },
      invinc:  { col:'#ffdd00', bg:'#443300', sym:'ST', label:'STAR',     desc:'Invincible' },
      lowgrav: { col:'#44ffdd', bg:'#003344', sym:'LG', label:'LOW-G',    desc:'Float lightly' },
    };
    const cfg   = CFG[this.subType] || { col:'#cc88ff', bg:'#220044', sym:'?', label:'ITEM', desc:'' };
    const pulse = Math.sin(this._glowPulse) * 0.4 + 0.6;
    const spin  = this._spinAngle;

    ctx.save();
    ctx.translate(cx, cy);

    // Outer aura ring
    ctx.shadowColor = cfg.col;
    ctx.shadowBlur  = 14 * pulse;
    ctx.strokeStyle = cfg.col;
    ctx.globalAlpha = pulse * 0.6;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;

    // Rotating orbit ring
    ctx.rotate(spin);
    ctx.strokeStyle = cfg.col + '88';
    ctx.lineWidth   = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    // Orbit dot
    ctx.fillStyle = cfg.col;
    ctx.beginPath(); ctx.arc(9, 0, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-9, 0, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.rotate(-spin);

    // Box body — distinct shape per type
    const boxR = this.subType === 'invinc' ? 7 : 6;
    ctx.fillStyle = cfg.bg;
    ctx.beginPath(); ctx.arc(0, 0, boxR, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = cfg.col + 'cc';
    ctx.beginPath(); ctx.arc(0, 0, boxR, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = cfg.bg;
    ctx.beginPath(); ctx.arc(0, 0, boxR - 2, 0, Math.PI*2); ctx.fill();

    // Symbol text
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = cfg.col;
    ctx.font        = 'bold 6px "Courier New"';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText(cfg.sym, 0, 0.5);

    ctx.restore();

    // Name label above
    ctx.fillStyle   = cfg.col;
    ctx.font        = 'bold 6px "Courier New"';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'alphabetic';
    ctx.fillText(cfg.label, cx, cy - 13);

    // Description tooltip below (smaller)
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font      = '5px "Courier New"';
    ctx.fillText(cfg.desc, cx, cy + 15);
  }

  _drawExit(ctx, cx, cy) {
    const pulse = Math.sin(this._glowPulse) * 0.5 + 0.5;
    const col   = this.open ? '#44ff88' : '#888888';
    const spin  = this._spinAngle;

    ctx.save();
    ctx.translate(cx, cy);

    // Outer aura
    ctx.shadowColor = col;
    ctx.shadowBlur  = (this.open ? 16 : 6) * pulse;

    // Multiple rotating rings
    for (let ring = 0; ring < 3; ring++) {
      const rs = 10 + ring * 4;
      const ra = spin * (this.open ? 1 : 0.2) * (ring % 2 === 0 ? 1 : -1);
      ctx.save();
      ctx.rotate(ra);
      ctx.strokeStyle = `rgba(${this.open ? '68,255,136' : '136,136,136'},${(0.8 - ring * 0.2) * pulse})`;
      ctx.lineWidth   = ring === 0 ? 2 : 1;
      ctx.setLineDash(ring > 0 ? [3, 4] : []);
      ctx.beginPath(); ctx.arc(0, 0, rs, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Portal fill
    const radgrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
    if (this.open) {
      radgrad.addColorStop(0,   `rgba(180,255,220,${0.5 * pulse})`);
      radgrad.addColorStop(0.5, `rgba(68,255,136,${0.3 * pulse})`);
      radgrad.addColorStop(1,    'rgba(0,100,50,0)');
    } else {
      radgrad.addColorStop(0,   `rgba(80,80,80,${0.3 * pulse})`);
      radgrad.addColorStop(1,    'rgba(40,40,40,0)');
    }
    ctx.fillStyle = radgrad;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // Arrow / lock icon in centre
    if (this.open) {
      // Right arrow
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-3, -4); ctx.lineTo(3, 0); ctx.lineTo(-3, 4);
      ctx.closePath(); ctx.fill();
    } else {
      // Padlock
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth   = 1.2;
      ctx.beginPath(); ctx.arc(0, -2, 3, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#888';
      ctx.fillRect(-3, -1, 6, 5);
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(0, 1.5, 1.2, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();

    // Status label
    ctx.fillStyle   = col;
    ctx.font        = 'bold 6px "Courier New"';
    ctx.textAlign   = 'center';
    ctx.fillText(this.open ? '▶ EXIT ◀' : '🔒 LOCKED', cx, cy + 20);
    if (!this.open) {
      ctx.fillStyle = 'rgba(200,200,200,0.6)';
      ctx.font      = '5px "Courier New"';
      ctx.fillText('Collect 60% of gems', cx, cy + 28);
    }
  }

  _drawCheckpoint(ctx, cx, cy) {
    const on    = this.activated;
    const col   = on ? '#ffdd00' : '#cccccc';
    const pulse = Math.sin(this._glowPulse) * 0.3 + 0.7;

    // Pole
    const poleGrad = ctx.createLinearGradient(cx - 1, 0, cx + 1, 0);
    poleGrad.addColorStop(0, '#777');
    poleGrad.addColorStop(0.5, '#bbb');
    poleGrad.addColorStop(1, '#666');
    ctx.fillStyle = poleGrad;
    ctx.fillRect(cx - 1.5, cy - 16, 3, 20);

    // Base
    ctx.fillStyle = '#555';
    ctx.fillRect(cx - 5, cy + 3, 10, 3);

    // Waving flag
    ctx.save();
    if (on) {
      ctx.shadowColor = '#ffdd00';
      ctx.shadowBlur  = 10 * pulse;
    }
    const wave = on ? Math.sin(this._glowPulse * 2) * 2 : 0;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy - 16);
    ctx.quadraticCurveTo(cx + 7 + wave, cy - 12, cx + 12 + wave, cy - 10);
    ctx.quadraticCurveTo(cx + 7 + wave, cy - 8,  cx + 1,         cy - 4);
    ctx.closePath();
    ctx.fill();

    // Checkmark on flag when activated
    if (on) {
      ctx.strokeStyle = '#aa8800';
      ctx.lineWidth   = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + 3, cy - 11);
      ctx.lineTo(cx + 6, cy - 8);
      ctx.lineTo(cx + 10 + wave, cy - 14);
      ctx.stroke();
    }

    ctx.restore();

    // CHECKPOINT label
    ctx.fillStyle   = on ? 'rgba(255,220,50,0.9)' : 'rgba(200,200,200,0.6)';
    ctx.font        = on ? 'bold 5px "Courier New"' : '5px "Courier New"';
    ctx.textAlign   = 'center';
    ctx.fillText(on ? '✓ SAVED' : 'CHECKPOINT', cx + 5, cy - 19);
  }
}