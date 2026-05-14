/**
 * AudioManager — Web Audio API positional sound system.
 *
 * Design goals (from acceptance criteria):
 *   • AudioContext created on first user gesture (pointer-lock) — satisfies autoplay policy
 *   • playSound(name, worldPos?) — world-position sounds are distance-attenuated + panned L/R
 *   • Sounds loadable from /public/audio/ as .ogg or .mp3
 *   • Graceful fallback: if AudioContext unavailable, game continues silently
 *   • Music loops seamlessly; volume controlled via MUSIC_VOLUME constant
 *   • Synthesised fallbacks via oscillators when audio files are not present
 */

// ─── tuneable constants ───────────────────────────────────────────────────────
/** Max world-unit distance at which a positional sound is still audible. */
export const MAX_AUDIBLE_DISTANCE = 40;
/** Reference distance: full volume within this radius. */
export const REFERENCE_DISTANCE = 4;
/** Master volume for SFX (0–1). */
export const SFX_VOLUME = 0.65;
/** Master volume for music (0–1). */
export const MUSIC_VOLUME = 0.28;

export type SoundName =
  | 'gunshot_pp7'
  | 'gunshot_kf7'
  | 'explosion'
  | 'enemy_death'
  | 'enemy_alert'
  | 'door_open'
  | 'door_close'
  | 'footstep_left'
  | 'footstep_right'
  | 'footstep_stone_left'
  | 'footstep_stone_right'
  | 'player_hurt'
  | 'pickup'
  | 'reload'
  | 'empty_click';

interface SoundDef {
  file: string;
  synth: (ctx: AudioContext, dest: AudioNode, when: number) => number;
}

function ramp(param: AudioParam, from: number, to: number, start: number, end: number): void {
  param.setValueAtTime(from, start);
  param.linearRampToValueAtTime(to, end);
}

function expRamp(param: AudioParam, from: number, to: number, start: number, end: number): void {
  param.setValueAtTime(Math.max(from, 0.0001), start);
  param.exponentialRampToValueAtTime(Math.max(to, 0.0001), end);
}

function synthGunshotPP7(ctx: AudioContext, dest: AudioNode, when: number): number {
  const dur = 0.12;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  ramp(gain.gain, 1, 0, when, when + dur);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 900;
  src.connect(hp).connect(gain).connect(dest);
  src.start(when);
  src.stop(when + dur);
  const osc = ctx.createOscillator();
  osc.frequency.value = 120;
  const g2 = ctx.createGain();
  expRamp(g2.gain, 0.9, 0.0001, when, when + 0.08);
  osc.connect(g2).connect(dest);
  osc.start(when);
  osc.stop(when + 0.08);
  return when + dur;
}

function synthGunshotKF7(ctx: AudioContext, dest: AudioNode, when: number): number {
  let t = when;
  for (let i = 0; i < 3; i++) { synthGunshotPP7(ctx, dest, t); t += 0.09; }
  return t + 0.12;
}

function synthExplosion(ctx: AudioContext, dest: AudioNode, when: number): number {
  const dur = 1.4;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  expRamp(gain.gain, 1.2, 0.0001, when, when + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 260;
  src.connect(lp).connect(gain).connect(dest);
  src.start(when); src.stop(when + dur);
  const osc = ctx.createOscillator();
  osc.frequency.value = 55;
  const g2 = ctx.createGain();
  expRamp(g2.gain, 1.5, 0.0001, when, when + 0.6);
  osc.connect(g2).connect(dest); osc.start(when); osc.stop(when + 0.6);
  return when + dur;
}

function synthEnemyDeath(ctx: AudioContext, dest: AudioNode, when: number): number {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(260, when);
  osc.frequency.linearRampToValueAtTime(90, when + 0.35);
  const gain = ctx.createGain();
  ramp(gain.gain, 0.4, 0, when, when + 0.35);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
  osc.connect(lp).connect(gain).connect(dest); osc.start(when); osc.stop(when + 0.35);
  return when + 0.35;
}

function synthEnemyAlert(ctx: AudioContext, dest: AudioNode, when: number): number {
  for (const [f, dt] of [[880, 0], [1100, 0.12]] as [number, number][]) {
    const osc = ctx.createOscillator(); osc.frequency.value = f; osc.type = 'square';
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, when + dt); g.gain.linearRampToValueAtTime(0, when + dt + 0.09);
    osc.connect(g).connect(dest); osc.start(when + dt); osc.stop(when + dt + 0.09);
  }
  return when + 0.21;
}

function synthDoorOpen(ctx: AudioContext, dest: AudioNode, when: number): number {
  const dur = 0.4;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const gain = ctx.createGain(); ramp(gain.gain, 0.6, 0, when, when + dur);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.5;
  src.connect(bp).connect(gain).connect(dest); src.start(when); src.stop(when + dur);
  return when + dur;
}

function synthDoorClose(ctx: AudioContext, dest: AudioNode, when: number): number {
  const dur = 0.25;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const gain = ctx.createGain(); ramp(gain.gain, 0.9, 0, when, when + dur);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
  src.connect(hp).connect(gain).connect(dest); src.start(when); src.stop(when + dur);
  return when + dur;
}

function synthFootstep(ctx: AudioContext, dest: AudioNode, when: number, stone = false): number {
  const freq = stone ? 140 : 90;
  const dur = stone ? 0.08 : 0.12;
  const osc = ctx.createOscillator(); osc.frequency.value = freq;
  const gain = ctx.createGain(); ramp(gain.gain, 0.45, 0, when, when + dur);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = stone ? 700 : 400;
  osc.connect(lp).connect(gain).connect(dest); osc.start(when); osc.stop(when + dur);
  return when + dur;
}

function synthPlayerHurt(ctx: AudioContext, dest: AudioNode, when: number): number {
  const osc = ctx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, when); osc.frequency.linearRampToValueAtTime(160, when + 0.18);
  const g = ctx.createGain(); ramp(g.gain, 0.35, 0, when, when + 0.18);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
  osc.connect(lp).connect(g).connect(dest); osc.start(when); osc.stop(when + 0.18);
  return when + 0.18;
}

function synthPickup(ctx: AudioContext, dest: AudioNode, when: number): number {
  for (const [f, dt] of [[523, 0], [659, 0.08], [784, 0.16]] as [number, number][]) {
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, when + dt); g.gain.exponentialRampToValueAtTime(0.001, when + dt + 0.18);
    osc.connect(g).connect(dest); osc.start(when + dt); osc.stop(when + dt + 0.2);
  }
  return when + 0.36;
}

function synthReload(ctx: AudioContext, dest: AudioNode, when: number): number {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.04), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.5, when); g.gain.linearRampToValueAtTime(0, when + 0.04);
  src.connect(g).connect(dest); src.start(when); src.stop(when + 0.04);
  return when + 0.04;
}

function synthEmptyClick(ctx: AudioContext, dest: AudioNode, when: number): number {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.03), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); ramp(g.gain, 0.4, 0, when, when + 0.03);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2000;
  src.connect(hp).connect(g).connect(dest); src.start(when); src.stop(when + 0.03);
  return when + 0.03;
}

const SOUND_DEFS: Record<SoundName, SoundDef> = {
  gunshot_pp7:         { file: 'gunshot_pp7',         synth: synthGunshotPP7 },
  gunshot_kf7:         { file: 'gunshot_kf7',         synth: synthGunshotKF7 },
  explosion:           { file: 'explosion',           synth: synthExplosion },
  enemy_death:         { file: 'enemy_death',         synth: synthEnemyDeath },
  enemy_alert:         { file: 'enemy_alert',         synth: synthEnemyAlert },
  door_open:           { file: 'door_open',           synth: synthDoorOpen },
  door_close:          { file: 'door_close',          synth: synthDoorClose },
  footstep_left:       { file: 'footstep_left',       synth: (c,d,w) => synthFootstep(c,d,w,false) },
  footstep_right:      { file: 'footstep_right',      synth: (c,d,w) => synthFootstep(c,d,w,false) },
  footstep_stone_left: { file: 'footstep_stone_left', synth: (c,d,w) => synthFootstep(c,d,w,true) },
  footstep_stone_right:{ file: 'footstep_stone_right',synth: (c,d,w) => synthFootstep(c,d,w,true) },
  player_hurt:         { file: 'player_hurt',         synth: synthPlayerHurt },
  pickup:              { file: 'pickup',              synth: synthPickup },
  reload:              { file: 'reload',              synth: synthReload },
  empty_click:         { file: 'empty_click',         synth: synthEmptyClick },
};

export interface Vec2 { x: number; z: number; }

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers = new Map<SoundName, AudioBuffer | null>();
  private musicNodes: { osc?: OscillatorNode; src?: AudioBufferSourceNode; gain: GainNode } | null = null;

  private _ready = false;
  get ready(): boolean { return this._ready; }

  playerPos: Vec2 = { x: 0, z: 0 };
  playerYaw = 0;
  musicEnabled = true;

  private _musicVolume = MUSIC_VOLUME;
  get musicVolume(): number { return this._musicVolume; }
  set musicVolume(v: number) {
    this._musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) this.musicGain.gain.value = this._musicVolume;
  }

  private _sfxVolume = SFX_VOLUME;
  get sfxVolume(): number { return this._sfxVolume; }
  set sfxVolume(v: number) {
    this._sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this._sfxVolume;
  }

  async init(): Promise<void> {
    if (this._ready) return;
    try {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) { console.warn('[AudioManager] Web Audio API not available.'); return; }
      this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') await this.ctx.resume();

      this.masterGain = this.ctx.createGain(); this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this._sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this._musicVolume;
      this.musicGain.connect(this.masterGain);

      this._ready = true;
      void this._loadAllSounds();
    } catch (err) { console.warn('[AudioManager] Failed to create AudioContext:', err); }
  }

  private async _loadAllSounds(): Promise<void> {
    if (!this.ctx) return;
    const exts = ['ogg', 'mp3'];
    const names = Object.keys(SOUND_DEFS) as SoundName[];
    await Promise.all(names.map(async (name) => {
      const def = SOUND_DEFS[name];
      for (const ext of exts) {
        try {
          const res = await fetch(`/audio/${def.file}.${ext}`);
          if (!res.ok) continue;
          const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(name, buf); return;
        } catch { /* try next ext */ }
      }
      this.buffers.set(name, null);
    }));
  }

  playSound(name: SoundName, worldPos?: Vec2, pitchVariance = 0): void {
    if (!this._ready || !this.ctx || !this.sfxGain) return;
    const def = SOUND_DEFS[name];
    if (!def) return;

    const when = this.ctx.currentTime;
    let volumeScale = 1;
    let pan = 0;

    if (worldPos) {
      const dx = worldPos.x - this.playerPos.x;
      const dz = worldPos.z - this.playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > MAX_AUDIBLE_DISTANCE) return;
      if (dist > REFERENCE_DISTANCE) {
        const ratio = REFERENCE_DISTANCE / dist;
        volumeScale = ratio * ratio;
      }
      const rightX = Math.sin(this.playerYaw + Math.PI / 2);
      const rightZ = Math.cos(this.playerYaw + Math.PI / 2);
      const dot = (dx * rightX + dz * rightZ) / Math.max(dist, 0.01);
      pan = Math.max(-1, Math.min(1, dot));
    }

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volumeScale;

    if (pan !== 0) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      gainNode.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      gainNode.connect(this.sfxGain);
    }

    const buf = this.buffers.get(name);
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      if (pitchVariance > 0) src.detune.value = (Math.random() * 2 - 1) * pitchVariance * 100;
      src.connect(gainNode);
      src.start(when);
    } else {
      def.synth(this.ctx, gainNode, when);
    }
  }

  startMusic(): void {
    if (!this._ready || !this.ctx || !this.musicGain) return;
    if (this.musicNodes) return;

    const gain = this.ctx.createGain();
    gain.gain.value = 1;
    gain.connect(this.musicGain);

    const exts = ['ogg', 'mp3'];
    const tryLoad = async () => {
      for (const ext of exts) {
        try {
          const res = await fetch(`/audio/music_ambient.${ext}`);
          if (!res.ok) continue;
          const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
          const src = this.ctx!.createBufferSource();
          src.buffer = buf; src.loop = true;
          src.connect(gain); src.start(0);
          this.musicNodes = { src, gain }; return;
        } catch { /* try next */ }
      }
      this._startSynthMusic(gain);
    };
    void tryLoad();
  }

  stopMusic(): void {
    if (!this.musicNodes) return;
    try {
      if (this.musicNodes.osc) { this.musicNodes.osc.stop(); this.musicNodes.osc.disconnect(); }
      if (this.musicNodes.src) { this.musicNodes.src.stop(); this.musicNodes.src.disconnect(); }
      this.musicNodes.gain.disconnect();
    } catch { /* ignore */ }
    this.musicNodes = null;
  }

  toggleMusic(): void {
    if (this.musicNodes) { this.stopMusic(); this.musicEnabled = false; }
    else { this.musicEnabled = true; this.startMusic(); }
  }

  private _startSynthMusic(dest: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Pad layer
    const padGain = ctx.createGain(); padGain.gain.value = 0.12; padGain.connect(dest);
    const padNotes = [110, 138.6, 164.8, 220];
    for (const freq of padNotes) {
      for (const detune of [-6, 0, 6]) {
        const osc = ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.value = freq; osc.detune.value = detune;
        const g = ctx.createGain(); g.gain.value = 0.25;
        osc.connect(g).connect(padGain); osc.start();
      }
    }

    // Bass ostinato
    const bassGain = ctx.createGain(); bassGain.gain.value = 0.35;
    const bassLp = ctx.createBiquadFilter(); bassLp.type = 'lowpass'; bassLp.frequency.value = 380;
    bassGain.connect(bassLp).connect(dest);

    const bassPattern: [number, number, number][] = [
      [55,0,0.45],[55,0.55,0.45],[62,1.1,0.45],[55,1.65,0.45],
      [49,2.2,0.9],[55,3.3,0.45],[58,3.85,0.45],[55,4.4,0.45],
      [52,4.95,0.45],[49,5.5,1.1],
    ];
    const loopLen = 6.6;

    const scheduleBassLoop = (startTime: number) => {
      for (const [freq, beat, dur] of bassPattern) {
        const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, startTime + beat);
        g.gain.linearRampToValueAtTime(1, startTime + beat + 0.02);
        g.gain.linearRampToValueAtTime(0.001, startTime + beat + dur);
        osc.connect(g).connect(bassGain);
        osc.start(startTime + beat); osc.stop(startTime + beat + dur + 0.05);
      }
    };

    let loopStart = ctx.currentTime;
    const scheduleLoops = () => {
      while (loopStart < ctx.currentTime + 3 * loopLen) { scheduleBassLoop(loopStart); loopStart += loopLen; }
    };
    scheduleLoops();
    const intervalId = setInterval(scheduleLoops, (loopLen * 1000) / 2);

    // Kick
    const kickGain = ctx.createGain(); kickGain.gain.value = 0.55; kickGain.connect(dest);
    const scheduleKick = (startTime: number) => {
      for (let b = 0; b < 12; b += 3) {
        const t = startTime + b * 0.55;
        const osc = ctx.createOscillator();
        osc.frequency.setValueAtTime(100, t); osc.frequency.exponentialRampToValueAtTime(25, t + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(Math.max(0.9, 0.0001), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(g).connect(kickGain); osc.start(t); osc.stop(t + 0.22);
      }
    };
    let kickStart = ctx.currentTime;
    const scheduleKicks = () => {
      while (kickStart < ctx.currentTime + 3 * loopLen) { scheduleKick(kickStart); kickStart += loopLen; }
    };
    scheduleKicks();
    const kickInterval = setInterval(scheduleKicks, (loopLen * 1000) / 2);

    // Shimmer noise
    const shimmerGain = ctx.createGain(); shimmerGain.gain.value = 0.04;
    const shimmerHp = ctx.createBiquadFilter(); shimmerHp.type = 'highpass'; shimmerHp.frequency.value = 4000;
    shimmerGain.connect(shimmerHp).connect(dest);
    const shimDur = 8;
    const shimBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * shimDur), ctx.sampleRate);
    const shimData = shimBuf.getChannelData(0);
    for (let i = 0; i < shimData.length; i++) shimData[i] = Math.random() * 2 - 1;
    const shimmerSrc = ctx.createBufferSource();
    shimmerSrc.buffer = shimBuf; shimmerSrc.loop = true;
    shimmerSrc.connect(shimmerGain); shimmerSrc.start(ctx.currentTime);

    const dummyOsc = ctx.createOscillator();
    const dummyGain = ctx.createGain(); dummyGain.gain.value = 0;
    dummyOsc.connect(dummyGain);
    this.musicNodes = { osc: dummyOsc, gain: dummyGain };

    const origStop = this.stopMusic.bind(this);
    this.stopMusic = () => {
      clearInterval(intervalId); clearInterval(kickInterval);
      try {
        shimmerSrc.stop(); shimmerSrc.disconnect();
        padGain.disconnect(); bassGain.disconnect(); kickGain.disconnect(); shimmerGain.disconnect();
      } catch { /* ignore */ }
      origStop();
      this.stopMusic = origStop;
    };
  }

  suspend(): void { this.ctx?.suspend(); }
  resume(): void { this.ctx?.resume(); }
  setMasterVolume(vol: number, rampTime = 0.1): void {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.linearRampToValueAtTime(
      Math.max(0, Math.min(1, vol)), this.ctx.currentTime + rampTime
    );
  }
}

export const audioManager = new AudioManager();
