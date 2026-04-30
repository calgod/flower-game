# Flower Runner

A third-person endless runner built with Three.js where a programmer runs through a surreal field of tall flowers on a rotating sphere. The peaceful, sun-drenched world gradually becomes corrupted with glitching geometry, dark particles, and digital artifacts.

## How to Play

- **A / ←** — Move left
- **D / →** — Move right
- Dodge the dark corruption blocks
- Survive as long as you can

## Tech Stack

- **Three.js** — 3D rendering
- **Vite** — Dev server and bundler
- **TypeScript** — Language

## Running Locally

```bash
npm install
npm run dev
```

## Project Structure

```
src/
  main.ts         — Game loop, camera, collision, restart
  scene.ts        — Renderer, lights, fog, sky
  player.ts       — Character model and movement
  controls.ts     — Keyboard input
  world.ts        — Rotating sphere, flowers, obstacles
  corruption.ts   — Time-ramped corruption effects
```

## Credits

Created with [Claude Opus 4.6](https://www.anthropic.com) (Anthropic) and [GitHub Copilot](https://github.com/features/copilot).
