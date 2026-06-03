/* ============================================================
   BOUNCE — Main Stylesheet (with font consistency/scale fixes)
   ============================================================ */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --red:       #e8231a;
  --red-light: #ff5a50;
  --red-dark:  #a3100a;
  --gold:      #ffd700;
  --bg:        #0a0a12;
  --panel:     rgba(10,10,20,0.88);
  --glow-r:    rgba(232,35,26,0.6);
  --font-main: 'Courier New', Courier, monospace;
  --font-base: clamp(18px, 2.2vw, 36px);
  --font-title: clamp(32px, 6vw, 60px);
  --font-section: clamp(25px, 4vw, 45px);
  --font-bigicon: clamp(85px, 10vw, 160px);
  --canvas-shadow: 0 0 80px rgba(255,80,60,0.15),
                   0 0 180px rgba(255,80,60,0.08),
                   inset 0 0 30px rgba(255,255,255,0.04);
}

html, body {
  width: 100%; height: 100%;
  margin: 0; padding: 0;
  overflow: hidden;
  background: radial-gradient(circle at top, #141428 0%, #080810 55%, #020204 100%);
  font-family: var(--font-main);
  font-size: var(--font-base);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

#game-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

#gameCanvas {
  display: block;
  cursor: default;
  image-rendering: auto;
  filter:
    contrast(1.04)
    saturate(1.08)
    brightness(1.02)
    drop-shadow(0 0 18px rgba(255,80,60,0.22));
  will-change: transform;
  transform: translateZ(0);
  border-radius: 18px;
  box-shadow: var(--canvas-shadow);
}

#game-wrapper::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at center,
      rgba(255,255,255,0.02) 0%,
      rgba(0,0,0,0.18) 100%);
  z-index: 2;
}

/* ── Loading Screen ── */
#loading-screen {
  position: absolute;
  inset: 0;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  transition: opacity 0.6s ease;
}
#loading-screen.hidden { opacity: 0; pointer-events: none; }

.loading-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem !important;
}
.loading-ball {
  width: clamp(60px, 8vw, 140px);
  height: clamp(60px, 8vw, 140px);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ff7a6e, #e8231a 55%, #6b0d08);
  box-shadow: 0 0 30px var(--glow-r), 0 0 60px rgba(232,35,26,0.3);
  animation: loadBounce 0.7s ease-in-out infinite alternate;
}

@keyframes loadBounce {
  from { transform: translateY(0) scaleY(1) scaleX(1); }
  to   { transform: translateY(-28px) scaleY(1.08) scaleX(0.94); }
}

.loading-title {
  font-size: var(--font-title) !important;
  font-weight: 900 !important;
  color: #fff;
  text-shadow:
    0 0 20px var(--glow-r), 0 0 50px var(--glow-r);
  letter-spacing: 0.30em !important;
}

.loading-sub {
  color: rgba(255,255,255,0.8);
  font-size: clamp(1rem, 2vw, 2rem) !important;
  opacity: 0.9;
  letter-spacing: 0.13em;
}

.loading-bar-wrap {
  width: min(50vw, 420px) !important;
  height: 10px !important;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  overflow: hidden;
}

.loading-bar {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, var(--red), var(--red-light));
  border-radius: 2px;
  transition: width 0.3s ease;
  box-shadow: 0 0 8px var(--glow-r);
}

/* ── Mobile Controls ── */
#mobile-controls {
  position: fixed;
  bottom: 20px;
  left: 0;
  right: 0;
  width: 100%;
  height: auto;
  display: none;
  justify-content: center;
  align-items: flex-end;
  padding: 0 16px;
  pointer-events: none;
  z-index: 50;
}

/* Left
