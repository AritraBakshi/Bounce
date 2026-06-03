/* ============================================================
   menus.js — All screen overlays: main, pause, gameover,
   victory, level select.  Drawn in screen space on top of
   the game canvas.
   ============================================================ */

class MenuSystem {
  constructor(w, h) {
    this.w = w;
    this.h = h;

    /** Active screen: 'main'|'levelSelect'|'scores'|'pause'|'gameover'|'victory'|null */
    this.screen      = 'main';
    this._frame      = 0;
    this._transition = 0;

    this._cursor = { main: 0, pause: 0, levelSelect: 0, gameover: 0 };
    this._savedProgress = Helpers.load('progress', { unlockedLevels: [1], highScores: {} });
    this._muted  = Helpers.load('muted', false);
    this._audioRef = null; // set by Game after construction

    // M key = mute toggle (works in pause without consuming confirm)
    window.addEventListener('keydown', e => {
      if (e.code === 'KeyM' && this.screen === 'pause') {
        this._muted = !this._muted;
        Helpers.save('muted', this._muted);
        if (this._audioRef) this._audioRef.setMute(this._muted);
      }
    });

    // Mouse / touch support
    this._mouse = { x: 0, y: 0, down: false, justDown: false, dragging: null };
    this._canvas = null;  // set by Game after construction

    // Mouse clicks disabled — keyboard/touch-button controls only
  }

  get isOpen() { return this.screen !== null; }

  open(screen) {
    this.screen       = screen;
    this._transition  = 0;
    this._entryGuard  = 6;  // block input for 6 frames after opening
    if (this._cursor[screen] === undefined) this._cursor[screen] = 0;
    else this._cursor[screen] = 0;
  }

  close() { this.screen = null; }

  /* ── Input handling — returns action string or null ── */
  handleInput(input) {
    if (!this.isOpen) return null;
    // Block input for a few frames after screen opens (prevents same-keypress closing)
    if (this._entryGuard > 0) return null;
    const inp = input.state;

    if (this.screen === 'main') {
      // Arrow keys navigate cursor
      if (inp.left || inp.right) {
        // horizontal ignored on main
      }
      if (this._justUp(inp)) {
        const opts = this._mainOptions();
        this._cursor.main = (this._cursor.main - 1 + opts.length) % opts.length;
      }
      if (this._justDown(inp)) {
        const opts = this._mainOptions();
        this._cursor.main = (this._cursor.main + 1) % opts.length;
      }
      // Only Space (not ArrowUp) confirms a selection
      if (inp.spaceOnly) {
        const opts = this._mainOptions();
        return opts[this._cursor.main].action;
      }
      return null;
    }

    if (this.screen === 'achievements' || this.screen === 'guide' || this.screen === 'scores') {
      if (inp.spaceOnly || inp.pause) return 'backToMain';
      return null;
    }

    if (this.screen === 'levelSelect') {
      if (this._justUp(inp))   this._cursor.levelSelect = Math.max(0, this._cursor.levelSelect - 1);
      if (this._justDown(inp)) this._cursor.levelSelect = Math.min(4, this._cursor.levelSelect + 1);
      if (inp.spaceOnly) {
        const lvl = this._cursor.levelSelect + 1;
        if ((this._savedProgress.unlockedLevels || [1]).includes(lvl)) return `playLevel:${lvl}`;
      }
      if (inp.pause) return 'backToMain';
      return null;
    }

    if (this.screen === 'scores') {
      if (inp.anyJustPressed) return 'backToMain';
      return null;
    }

    if (this.screen === 'gameover') {
      if (this._justUp(inp))   this._cursor.gameover = Math.max(0, (this._cursor.gameover||0) - 1);
      if (this._justDown(inp)) this._cursor.gameover = Math.min(1, (this._cursor.gameover||0) + 1);
      if (inp.spaceOnly) {
        return (this._cursor.gameover||0) === 0 ? 'restart' : 'backToMain';
      }
      return null;
    }

    if (this.screen === 'victory' && inp.spaceOnly) return 'nextLevel';

    if (this.screen === 'pause') {
      // 5 rows: 0=RESUME 1=RESTART 2=MAIN MENU 3=MUSIC VOL 4=SFX VOL
      if (this._justUp(inp))   this._cursor.pause = Math.max(0, this._cursor.pause - 1);
      if (this._justDown(inp)) this._cursor.pause = Math.min(4, this._cursor.pause + 1);

      // Left/Right only when a slider row is highlighted
      if ((inp.left || inp.right) && this._cursor.pause >= 3) {
        const d = inp.left ? -0.05 : 0.05;
        if (this._cursor.pause === 3) {
          this._bgVol  = Math.max(0, Math.min(1, +(this._bgVol  + d).toFixed(2)));
          Helpers.save('bgVol',  this._bgVol);
          if (this._audioRef) this._audioRef.setBgVol(this._bgVol);
        } else {
          this._sfxVol = Math.max(0, Math.min(1, +(this._sfxVol + d).toFixed(2)));
          Helpers.save('sfxVol', this._sfxVol);
          if (this._audioRef) this._audioRef.setSfxVol(this._sfxVol);
        }
      }

      // ESC always resumes
      if (inp.pause) return 'resume';

      // Space confirms menu rows only (0-2) — not ArrowUp
      if (inp.spaceOnly && this._cursor.pause <= 2) {
        const pauseActions = ['resume', 'restart', 'menu'];
        return pauseActions[this._cursor.pause];
      }

      return null;
    }
    return null;
  }


  // Key helpers — now uses unified input from InputManager
  _justUp(inp) {
    return inp.menuUp;  // Now uses unified input from InputManager
  }
  _justDown(inp) {
    return inp.menuDown;  // Now uses unified input from InputManager
  }
  _justEnter(inp) { return false; }

  _mainOptions() {
    const hasUnlocked = (this._savedProgress.unlockedLevels || [1]).some(l => l > 1);
    const opts = [{ label: 'NEW GAME', action: 'startGame' }];
    if (hasUnlocked) opts.push({ label: 'CONTINUE', action: 'openLevelSelect' });
    opts.push({ label: 'HIGH SCORES',  action: 'openScores' });
    opts.push({ label: 'ACHIEVEMENTS', action: 'openAchievements' });
    opts.push({ label: 'GUIDE',        action: 'openGuide' });
    opts.push({ label: this._muteLabel(), action: 'toggleMute' });
    return opts;
  }

  _muteLabel() { return this._muted ? '♪ UNMUTE' : '♪ MUTE'; }

  /* ── Update ── */
  update() {
    this._frame++;
    this._transition = Math.min(1, this._transition + 0.06);
    if (this._entryGuard > 0) this._entryGuard--;
  }

  /* ── Draw ── */
  draw(ctx, data = {}) {
    if (!this.isOpen) return;
    this.update();

    const alpha = MathUtils.smoothStep(this._transition);
    ctx.save();
    ctx.globalAlpha = alpha;

    switch (this.screen) {
      case 'main':         this._drawMain(ctx, data);         break;
      case 'pause':        this._drawPause(ctx, data);        break;
      case 'gameover':     this._drawGameOver(ctx, data);     break;
      case 'victory':      this._drawVictory(ctx, data);      break;
      case 'levelSelect':  this._drawLevelSelect(ctx, data);  break;
      case 'scores':       this._drawScores(ctx, data);       break;
      case 'achievements': this._drawAchievements(ctx, data); break;
      case 'guide':        this._drawGuide(ctx);              break;
    }

    ctx.restore();
  }

  /* ── Shared helpers ── */
  _panel(ctx, x, y, w, h, col = 'rgba(8,8,18,0.92)') {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  _title(ctx, text, y, size = 18, col = '#fff') {
    const pulse = Math.sin(this._frame * 0.06) * 0.15 + 0.85;
    ctx.font      = `bold ${size}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 20 * pulse;
    ctx.fillText(text, this.w / 2, y);
    ctx.shadowBlur = 0;
  }

  _btn(ctx, text, y, selected = false, col = '#e8231a') {
    const pulse = selected ? Math.sin(this._frame * 0.15) * 0.2 + 0.8 : 1;
    ctx.font      = `${selected ? 'bold ' : ''}8px "Courier New"`;
    ctx.textAlign = 'center';
    if (selected) {
      ctx.fillStyle   = col;
      ctx.shadowColor = col;
      ctx.shadowBlur  = 10 * pulse;
      ctx.fillText(`▶ ${text} ◀`, this.w / 2, y);
    } else {
      ctx.fillStyle   = 'rgba(255,255,255,0.55)';
      ctx.shadowBlur  = 0;
      ctx.fillText(text, this.w / 2, y);
    }
    ctx.shadowBlur = 0;
  }

  /* ── Screens ── */
  _drawMain(ctx, { bestScore = 0 } = {}) {
    const W = this.w, H = this.h;
    const cx = W / 2;
    const f  = this._frame;
    const S  = H / 270;

    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(232,35,26,0.07)';
    ctx.lineWidth   = 0.5;
    const grid = Math.round(20 * S);
    for (let x = 0; x < W; x += grid) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += grid) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Divider strip
    ctx.fillStyle = 'rgba(232,35,26,0.14)';
    ctx.fillRect(0, H * 0.50 - 1, W, Math.max(2, Math.round(2*S)));

    // ── Bouncing ball ──
    const ballR     = Math.round(11 * S);
    const ballBaseY = H * 0.26;
    const bounce    = Math.abs(Math.sin(f * 0.07));
    const ballY     = ballBaseY - bounce * ballR * 2.2;
    const sqY = 1 + (1 - bounce) * 0.32;
    const sqX = 1 - (1 - bounce) * 0.20;
    const ballX = cx - Math.round(72 * S);

    ctx.save();
    ctx.translate(ballX, ballY);
    ctx.scale(sqX, sqY);
    ctx.strokeStyle = 'rgba(232,35,26,0.5)';
    ctx.lineWidth   = Math.round(1.5 * S);
    ctx.beginPath(); ctx.arc(0, 0, ballR + Math.round(3*S), 0, Math.PI*2); ctx.stroke();
    const bg = ctx.createRadialGradient(-ballR*0.35,-ballR*0.38, 0.5, 0, 0, ballR);
    bg.addColorStop(0,'#ff7a68'); bg.addColorStop(0.3,'#e8231a');
    bg.addColorStop(0.7,'#9a0f08'); bg.addColorStop(1,'#3d0403');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(0,0,ballR,0,Math.PI*2); ctx.fill();
    const spec = ctx.createRadialGradient(-ballR*0.32,-ballR*0.36,0,-ballR*0.32,-ballR*0.36,ballR*0.52);
    spec.addColorStop(0,'rgba(255,255,255,0.92)'); spec.addColorStop(0.45,'rgba(255,255,255,0.28)'); spec.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = spec; ctx.beginPath(); ctx.arc(0,0,ballR,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(ballR*0.28,ballR*0.3,ballR*0.2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(0,0,0,${0.10+bounce*0.18})`;
    ctx.beginPath(); ctx.ellipse(ballX, ballBaseY+ballR+2, ballR*(0.5+bounce*0.8), Math.round(3*S), 0, 0, Math.PI*2); ctx.fill();

    // ── Title ──
    const titleX    = cx + Math.round(14 * S);
    const titleY    = H * 0.22;
    const titleSize = Math.round(22 * S);
    ctx.font      = `bold ${titleSize}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2a0000';
    ctx.fillText('BOUNCE', titleX + 2, titleY + 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BOUNCE', titleX, titleY);
    const tw = ctx.measureText('BOUNCE').width;
    ctx.fillStyle = '#e8231a';
    ctx.fillRect(titleX - tw/2, titleY + Math.round(5*S), tw, Math.max(2, Math.round(2.5*S)));

    ctx.font      = `${Math.round(8*S)}px "Courier New"`;
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillText('A Nokia-inspired platformer', titleX, titleY + titleSize*0.70);

    ctx.font      = `bold ${Math.round(7*S)}px "Courier New"`;
    ctx.fillStyle = '#e8231a';
    ctx.fillText('by ARITRA BAKSHI', titleX, titleY + titleSize + Math.round(4*S));

    // ── Menu options ──
    const opts       = this._mainOptions();
    const menuStartY = H * 0.52;           // start just after divider
    const lineH      = Math.round(16 * S); // tighter rows — fits 6 items
    const btnW       = Math.round(190 * S);
    const btnH       = Math.round(15 * S);

    opts.forEach((opt, i) => {
      const oy  = menuStartY + i * lineH + lineH * 0.75;
      const sel = i === this._cursor.main;
      if (sel) {
        ctx.fillStyle   = 'rgba(232,35,26,0.22)';
        ctx.fillRect(cx - btnW/2, oy - btnH*0.82, btnW, btnH);
        ctx.strokeStyle = '#e8231a';
        ctx.lineWidth   = Math.max(1, Math.round(1.2*S));
        ctx.strokeRect(cx - btnW/2, oy - btnH*0.82, btnW, btnH);
        ctx.font      = `bold ${Math.round(9*S)}px "Courier New"`;
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.font      = `${Math.round(8.5*S)}px "Courier New"`;
        ctx.fillStyle = 'rgba(255,255,255,0.50)';
      }
      ctx.textAlign = 'center';
      ctx.fillText((sel ? '\u25b6 ' : '') + opt.label, cx, oy);
    });

    if (bestScore > 0) {
      const scoreY = menuStartY + opts.length * lineH + Math.round(10*S);
      ctx.fillStyle = 'rgba(255,215,0,0.85)';
      ctx.font      = `bold ${Math.round(8*S)}px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.fillText('\u25c6 BEST: ' + Helpers.formatScore(bestScore), cx, scoreY);
    }

    // Bottom bar
    const barH = Math.round(14 * S);
    ctx.fillStyle = 'rgba(232,35,26,0.2)';
    ctx.fillRect(0, H - barH, W, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font      = `${Math.round(7*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillText('\u2191\u2193 NAVIGATE   SPACE SELECT   ESC PAUSE', cx, H - Math.round(3*S));
  }


  _drawPause(ctx, data = {}) {
    const W = this.w, H = this.h, S = H / 270;
    ctx.fillStyle = 'rgba(5,5,15,0.88)';
    ctx.fillRect(0, 0, W, H);

    const pw = Math.min(Math.round(240*S), W * 0.88);
    const ph = Math.min(Math.round(230*S), H * 0.92);
    const px = (W - pw) / 2, py = (H - ph) / 2;
    this._panel(ctx, px, py, pw, ph);

    // Header
    const hdrH = Math.round(22*S);
    ctx.fillStyle = '#e8231a';
    ctx.fillRect(px, py, pw, hdrH);
    ctx.font      = `bold ${Math.round(10*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('PAUSED', W / 2, py + hdrH * 0.76);

    // Nav options (rows 0-2)
    const cursor  = this._cursor.pause;
    const rowH    = Math.round(17*S);
    const opts    = ['RESUME', 'RESTART', 'MAIN MENU'];
    opts.forEach((o, i) => {
      const oy  = py + hdrH + Math.round(4*S) + i * rowH + rowH * 0.78;
      const sel = i === cursor;
      if (sel) {
        ctx.fillStyle   = 'rgba(232,35,26,0.22)';
        ctx.fillRect(px + Math.round(8*S), oy - rowH*0.75, pw - Math.round(16*S), rowH*0.9);
        ctx.strokeStyle = '#e8231a';
        ctx.lineWidth   = 1;
        ctx.strokeRect(px + Math.round(8*S), oy - rowH*0.75, pw - Math.round(16*S), rowH*0.9);
        ctx.font      = `bold ${Math.round(9*S)}px "Courier New"`;
        ctx.fillStyle = '#fff';
      } else {
        ctx.font      = `${Math.round(8*S)}px "Courier New"`;
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
      }
      ctx.textAlign = 'center';
      ctx.fillText((sel ? '\u25b6 ' : '') + o, W / 2, oy);
    });

    // Divider
    const divY = py + hdrH + opts.length * rowH + Math.round(8*S);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(px + Math.round(8*S), divY, pw - Math.round(16*S), 1);

    // Audio section label
    ctx.font      = `${Math.round(6*S)}px "Courier New"`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('AUDIO SETTINGS', px + Math.round(12*S), divY + Math.round(10*S));

    // Volume sliders (rows 3=bgVol, 4=sfxVol)
    const sliders = [
      { label: 'MUSIC VOL', vol: this._bgVol,  row: 3 },
      { label: 'SFX VOL',   vol: this._sfxVol, row: 4 },
    ];
    const bx   = px + Math.round(12*S);
    const bw   = pw - Math.round(24*S);
    const barW = bw - Math.round(48*S);
    const sliderStartY = divY + Math.round(14*S);
    const sliderRowH   = Math.round(32*S);

    sliders.forEach((s, i) => {
      const sy     = sliderStartY + i * sliderRowH;
      const vol    = this._muted ? 0 : s.vol;
      const selRow = cursor === s.row;

      if (selRow) {
        ctx.fillStyle   = 'rgba(232,35,26,0.14)';
        ctx.fillRect(px + Math.round(6*S), sy - Math.round(2*S), pw - Math.round(12*S), Math.round(28*S));
        ctx.strokeStyle = 'rgba(232,35,26,0.5)';
        ctx.lineWidth   = 1;
        ctx.strokeRect(px + Math.round(6*S), sy - Math.round(2*S), pw - Math.round(12*S), Math.round(28*S));
      }

      ctx.font      = selRow ? `bold ${Math.round(7*S)}px "Courier New"` : `${Math.round(7*S)}px "Courier New"`;
      ctx.textAlign = 'left';
      ctx.fillStyle = selRow ? '#fff' : 'rgba(255,255,255,0.6)';
      ctx.fillText((selRow ? '\u25b6 ' : '  ') + s.label, bx, sy + Math.round(7*S));

      // Track
      const trackY = sy + Math.round(12*S);
      ctx.fillStyle   = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, trackY, barW, Math.round(6*S));
      ctx.strokeStyle = selRow ? 'rgba(232,35,26,0.5)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth   = 0.8;
      ctx.strokeRect(bx, trackY, barW, Math.round(6*S));

      const fillW = Math.max(0, barW * vol);
      if (fillW > 0) {
        const fg = ctx.createLinearGradient(bx, 0, bx + barW, 0);
        fg.addColorStop(0,'#e8231a'); fg.addColorStop(0.5,'#ff6644'); fg.addColorStop(1,'#ffaa44');
        ctx.fillStyle = fg;
        ctx.fillRect(bx, trackY, fillW, Math.round(6*S));
      }

      const kR = Math.round(4*S);
      ctx.fillStyle   = selRow ? '#fff' : 'rgba(255,255,255,0.7)';
      ctx.strokeStyle = selRow ? '#e8231a' : '#555';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(bx + fillW, trackY + Math.round(3*S), kR, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillStyle = selRow ? 'rgba(255,220,100,0.9)' : 'rgba(255,255,255,0.45)';
      ctx.font      = `${Math.round(6*S)}px "Courier New"`;
      ctx.fillText(Math.round(vol * 100) + '%', bx + bw, trackY + Math.round(8*S));

      if (selRow) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,200,100,0.5)';
        ctx.font      = `${Math.round(5.5*S)}px "Courier New"`;
        ctx.fillText('\u2190 \u2192 to adjust', bx, sy + Math.round(26*S));
      }
    });

    // Mute + footer
    const muteY = py + ph - Math.round(20*S);
    ctx.fillStyle = this._muted ? '#ff5544' : 'rgba(255,255,255,0.3)';
    ctx.font      = `${Math.round(7*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillText(this._muted ? '[M] MUTED \u2014 M to unmute' : '[M] M key = toggle mute', W/2, muteY);

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font      = `${Math.round(5.5*S)}px "Courier New"`;
    ctx.fillText('\u2191\u2193 SELECT  \u2190\u2192 VOL  SPACE CONFIRM  ESC RESUME', W/2, py + ph - Math.round(6*S));
  }


  _drawGameOver(ctx, { score = 0, level = 1 } = {}) {
    const W = this.w, H = this.h, S = H / 270;
    ctx.fillStyle = '#08000a';
    ctx.fillRect(0, 0, W, H);

    const hdrH = Math.round(22*S);
    ctx.fillStyle = '#e8231a';
    ctx.fillRect(0, 0, W, hdrH);
    ctx.font      = `bold ${Math.round(11*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('GAME OVER', W / 2, hdrH * 0.76);

    const py = H * 0.28;
    const panelH = Math.round(58*S);
    const marginX = Math.round(20*S);
    ctx.fillStyle   = 'rgba(255,255,255,0.05)';
    ctx.fillRect(marginX, py, W - marginX*2, panelH);
    ctx.strokeStyle = 'rgba(232,35,26,0.35)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(marginX, py, W - marginX*2, panelH);

    ctx.font      = `bold ${Math.round(10*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('SCORE: ' + Helpers.formatScore(score), W/2, py + Math.round(18*S));
    ctx.font      = `${Math.round(9*S)}px "Courier New"`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('REACHED LEVEL ' + level, W/2, py + Math.round(34*S));
    ctx.font      = `${Math.round(8*S)}px "Courier New"`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('LEVELS UNLOCKED UP TO: ' + level, W/2, py + Math.round(50*S));

    const opts    = ['RETRY THIS LEVEL', 'MAIN MENU'];
    const cursor  = this._cursor.gameover || 0;
    const baseY   = H * 0.67;
    const optRowH = Math.round(24*S);
    const optBtnW = Math.round(200*S);

    opts.forEach((o, i) => {
      const oy  = baseY + i * optRowH;
      const sel = i === cursor;
      if (sel) {
        ctx.fillStyle   = 'rgba(232,35,26,0.22)';
        ctx.fillRect(W/2 - optBtnW/2, oy - optRowH*0.7, optBtnW, optRowH*0.88);
        ctx.strokeStyle = '#e8231a';
        ctx.lineWidth   = 1;
        ctx.strokeRect(W/2 - optBtnW/2, oy - optRowH*0.7, optBtnW, optRowH*0.88);
        ctx.fillStyle   = '#ffffff';
        ctx.font        = `bold ${Math.round(10*S)}px "Courier New"`;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font      = `${Math.round(9*S)}px "Courier New"`;
      }
      ctx.textAlign = 'center';
      ctx.fillText((sel ? '\u25b6 ' : '') + o, W/2, oy);
    });

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font      = `${Math.round(7*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillText('\u2191\u2193 NAVIGATE   SPACE SELECT', W/2, H - Math.round(8*S));
  }


  _drawVictory(ctx, { score = 0, time = 0, gems = 0, totalGems = 0, level = 1 } = {}) {
    const W = this.w, H = this.h, S = H / 270;
    ctx.fillStyle = 'rgba(0,5,0,0.92)';
    ctx.fillRect(0, 0, W, H);

    // Celebration particles
    for (let i = 0; i < 8; i++) {
      const t  = this._frame * 0.04 + i * 0.78;
      const bx = Math.sin(t) * W * 0.4 + W / 2;
      const by = Math.cos(t * 1.3) * H * 0.35 + H / 2;
      const r  = Math.abs(Math.sin(this._frame * 0.1 + i)) * Math.round(5*S) + Math.round(2*S);
      ctx.fillStyle = `hsl(${(this._frame * 3 + i * 45) % 360},100%,65%)`;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.fill();
    }

    // Header
    const hdrH = Math.round(22*S);
    ctx.fillStyle = '#44ff88';
    ctx.fillRect(0, 0, W, hdrH);
    ctx.font      = `bold ${Math.round(11*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText('LEVEL CLEAR!', W/2, hdrH * 0.77);

    // Stars
    const gemPct = totalGems > 0 ? gems / totalGems : 1;
    const stars  = gemPct >= 1.0 ? 3 : gemPct >= 0.8 ? 2 : 1;
    const starY  = H * 0.30;
    const starSpacing = Math.round(30*S);
    for (let s = 0; s < 3; s++) {
      const filled = s < stars;
      const sx     = W/2 + (s - 1) * starSpacing;
      const pulse  = filled ? Math.sin(this._frame * 0.12 + s) * 0.15 + 0.9 : 1;
      ctx.save();
      ctx.translate(sx, starY);
      ctx.scale(pulse, pulse);
      ctx.font      = `${Math.round(22*S)}px sans-serif`;
      ctx.fillStyle = filled ? '#ffd700' : 'rgba(255,255,255,0.15)';
      if (filled) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = Math.round(10*S) * pulse; }
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.fillText('\u2605', 0, 0);
      ctx.shadowBlur  = 0;
      ctx.textBaseline= 'alphabetic';
      ctx.restore();
    }

    // Rating label
    const ratingLabel = ['','\u2605 CLEARED','\u2605\u2605 GREAT RUN','\u2605\u2605\u2605 PERFECT!'][stars] || '';
    ctx.font      = `bold ${Math.round(9*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = ['','#aaaaaa','#88ff44','#ffd700'][stars];
    ctx.fillText(ratingLabel, W/2, starY + Math.round(20*S));

    // Stats panel
    const py     = H * 0.46;
    const panelH = Math.round(58*S);
    const mrgX   = Math.round(20*S);
    ctx.fillStyle   = 'rgba(0,0,0,0.45)';
    ctx.fillRect(mrgX, py, W - mrgX*2, panelH);
    ctx.strokeStyle = 'rgba(68,255,136,0.3)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(mrgX, py, W - mrgX*2, panelH);

    ctx.font      = `bold ${Math.round(10*S)}px "Courier New"`;
    ctx.fillStyle = '#ffd700';
    ctx.fillText('SCORE: ' + Helpers.formatScore(score), W/2, py + Math.round(16*S));
    ctx.font      = `${Math.round(9*S)}px "Courier New"`;
    ctx.fillStyle = gems >= totalGems ? '#44ff88' : '#fff';
    ctx.fillText('\u25c6 GEMS: ' + gems + '/' + totalGems + (gems >= totalGems ? '  \u2713' : ''), W/2, py + Math.round(32*S));
    ctx.fillStyle = 'rgba(200,220,255,0.75)';
    ctx.fillText('\u23f1 TIME: ' + Helpers.formatTime(Math.floor(time / 60)), W/2, py + Math.round(48*S));

    // Continue prompt
    const flash = Math.floor(this._frame / 22) % 2 === 0;
    ctx.fillStyle = flash ? '#44ff88' : 'rgba(68,255,136,0.45)';
    ctx.font      = `bold ${Math.round(9*S)}px "Courier New"`;
    ctx.fillText(level < 5 ? 'SPACE \u2014 NEXT LEVEL' : 'SPACE \u2014 BACK TO MENU', W/2, H * 0.88);
  }


  _drawScores(ctx, { score = 0 } = {}) {
    const W = this.w, H = this.h, S = H / 270;
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);

    const hdrH = Math.round(22*S);
    ctx.fillStyle = '#e8231a';
    ctx.fillRect(0, 0, W, hdrH);
    ctx.font      = `bold ${Math.round(10*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('HIGH SCORES', W/2, hdrH * 0.77);

    const hs     = this._savedProgress.highScores || {};
    const themes = ['GREEN HILLS','DARK CAVE','IRON WORKS','MAGMA CORE','SKY KINGDOM'];
    const cols   = ['#44ff88','#9944ff','#aabbcc','#ff6600','#44aaff'];
    const mrgX   = Math.round(10*S);
    const rowH   = Math.round(36*S);
    const rowPad = Math.round(5*S);

    themes.forEach((name, i) => {
      const key  = 'level' + (i + 1);
      const sc   = hs[key] || null;
      const y    = hdrH + Math.round(8*S) + i * (rowH + rowPad);
      const col  = cols[i];
      const stars = this.getStars(i + 1);

      ctx.fillStyle   = col + '22';
      ctx.fillRect(mrgX, y, W - mrgX*2, rowH);
      ctx.strokeStyle = col + '66';
      ctx.lineWidth   = 1;
      ctx.strokeRect(mrgX, y, W - mrgX*2, rowH);

      // Badge
      ctx.fillStyle = col;
      ctx.fillRect(mrgX + Math.round(4*S), y + Math.round(4*S), Math.round(26*S), rowH - Math.round(8*S));
      ctx.font      = `bold ${Math.round(10*S)}px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(i + 1, mrgX + Math.round(17*S), y + rowH * 0.65);

      // Name
      ctx.font      = `bold ${Math.round(9*S)}px "Courier New"`;
      ctx.textAlign = 'left';
      ctx.fillStyle = col;
      ctx.fillText(name, mrgX + Math.round(36*S), y + Math.round(16*S));

      // Stars
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < stars ? '#ffd700' : 'rgba(255,255,255,0.15)';
        ctx.font      = `${Math.round(9*S)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText('\u2605', mrgX + Math.round(36*S) + s * Math.round(12*S), y + Math.round(30*S));
      }

      // Score
      ctx.textAlign = 'right';
      if (sc) {
        ctx.fillStyle = '#ffd700';
        ctx.font      = `bold ${Math.round(9*S)}px "Courier New"`;
        ctx.fillText(Helpers.formatScore(sc), W - mrgX - Math.round(8*S), y + rowH * 0.65);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font      = `${Math.round(9*S)}px "Courier New"`;
        ctx.fillText('---', W - mrgX - Math.round(8*S), y + rowH * 0.65);
      }
    });

    const flash = Math.floor(this._frame / 22) % 2 === 0;
    ctx.font      = `${Math.round(8*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = flash ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)';
    ctx.fillText('SPACE / ESC TO GO BACK', W/2, H - Math.round(8*S));
  }


  _drawLevelSelect(ctx, data = {}) {
    const unlockedLevels = data.unlockedLevels || this._savedProgress.unlockedLevels || [1];
    const W = this.w, H = this.h, S = H / 270;
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);

    const hdrH = Math.round(22*S);
    ctx.fillStyle = '#e8231a';
    ctx.fillRect(0, 0, W, hdrH);
    ctx.font      = `bold ${Math.round(10*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('SELECT LEVEL', W/2, hdrH * 0.77);

    const themes = ['GREEN HILLS','DARK CAVE','IRON WORKS','MAGMA CORE','SKY KINGDOM'];
    const cols   = ['#44ff88','#9944ff','#aabbcc','#ff6600','#44aaff'];
    const hs     = this._savedProgress.highScores || {};
    const mrgX   = Math.round(8*S);
    const rowH   = Math.round(38*S);
    const rowGap = Math.round(4*S);

    for (let i = 0; i < 5; i++) {
      const locked = !unlockedLevels.includes(i + 1);
      const y      = hdrH + Math.round(6*S) + i * (rowH + rowGap);
      const sel    = this._cursor.levelSelect === i;
      const col    = cols[i];
      const sc     = hs['level' + (i+1)];
      const stars  = this.getStars(i + 1);
      const medals = this.getMedals(i + 1);

      // Row bg
      ctx.fillStyle   = sel ? col + '22' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(mrgX, y, W - mrgX*2, rowH);
      ctx.strokeStyle = sel ? col : (locked ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.12)');
      ctx.lineWidth   = sel ? 1.5 : 0.5;
      ctx.strokeRect(mrgX, y, W - mrgX*2, rowH);

      // Level badge
      const badgeW = Math.round(26*S), badgePad = Math.round(5*S);
      ctx.fillStyle = locked ? '#222' : col;
      ctx.fillRect(mrgX + badgePad, y + badgePad, badgeW, rowH - badgePad*2);
      ctx.font      = `bold ${Math.round(10*S)}px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.fillStyle = locked ? '#444' : '#000';
      ctx.fillText(i + 1, mrgX + badgePad + badgeW/2, y + rowH * 0.66);

      // Name
      const nameX = mrgX + badgePad + badgeW + Math.round(8*S);
      ctx.font      = sel ? `bold ${Math.round(9*S)}px "Courier New"` : `${Math.round(9*S)}px "Courier New"`;
      ctx.textAlign = 'left';
      ctx.fillStyle = locked ? '#555' : (sel ? col : 'rgba(255,255,255,0.85)');
      ctx.fillText(locked ? '\u2753\u2753\u2753 LOCKED' : themes[i], nameX, y + Math.round(15*S));

      // Stars row
      if (!locked && stars > 0) {
        for (let s = 0; s < 3; s++) {
          ctx.fillStyle = s < stars ? '#ffd700' : 'rgba(255,255,255,0.12)';
          ctx.font      = `${Math.round(8*S)}px sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText('\u2605', nameX + s * Math.round(11*S), y + Math.round(30*S));
        }
      }

      // Medal chips
      if (!locked) {
        let mOff = nameX + Math.round(42*S);
        const mFont = `${Math.round(6.5*S)}px "Courier New"`;
        if (medals.speed)         { ctx.fillStyle='#ffdd44'; ctx.font=mFont; ctx.textAlign='left'; ctx.fillText('\u26a1SPD', mOff, y+Math.round(30*S)); mOff+=Math.round(28*S); }
        if (medals.pacifist)      { ctx.fillStyle='#88ff88'; ctx.font=mFont; ctx.textAlign='left'; ctx.fillText('\u262ePAC', mOff, y+Math.round(30*S)); mOff+=Math.round(28*S); }
        if (medals.perfectionist) { ctx.fillStyle='#ff88ff'; ctx.font=mFont; ctx.textAlign='left'; ctx.fillText('\u25c6PRF', mOff, y+Math.round(30*S)); }
      }

      // Score top-right
      if (sc && !locked) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffd700';
        ctx.font      = `${Math.round(8*S)}px "Courier New"`;
        ctx.fillText('\u25c6 ' + Helpers.formatScore(sc), W - mrgX - Math.round(6*S), y + Math.round(15*S));
      }

      // Hint on selected row
      if (sel) {
        ctx.textAlign = 'right';
        ctx.font      = `${Math.round(7*S)}px "Courier New"`;
        ctx.fillStyle = locked ? 'rgba(255,80,80,0.8)' : 'rgba(255,255,255,0.4)';
        ctx.fillText(locked ? 'FINISH PREV LEVEL FIRST' : 'SPACE TO PLAY', W - mrgX - Math.round(6*S), y + Math.round(30*S));
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font      = `${Math.round(8*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillText('\u2191\u2193 SELECT   SPACE PLAY   ESC BACK', W/2, H - Math.round(8*S));
  }


  _drawAchievements(ctx, data = {}) {
    const W = this.w, H = this.h, S = H / 270;
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);

    const hdrH = Math.round(22 * S);
    ctx.fillStyle = '#e8231a';
    ctx.fillRect(0, 0, W, hdrH);
    ctx.font      = `bold ${Math.round(10*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('ACHIEVEMENTS', W / 2, hdrH * 0.77);

    const levelNames = ['GREEN HILLS','DARK CAVE','IRON WORKS','MAGMA CORE','SKY KINGDOM'];
    const levelCols  = ['#44ff88','#9944ff','#aabbcc','#ff6600','#44aaff'];
    const medalDefs  = [
      { key:'speed',         icon:'\u26a1', label:'SPEED RUN',     desc:'Under 30s',     col:'#ffdd44' },
      { key:'pacifist',      icon:'\u262e', label:'PACIFIST',      desc:'No kills',      col:'#88ff88' },
      { key:'perfectionist', icon:'\u25c6', label:'PERFECTIONIST', desc:'All gems',       col:'#ff88ff' },
    ];

    // Layout constants
    const mrgX    = Math.round(10*S);
    const leftW   = Math.round(90*S);   // level label column width
    const colW    = (W - mrgX*2 - leftW) / 3;  // width of each medal column
    const rowH    = Math.round(38*S);
    const iconR   = Math.round(13*S);   // icon circle radius
    const startY  = hdrH + Math.round(6*S);

    // Column headers
    const headerY = startY + Math.round(14*S);
    medalDefs.forEach((m, mi) => {
      const cx2 = mrgX + leftW + mi * colW + colW / 2;
      ctx.font      = `bold ${Math.round(7.5*S)}px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.fillStyle = m.col;
      ctx.fillText(m.icon + ' ' + m.label, cx2, headerY);
    });

    // Level rows
    for (let li = 0; li < 5; li++) {
      const ry  = startY + Math.round(20*S) + li * (rowH + Math.round(3*S));
      const col = levelCols[li];
      const lm  = this.getMedals(li + 1);
      const stars = this.getStars(li + 1);

      // Row bg
      ctx.fillStyle   = 'rgba(255,255,255,0.03)';
      ctx.fillRect(mrgX, ry, W - mrgX*2, rowH);
      ctx.strokeStyle = col + '44';
      ctx.lineWidth   = 0.8;
      ctx.strokeRect(mrgX, ry, W - mrgX*2, rowH);

      // Level name + stars
      ctx.font      = `bold ${Math.round(8*S)}px "Courier New"`;
      ctx.textAlign = 'left';
      ctx.fillStyle = col;
      ctx.fillText('LV' + (li+1), mrgX + Math.round(4*S), ry + Math.round(14*S));
      ctx.font      = `${Math.round(6.5*S)}px "Courier New"`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(levelNames[li], mrgX + Math.round(4*S), ry + Math.round(24*S));
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < stars ? '#ffd700' : 'rgba(255,255,255,0.1)';
        ctx.font      = `${Math.round(7*S)}px sans-serif`;
        ctx.fillText('\u2605', mrgX + Math.round(4*S) + s * Math.round(10*S), ry + Math.round(35*S));
      }

      // Medal cells
      medalDefs.forEach((m, mi) => {
        const cx2 = mrgX + leftW + mi * colW + colW / 2;
        const got = lm[m.key];

        ctx.fillStyle   = got ? m.col + '22' : 'rgba(255,255,255,0.02)';
        ctx.fillRect(mrgX + leftW + mi * colW + Math.round(3*S), ry + Math.round(3*S),
                     colW - Math.round(6*S), rowH - Math.round(6*S));
        ctx.strokeStyle = got ? m.col + '77' : 'rgba(255,255,255,0.06)';
        ctx.lineWidth   = 0.8;
        ctx.strokeRect(mrgX + leftW + mi * colW + Math.round(3*S), ry + Math.round(3*S),
                       colW - Math.round(6*S), rowH - Math.round(6*S));

        if (got) {
          // Earned: big icon + label
          ctx.fillStyle   = m.col;
          ctx.shadowColor = m.col;
          ctx.shadowBlur  = Math.round(8*S);
          ctx.font        = `${Math.round(iconR * 1.6)}px sans-serif`;
          ctx.textAlign   = 'center';
          ctx.textBaseline= 'middle';
          ctx.fillText(m.icon, cx2, ry + rowH * 0.45);
          ctx.shadowBlur  = 0;
          ctx.textBaseline= 'alphabetic';
          ctx.font        = `${Math.round(6*S)}px "Courier New"`;
          ctx.fillStyle   = 'rgba(255,255,255,0.65)';
          ctx.fillText(m.label, cx2, ry + rowH * 0.85);
        } else {
          ctx.font        = `${Math.round(10*S)}px sans-serif`;
          ctx.textAlign   = 'center';
          ctx.textBaseline= 'middle';
          ctx.fillStyle   = 'rgba(255,255,255,0.1)';
          ctx.fillText('\u2014', cx2, ry + rowH * 0.45);
          ctx.textBaseline= 'alphabetic';
          ctx.font        = `${Math.round(5.5*S)}px "Courier New"`;
          ctx.fillStyle   = 'rgba(255,255,255,0.18)';
          ctx.fillText(m.desc, cx2, ry + rowH * 0.85);
        }
      });
    }

    // Progress bar
    let total = 0, earned = 0;
    for (let li = 1; li <= 5; li++) {
      const lm = this.getMedals(li);
      total  += 3;
      earned += (lm.speed?1:0) + (lm.pacifist?1:0) + (lm.perfectionist?1:0);
    }
    const barY  = H - Math.round(22*S);
    const barX  = mrgX, barTW = W - mrgX*2;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(barX, barY, barTW, Math.round(12*S));
    ctx.fillStyle = '#e8231a';
    ctx.fillRect(barX, barY, barTW * (earned / Math.max(1, total)), Math.round(12*S));
    ctx.font      = `bold ${Math.round(7*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(earned + ' / ' + total + ' MEDALS   \u2022   SPACE / ESC TO GO BACK', W/2, barY + Math.round(9*S));
  }


  _drawGuide(ctx) {
    const W = this.w, H = this.h, S = H / 270;
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);

    const hdrH = Math.round(22 * S);
    ctx.fillStyle = '#e8231a';
    ctx.fillRect(0, 0, W, hdrH);
    ctx.font      = `bold ${Math.round(10*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('FIELD GUIDE', W / 2, hdrH * 0.77);

    // Footer (drawn before clip so it's always visible)
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font      = `${Math.round(7*S)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillText('AUTO-SCROLL   \u2022   SPACE / ESC TO GO BACK', W/2, H - Math.round(5*S));

    const f   = this._frame;

    // Layout
    const ICON_R   = Math.round(18 * S);   // icon draw radius
    const ICON_BOX = ICON_R * 2 + Math.round(8*S); // horizontal space for icon
    const ENTRY_H  = Math.round(52 * S);   // fixed height per entry (no overlap)
    const SEC_H    = Math.round(20 * S);   // section header height
    const PAD_X    = Math.round(16 * S);
    const TEXT_X   = PAD_X + ICON_BOX + Math.round(8*S);
    const TEXT_W   = W - TEXT_X - PAD_X;

    // Total scrollable content height
    const sections = [
      { label: '\u26a0 OBSTACLES', col: '#883322', count: 4 },
      { label: '\ud83d\udc7e ENEMIES',   col: '#553311', count: 4 },
      { label: '\ud83d\udc8e COLLECTIBLES', col:'#334422',count:2 },
      { label: '\u26a1 POWERUPS',  col: '#223344', count: 6 },
      { label: '\ud83d\udea9 CHECKPOINTS & EXIT', col:'#332244',count:2 },
    ];
    const totalContent = sections.reduce((a,s) => a + SEC_H + s.count * ENTRY_H, 0) + Math.round(20*S);
    const viewH    = H - hdrH - Math.round(16*S);
    const scrollMax = Math.max(0, totalContent - viewH);
    // Smooth auto-scroll: sine wave 0→1→0 over ~12 seconds
    const scroll = Math.floor(
      (Math.sin(f * 0.004) * 0.5 + 0.5) * scrollMax
    );

    // Clip to content area
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hdrH, W, H - hdrH - Math.round(14*S));
    ctx.clip();
    ctx.translate(0, hdrH - scroll);

    // Scroll indicator bar (right edge)
    if (scrollMax > 0) {
      const frac  = scroll / scrollMax;
      const indH  = Math.round(Math.max(20, viewH * viewH / totalContent));
      const indY  = frac * (viewH - indH);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(W - Math.round(4*S), scroll, Math.round(4*S), viewH); // track (in scroll coords)
      ctx.fillStyle = '#e8231a';
      ctx.fillRect(W - Math.round(4*S), scroll + indY, Math.round(4*S), indH);
    }

    let cy = Math.round(8*S);

    // ── Section helper ──────────────────────────────────────
    const drawSection = (label, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(PAD_X, cy, W - PAD_X*2, SEC_H);
      ctx.font      = `bold ${Math.round(8.5*S)}px "Courier New"`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, PAD_X + Math.round(8*S), cy + SEC_H * 0.72);
      cy += SEC_H + Math.round(4*S);
    };

    // ── Entry helper ─────────────────────────────────────────
    const drawEntry = (drawFn, title, desc) => {
      const ey = cy;

      // Row bg
      ctx.fillStyle   = 'rgba(255,255,255,0.03)';
      ctx.fillRect(PAD_X, ey, W - PAD_X*2, ENTRY_H - Math.round(3*S));
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(PAD_X, ey, W - PAD_X*2, ENTRY_H - Math.round(3*S));

      // Icon (clipped to its box)
      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD_X, ey, ICON_BOX, ENTRY_H - Math.round(3*S));
      ctx.clip();
      ctx.translate(PAD_X + ICON_BOX/2, ey + (ENTRY_H - Math.round(3*S))/2);
      drawFn(ctx, f);
      ctx.restore();

      // Vertical icon/text divider
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_X + ICON_BOX, ey + Math.round(4*S));
      ctx.lineTo(PAD_X + ICON_BOX, ey + ENTRY_H - Math.round(6*S));
      ctx.stroke();

      // Title
      ctx.font        = `bold ${Math.round(8.5*S)}px "Courier New"`;
      ctx.textAlign   = 'left';
      ctx.fillStyle   = '#ffffff';
      ctx.fillText(title, TEXT_X, ey + Math.round(14*S));

      // Description — word-wrap to fixed width, max 2 lines
      const maxChars  = Math.floor(TEXT_W / (Math.round(6.5*S) * 0.62));
      ctx.font        = `${Math.round(7*S)}px "Courier New"`;
      ctx.fillStyle   = 'rgba(255,255,255,0.72)';
      const words     = desc.split(' ');
      let line = '', ly = ey + Math.round(26*S);
      for (const word of words) {
        const test = line + word + ' ';
        if (test.length > maxChars && line.length > 0) {
          ctx.fillText(line.trim(), TEXT_X, ly);
          ly += Math.round(11*S);
          line = word + ' ';
          if (ly > ey + ENTRY_H - Math.round(6*S)) break; // safety: no more than fits
        } else {
          line = test;
        }
      }
      if (line.trim() && ly <= ey + ENTRY_H - Math.round(6*S)) {
        ctx.fillText(line.trim(), TEXT_X, ly);
      }

      cy += ENTRY_H;
    };

    // ══════════════════════ CONTENT ══════════════════════════

    // OBSTACLES
    drawSection('\u26a0 OBSTACLES', '#5a1a08');
    drawEntry((c,f2)=>{
      c.fillStyle='#556677';c.fillRect(-14,6,28,6);
      c.fillStyle='#778899';
      c.beginPath();c.moveTo(-12,12);c.lineTo(0,-16);c.lineTo(12,12);c.closePath();c.fill();
      c.fillStyle='rgba(255,255,255,0.55)';
      c.beginPath();c.moveTo(-10,12);c.lineTo(-4,0);c.lineTo(0,-16);c.closePath();c.fill();
    }, 'SPIKE', 'Loses half a heart on contact. Jump carefully over them — gaps between spikes are always passable!');

    drawEntry((c,f2)=>{
      c.fillStyle='#440800';c.fillRect(-ICON_R,-ICON_R*0.3,ICON_R*2,ICON_R*1.3);
      const surf=c.createLinearGradient(0,-ICON_R*0.3,0,ICON_R*0.5);
      surf.addColorStop(0,'#ff8800');surf.addColorStop(1,'#cc2200');
      c.fillStyle=surf;
      c.beginPath();c.moveTo(-ICON_R,ICON_R*0.5);
      for(let x2=-ICON_R;x2<=ICON_R;x2+=3){
        c.lineTo(x2,-ICON_R*0.2+Math.sin((x2+f2*1.5)*0.35)*ICON_R*0.22);
      }
      c.lineTo(ICON_R,ICON_R*0.5);c.closePath();c.fill();
      c.fillStyle='rgba(255,180,0,0.6)';c.fillRect(-ICON_R,-ICON_R*0.3,ICON_R*2,ICON_R*0.18);
    }, 'LAVA', 'Loses a FULL heart instantly. Never fall in — there is no recovery from lava pits!');

    drawEntry((c,f2)=>{
      const hue=180+Math.sin(f2*0.1)*20;
      c.fillStyle='#1a2a33';c.fillRect(-ICON_R,-ICON_R,ICON_R*2,ICON_R*2);
      c.strokeStyle=`hsl(${hue},100%,65%)`;c.lineWidth=2;c.shadowColor='#00eeff';c.shadowBlur=10;
      c.beginPath();c.moveTo(0,-ICON_R+2);
      let ty=-ICON_R+2;
      while(ty<ICON_R-2){ty+=Math.round(5*S);c.lineTo((Math.random()-0.5)*ICON_R,ty);}
      c.stroke();c.shadowBlur=0;
      c.fillStyle=`rgba(0,200,255,0.15)`;c.fillRect(-ICON_R,-ICON_R,ICON_R*2,ICON_R*2);
    }, 'ELECTRIC', 'Pulses on/off. Watch for the OFF state (dim) — that is your safe window to pass through.');

    drawEntry((c,f2)=>{
      c.fillStyle='#4a5f70';c.fillRect(-ICON_R,-ICON_R*0.55,ICON_R*2,ICON_R*1.1);
      c.fillStyle='rgba(255,255,255,0.15)';c.fillRect(-ICON_R,-ICON_R*0.55,ICON_R*2,ICON_R*0.28);
      const sw=Math.round(ICON_R*0.45);
      for(let x2=-ICON_R;x2<ICON_R;x2+=sw*2){c.fillStyle='#ffcc00';c.fillRect(x2,ICON_R*0.28,sw,ICON_R*0.27);}
      for(let x2=-ICON_R+sw;x2<ICON_R;x2+=sw*2){c.fillStyle='#111';c.fillRect(x2,ICON_R*0.28,sw,ICON_R*0.27);}
    }, 'CRUSHER', 'Heavy piston that moves up and down. Time your run — pass underneath during the upswing.');

    // ENEMIES
    drawSection('\ud83d\udc7e ENEMIES', '#3a1a08');
    drawEntry((c,f2)=>{
      c.fillStyle='#cc2200';c.beginPath();c.arc(0,0,ICON_R,0,Math.PI*2);c.fill();
      c.strokeStyle='#ff5500';c.lineWidth=2;
      for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2+f2*0.04;
        c.beginPath();c.moveTo(Math.cos(a)*ICON_R*0.8,Math.sin(a)*ICON_R*0.8);
        c.lineTo(Math.cos(a)*ICON_R*1.35,Math.sin(a)*ICON_R*1.35);c.stroke();}
      c.fillStyle='#fff';c.beginPath();c.arc(-ICON_R*0.28,-ICON_R*0.1,ICON_R*0.2,0,Math.PI*2);c.fill();
      c.beginPath();c.arc(ICON_R*0.28,-ICON_R*0.1,ICON_R*0.2,0,Math.PI*2);c.fill();
    }, 'MINE', 'Patrols back and forth. Chases you when close — spikes rotate faster! Stomp from above to destroy.');

    drawEntry((c,f2)=>{
      c.fillStyle='#2a3f50';c.beginPath();c.ellipse(0,0,ICON_R*1.1,ICON_R*0.6,0,0,Math.PI*2);c.fill();
      const spinA=f2*0.3;
      for(let arm=0;arm<2;arm++){
        c.strokeStyle=`rgba(0,200,255,0.7)`;c.lineWidth=1.5;
        const a=spinA+arm*Math.PI;
        c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*ICON_R*1.1,Math.sin(a)*ICON_R*0.55);c.stroke();
      }
      c.fillStyle='rgba(0,220,255,0.9)';c.beginPath();c.arc(0,ICON_R*0.1,ICON_R*0.28,0,Math.PI*2);c.fill();
    }, 'DRONE', 'Floats and follows you through the air. Level 5 is full of them — use double jump to evade and stomp!');

    drawEntry((c,f2)=>{
      c.fillStyle='#44aa22';c.beginPath();c.arc(0,ICON_R*0.1,ICON_R,0,Math.PI*2);c.fill();
      for(let i=-1;i<=1;i++){c.fillStyle='#33bb11';c.beginPath();
        c.moveTo(i*ICON_R*0.55-ICON_R*0.28,-ICON_R*0.78);
        c.lineTo(i*ICON_R*0.55,-ICON_R*1.5);
        c.lineTo(i*ICON_R*0.55+ICON_R*0.28,-ICON_R*0.78);c.closePath();c.fill();}
      c.fillStyle='#fff';
      c.beginPath();c.arc(-ICON_R*0.28,-ICON_R*0.1,ICON_R*0.22,0,Math.PI*2);c.fill();
      c.beginPath();c.arc(ICON_R*0.28,-ICON_R*0.1,ICON_R*0.22,0,Math.PI*2);c.fill();
    }, 'JUMPER', 'Leaps unpredictably toward you. Time your jump over it or stomp it mid-air to kill it.');

    drawEntry((c,f2)=>{
      for(let i=0;i<3;i++){const sx=(i-1)*ICON_R*0.85;
        c.fillStyle='#885522';c.beginPath();c.arc(sx,Math.sin(f2*0.18+i)*ICON_R*0.18,ICON_R*0.55,0,Math.PI*2);c.fill();
        c.strokeStyle='#ffaa44';c.lineWidth=1.2;c.stroke();}
      c.strokeStyle='#ccaa44';c.lineWidth=1.5;
      c.beginPath();c.moveTo(ICON_R*0.85,-ICON_R*0.28);c.quadraticCurveTo(ICON_R*1.3,-ICON_R*0.65,ICON_R*1.6,-ICON_R*0.42);c.stroke();
    }, 'CRAWLER', 'Slow but steady — patrols platform edges with antennae raised. Jump over or stomp from above.');

    // COLLECTIBLES
    drawSection('\ud83d\udc8e COLLECTIBLES', '#1a3311');
    drawEntry((c,f2)=>{
      c.fillStyle='#3377ff';
      c.beginPath();c.moveTo(0,-ICON_R);c.lineTo(ICON_R*0.7,0);c.lineTo(0,ICON_R*0.75);c.lineTo(-ICON_R*0.7,0);c.closePath();c.fill();
      c.fillStyle='#99bbff';
      c.beginPath();c.moveTo(0,-ICON_R);c.lineTo(ICON_R*0.35,-ICON_R*0.25);c.lineTo(0,-ICON_R*0.1);c.lineTo(-ICON_R*0.35,-ICON_R*0.25);c.closePath();c.fill();
      c.fillStyle='rgba(255,255,255,0.7)';c.beginPath();c.arc(-ICON_R*0.1,-ICON_R*0.55,ICON_R*0.1,0,Math.PI*2);c.fill();
    }, 'GEM', '+10 pts each. Collect 60% of gems to open the exit. Collect 100% for a perfect 3-star rating!');

    drawEntry((c,f2)=>{
      const spin=Math.abs(Math.cos(f2*0.06));
      c.fillStyle='#c8880a';c.beginPath();c.ellipse(0,0,spin*ICON_R+2,ICON_R,0,0,Math.PI*2);c.fill();
      if(spin>0.2){c.fillStyle='#ffd700';c.beginPath();c.ellipse(0,0,spin*ICON_R*0.85,ICON_R*0.9,0,0,Math.PI*2);c.fill();}
      if(spin>0.5){ctx.font=`bold ${Math.round(7*S)}px "Courier New"`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(150,90,0,0.7)';ctx.fillText('$',0,0);ctx.textBaseline='alphabetic';}
    }, 'COIN', '+5 pts each. Scattered as bonus pickups along the route — grab them for a higher score!');

    // POWERUPS
    drawSection('\u26a1 POWERUPS', '#112233');
    const puCFG = [
      {sym:'SH',col:'#4488ff',bg:'#001a44',label:'SHIELD',    desc:'Absorbs the next hit completely. Your lifesaver in tight spots!'},
      {sym:'SP',col:'#ffaa00',bg:'#442200',label:'SPEED',     desc:'Move 1.6\u00d7 faster for 5 seconds. Perfect for speed run medals.'},
      {sym:'2J',col:'#88ff44',bg:'#1a4400',label:'DBL JUMP',  desc:'Jump a second time in mid-air. Essential on later levels.'},
      {sym:'MG',col:'#ff44aa',bg:'#440022',label:'MAGNET',    desc:'Pulls nearby gems toward you automatically for 6 seconds.'},
      {sym:'ST',col:'#ffdd00',bg:'#443300',label:'STAR',      desc:'Full invincibility for 4 seconds — golden opportunity to rush!'},
      {sym:'LG',col:'#44ffdd',bg:'#003344',label:'LOW-G',     desc:'Reduced gravity for 5 seconds. Float lightly over tricky gaps.'},
    ];
    puCFG.forEach(pu => {
      drawEntry((c,f2)=>{
        c.fillStyle=pu.bg;c.beginPath();c.arc(0,0,ICON_R*0.9,0,Math.PI*2);c.fill();
        c.fillStyle=pu.col+'bb';c.beginPath();c.arc(0,0,ICON_R*0.9,0,Math.PI*2);c.fill();
        c.fillStyle=pu.bg;c.beginPath();c.arc(0,0,ICON_R*0.65,0,Math.PI*2);c.fill();
        c.fillStyle=pu.col;
        c.font=`bold ${Math.round(ICON_R*0.85)}px "Courier New"`;
        c.textAlign='center';c.textBaseline='middle';c.fillText(pu.sym,0,1);c.textBaseline='alphabetic';
      }, pu.label, pu.desc);
    });

    // CHECKPOINTS & EXIT
    drawSection('\ud83d\udea9 CHECKPOINTS & EXIT', '#1a1133');
    drawEntry((c,f2)=>{
      c.fillStyle='#aaa';c.fillRect(-2,-ICON_R*1.1,4,ICON_R*2.2);
      c.fillStyle='#555';c.fillRect(-ICON_R*0.5,ICON_R,ICON_R,Math.round(4*S));
      const wv=Math.sin(f2*0.12)*ICON_R*0.12;
      c.fillStyle='#ffdd00';c.shadowColor='#ffdd00';c.shadowBlur=Math.round(8*S);
      c.beginPath();c.moveTo(2,-ICON_R*1.05);c.quadraticCurveTo(ICON_R*1.1+wv,-ICON_R*0.7,ICON_R*1.4+wv,-ICON_R*0.45);
      c.quadraticCurveTo(ICON_R*1.1+wv,-ICON_R*0.2,2,-ICON_R*0.05);c.closePath();c.fill();c.shadowBlur=0;
      c.strokeStyle='#aa8800';c.lineWidth=1.5;
      c.beginPath();c.moveTo(ICON_R*0.35,-ICON_R*0.75);c.lineTo(ICON_R*0.75,-ICON_R*0.5);c.lineTo(ICON_R*0.3,-ICON_R*0.2);c.stroke();
    }, 'CHECKPOINT', 'Jump UP to collect the flag! On respawn, you drop from above and land on the path with 3 seconds invincibility.');

    drawEntry((c,f2)=>{
      const pulse=Math.sin(f2*0.1)*0.5+0.5;
      for(let ring=0;ring<3;ring++){
        const rs=ICON_R*(0.55+ring*0.2);
        c.strokeStyle=`rgba(68,255,136,${(0.85-ring*0.25)*pulse})`;
        c.lineWidth=ring===0?3:1.5;
        if(ring>0)c.setLineDash([Math.round(3*S),Math.round(4*S)]);
        c.beginPath();c.arc(0,0,rs,0,Math.PI*2);c.stroke();c.setLineDash([]);
      }
      c.fillStyle='#fff';c.beginPath();c.moveTo(-ICON_R*0.28,-ICON_R*0.4);c.lineTo(ICON_R*0.42,0);c.lineTo(-ICON_R*0.28,ICON_R*0.4);c.closePath();c.fill();
    }, 'EXIT GATE', 'Opens once you collect 60% of gems. More gems = higher star rating. Look for the green glow!');

    ctx.restore();
  }

/* ── Progress helpers ── */

  getBestScore() {
    const vals = Object.values(this._savedProgress.highScores || {});
    return vals.length > 0 ? Math.max(...vals) : 0;
  }

  updateHighScore(levelId, score) {
    if (!this._savedProgress.highScores) this._savedProgress.highScores = {};
    const key = 'level' + levelId;
    if (score > (this._savedProgress.highScores[key] || 0)) {
      this._savedProgress.highScores[key] = score;
      Helpers.save('progress', this._savedProgress);
    }
  }

  unlockLevel(levelId) {
    if (levelId < 1 || levelId > 5) return;
    if (!this._savedProgress.unlockedLevels) this._savedProgress.unlockedLevels = [1];
    if (!this._savedProgress.unlockedLevels.includes(levelId)) {
      this._savedProgress.unlockedLevels.push(levelId);
      Helpers.save('progress', this._savedProgress);
    }
  }

  updateStars(levelId, stars) {
    if (!this._savedProgress.stars) this._savedProgress.stars = {};
    const key = 'level' + levelId;
    if (stars > (this._savedProgress.stars[key] || 0)) {
      this._savedProgress.stars[key] = stars;
      Helpers.save('progress', this._savedProgress);
    }
  }

  getStars(levelId) {
    return ((this._savedProgress.stars || {})['level' + levelId]) || 0;
  }

  updateMedals(levelId, medals) {
    if (!this._savedProgress.medals) this._savedProgress.medals = {};
    const key = 'level' + levelId;
    const existing = this._savedProgress.medals[key] || {};
    const merged = Object.assign({}, existing);
    for (const [k, v] of Object.entries(medals)) {
      if (v) merged[k] = true;   // medals are permanent — never revoked
    }
    this._savedProgress.medals[key] = merged;
    Helpers.save('progress', this._savedProgress);
  }

  getMedals(levelId) {
    return ((this._savedProgress.medals || {})['level' + levelId]) || {};
  }

}
