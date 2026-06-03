/* ============================================================
   game.js — Core game orchestrator.
   Owns the requestAnimationFrame loop, delta-time, and
   coordinates every subsystem per frame.
   States: loading | menu | playing | paused | gameover | victory
   ============================================================ */

class Game {
  constructor(canvas) {
    this.canvas   = canvas;
    this.W        = C.CANVAS_W;
    this.H        = C.CANVAS_H;

    /* ── Engine systems ── */
    this.input    = new InputManager();
    this.audio    = new AudioEngine();
    this.renderer = new Renderer(canvas);
    this.camera   = new Camera(this.W, this.H);
    this.particles= new ParticleSystem();
    this.physics  = new Physics();

    /* ── UI ── */
    this.hud      = new HUD(this.W, this.H);
    this.ghost    = new Ghost();

    this.menus    = new MenuSystem(this.W, this.H);

    // Wire canvas after construction so mouse coords are available on main menu
    this.menus._canvas = canvas;
    this.menus._menuW  = this.W;
    this.menus._menuH  = this.H;

    /* ── Level ── */
    this.loader   = new LevelLoader();
    this.levelId  = 1;
    this._levelData = null;

    /* ── Active entities ── */
    this.player       = null;
    this.platforms    = [];
    this.hazards      = [];
    this.collectibles = [];
    this.enemies      = [];
    this.totalGems    = 0;
    this.exit         = null;

    /* ── Loop state ── */
    this._state     = 'loading';  // loading|menu|playing|paused|gameover|victory
    this._raf       = null;
    this._lastTime  = 0;
    this._fps       = 60;
    this._frame     = 0;

    /* ── Canvas scaling ── */
    this._scale     = 1;
    this._offsetX   = 0;
    this._offsetY   = 0;

    this._bindResize();
    this._resize();
  }

  /* ── Init: preload then show menu ── */
  async init() {
    this._updateLoadBar(10);
    // Pre-cache levels 1 and 2 (JSON fetch)
    await this.loader.loadData(1);
    this._updateLoadBar(50);
    await this.loader.loadData(2);
    this._updateLoadBar(90);
    await Helpers.wait(200);
    this._updateLoadBar(100);
    await Helpers.wait(400);

    document.getElementById('loading-screen').classList.add('hidden');
    this._state = 'menu';
    this.menus.open('main');
    this._startLoop();
  }

  _updateLoadBar(pct) {
    const el = document.getElementById('loading-bar');
    if (el) el.style.width = pct + '%';
  }

  /* ── Canvas scaling to fill viewport ── */
  _bindResize() {
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Maintain 16:9 with letterboxing
    const targetRatio = this.W / this.H;
    const viewRatio   = vw / vh;
    let cw, ch;
    if (viewRatio > targetRatio) { ch = vh; cw = Math.round(ch * targetRatio); }
    else                          { cw = vw; ch = Math.round(cw / targetRatio); }
    this._scale = cw / this.W;
    this.canvas.style.width    = cw + 'px';
    this.canvas.style.height   = ch + 'px';
    this.canvas.style.position = 'absolute';
    this.canvas.style.left     = Math.round((vw - cw) / 2) + 'px';
    this.canvas.style.top      = Math.round((vh - ch) / 2) + 'px';
    this.canvas.width  = this.W;
    this.canvas.height = this.H;
    if (this.menus) { this.menus.w = this.W; this.menus.h = this.H; }
  }

  /* ── Game loop ── */
  _startLoop() {
    this._lastTime = performance.now();
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  _loop(timestamp) {
    const dt  = Math.min((timestamp - this._lastTime) / (1000 / 60), 3);
    this._lastTime = timestamp;
    this._fps  = MathUtils.lerp(this._fps, 1000 / Math.max(1, timestamp - this._lastTime + 0.01), 0.05);
    this._frame++;

    this._update(dt);
    this._draw();

    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  /* ── Update ── */
_update(dt) {
  // Update InputManager with current menu state
  this.input.menuOpen = this.menus.isOpen;
  
  // Update mobile button visibility based on game state
  if (typeof mobileControls !== 'undefined') {
    mobileControls.updateState(this._state);
  }
  
  this.input.flush();
  const inp = this.input.state;

  switch (this._state) {
    case 'menu':
      this._updateMenu(); break;
    case 'playing':
      if (inp.pause) { this._pause(); break; }
      this._updatePlaying(dt); break;
    case 'paused':
      this._updatePaused(); break;
    case 'gameover':
    case 'victory':
      this._updateEndScreen(); break;
  }
}

  /* ── Menu state ── */
  _updateMenu() {
    const action = this.menus.handleInput(this.input);
    if (!action) return;
    if (action === 'startGame')        { this._startLevel(1); }
    else if (action === 'openLevelSelect') { this.menus.open('levelSelect'); }
    else if (action === 'openScores')       { this.menus.open('scores'); }
    else if (action === 'openAchievements') { this.menus.open('achievements'); }
    else if (action === 'openGuide')        { this.menus.open('guide'); }
    else if (action === 'backToMain')       { this.menus.open('main'); }
    else if (action === 'toggleMute')  {
      this.menus._muted = !this.menus._muted;
      this.audio.setMute(this.menus._muted);
    }
    else if (action && action.startsWith('playLevel:')) {
      const lvl = parseInt(action.split(':')[1]);
      this.menus.close();
      this._startLevel(lvl);
    }
  }

  /* ── Pause ── */
  _pause() {
    this._state = 'paused';
    this.menus.open('pause');
    this.audio.stopBgMusic();
  }

  _updatePaused() {
    const action = this.menus.handleInput(this.input);
    if (action === 'resume') {
      this._state = 'playing';
      this.menus.close();
      this.audio.startBgMusic(this._levelData?.theme || 0);
    } else if (action === 'restart') {
      this.menus.close();
      this._startLevel(this.levelId);
    } else if (action === 'menu') {
      this.menus.close();
      this._state = 'menu';
      this.menus.open('main');
    }
  }

  /* ── End screens ── */
  _updateEndScreen() {
    const action = this.menus.handleInput(this.input);
    if (this._state === 'gameover') {
      if (action === 'restart')    { this.menus.close(); this._startLevel(this.levelId); }
      if (action === 'backToMain') { this.menus.close(); this._state = 'menu'; this.menus.open('main'); }
    }
    if (this._state === 'victory' && action === 'nextLevel') {
      this.menus.close();
      const next = this.levelId + 1;
      if (next <= 5) {
        this._startLevel(next);
      } else {
        this._state = 'menu';
        this.menus.open('main');
      }
    }
  }

  /* ── Load and start a level ── */
  async _startLevel(id) {
    this._state = 'loading';
    this.audio.stopBgMusic();

    const data = await this.loader.loadData(id);
    if (!data) { console.error('Failed to load level', id); return; }

    this.levelId     = id;
    this._levelData  = data;
    const level      = this.loader.instantiate(data);

    this.platforms   = level.platforms;
    this.hazards     = level.hazards;
    this.collectibles= level.collectibles;
    this.enemies     = level.enemies;
    this.totalGems   = level.totalGems;
    this.exit        = level.exit;

    // Player
    this.player      = new Player(level.spawn.x, level.spawn.y);
    this.player._camRef   = this.camera;
    // Default checkpoint = spawn so first death returns to start
    this.player.checkpoint = { x: level.spawn.x, y: level.spawn.y };

    // Camera
    this.camera.setBounds(level.worldW, level.worldH);
    this.camera.x    = 0;
    this.camera.y    = 0;
    // Give player the world height so out-of-bounds kill works
    this.player._levelWorldH = level.worldH + 80;

    // Phase 6: Pre-render and cache static platforms onto an offscreen canvas
    this.renderer.cacheStaticPlatforms(this.platforms, level.worldW, level.worldH, level.theme);

    // Reset particles
    for (const p of this.particles._pool)   p.active = false;
    for (const f of this.particles._floats) f.active = false;

    // Audio
    this.audio.init();
    this.audio.resume();
    this.audio.startBgMusic(level.bgMusic || 0);
    this.menus._muted   = this.audio.muted;
    this.menus._bgVol   = this.audio.bgVol;
    this.menus._sfxVol  = this.audio.sfxVol;
    this.menus._audioRef = this.audio;
    this.menus._canvas   = this.canvas;
    this.menus._menuW    = this.W;
    this.menus._menuH    = this.H;

    // Ghost — load previous best, start recording new run
    this.ghost.loadForLevel(id);
    this.ghost.startRecording();

    this._state = 'playing';
    this.menus.close();
  }

  /* ── Main gameplay update ── */
  _updatePlaying(dt) {
    const player = this.player;
    if (!player) return;

    // Player update
    player.update(this.input, this.physics, this.platforms,
                  this.particles, this.audio);

    // Ghost: record this frame
    this.ghost.record(player);
    this.ghost.update();

    // Camera follow
    this.camera.update(player);

    // Platforms
    const playerRect = {
      x: player.x - player.r, y: player.y - player.r,
      w: player.r * 2, h: player.r * 2,
    };
    for (const plat of this.platforms) {
      const onTop = (player.onGround &&
        player.x >= plat.x && player.x <= plat.x + plat.w &&
        player.y + player.r >= plat.y && player.y + player.r <= plat.y + 4);
      plat.update(onTop);
    }

    // Hazards
    for (const hz of this.hazards) {
      hz.update(this.particles);
      if (!hz.active) continue;
      // Don't test collision if player is already dead, winning, or invulnerable
      if (player.state === 'dead' || player.state === 'win') continue;
      if (player.isInvuln) continue;
      const hb = hz.hitBox;
      const m  = Collision.circleRect(player.x, player.y, player.r,
                                      hb.x, hb.y, hb.w, hb.h);
      if (m) {
        // Lava / OOB = full heart; spike / electric / crusher = half heart
        if (hz.type === 'lava') {
          player.hurtFull(this.camera, this.particles, this.audio);
        } else {
          player.hurt(this.camera, this.particles, this.audio);
        }
      }
    }

    // Collectibles
    let gemsCollected = 0;
    for (const col of this.collectibles) {
      if (col.collected) continue;
      col.update(this._frame);

      // Magnet attraction
      if (player.magnet && (col.type === 'gem' || col.type === 'coin')) {
        const dist = MathUtils.dist(player.x, player.y, col.cx, col.cy);
        if (dist < 55) {
          const dx = player.x - col.cx;
          const dy = player.y - col.cy;
          const d  = Math.sqrt(dx*dx+dy*dy) || 1;
          col.x += (dx/d) * 3;
          col.y += (dy/d) * 3;
        }
      }

      const dist = MathUtils.dist(player.x, player.y, col.cx, col.cy);
      if (dist < player.r + col.hitR) {
        if (col.type === 'checkpoint' && !col.activated) {
          col.activated = true;
          // Use static Y (not bobbing cy) so respawn plants on ground
          player.setCheckpoint(col.cx, col.y + col.h);
          this.audio.playCheckpoint();
          this.particles.floatText(col.cx, col.cy - 12, 'CHECKPOINT!', '#ffdd00');
        } else if (col.type === 'exit') {
          if (col.open) this._onLevelClear();
        } else if (col.type === 'powerup') {
          col.collect(this.particles, this.audio, player.score);
          player.applyPowerup(col.subType);
        } else {
          const pts = col.collect(this.particles, this.audio, player.score);
          player.addScore(pts);
          if (col.type === 'gem') { player.gems++; gemsCollected++; }
        }
      }
    }

    // Open exit when all gems collected
    // Exit opens at 60% gems — allows 1-3 star rating system
    const gemThreshold = Math.ceil(this.totalGems * 0.6);
    if (this.exit && !this.exit.open && player.gems >= gemThreshold) {
      this.exit.open = true;
      this.particles.burst(this.exit.cx, this.exit.cy, 20, 68, 255, 136, 4, 50, 3);
      this.particles.floatText(this.exit.cx, this.exit.cy - 14, 'EXIT OPEN! ▶', '#44ff88');
      this.audio.playCheckpoint();
    }

    // Enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.update(this.platforms, player, this.particles, this.physics);

      if (!enemy.dead) {
        // Enemy vs player — skip if player dead or invulnerable
        if (player.state === 'dead' || player.state === 'win' || player.isInvuln) continue;
        const m = Collision.circleCircle(player.x, player.y, player.r,
                                         enemy.x, enemy.y, enemy.r);
        if (m) {
          // Stomp kill: player falling onto enemy from above
          if (player.vy > 1.5 && player.y < enemy.y - enemy.r * 0.3) {
            enemy.hit(this.particles);
            const combo = player.enemyKill(this.particles);
            player.addScore(C.ENEMY_SCORE * combo);
            player.vy = C.JUMP_FORCE * 0.55;  // bounce off kill
            this.audio.playCollect();
          } else {
            // Side/bottom contact = half heart
            player.hurt(this.camera, this.particles, this.audio);
          }
        }
      }
    }

    // Particles
    this.particles.update();

    // HUD
    this.hud.update(player);

    // Player state transitions
    if (player.state === 'dead') {
      this._deathTimer = (this._deathTimer || 0) + 1;
      if (this._deathTimer > 60) {  // 1s before respawn at checkpoint
        this._deathTimer = 0;
        if (player.lives > 0) {
          // Respawn at checkpoint — drop from slightly above so player lands on path
          player.x           = player.checkpoint.x;
          player.y           = player.checkpoint.y - 30; // drop from above onto path
          player.vx          = 0;
          player.vy          = 0;
          player.state       = 'idle';
          player.onGround    = false;
          player._hurtTimer  = 0;
          player._deathTimer = 0;
          player._invulnTimer= C.INVULN_FRAMES; // refresh full 3s on actual spawn
          player._squashX    = 1;
          player._squashY    = 1;
          player._jumpsLeft  = 1;
          // Keep powerups cleared
          player.powerups    = {};
          // Snap camera to respawn point
          this.camera.x      = Math.max(0, player.x - this.W / 2);
          this.camera.y      = Math.max(0, player.y - this.H / 2);
          this.camera.flash(0.5);
          this._deathTimer   = 0;
          // Float text showing remaining hearts
          const heartsLeft = Math.ceil(player.lives / 2);
          this.particles.floatText(player.x, player.y - 20,
            heartsLeft + (heartsLeft === 1 ? ' HEART LEFT' : ' HEARTS LEFT'), '#ff6644');
          this.particles.floatText(player.x, player.y - 32, '3s INVINCIBLE', '#44ffdd');
        } else {
          this._onGameOver();
        }
      }
    }

    // Dynamic procedural audio tension: accelerates tempo/pitch when low health or chased
    let tension = 1.0;
    if (player) {
      if (player.lives <= 2) {
        tension = 1.25; // 1 heart left: major speed and pitch shift up
      } else {
        const closeEnemy = this.enemies.some(e => e._alerted && MathUtils.dist(e.x, e.y, player.x, player.y) < 130);
        if (closeEnemy) {
          tension = 1.14; // near alert enemy: slight adrenaline tempo boost
        }
      }
    }
    if (this.audio) this.audio.tension = tension;
  }

  /* ── Level clear ── */
  _onLevelClear() {
    if (this._state !== 'playing') return;
    this._state = 'victory';
    this.player.state = 'win';
    this.audio.stopBgMusic();
    this.audio.playVictory();
    this.camera.shake(5);
    this.particles.victory(this.player.x, this.player.y);

    this.menus.updateHighScore(this.levelId, this.player.score);
    this.menus.unlockLevel(this.levelId + 1);
    Helpers.save('lastLevel', this.levelId + 1 <= 5 ? this.levelId + 1 : 1);

    // Compute and save star rating
    const gemPct = this.totalGems > 0 ? this.player.gems / this.totalGems : 1;
    const stars  = gemPct >= 1.0 ? 3 : gemPct >= 0.8 ? 2 : 1;
    this.menus.updateStars(this.levelId, stars);

    // Compute and save challenge medals
    const levelTimeSecs = Math.floor(this.player.levelTime / 60);
    this.menus.updateMedals(this.levelId, {
      speed:         levelTimeSecs < 30,
      pacifist:      this.player.kills === 0,
      perfectionist: this.player.gems >= this.totalGems,
    });

    // Save ghost if this run is the best
    this.ghost.stopRecording();
    this.ghost.commitIfBest(
      this.levelId,
      this.player.gems,
      this.totalGems,
      this.player.levelTime
    );

    this.menus.open('victory');
  }

  /* ── Game over ── */
  _onGameOver() {
    if (this._state !== 'playing') return;
    this._state = 'gameover';
    this.audio.stopBgMusic();
    this.menus.open('gameover');
  }

  /* ── Draw ── */
  _draw() {
    const ctx  = this.renderer.ctx;
    const cam  = this.camera;

    // Background (screen space)
    this.renderer.drawBackground(cam.x, cam.y, this._levelData?.theme || 0);

    // World space
    cam.begin(ctx);

    // Platforms
    for (const p of this.platforms) p.draw(ctx, this.renderer, cam);

    // Hazards
    for (const h of this.hazards) h.draw(ctx, cam);

    // Collectibles
    for (const c of this.collectibles) c.draw(ctx, cam);

    // Ghost replay (before player so player draws on top)
    this.ghost.draw(ctx);

    // Enemies
    for (const e of this.enemies) e.draw(ctx, cam, this.player);

    // Player
    if (this.player) this.player.draw(ctx, this.renderer);

    // Particles (world space)
    this.particles.draw(ctx);

    // Ground/floor strip (drawn last in world space, always visible)
    if (this._levelData) {
      const wH    = this._levelData.worldH || 400;
      const theme = this._levelData.theme  || 0;
      const t     = this.renderer._themes[theme] || this.renderer._themes[0];
      const gCol  = t.ground || t.mid[1];
      ctx.fillStyle = gCol;
      ctx.fillRect(0, wH - 20, this._levelData.worldW || 1200, 20);
      // Top edge highlight
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, wH - 20, this._levelData.worldW || 1200, 2);
    }

    cam.end(ctx);

    // Screen-space overlays
    cam.drawOverlays(ctx);

    // HUD (only while playing)
    if (this._state === 'playing' || this._state === 'paused') {
      this.hud.draw(ctx, this.player, this._levelData?.name, this.totalGems);
    }

    // Debug
    if (C.DEBUG) {
      this.renderer.drawDebug(ctx, [...this.platforms, ...this.enemies], this._fps, cam);
    }

    // Menus (always on top)
    this.menus.draw(ctx, {
      score:      this.player?.score      || 0,
      level:      this.levelId,
      time:       this.player?.levelTime  || 0,
      gems:       this.player?.gems       || 0,
      totalGems:  this.totalGems,
      bestScore:  this.menus.getBestScore(),
    });
  }
}
