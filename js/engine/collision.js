/* ============================================================
   collision.js — AABB + circle collision detection & response.
   All geometry tests return null (no hit) or a manifold:
     { normal: {x,y}, depth: number, point: {x,y} }
   ============================================================ */

const Collision = {

  /* ── Circle vs AABB ───────────────────────────────────────
     cx,cy = circle centre  r = radius
     rx,ry = rect top-left  rw,rh = rect size
     Returns manifold or null.
  ── */
  circleRect(cx, cy, r, rx, ry, rw, rh) {
    // Closest point on rect to circle centre
    const nearX = MathUtils.clamp(cx, rx, rx + rw);
    const nearY = MathUtils.clamp(cy, ry, ry + rh);
    const dx    = cx - nearX;
    const dy    = cy - nearY;
    const dist2 = dx * dx + dy * dy;

    if (dist2 >= r * r) return null;   // no overlap

    const dist = Math.sqrt(dist2);
    let nx, ny;

    if (dist === 0) {
      // Centre is inside rect — push out via shortest axis
      const overlapL = cx - rx;
      const overlapR = (rx + rw) - cx;
      const overlapT = cy - ry;
      const overlapB = (ry + rh) - cy;
      const min = Math.min(overlapL, overlapR, overlapT, overlapB);
      if      (min === overlapL) { nx = -1; ny = 0; }
      else if (min === overlapR) { nx =  1; ny = 0; }
      else if (min === overlapT) { nx =  0; ny = -1; }
      else                       { nx =  0; ny =  1; }
      return { normal: { x: nx, y: ny }, depth: min, point: { x: nearX, y: nearY } };
    }

    nx = dx / dist;
    ny = dy / dist;
    return {
      normal: { x: nx, y: ny },
      depth:  r - dist,
      point:  { x: nearX, y: nearY },
    };
  },

  /* ── Circle vs Circle ── */
  circleCircle(ax, ay, ar, bx, by, br) {
    const dx   = bx - ax, dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const sumR = ar + br;
    if (dist >= sumR) return null;
    const nx = dist === 0 ? 1 : dx / dist;
    const ny = dist === 0 ? 0 : dy / dist;
    return {
      normal: { x: nx, y: ny },
      depth:  sumR - dist,
      point:  { x: ax + nx * ar, y: ay + ny * ar },
    };
  },

  /* ── AABB vs AABB ── */
  rectRect(ax, ay, aw, ah, bx, by, bw, bh) {
    const overlapX = (ax + aw / 2) - (bx + bw / 2);
    const overlapY = (ay + ah / 2) - (by + bh / 2);
    const halfW    = (aw + bw) / 2;
    const halfH    = (ah + bh) / 2;
    if (Math.abs(overlapX) >= halfW || Math.abs(overlapY) >= halfH) return null;
    const depthX = halfW - Math.abs(overlapX);
    const depthY = halfH - Math.abs(overlapY);
    if (depthX < depthY) {
      const nx = overlapX > 0 ? 1 : -1;
      return { normal: { x: nx, y: 0 }, depth: depthX, point: { x: ax, y: ay } };
    } else {
      const ny = overlapY > 0 ? 1 : -1;
      return { normal: { x: 0, y: ny }, depth: depthY, point: { x: ax, y: ay } };
    }
  },

  /* ── Point inside AABB ── */
  pointRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  },

  /* ── Point inside circle ── */
  pointCircle(px, py, cx, cy, r) {
    const dx = px - cx, dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  },

  /* ── Sweep: moving circle vs static AABB ─────────────────
     Returns earliest collision time [0-1] or null.
     Used for tunnelling prevention on fast objects.
  ── */
  sweepCircleRect(cx, cy, vx, vy, r, rx, ry, rw, rh) {
    // Expand rect by radius (Minkowski sum)
    const ex = rx - r, ey = ry - r;
    const ew = rw + r * 2, eh = rh + r * 2;

    // Ray vs expanded rect
    let tmin = 0, tmax = 1;

    if (vx !== 0) {
      const t1 = (ex - cx) / vx;
      const t2 = (ex + ew - cx) / vx;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    } else if (cx < ex || cx > ex + ew) return null;

    if (vy !== 0) {
      const t1 = (ey - cy) / vy;
      const t2 = (ey + eh - cy) / vy;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    } else if (cy < ey || cy > ey + eh) return null;

    if (tmax < tmin || tmax < 0 || tmin > 1) return null;
    return Math.max(0, tmin);
  },

  /* ── Resolve: push circle out of AABB using manifold ── */
  resolve(entity, manifold) {
    entity.x += manifold.normal.x * manifold.depth;
    entity.y += manifold.normal.y * manifold.depth;

    // Cancel velocity component along normal
    const dot = MathUtils.dot(entity.vx, entity.vy,
                              manifold.normal.x, manifold.normal.y);
    if (dot < 0) {
      entity.vx -= manifold.normal.x * dot;
      entity.vy -= manifold.normal.y * dot;
    }
  },
};