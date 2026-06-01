/* ============================================================
   main.js — Entry point.
   Creates the Game instance, wires the canvas, and starts.
   ============================================================ */

(function () {
  'use strict';

  const canvas = document.getElementById('gameCanvas');

  // Native resolution — renderer & camera work at this size;
  // CSS scaling (in Game._resize) handles the actual display.
  canvas.width  = C.CANVAS_W;
  canvas.height = C.CANVAS_H;

  // Disable right-click context menu on canvas
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Boot
  const game = new Game(canvas);

  // Expose globally for debugging
  if (C.DEBUG) window._game = game;

  // Init (async: fetches level JSON, shows loading bar, then menu)
  game.init().catch(err => console.error('Game init failed:', err));

  // Resume audio context on any interaction (browser autoplay policy)
  const resumeAudio = () => {
    game.audio.init();
    game.audio.resume();
  };
  window.addEventListener('pointerdown', resumeAudio, { once: true });
  window.addEventListener('keydown',     resumeAudio, { once: true });

})();