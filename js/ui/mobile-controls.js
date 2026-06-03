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
    this.btnPauseUp = document.getElementById('btn-pause-up');
    this.btnPauseDown = document.getElementById('btn-pause-down');
  }

  /** Update button visibility based on game state */
  updateState(newState) {
    this.gameState = newState;
    this._updateButtonVisibility();
  }

  _updateButtonVisibility() {
    const isGameplay = this.gameState === 'playing';
    const isPause = this.gameState === 'paused';
    const isMenu = ['menu', 'levelSelect', 'scores', 'achievements', 'guide', 'gameover', 'victory'].includes(this.gameState);

    // Reset all to hidden first
    this.btnLeft.style.display = 'none';
    this.btnRight.style.display = 'none';
    this.btnUp.style.display = 'none';
    this.btnDown.style.display = 'none';
    this.btnJump.style.display = 'none';
    this.btnMute.style.display = 'none';
    this.btnEscape.style.display = 'none';
    this.btnPauseUp.style.display = 'none';
    this.btnPauseDown.style.display = 'none';

    if (isGameplay) {
      // GAMEPLAY MODE: Left (bottom-left), Jump (center), Right (bottom-right), Mute (top-left), Escape (top-right)
      this.btnLeft.style.display = 'flex';
      this.btnRight.style.display = 'flex';
      this.btnJump.style.display = 'flex';
      this.btnMute.style.display = 'flex';
      this.btnEscape.style.display = 'flex';
    } else if (isPause) {
      // PAUSE MODE: Left+Up (bottom-left, side-by-side), Jump (center), Right+Down (bottom-right, side-by-side), Mute (top-left), Escape (top-right)
      this.btnLeft.style.display = 'flex';
      this.btnRight.style.display = 'flex';
      this.btnJump.style.display = 'flex';
      this.btnMute.style.display = 'flex';
      this.btnEscape.style.display = 'flex';
      this.btnPauseUp.style.display = 'flex';   // Up button for pause menu nav (beside left)
      this.btnPauseDown.style.display = 'flex'; // Down button for pause menu nav (beside right)
    } else if (isMenu) {
      // MENU MODE: Up (bottom-left), Jump (center), Down (bottom-right), Escape (top-right only)
      this.btnUp.style.display = 'flex';
      this.btnDown.style.display = 'flex';
      this.btnJump.style.display = 'flex';
      this.btnEscape.style.display = 'flex';
    } else {
      // LOADING or other: hide all buttons
      this.btnJump.style.display = 'none';
    }
  }
}

// Create global instance
const mobileControls = new MobileControls();
