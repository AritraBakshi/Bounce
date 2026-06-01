/* ============================================================
   audio.js — Procedural Web Audio API sound engine.
   All sounds are synthesised at runtime — no asset files
   needed. Each sound method returns the source node so
   callers can stop it early if needed.
   ============================================================ */

class AudioEngine {
  constructor() {
    this._ctx     = null;
    this._master  = null;
    this._bgGain  = null;
    this._sfxGain = null;
    this._bgNode  = null;
    this.muted    = Helpers.load('muted', false);
    this.bgVol    = Helpers.load('bgVol',  0.35);
    this.sfxVol   = Helpers.load('sfxVol', 0.55);
    this._started = false;
  }

  /* ── Initialise lazily on first user gesture ── */
  init() {
    if (this._started) return;
    this._started = true;
    try {
      this._ctx    = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._ctx.createGain();
      this._master.connect(this._ctx.destination);

      this._bgGain  = this._ctx.createGain();
      this._sfxGain = this._ctx.createGain();
      this._bgGain.connect(this._master);
      this._sfxGain.connect(this._master);

      this._applyVolumes();
    } catch(e) {
      console.warn('AudioEngine: Web Audio unavailable.', e);
    }
  }

  /* ── Volume helpers ── */
  _applyVolumes() {
    if (!this._ctx) return;
    const m = this.muted ? 0 : 1;
    this._bgGain.gain.setTargetAtTime(this.bgVol  * m, this._ctx.currentTime, 0.05);
    this._sfxGain.gain.setTargetAtTime(this.sfxVol * m, this._ctx.currentTime, 0.05);
  }

  setMute(v)   { this.muted  = v; Helpers.save('muted',  v); this._applyVolumes(); }
  toggleMute() { this.setMute(!this.muted); }
  setBgVol(v)  { this.bgVol  = v; Helpers.save('bgVol',  v); this._applyVolumes(); }
  setSfxVol(v) { this.sfxVol = v; Helpers.save('sfxVol', v); this._applyVolumes(); }

  /* ── Low-level helpers ── */
  _osc(type, freq, when, dur, gain, dest) {
    if (!this._ctx) return null;
    const g = this._ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    g.connect(dest || this._sfxGain);

    const o = this._ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    o.connect(g);
    o.start(when);
    o.stop(when + dur + 0.05);
    return o;
  }

  _noise(when, dur, gain, dest) {
    if (!this._ctx) return null;
    const buf = this._ctx.createBuffer(1, this._ctx.sampleRate * dur, this._ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = this._ctx.createBufferSource();
    src.buffer = buf;

    const g = this._ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(g);
    g.connect(dest || this._sfxGain);
    src.start(when);
    return src;
  }

  /* ── Sound Effects ── */
  playJump() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    const o = this._ctx.createOscillator();
    const g = this._ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(280, t);
    o.frequency.exponentialRampToValueAtTime(560, t + 0.12);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(this._sfxGain);
    o.start(t); o.stop(t + 0.2);
  }

  playBounce(vel = 5) {
    if (!this._ctx) return;
    const t    = this._ctx.currentTime;
    const freq = MathUtils.clamp(200 + vel * 30, 180, 480);
    const o    = this._ctx.createOscillator();
    const g    = this._ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq,       t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.09);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(this._sfxGain);
    o.start(t); o.stop(t + 0.14);
  }

  playCollect() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    [0, 0.06, 0.12].forEach((delay, i) => {
      this._osc('sine', [880, 1100, 1320][i], t + delay, 0.15, 0.12);
    });
  }

  playHurt() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    const o = this._ctx.createOscillator();
    const g = this._ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(440, t);
    o.frequency.linearRampToValueAtTime(110, t + 0.3);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(this._sfxGain);
    o.start(t); o.stop(t + 0.38);
    this._noise(t, 0.15, 0.08);
  }

  playDie() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    [440, 370, 310, 220, 150].forEach((f, i) => {
      this._osc('square', f, t + i * 0.06, 0.1, 0.15);
    });
  }

  playVictory() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    const melody = [523, 659, 784, 1047, 784, 1047];
    melody.forEach((f, i) => this._osc('square', f, t + i * 0.11, 0.15, 0.13));
  }

  playPowerup() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    const o = this._ctx.createOscillator();
    const g = this._ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(440, t);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.25);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g); g.connect(this._sfxGain);
    o.start(t); o.stop(t + 0.3);
  }

  playCheckpoint() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    [660, 880].forEach((f, i) => this._osc('sine', f, t + i * 0.1, 0.2, 0.14));
  }

  /* ── Background Music (procedural chiptune with dynamic tension) ── */
  startBgMusic(theme = 0) {
    this.stopBgMusic();
    if (!this._ctx) return;
    this.tension = 1.0; // default tension
    this._bgLooping = true;
    this._playBgLoop(theme);
  }

  _playBgLoop(theme) {
    if (!this._bgLooping || !this._ctx) return;
    const ctx = this._ctx;
    const t   = ctx.currentTime;
    
    // Dynamic tension factor (up to 1.3x speed and slight pitch shift up under pressure)
    const tMult = this.tension || 1.0;
    const bpm = [140, 120, 150, 100, 160][theme % 5] * tMult;
    const beat= 60 / bpm;
    const pitchShift = tMult > 1.1 ? 1.06 : 1.0; // slight pitch shift up for panic feel

    // Theme note sets
    const themes = [
      [262, 330, 392, 523, 392, 523, 659, 523],  // Grassland - C major
      [220, 277, 330, 415, 330, 415, 523, 415],  // Cave - A minor
      [233, 294, 349, 466, 349, 466, 587, 466],  // Industrial - Bb
      [196, 247, 294, 392, 294, 392, 494, 392],  // Lava - G minor
      [277, 349, 415, 554, 415, 554, 698, 554],  // Sky - Db
    ];
    const notes = themes[theme % themes.length];
    const dur   = beat * notes.length;

    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      // Sawtooth oscillator under high tension for an aggressive feel
      o.type = tMult > 1.2 ? 'sawtooth' : 'square';
      o.frequency.setValueAtTime(freq * pitchShift, t + i * beat);
      g.gain.setValueAtTime(0.0, t + i * beat);
      
      const gainVal = tMult > 1.2 ? 0.04 : 0.07; // adjust sawtooth gain so it's not too loud
      g.gain.linearRampToValueAtTime(gainVal, t + i * beat + 0.02);
      g.gain.setValueAtTime(gainVal, t + i * beat + beat * 0.7);
      g.gain.linearRampToValueAtTime(0.0, t + i * beat + beat * 0.95);
      o.connect(g); g.connect(this._bgGain);
      o.start(t + i * beat);
      o.stop(t + i * beat + beat);
    });

    // Bass line
    const bassNotes = [notes[0] / 2, notes[2] / 2, notes[4] / 2, notes[6] / 2];
    bassNotes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq * pitchShift, t + i * beat * 2);
      g.gain.setValueAtTime(0.06, t + i * beat * 2);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * beat * 2 + beat * 1.8);
      o.connect(g); g.connect(this._bgGain);
      o.start(t + i * beat * 2);
      o.stop(t + i * beat * 2 + beat * 2);
    });

    this._bgTimer = setTimeout(() => this._playBgLoop(theme), dur * 1000 - 50);
  }

  stopBgMusic() {
    this._bgLooping = false;
    if (this._bgTimer) { clearTimeout(this._bgTimer); this._bgTimer = null; }
  }

  resume() {
    if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume();
  }
}