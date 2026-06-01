/* ============================================================
   physics.js — Physics step.
   Applies gravity, integrates velocity, then resolves
   circle-vs-rect collisions against all platforms.
   Also handles slopes, one-way platforms, and moving
   platform "carry" logic.
   ============================================================ */

class Physics {
  constructor() {
    this._gravity  = C.GRAVITY;
    this._maxFall  = C.MAX_FALL;
  }

  /* ── Dynamic Material & Surface Properties ────────────────
     Different platform themes have honest, physical behaviors:
     - Theme 0 (Grass): balanced friction, standard bounce
     - Theme 1 (Ice/Cave): slick sliding friction (0.97), low damping (0.3)
     - Theme 2 (Volcanic/Iron): hard and highly elastic (0.6 bounce)
     - Theme 4 (Sky/Cloud): super bouncy (0.85 bounce), cushions falls
  ── */
  _getSurfaceProperties(theme) {
    switch (theme) {
      case 1: // Ice / Slick Cave
        return { bounce: 0.28, friction: 0.97 }; // Low bounce, extremely slippery sliding
      case 2: // Magma / Hard Iron
        return { bounce: 0.60, friction: 0.84 }; // High elasticity, quick recovery
      case 4: // Sky / Cloud
        return { bounce: 0.85, friction: 0.88 }; // Massive bounce, soft landing feel
      case 0: // Grass / Normal
      default:
        return { bounce: C.BOUNCE_DAMP, friction: C.GROUND_FRIC };
    }
  }

  /* ── Apply per-entity gravity + integrate ── */
  integrate(entity, dt = 1) {
    // Gravity (modifiable by low-grav powerup)
    const grav = entity.lowGrav ? this._gravity * 0.38 : this._gravity;
    entity.vy  = Math.min(entity.vy + grav * dt, this._maxFall);

    entity.x  += entity.vx * dt;
    entity.y  += entity.vy * dt;
  }

  /* ── Full collision pass for the player ──────────────────
     Returns ground info: { onGround, onPlatform, groundNormal }
  ── */
  resolvePlayer(player, platforms) {
    let onGround    = false;
    let groundNorm  = { x: 0, y: -1 };
    let carrierVx   = 0;
    let carrierVy   = 0;
    let standingPlatTheme = 0;

    const r  = player.r;
    const cx = player.x;
    const cy = player.y;

    for (const plat of platforms) {
      if (!plat.solid) continue;

      // One-way: only collide from above
      if (plat.oneWay) {
        if (player.vy < 0) continue;            // rising — skip
        if (cy - r > plat.y + 2) continue;      // below platform — skip
      }

      const m = Collision.circleRect(player.x, player.y, r,
                                     plat.x, plat.y, plat.w, plat.h);
      if (!m) continue;

      const nx = m.normal.x;
      const ny = m.normal.y;

      // Push out
      player.x += nx * m.depth;
      player.y += ny * m.depth;

      // Fetch surface properties dynamically based on the platform's theme
      const props = this._getSurfaceProperties(plat.theme);

      // Velocity response
      const dot = MathUtils.dot(player.vx, player.vy, nx, ny);
      if (dot < 0) {
        if (ny < -0.5) {
          // Landing on top — bounce or stop
          const bounceVel = -player.vy * props.bounce;
          player.vy = Math.abs(bounceVel) > 1.5 ? bounceVel : 0;
          player.vx *= props.friction;

          onGround   = true;
          groundNorm = { x: nx, y: ny };
          standingPlatTheme = plat.theme;

          // Carry by moving platform
          if (plat.vx !== undefined) {
            carrierVx = plat.vx;
            carrierVy = plat.vy || 0;
          }
        } else if (ny > 0.5) {
          // Hit ceiling
          player.vy = Math.abs(player.vy) * 0.2;
        } else {
          // Side wall
          player.vx -= nx * dot;
          player.vx *= 0.6;
        }
      }
    }

    // Apply carrier velocity if standing on moving platform
    if (onGround && (carrierVx !== 0 || carrierVy !== 0)) {
      player.x += carrierVx;
      player.y += carrierVy;
    }

    // Save standing theme on player to use for input friction
    player.standingPlatTheme = standingPlatTheme;

    return { onGround, groundNorm, carrierVx };
  }

  /* ── Simple entity vs platforms (for enemies) ── */
  resolveEntity(entity, platforms) {
    let onGround = false;
    for (const plat of platforms) {
      if (!plat.solid || plat.oneWay) continue;
      const m = Collision.circleRect(entity.x, entity.y, entity.r || 6,
                                     plat.x, plat.y, plat.w, plat.h);
      if (!m) continue;
      entity.x += m.normal.x * m.depth;
      entity.y += m.normal.y * m.depth;
      const dot = MathUtils.dot(entity.vx, entity.vy, m.normal.x, m.normal.y);
      if (dot < 0) {
        entity.vx -= m.normal.x * dot;
        entity.vy -= m.normal.y * dot;
        if (m.normal.y < -0.5) { onGround = true; entity.vy = 0; }
      }
    }
    return { onGround };
  }

  /* ── Air friction ── */
  applyAirFriction(entity) {
    entity.vx *= C.AIR_FRIC;
  }

  /* ── Horizontal input movement ── */
  applyMovement(entity, dirX, onGround) {
    const theme = entity.standingPlatTheme || 0;
    const props = this._getSurfaceProperties(theme);
    const friction = props.friction;

    const accel = onGround ? C.RUN_ACCEL : C.AIR_ACCEL;
    const max   = entity.speedBoost ? C.RUN_MAX * 1.6 : C.RUN_MAX;

    entity.vx += dirX * accel;
    entity.vx  = MathUtils.clamp(entity.vx, -max, max);

    if (dirX === 0 && onGround) {
      entity.vx *= friction;
    }
  }

  /* ── Jump ── */
  jump(entity, isDouble = false) {
    entity.vy = isDouble ? C.DOUBLE_JUMP : C.JUMP_FORCE;
  }
}
