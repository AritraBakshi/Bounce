/* ============================================================
   enemy.js — Enemy entity types.
   Types: mine | drone | jumper | crawler
   Each has its own AI behaviour and draw routine.
   ============================================================ */

class Enemy {
  constructor(def) {
    this.x     = def.x;
    this.y     = def.y;
    this.r     = def.r || 7;
    this.type  = def.type || 'mine';
    this.theme = def.theme ?? 0;

    this.vx    = 0;
    this.vy    = 0;
    this.alive = true;
    this.value = C.ENEMY_SCORE;

    // Patrol
    this._ox        = def.x;
    this._patrolRange = def.patrolRange || 48;
    this._speed     = def.speed || 0.9;
    this._dir       = def.dir  || 1;
    this._onGround  = false;

    // Chase
    this._chaseRange  = def.chaseRange  || 80;
    this._chaseSpeed  = def.chaseSpeed  || 1.4;
    this._alerted     = false;

    // Jumper
    this._jumpTimer   = MathUtils.randInt(60, 120);
    this._jumpCooldown= 90;

    // Drone
    this._floatY    = def.y;
    this._floatAmp  = def.floatAmp || 12;
    this._t         = Math.random() * Math.PI * 2;
    this._laserCharge = 0;

    // Hurt flash
    this._hurtTimer = 0;
    this._frame     = 0;
    this._deathTimer= 0;
    this.dead       = false;

    // Start pos
    this._startX = def.x;
    this._startY = def.y;
  }

  update(platforms, player, particles, physics) {
    if (this.dead) {
      this._deathTimer++;
      if (this._deathTimer > 40) this.alive = false;
      particles.trail(this.x, this.y, this.vx, this.vy, { r: 200, g: 100, b: 30 });
      this.vy += C.GRAVITY;
      this.x  += this.vx;
      this.y  += this.vy;
      return;
    }
    if (this._hurtTimer > 0) this._hurtTimer--;
    this._frame++;

    const px = player.x, py = player.y;
    const distToPlayer = MathUtils.dist(this.x, this.y, px, py);

    switch (this.type) {
      case 'mine':    this._updateMine(distToPlayer, px, py); break;
      case 'drone':   this._updateDrone(distToPlayer, px, py, player, particles); break;
      case 'jumper':  this._updateJumper(distToPlayer, px, py, platforms, physics); break;
      case 'crawler': this._updateCrawler(platforms, physics); break;
    }
  }

  _updateMine(dist, px, py) {
    // Patrol until player in range, then chase
    if (dist < this._chaseRange) {
      this._alerted = true;
    }
    if (this._alerted && dist < this._chaseRange * 1.5) {
      const dx = px - this.x;
      this.vx  = MathUtils.lerp(this.vx, Math.sign(dx) * this._chaseSpeed, 0.08);
    } else {
      this._alerted = false;
      // Patrol
      this.vx = this._dir * this._speed;
      if (Math.abs(this.x - this._ox) > this._patrolRange) this._dir *= -1;
    }
    this.vy = Math.min(this.vy + C.GRAVITY, C.MAX_FALL);
    this.x += this.vx;
    this.y += this.vy;
    this._onGround = false;  // resolved in physics pass
  }

  _updateDrone(dist, px, py, player, particles) {
    this._t += 0.04;
    this.y   = this._floatY + Math.sin(this._t) * this._floatAmp;

    if (dist < this._chaseRange) {
      this._alerted = true;
      const dx = px - this.x;
      const dy = py - this.y;
      const len = Math.sqrt(dx*dx+dy*dy)||1;
      this.vx = MathUtils.lerp(this.vx, (dx/len)*this._chaseSpeed, 0.04);
      this.vy = MathUtils.lerp(this.vy, (dy/len)*this._chaseSpeed, 0.04);

      // --- Lethal Target Laser system ---
      this._laserCharge++;
      if (this._laserCharge >= 110) { // Fires every ~1.8 seconds
        this._laserCharge = 0;
        
        // Unleash blast particles
        particles.burst(this.x, this.y, 10, 255, 30, 30, 3.5, 24, 2.5);
        
        // Spawn energetic laser trail particles towards the player
        for (let step = 0; step < dist; step += 12) {
          const t = step / dist;
          particles.burst(this.x + dx * t, this.y + dy * t, 2, 255, 80, 80, 1.2, 4, 0.6);
        }

        // Deal real damage!
        player.hurt(); 
      }
    } else {
      this._alerted = false;
      this.vx = MathUtils.lerp(this.vx, 0, 0.06);
      this.vy = 0;
      this._laserCharge = 0;
    }
    this.x += this.vx;
  }

  _updateJumper(dist, px, py, platforms, physics) {
    this.vx += Math.sign(px - this.x) * 0.06;
    this.vx  = MathUtils.clamp(this.vx, -this._speed, this._speed);

    physics.integrate(this);
    const res = physics.resolveEntity(this, platforms);
    this._onGround = res.onGround;

    if (this._onGround) {
      this._jumpTimer--;
      if (this._jumpTimer <= 0 && dist < this._chaseRange) {
        this.vy = C.JUMP_FORCE * 0.8;
        this._jumpTimer = this._jumpCooldown;
      }
    }
  }

  _updateCrawler(platforms, physics) {
    this.vx = this._dir * this._speed * 0.7;

    // --- SENSE PLATFORM EDGES ---
    const checkDistX = this._dir * (this.r + 5);
    const checkX = this.x + checkDistX;
    const checkY = this.y + this.r + 5;
    
    let groundAhead = false;
    for (const plat of platforms) {
      if (!plat.solid) continue;
      // Is check point inside platform bounds?
      if (checkX >= plat.x && checkX <= plat.x + plat.w &&
          checkY >= plat.y - 2 && checkY <= plat.y + plat.h + 5) {
        groundAhead = true;
        break;
      }
    }

    // Flip direction if on ground and we are about to slide off!
    if (this._onGround && !groundAhead) {
      this._dir *= -1;
      this.vx = this._dir * this._speed * 0.7;
    }

    physics.integrate(this);
    const res = physics.resolveEntity(this, platforms);
    this._onGround = res.onGround;

    // Reverse at patrol edge
    if (Math.abs(this.x - this._ox) > this._patrolRange) this._dir *= -1;
    // Turn on wall hit
    if (Math.abs(this.vx) < 0.1 && this._frame % 3 === 0) this._dir *= -1;
  }

  hit(particles) {
    this.dead        = true;
    this._hurtTimer  = 10;
    particles.burst(this.x, this.y, 14, 200, 80, 20, 4, 45, 3);
    particles.floatText(this.x, this.y - 10, `+${this.value}`, '#ff9944');
  }

  draw(ctx, cam, player) {
    if (!this.alive) return;
    if (!cam.isVisible(this.x - this.r, this.y - this.r, this.r*2, this.r*2)) return;

    ctx.save();
    if (this._hurtTimer > 0) ctx.globalAlpha = this._hurtTimer % 3 < 1 ? 0.3 : 1;
    if (this.dead) {
      ctx.globalAlpha = 1 - this._deathTimer / 40;
      ctx.translate(this.x, this.y);
      ctx.rotate(this._deathTimer * 0.25);
      ctx.translate(-this.x, -this.y);
    }

    switch (this.type) {
      case 'mine':    this._drawMine(ctx);    break;
      case 'drone':   this._drawDrone(ctx, player);   break;
      case 'jumper':  this._drawJumper(ctx);  break;
      case 'crawler': this._drawCrawler2(ctx);break;
    }
    ctx.restore();
  }

  _drawMine(ctx) {
    const pulse = Math.sin(this._frame * 0.18) * 0.4 + 0.6;
    const alert = this._alerted;

    // Outer warning ring
    ctx.strokeStyle = alert ? `rgba(255,60,0,${pulse})` : `rgba(200,80,0,${pulse * 0.5})`;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r + 1, this.r * 0.8, 3, 0, 0, Math.PI*2); ctx.fill();

    // Body gradient
    ctx.shadowColor = alert ? '#ff2200' : '#aa3300';
    ctx.shadowBlur  = alert ? 12 * pulse : 6;
    const bg = ctx.createRadialGradient(this.x - 2.5, this.y - 2.5, 0.5, this.x, this.y, this.r);
    bg.addColorStop(0,   '#ff7755');
    bg.addColorStop(0.45,'#cc2200');
    bg.addColorStop(0.8, '#881100');
    bg.addColorStop(1,   '#3a0500');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Rotating spikes
    const spikeCount = alert ? 8 : 6;
    ctx.strokeStyle = alert ? '#ff6600' : '#cc4400';
    ctx.lineWidth   = 1.8;
    for (let i = 0; i < spikeCount; i++) {
      const a = (i / spikeCount) * Math.PI * 2 + this._frame * (alert ? 0.06 : 0.025);
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(a) * this.r * 0.75, this.y + Math.sin(a) * this.r * 0.75);
      ctx.lineTo(this.x + Math.cos(a) * this.r * 1.45, this.y + Math.sin(a) * this.r * 1.45);
      ctx.stroke();
    }

    // Skull face
    ctx.fillStyle = '#ffeecc';
    ctx.beginPath(); ctx.arc(this.x - 2.5, this.y - 1, 1.8, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.x + 2.5, this.y - 1, 1.8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#cc2200';
    ctx.beginPath(); ctx.arc(this.x - 2.5, this.y - 1, 0.9, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.x + 2.5, this.y - 1, 0.9, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffeecc';
    ctx.fillRect(this.x - 3, this.y + 1.5, 2, 2);
    ctx.fillRect(this.x - 0.5, this.y + 1.5, 2, 2);
    ctx.fillRect(this.x + 2, this.y + 1.5, 2, 2);

    // Name label
    ctx.fillStyle = alert ? 'rgba(255,100,50,0.9)' : 'rgba(255,180,100,0.7)';
    ctx.font      = 'bold 5px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(alert ? '! MINE !' : 'MINE', this.x, this.y - this.r - 4);
  }

  _drawDrone(ctx, player) {
    const pulse = Math.sin(this._frame * 0.12) * 0.4 + 0.6;
    const spin  = this._frame * 0.35;

    // --- Dynamic Target Laser tracking player ---
    if (this._alerted && player) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx*dx+dy*dy) || 1;
      const angle = Math.atan2(dy, dx);
      const chargePct = (this._laserCharge || 0) / 110;

      ctx.save();
      // Draw targeting laser in world coordinates
      ctx.strokeStyle = chargePct > 0.85 ? `rgba(255,0,0,${pulse * 0.9})` : `rgba(255,60,60,${chargePct * 0.7 + 0.1})`;
      ctx.lineWidth   = chargePct > 0.85 ? 1.6 : 0.6;
      if (chargePct > 0.85) {
        ctx.setLineDash([]);
      } else {
        ctx.setLineDash([2, 3]);
      }
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(angle) * dist, this.y + Math.sin(angle) * dist);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur  = 8 * pulse;

    // Rotor blades (behind body)
    for (let arm = 0; arm < 4; arm++) {
      const a = spin + arm * Math.PI / 2;
      const ax = Math.cos(a) * this.r * 1.5, ay = Math.sin(a) * this.r * 0.5;
      ctx.strokeStyle = '#3a4a5a';
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.fillStyle = `rgba(0,200,255,${pulse * 0.45})`;
      ctx.beginPath(); ctx.ellipse(ax, ay, 4, 1.5, a, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = `rgba(0,220,255,${pulse * 0.7})`;
      ctx.lineWidth   = 0.8;
      ctx.beginPath(); ctx.ellipse(ax, ay, 4, 1.5, a, 0, Math.PI*2); ctx.stroke();
    }

    // Fuselage body
    const body = ctx.createRadialGradient(-2, -2, 0.5, 0, 0, this.r * 1.1);
    body.addColorStop(0,   '#4a6880');
    body.addColorStop(0.5, '#2a3f50');
    body.addColorStop(1,   '#111e28');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.r * 1.1, this.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cockpit dome
    ctx.fillStyle = `rgba(0,200,255,${pulse * 0.7})`;
    ctx.beginPath(); ctx.ellipse(0, -1, this.r * 0.45, this.r * 0.3, 0, 0, Math.PI*2); ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0;

    // DRONE label
    ctx.fillStyle = this._alerted ? 'rgba(255,60,60,0.9)' : 'rgba(0,220,255,0.7)';
    ctx.font      = 'bold 5px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(this._alerted ? '! LOCK !' : 'DRONE', this.x, this.y - this.r - 4);
  }

  _drawJumper(ctx) {
    const jumping = this.vy < -1;
    const sqX = jumping ? 0.75 : 1.15;
    const sqY = jumping ? 1.25 : 0.85;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r + 1, this.r * 0.8 * sqX, 2.5, 0, 0, Math.PI*2); ctx.fill();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(sqX, sqY);

    // Body
    const body = ctx.createRadialGradient(-2, -2, 0.5, 0, 0, this.r);
    body.addColorStop(0,   '#88ee55');
    body.addColorStop(0.5, '#44aa22');
    body.addColorStop(1,   '#226611');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill();

    // Specular ring
    ctx.strokeStyle = '#aaffaa';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.arc(0, 0, this.r - 0.5, 0, Math.PI * 2); ctx.stroke();

    // Head spikes
    const spikeH = jumping ? this.r * 1.8 : this.r * 1.4;
    ctx.fillStyle = '#33bb11';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 5 - 2.5, -this.r * 0.7);
      ctx.lineTo(i * 5,        -spikeH);
      ctx.lineTo(i * 5 + 2.5, -this.r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#88ff44';
      ctx.beginPath();
      ctx.moveTo(i * 5 - 1, -this.r * 0.7);
      ctx.lineTo(i * 5,      -spikeH);
      ctx.lineTo(i * 5 + 0.5,-this.r * 0.7 - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#33bb11';
    }

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(-2.8, -1, 2.2, 2.8, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 2.8, -1, 2.2, 2.8, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#003300';
    ctx.beginPath(); ctx.arc(-2.8, -0.5, 1.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( 2.8, -0.5, 1.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-2.2, -1.2, 0.6, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( 3.4, -1.2, 0.6, 0, Math.PI*2); ctx.fill();

    // Frown
    ctx.strokeStyle = '#226611';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(0, 2, 2.5, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // Feet
    ctx.fillStyle = '#33aa11';
    ctx.beginPath(); ctx.ellipse(-3, this.r - 1, 2.5, 2, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 3, this.r - 1, 2.5, 2, 0, 0, Math.PI*2); ctx.fill();

    ctx.restore();

    // Jump arc
    if (jumping) {
      ctx.strokeStyle = 'rgba(100,255,80,0.4)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 6, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Label
    ctx.fillStyle = 'rgba(120,255,80,0.8)';
    ctx.font      = 'bold 5px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('JUMPER', this.x, this.y - this.r * sqY - 5);
  }

  _drawCrawler2(ctx) {
    const f   = this._frame;
    const dir = this._dir;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r, this.r * 1.5, 2, 0, 0, Math.PI*2); ctx.fill();

    // Legs
    ctx.strokeStyle = '#aa7733';
    ctx.lineWidth   = 1;
    for (let leg = 0; leg < 6; leg++) {
      const side  = leg % 2 === 0 ? 1 : -1;
      const segOff= (Math.floor(leg / 2) - 1) * this.r * 0.9;
      const lx    = this.x + segOff * dir;
      const phase = Math.sin(f * 0.25 + leg * 1.05);
      ctx.beginPath();
      ctx.moveTo(lx, this.y + 2);
      ctx.lineTo(lx + side * 4, this.y + this.r * 0.8 + phase * 2);
      ctx.lineTo(lx + side * 7, this.y + this.r + 1);
      ctx.stroke();
    }

    // 3 body segments
    for (let i = 2; i >= 0; i--) {
      const segX  = this.x + (i - 1) * this.r * 0.95 * dir;
      const segY  = this.y + Math.sin(f * 0.18 + i * 1.2) * 1.5;
      const segR  = i === 1 ? this.r * 0.78 : this.r * 0.62;
      const light = i === 1 ? 1.2 : 1.0;

      const seg = ctx.createRadialGradient(segX - segR*0.3, segY - segR*0.3, 0.5, segX, segY, segR);
      seg.addColorStop(0,   `rgb(${Math.round(170*light)},${Math.round(110*light)},${Math.round(50*light)})`);
      seg.addColorStop(0.6, '#774422');
      seg.addColorStop(1,   '#3a1a08');
      ctx.fillStyle = seg;
      ctx.beginPath(); ctx.arc(segX, segY, segR, 0, Math.PI*2); ctx.fill();

      ctx.strokeStyle = 'rgba(255,160,60,0.3)';
      ctx.lineWidth   = 0.8;
      ctx.beginPath(); ctx.arc(segX, segY, segR - 0.5, 0, Math.PI*2); ctx.stroke();
    }

    // Head
    const hx = this.x + this.r * 0.95 * dir;
    const hy = this.y + Math.sin(f * 0.18 + 1.2) * 1.5;

    ctx.fillStyle = '#ffee00';
    ctx.beginPath(); ctx.arc(hx + dir * 2, hy - 2.5, 1.8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle  = '#cc8800';
    ctx.beginPath(); ctx.arc(hx + dir * 2, hy - 2.5, 0.9, 0, Math.PI*2); ctx.fill();

    // Antennae
    ctx.strokeStyle = '#bbaa55';
    ctx.lineWidth   = 0.9;
    ctx.beginPath();
    ctx.moveTo(hx + dir * 3, hy - 3);
    ctx.quadraticCurveTo(hx + dir * 8, hy - 9, hx + dir * 11, hy - 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + dir * 3, hy - 2);
    ctx.quadraticCurveTo(hx + dir * 9, hy - 5, hx + dir * 12, hy - 1);
    ctx.stroke();
    ctx.fillStyle = '#ffee88';
    ctx.beginPath(); ctx.arc(hx + dir * 11, hy - 7, 1.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + dir * 12, hy - 1, 1.2, 0, Math.PI*2); ctx.fill();

    // CRAWLER label
    ctx.fillStyle = 'rgba(220,150,60,0.8)';
    ctx.font      = 'bold 5px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('CRAWLER', this.x, this.y - this.r - 4);
  }

  reset() {
    this.x    = this._startX;
    this.y    = this._startY;
    this.vx   = 0;
    this.vy   = 0;
    this.alive = true;
    this.dead  = false;
    this._hurtTimer  = 0;
    this._deathTimer = 0;
    this._alerted    = false;
    this._laserCharge = 0;
    this._jumpTimer  = MathUtils.randInt(60, 120);
  }
}
