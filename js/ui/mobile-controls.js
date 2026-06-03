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

  _updateButtonVisibility() {
    if (!this.btnLeft) return; // Not ready yet

    const isGameplay = this.gameState === 'playing';
    const isPause = this.gameState === 'paused';
    const isMenu = ['menu', 'levelSelect', 'scores', 'achievements', 'guide', 'gameover', 'victory'].includes(this.gameState);

    // Hide all first
    this._hideAll();

    if (isGameplay) {
      // GAMEPLAY: Left | Jump | Right | Mute (top-left) | Escape (top-right)
      this.btnLeft.style.display = 'flex';
      this.btnRight.style.display = 'flex';
      this.btnJump.style.display = 'flex';
      this.btnMute.style.display = 'flex';
      this.btnEscape.style.display = 'flex';
    } 
    else if (isPause) {
      // PAUSE: [Left + Up] | Jump | [Right + Down] | Mute (top-left) | Escape (top-right)
      this.btnLeft.style.display = 'flex';
      this.btnRight.style.display = 'flex';
      this.btnUp.style.display = 'flex';
      this.btnDown.style.display = 'flex';
      this.btnJump.style.display = 'flex';
      this.btnPauseUp.style.display = 'flex';
      this.btnPauseDown.style.display = 'flex';
      this.btnMute.style.display = 'flex';
      this.btnEscape.style.display = 'flex';
    } 
    else if (isMenu) {
      // MENU: Up | Jump | Down | Escape (top-right) — NO MUTE
      this.btnUp.style.display = 'flex';
      this.btnDown.style.display = 'flex';
      this.btnJump.style.display = 'flex';
      this.btnEscape.style.display = 'flex';
    }
  }

  _hideAll() {
    [this.btnLeft, this.btnRight, this.btnUp, this.btnDown, this.btnJump, this.btnMute, this.btnEscape, this.btnPauseUp, this.btnPauseDown]
      .forEach(btn => {
        if (btn) btn.style.display = 'none';
      });
  }
}

// Create global instance
const mobileControls = new MobileControls();
