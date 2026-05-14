# tldrawdeneye — GoldenEye in tldraw

A GoldenEye-007-inspired raycaster FPS running entirely inside a
[tldraw](https://tldraw.dev) canvas, built with Vite + React + TypeScript.

## Getting started

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm run typecheck  # TypeScript type-checking (no emit)
npm run preview    # preview production build
```

## Architecture

```
src/
  engine/           # Raycaster, Camera, Input
  game/             # Game loop, Player, EnemySystem, DoorSystem, SpriteRenderer, World
  audio/            # AudioManager (Web Audio API, positional SFX + music)
  shapes/           # Custom tldraw ShapeUtils (GameViewportShape, MinimapShape)
  store/            # gameStore.ts — shared reactive state
  app/              # App.tsx, main.tsx — React entry point
```

The custom tldraw shapes (`GameViewportShape`, `MinimapShape`) embed the
raycaster canvas and top-down minimap directly into the tldraw document so
they can be repositioned, scaled, and annotated like any other tldraw shape.

## Roadmap

1. ✅ Project scaffold — Vite + React + TypeScript + tldraw shell
2. ⬜ Raycaster engine (Raycaster, Camera, World)
3. ⬜ Player movement & Input
4. ⬜ GameViewportShape — render raycaster output inside tldraw
5. ⬜ Enemy AI (EnemySystem)
6. ⬜ Doors (DoorSystem)
7. ⬜ Sprite rendering (SpriteRenderer)
8. ⬜ HUD & Minimap (MinimapShape)
9. ⬜ Audio (AudioManager)
10. ⬜ Level editor using tldraw tools

## Controls *(planned)*

| Key / action     | Effect                  |
|------------------|-------------------------|
| `WASD`           | Move                    |
| Mouse            | Look                    |
| Left mouse btn   | Fire                    |
| `E`              | Open / close door       |
| `R`              | Reload                  |
| `M`              | Toggle music            |
| `[` / `]`        | Music volume down / up  |
| `Esc`            | Pause                   |
