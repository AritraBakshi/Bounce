/* ============================================================
   input.js — Unified input manager.
   Handles keyboard, touch virtual controls, and gamepad.
   All consumers read from InputManager.state (immutable copy
   per frame) rather than listening to raw events themselves.
   ============================================================ */

class InputManager {
  constructor() {
    /** Raw key state */
    this._keys   = {};
    /** Pressed this frame */
    this._justPressed  = {};
    /** Released this frame */
    this._justReleased = {};

    /** Public per-frame state (set in flush()) */
    this.state = this._blankState();

    /** Mobile button state */
    this._mobile = { left: false, right: false, jump: false };

    /** Gamepad axes snapshot */
    this._gp = null;

    this._bindKeyboard();
    this._bindMobileButtons();
    this._bindGamepad();
  }

  /* ── Internal ─────────────────────────────────────────── */

  _blankState() {
    return { left: false, right: false, jump: false, pause: false,
             jumpJustPressed: false, anyJustPressed: false };
  }

  _bindKeyboard() {
    window.addEventListener('keydown', e => {
      if (this._keys[e.code]) return;   // already held
      this._keys[e.code] = true;
      this._justPressed[e.code] = true;
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))
        e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      this._keys[e.code] = false;
      this._justReleased[e.code] = true;
    });
  }

  _bindMobileButtons() {
    const map = {
      'btn-left':  'left',
      'btn-right': 'right',
      'btn-jump':  'jump',
    };
    for (const [id, action] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (!el) continue;

      const start = (e) => {
        e.preventDefault();
        this._mobile[action] = true;
        el.classList.add('pressed');
        if (action === 'jump') this._justPressed['MobileJump'] = true;
      };
      const end = (e) => {
        e.preventDefault();
        this._mobile[action] = false;
        el.classList.remove('pressed');
      };

      el.addEventListener('touchstart',  start, { passive: false });
      el.addEventListener('touchend',    end,   { passive: false });
      el.addEventListener('touchcancel', end,   { passive: false });
      el.addEventListener('mousedown',   start);
      el.addEventListener('mouseup',     end);
    }
  }

  _bindGamepad() {
    window.addEventListener('gamepadconnected',    e => { this._gp = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', e => { if (this._gp === e.gamepad.index) this._gp = null; });
  }

  _pollGamepad() {
    if (this._gp === null) return;
    const gp = navigator.getGamepads ? navigator.getGamepads()[this._gp] : null;
    if (!gp) return;
    // Axis 0: left stick X
    const axisX = gp.axes[0] || 0;
    if (axisX < -0.3) this._keys['ArrowLeft']  = true;
    if (axisX >  0.3) this._keys['ArrowRight'] = true;
    // Button 0: A / Cross = jump
    if (gp.buttons[0]?.pressed) {
      if (!this._keys['GamepadJump']) this._justPressed['GamepadJump'] = true;
      this._keys['GamepadJump'] = true;
    } else {
      this._keys['GamepadJump'] = false;
    }
    // Button 9: Start = pause
    if (gp.buttons[9]?.pressed) this._justPressed['Escape'] = true;
  }

  /* ── Public ───────────────────────────────────────────── */

  /**
   * Called once per frame by Game before update().
   * Builds this.state and clears per-frame maps.
   */
  flush() {
    this._pollGamepad();

    const left  = !!(this._keys['ArrowLeft']  || this._keys['KeyA'] || this._mobile.left);
    const right = !!(this._keys['ArrowRight'] || this._keys['KeyD'] || this._mobile.right);
    const jump  = !!(this._keys['ArrowUp']    || this._keys['KeyW'] || this._keys['Space'] || this._mobile.jump || this._keys['GamepadJump']);
    const pause = !!(this._justPressed['Escape'] || this._justPressed['KeyP']);

    const jumpJustPressed = !!(
      this._justPressed['ArrowUp']   ||
      this._justPressed['KeyW']      ||
      this._justPressed['Space']     ||
      this._justPressed['MobileJump']||
      this._justPressed['GamepadJump']
    );

    // spaceOnly: true when ONLY Space (not ArrowUp/W) triggered the jump
    // Used by menus to avoid Up-arrow triggering selection
    const spaceOnly = !!(
      this._justPressed['Space'] ||
      this._justPressed['MobileJump'] ||
      this._justPressed['GamepadJump']
    );

    const anyJustPressed = Object.keys(this._justPressed).length > 0;

    this.state = { left, right, jump, pause, jumpJustPressed, spaceOnly, anyJustPressed };

    // Clear per-frame maps
    this._justPressed  = {};
    this._justReleased = {};
  }

  /** Check if a raw key is currently held */
  isHeld(code) { return !!this._keys[code]; }
}