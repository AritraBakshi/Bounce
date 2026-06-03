/* ============================================================
   mobile-controls.js — Dynamic button visibility and layout
   Shows/hides buttons based on game state
   ============================================================ */

class MobileControls {
  constructor() {
    this.gameState = 'loading'; // loading | menu | playing | paused | gameover | victory
    this._setupControls();
  }

  _setupControls() {
    // Get all button elements
    this.btnLeft = document.getElementById('btn-left');
    this.btnRight = document.getElementById('btn-right');
    this.btnUp = document.getElementById('btn-up');
    this.btnDown = document.getElementById('btn-down');
    this.btnJump = document.getElementById('btn-jump');
    this.btnMute = document.getElementById('btn-mute');
    this.btnEscape = document.getElementById('btn-escape');
  }

  /** Update button visibility based on game state */
  updateState(newState) {
    this.gameState = newState;
    this._updateButtonVisibility();
  }

  _updateButtonVisibility() {
    const isGameplay = this.gameState === 'playing';
    const isMenu = ['menu', 'pause', 'levelSelect', 'scores', 'achievements', 'guide', 'gameover', 'victory'].includes(this.gameState);

    if (isGameplay) {
      // GAMEPLAY MODE: Show left, right, jump, mute, escape
      this.btnLeft.style.display = 'flex';
      this.btnRight.style.display = 'flex';
      this.btnUp.style.display = 'none';
      this.btnDown.style.display = 'none';
      this.btnMute.style.display = 'flex';
      this.btnEscape.style.display = 'flex';
    } else if (isMenu) {
      // MENU MODE: Show up, down, jump only (no mute, no escape, no left/right)
      this.btnLeft.style.display = 'none';
      this.btnRight.style.display = 'none';
      this.btnUp.style.display = 'flex';
      this.btnDown.style.display = 'flex';
      this.btnMute.style.display = 'none';
      this.btnEscape.style.display = 'none';
    } else {
      // LOADING or other: hide all except jump
      this.btnLeft.style.display = 'none';
      this.btnRight.style.display = 'none';
      this.btnUp.style.display = 'none';
      this.btnDown.style.display = 'none';
      this.btnMute.style.display = 'none';
      this.btnEscape.style.display = 'none';
    }
  }
}

// Create global instance
const mobileControls = new MobileControls();
