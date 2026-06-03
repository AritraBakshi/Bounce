/* ============================================================
   mobile-controls.js — Dynamic button visibility and layout
   Shows/hides buttons based on game state
   ============================================================ */

class MobileControls {
  constructor() {
    this.gameState = 'loading';
    this._setupControls();
  }

  _setupControls() {
    // Bottom row buttons
    this.btnLeft = document.getElementById('btn-left');
    this.btnRight = document.getElementById('btn-right');
    this.btnUp = document.getElementById('btn-up');
    this.btnDown = document.getElementById('btn-down');
    this.btnJump = document.getElementById('btn-jump');

    // Pause-specific buttons (side-by-side)
    this.btnPauseUp = document.getElementById('btn-pause-up');
    this.btnPauseDown = document.getElementById('btn-pause-down');

    // Top buttons
    this.btnMute = document.getElementById('btn-mute');
    this.btnEscape = document.getElementById('btn-escape');

    // Wait for elements if not yet loaded
    if (!this.btnLeft) {
      setTimeout(() => this._setupControls(), 100);
      return;
    }
  }

  updateState(newState) {
    this.gameState = newState;
    this._updateButtonVisibility();
  }

  _show(btn) {
    if (btn) {
      btn.style.removeProperty('display');
      btn.classList.remove('hidden-btn');
    }
  }

  _hide(btn) {
    if (btn) {
      btn.classList.add('hidden-btn');
    }
  }

  _updateButtonVisibility() {
    if (!this.btnLeft) return;

    const isGameplay = this.gameState === 'playing';
    const isPause = this.gameState === 'paused';
    const isMenu = ['menu', 'levelSelect', 'scores', 'achievements', 'guide', 'gameover', 'victory'].includes(this.gameState);

    // Hide all first
    this._hideAll();

    if (isGameplay) {
      // GAMEPLAY: Left | Jump | Right | Mute (top-left) | Escape (top-right)
      this._show(this.btnLeft);
      this._show(this.btnRight);
      this._show(this.btnJump);
      this._show(this.btnMute);
      this._show(this.btnEscape);
    } 
    else if (isPause) {
      // PAUSE: [Left + Up] | Jump | [Right + Down] | Mute (top-left) | Escape (top-right)
      this._show(this.btnLeft);
      this._show(this.btnRight);
      this._show(this.btnUp);
      this._show(this.btnDown);
      this._show(this.btnJump);
      this._show(this.btnPauseUp);
      this._show(this.btnPauseDown);
      this._show(this.btnMute);
      this._show(this.btnEscape);
    } 
    else if (isMenu) {
      // MENU: Up | Jump | Down | Escape (top-right) — NO MUTE
      this._show(this.btnUp);
      this._show(this.btnDown);
      this._show(this.btnJump);
      this._show(this.btnEscape);
    }
  }

  _hideAll() {
    [this.btnLeft, this.btnRight, this.btnUp, this.btnDown, this.btnJump, this.btnMute, this.btnEscape, this.btnPauseUp, this.btnPauseDown]
      .forEach(btn => this._hide(btn));
  }
}

// Create global instance
const mobileControls = new MobileControls();
