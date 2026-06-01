/* ============================================================
   constants.js — All game-wide tuning values in one place.
   Centralising constants prevents magic numbers and makes
   balancing/tweaking trivially easy.
   ============================================================ */

const C = Object.freeze({

  /* ── Canvas / Display ── */
  CANVAS_W:      1280,
  CANVAS_H:      720,

  /* ── Physics ── */
  GRAVITY:        0.38,
  MAX_FALL:      16,
  GROUND_FRIC:   0.82,
  AIR_FRIC:      0.94,
  BOUNCE_DAMP:   0.45,   // velocity retained on bounce
  RUN_ACCEL:     0.55,
  RUN_MAX:       5.2,
  AIR_ACCEL:     0.38,
  JUMP_FORCE:   -9.0,
  DOUBLE_JUMP:  -7.0,

  /* ── Coyote / Buffer ── */
  COYOTE_FRAMES:  8,
  JUMP_BUFFER:    10,

  /* ── Player ── */
  PLAYER_R:       9,
  PLAYER_LIVES:   6,   // stored as half-hearts; 6 = 3 full hearts
  HURT_FRAMES:    90,
  INVULN_FRAMES:  180,   // 3 seconds at 60fps — used after every respawn
  RESPAWN_DELAY:  80,

  /* ── Camera ── */
  CAM_LOOKAHEAD:  80,
  CAM_SMOOTH:     0.14,
  SHAKE_DECAY:    0.88,

  /* ── Particles ── */
  PARTICLE_POOL:  800,

  /* ── Scoring ── */
  GEM_SCORE:      10,
  COIN_SCORE:     5,
  ENEMY_SCORE:    25,
  COMBO_WINDOW:   180,  // frames

  /* ── Powerup Durations (frames at 60fps) ── */
  PU_SHIELD:      360,
  PU_SPEED:       300,
  PU_DBLJ:        300,
  PU_MAGNET:      360,
  PU_INVINC:      240,
  PU_LOWGRAV:     300,

  /* ── Misc ── */
  TILE:           16,
  FPS_CAP:        60,
  DEBUG:          false,
});