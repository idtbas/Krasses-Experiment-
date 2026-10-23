// Kleine Klangkulisse mit WebAudio (startet erst nach einer Berührung – so will es iOS)
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.servoGain = null;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    // leises Servo-Summen
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 140;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 900; filt.Q.value = 2;
    this.servoGain = this.ctx.createGain();
    this.servoGain.gain.value = 0;
    osc.connect(filt); filt.connect(this.servoGain); this.servoGain.connect(this.master);
    osc.start();
    this.servoOsc = osc;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  tone(freq, dur, type = 'sine', vol = 0.25, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  beep(freq = 880, dur = 0.12) { this.tone(freq, dur, 'square', 0.12); }
  click() { this.tone(1400, 0.04, 'triangle', 0.08); }
  snap() { this.tone(520, 0.05, 'triangle', 0.12); this.tone(880, 0.05, 'triangle', 0.08, 0.03); }
  error() { this.tone(220, 0.25, 'sawtooth', 0.08); this.tone(160, 0.3, 'sawtooth', 0.08, 0.12); }
  start() { this.tone(660, 0.09, 'triangle', 0.14); this.tone(990, 0.12, 'triangle', 0.12, 0.08); }
  success() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.16, i * 0.11)); }
  grip() { this.tone(300, 0.06, 'square', 0.05); }

  // Lautstärke des Motorsummens nach Bewegung (0..1)
  servo(level) {
    if (!this.servoGain) return;
    const v = this.muted ? 0 : Math.min(0.05, level * 0.05);
    this.servoGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08);
    this.servoOsc.frequency.setTargetAtTime(120 + level * 160, this.ctx.currentTime, 0.1);
  }
}
