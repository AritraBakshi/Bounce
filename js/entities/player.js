/* ============================================================
   player.js — Player entity.
   Full state machine: idle|moving|jumping|falling|hurt|dead|win
   Integrates with Physics, handles coyote time, jump buffering,
   powerups, squash/stretch, rotation.
   ============================================================ */

/* ============================================================
   Ghost — records a run as {x,y,vx,vy,rotation,squashX,squashY}
   per frame and plays it back as a translucent red ghost ball.
   Only the BEST (fastest full-gem) run is persisted per level.
   ============================================================ */
class Ghost {
  constructor() {
    this._recording = [];   // frames recorded this run
    this._playback  = [];   // frames loaded from best run
    this._frame     = 0;
    this.recording  = false;
    this.playing    = false;
  }

  startRecording() {
    this._recording = [];
    this.recording  = true;
  }

  record(player) {
    if (!this.recording) return;
    this._recording.push({
      x: player.x, y: player.y,
      vx: player.vx, vy: player.vy,
      rot: player._rotation,
      sx: player._squashX, sy: player._squashY,
    });
  }

  stopRecording() { this.recording = false; }

  /** Save this run if it's better than the stored best */
  commitIfBest(levelId, gems, totalGems, time) {
    const key    = 'ghost_' + levelId;
    const stored = Helpers.load(key, null);
    // Better = more gems first, then faster time
    const better = !stored
      || gems > (stored.gems || 0)
      || (gems === (stored.gems || 0) && time < (stored.time || Infinity));
    if (better) {
      Helpers.save(key, { frames: this._recording, gems, totalGems, time });
    }
  }

  loadForLevel(levelId) {
    const key  = 'ghost_' + levelId;
    const data = Helpers.load(key, null);
    if (data && data.frames && data.frames.length > 0) {
      this._playback = data.frames;
      this._frame    = 0;
      this.playing   = true;
    } else {
      this.playing = false;
    }
  }

  update() {
    if (!this.playing || this._playback.length === 0) return;
    this._frame++;
    if (this._frame >= this._playback.length) {
      this._frame = 0; // loop ghost
    }
  }

  draw(ctx) {
    if (!this.playing || this._playback.length === 0) return;
    const f = this._playback[this._frame];
    if (!f) return;

    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot || 0);
    ctx.scale(f.sx || 1, f.sy || 1);

    // Ghost ball — translucent, desaturated red
    const g = ctx.createRadialGradient(-4, -4, 0.5, 0, 0, 10);
    g.addColorStop(0,   'rgba(255,160,160,0.9)');
    g.addColorStop(0.5, 'rgba(200,60,60,0.7)');
    g.addColorStop(1,   'rgba(100,20,20,0.4)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();

    // Ghost shimmer outline
    ctx.strokeStyle = 'rgba(255,120,120,0.5)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  get currentFrame() { return this._frame; }
  get totalFrames()  { return this._playback.length; }
}

class Player {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    this.r  = C.PLAYER_R;

    this.vx = 0;
    this.vy = 0;

    this.lives  = C.PLAYER_LIVES;
    this.score  = 0;
    this.gems   = 0;
    this.totalGems = 0;
    this.kills  = 0;  // for pacifist medal

    this.state  = 'idle'; // idle|moving|jumping|falling|hurt|dead|win

    // Ground tracking
    this.onGround   = false;
    this._wasGround = false;

    // Coyote + jump buffer
    this._coyoteTimer = 0;
    this._jumpBuffer  = 0;

    // Double jump
    this._jumpsLeft = 1;

    // Rotation (visual only)
    this._rotation    = 0;
    this._squashX     = 1;
    this._squashY     = 1;

    // Hurt
    this._hurtTimer   = 0;
    this._invulnTimer = 0;

    // Death
    this._deathTimer  = 0;
    this._respawnDelay= 0;

    // Checkpoint
    this.checkpoint   = { x, y };

    // Combo
    this._comboTimer  = 0;
    this.combo        = 0;

    // Speedrun
    this.levelTime    = 0;

    // Powerups { type: framesLeft }
    this.powerups     = {};

    // Magnet pull targets
    this._magnetTargets = [];

    this._frame = 0;
  }

  /* ── Powerup shortcuts ── */
  get shield()   { return !!(this.powerups.shield  > 0); }
  get speedBoost(){ return !!(this.powerups.speed   > 0); }
  get dblJump()  { return !!(this.powerups.dblj    > 0); }
  get magnet()   { return !!(this.powerups.magnet  > 0); }
  get invincible(){ return !!(this.powerups.invinc  > 0); }
  get lowGrav()  { return !!(this.powerups.lowgrav > 0); }

  get isInvuln() { return this._invulnTimer > 0 || this.invincible; }

  /* ── Respawn point ── */
  setCheckpoint(x, y) { this.checkpoint = { x, y }; }

  /* ── Apply a collected powerup ── */
  applyPowerup(subType) {
    const durations = {
      shield: C.PU_SHIELD, speed: C.PU_SPEED, dblj: C.PU_DBLJ,
      magnet: C.PU_MAGNET, invinc: C.PU_INVINC, lowgrav: C.PU_LOWGRAV,
    };
    this.powerups[subType] = durations[subType] || 240;
    if (subType === 'dblj') this._jumpsLeft = 2;
  }

  /* ── Main update ── */
  update(input, physics, platforms, particles, audio) {
    if (this.state === 'dead')     { this._updateDead(particles, audio); return; }
    if (this.state === 'win')      { this._updateWin(particles); return; }

    this._frame++;
    this.levelTime++;

    this._tickPowerups(particles);

    const inp = input.state;

    // Movement direction
    let dirX = 0;
    if (inp.left)  dirX = -1;
    if (inp.right) dirX =  1;

    // Physics integrate
    physics.integrate(this);

    // Apply movement
    physics.applyMovement(this, dirX, this.onGround);
    if (!this.onGround) physics.applyAirFriction(this);

    // Platform collision
    const res     = physics.resolvePlayer(this, platforms);
    this._wasGround= this.onGround;
    this.onGround  = res.onGround;

    // Coyote time
    if (this._wasGround && !this.onGround) {
      this._coyoteTimer = C.COYOTE_FRAMES;
    } else if (this.onGround) {
      this._coyoteTimer = C.COYOTE_FRAMES;
    }
    if (this._coyoteTimer > 0) this._coyoteTimer--;

    // Jump buffer
    if (inp.jumpJustPressed) this._jumpBuffer = C.JUMP_BUFFER;
    if (this._jumpBuffer > 0) this._jumpBuffer--;

    // Landing effects
    if (!this._wasGround && this.onGround) {
      this._onLand(particles, audio);
    }

    // Jump logic
    if (this._jumpBuffer > 0) {
      if (this._coyoteTimer > 0) {
        physics.jump(this, false);
        this._jumpBuffer  = 0;
        this._coyoteTimer = 0;
        this._jumpsLeft   = this.dblJump ? 1 : 0;
        audio.playJump();
        particles.dust(this.x, this.y + this.r, this.vx);
      } else if (this._jumpsLeft > 0) {
        physics.jump(this, true);
        this._jumpsLeft--;
        this._jumpBuffer = 0;
        audio.playJump();
        particles.burst(this.x, this.y + this.r, 6, 200, 200, 255, 2.5, 22, 2, 0.04);
      }
    }

    // Reset double jump when grounded
    if (this.onGround) {
      this._jumpsLeft = this.dblJump ? 2 : 1;
    }

    // Visual rotation
    this._rotation += this.vx * 0.08;

    // Squash/stretch
    this._updateSquash();

    // Trail (speed boost or invincible)
    if (this.speedBoost || this.invincible) {
      const col = this.invincible
        ? { r: 255, g: 220, b: 50 }
        : { r: 255, g: 120, b: 50 };
      particles.trail(this.x, this.y, this.vx, this.vy, col);
    }

    // Hurt timer
    if (this._hurtTimer > 0) this._hurtTimer--;
    if (this._invulnTimer > 0) this._invulnTimer--;

    // Combo decay
    if (this._comboTimer > 0) this._comboTimer--;
    else this.combo = 0;

    // State machine
    this._updateState(dirX);

    // World bounds safety
    // Fell out of world → full heart lost, go to checkpoint
    if (this.y > (this._levelWorldH || 600)) {
      if (this.state !== 'dead' && this.state !== 'win' && !this.isInvuln) {
        this.hurtFull(null, particles, audio);
      } else if (this.state === 'dead') {
        // Already dying — snap back so death anim doesn't scroll forever
        this.y = (this._levelWorldH || 600) - 20;
      }
    }
  }

  _updateState(dirX) {
    if (this._hurtTimer > 0) { this.state = 'hurt'; return; }
    if (!this.onGround && this.vy < 0) { this.state = 'jumping'; return; }
    if (!this.onGround && this.vy > 0) { this.state = 'falling'; return; }
    if (dirX !== 0) { this.state = 'moving'; return; }
    this.state = 'idle';
  }

  _updateSquash() {
    // Squash on landing is handled in _onLand
    // Decay squash back to 1
    this._squashX = MathUtils.lerp(this._squashX, 1, 0.22);
    this._squashY = MathUtils.lerp(this._squashY, 1, 0.22);

    // Stretch while falling fast
    if (this.vy > 4) {
      this._squashX = MathUtils.lerp(this._squashX, 0.75, 0.12);
      this._squashY = MathUtils.lerp(this._squashY, 1.25, 0.12);
    }
  }

  _onLand(particles, audio) {
    const impact = Math.abs(this.vy);
    if (impact > 1.5) {
      // Squash on landing
      const squash = MathUtils.clamp(1 - impact * 0.04, 0.6, 0.88);
      this._squashX = MathUtils.clamp(1 + impact * 0.04, 1.12, 1.4);
      this._squashY = squash;

      particles.dust(this.x, this.y + this.r, this.vx);
      audio.playBounce(impact);

      if (impact > 5) {
        // Camera shake proportional to impact
        // Passed via game.camera reference
        if (this._camRef) this._camRef.shake(Math.min(impact - 4, 4));
      }
    }
  }

  _tickPowerups(particles) {
    for (const key of Object.keys(this.powerups)) {
      if (this.powerups[key] > 0) {
        this.powerups[key]--;
        // Warn flash at 3s remaining
        if (this.powerups[key] === 180) {
          particles.floatText(this.x, this.y - 16, key.toUpperCase() + ' FADING', '#ffaa44');
        }
        if (this.powerups[key] <= 0) {
          delete this.powerups[key];
          if (key === 'dblj') this._jumpsLeft = 1;
        }
      }
    }
  }

  /* ── Hurt / Die ── */
  /* ── hurtHalf: spike / mob contact → -1 half-heart ── */
  hurt(cam, particles, audio) {
    this._takeDamage(1, cam, particles, audio, false);
  }

  /* ── hurtFull: lava / out-of-bounds → -2 halves (full heart) ── */
  hurtFull(cam, particles, audio) {
    this._takeDamage(2, cam, particles, audio, true);
  }

  _takeDamage(halves, cam, particles, audio, isFatal) {
    if (this.isInvuln) return;
    if (this.state === 'dead' || this.state === 'win') return;

    // Shield absorbs one hit entirely
    if (this.shield) {
      delete this.powerups.shield;
      this._invulnTimer = C.INVULN_FRAMES;
      
      // EventBus emission
      window.gameEvents.emit('player:shield-break', { x: this.x, y: this.y });

      // Legacy fallback
      if (cam) cam.shake(3);
      if (cam) cam.flash(0.35);
      if (particles) particles.burst(this.x, this.y, 10, 100, 160, 255, 3, 28, 2.5);
      if (audio) audio.playHurt();
      return;
    }

    // Deduct lives
    this.lives = Math.max(0, this.lives - halves);

    // ── CRITICAL: grant invuln immediately so no follow-up hits land ──
    // For game-over (lives==0) we skip so the death screen shows cleanly.
    if (this.lives > 0) {
      this._invulnTimer = C.INVULN_FRAMES; // 3s protection starts NOW
    }

    this._hurtTimer = 40;  // red flash duration
    this.powerups   = {};

    const big = halves >= 2 || this.lives <= 0;

    // EventBus emission
    window.gameEvents.emit('player:damage', { halves, isFatal, big, x: this.x, y: this.y, lives: this.lives });

    // Legacy fallback
    if (cam) cam.shake(big ? 7 : 3);
    if (cam) cam.flash(big ? 0.65 : 0.35);
    if (particles) {
      if (big) particles.sparks(this.x, this.y);
      else     particles.burst(this.x, this.y, 6, 255, 80, 40, 2, 20, 2);
    }
    if (audio) audio.playHurt();

    if (this.lives <= 0) {
      this.state = 'dead';
      this._invulnTimer = 0;
      window.gameEvents.emit('player:death');
      if (audio) audio.playDie();
    } else {
      // Trigger respawn — state='dead' starts the 60-frame countdown
      this.state = 'dead';
    }
  }

  _updateDead(particles, audio) {
    this._deathTimer++;
    this.vy = Math.min(this.vy + C.GRAVITY, C.MAX_FALL);
    this.x += this.vx;
    this.y += this.vy;
    this._rotation += 0.2;
    if (this._deathTimer % 4 === 0) {
      particles.burst(this.x, this.y, 3, 232, 35, 26, 2, 20, 2);
    }
  }

  _updateWin(particles) {
    this._frame++;
    // Float upward gently
    this.vy = MathUtils.lerp(this.vy, -1.5, 0.08);
    this.y += this.vy;
    this._rotation += 0.05;
    if (this._frame % 6 === 0) {
      particles.burst(this.x, this.y, 4, 255, 215, 0, 3, 35, 2.5, 0);
    }
  }

  /* ── Scoring ── */
  addScore(points, multiplier = 1) {
    this.score += Math.floor(points * multiplier);
  }

  enemyKill(particles) {
    this.kills++;
    this.combo++;
    this._comboTimer = C.COMBO_WINDOW;
    const bonus = this.combo > 1 ? `x${this.combo} COMBO!` : null;
    if (bonus) particles.floatText(this.x, this.y - 22, bonus, '#ff9944');
    return this.combo;
  }

  /* ── Draw ── */
  draw(ctx, renderer) {
    const hurtFlash  = this._hurtTimer  > 0 && Math.floor(this._frame / 3) % 2 === 0;
    const invuln     = this._invulnTimer > 0 && !this.invincible;

    // Shield bubble
    if (this.shield) {
      const pulse = Math.sin(this._frame * 0.15) * 0.3 + 0.7;
      ctx.save();
      ctx.globalAlpha = 0.4 * pulse;
      ctx.strokeStyle = '#4488ff';
      ctx.lineWidth   = 2;
      ctx.shadowColor = '#4488ff';
      ctx.shadowBlur  = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Magnet field
    if (this.magnet) {
      const pulse = Math.sin(this._frame * 0.1) * 0.25 + 0.25;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ff44aa';
      ctx.lineWidth   = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Invincible gold glow
    if (this.invincible) {
      const pulse = Math.sin(this._frame * 0.2) * 0.5 + 0.5;
      ctx.save();
      ctx.globalAlpha = 0.5 * pulse;
      ctx.fillStyle   = '#ffdd00';
      ctx.shadowColor = '#ffdd00';
      ctx.shadowBlur  = 20;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    renderer.drawBall(
      ctx,
      this.x, this.y, this.r,
      this._rotation,
      this._squashX, this._squashY,
      hurtFlash, invuln,
      this._frame
    );
  }
}