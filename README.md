# GoldenEye Demo — Web Audio FPS

A raycaster-based FPS browser game inspired by GoldenEye 007, built with TypeScript + Vite.

## Getting started

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm run typecheck  # TypeScript type-checking (no emit)
```

## Audio System

The audio system lives in `src/audio/AudioManager.ts`.

### Key features

| Feature | Detail |
|---------|--------|
| **Web Audio API** | `AudioContext` created on first pointer-lock gesture (satisfies autoplay policy) |
| **Positional audio** | `playSound(name, worldPos?)` — inverse-square distance attenuation + stereo pan |
| **Synthesiser fallbacks** | Every sound has a procedural oscillator/noise synth that runs when no audio file is present |
| **Music** | GoldenEye-style ambient track: synthesised pad + bass ostinato + kick + shimmer. Optionally loads `/public/audio/music_ambient.ogg` or `.mp3` and loops it |
| **Graceful degradation** | If `AudioContext` is unavailable the game runs silently |
| **Controls** | `M` toggles music · `[` / `]` adjust music volume |

### Constants (top of `AudioManager.ts`)

```ts
MAX_AUDIBLE_DISTANCE = 40   // world units — sounds beyond this are silent
REFERENCE_DISTANCE   = 4    // full-volume radius
SFX_VOLUME           = 0.65
MUSIC_VOLUME         = 0.28
```

### API

```ts
import { audioManager } from './audio/AudioManager';

// Must be called on a user gesture
await audioManager.init();

// Play a sound (optional world-position for attenuation + panning)
audioManager.playSound('gunshot_pp7');
audioManager.playSound('enemy_alert', { x: 12, z: 8 });

// Music
audioManager.startMusic();
audioManager.stopMusic();
audioManager.musicVolume = 0.4;   // 0–1
audioManager.sfxVolume   = 0.8;   // 0–1
```

### Adding real audio files

Drop `.ogg` or `.mp3` files into `public/audio/` following the naming convention in
[`public/audio/README.md`](public/audio/README.md). The manager auto-loads them at
start-up and prefers file playback over synthesis.

## Controls

| Key / action | Effect |
|---|---|
| `WASD` | Move |
| Mouse | Look |
| Left mouse button | Fire |
| `E` | Open/close door |
| `R` | Reload |
| `M` | Toggle music |
| `[` / `]` | Music volume down / up |
| `Esc` | Pause |
