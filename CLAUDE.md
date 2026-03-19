# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Game Spec

`.claude/spec.md` — 게임의 모든 수치/동작을 정의한 스펙 파일. 이 파일을 수정하면 Claude가 읽고 `src/App.jsx`에 반영한다.

## Commands

```bash
npm run dev      # start dev server (Vite HMR)
npm run build    # production build → dist/
npm run preview  # serve dist/ locally
```

No test runner is configured.

## Deploy Workflow

When the user says "배포해줘":
1. **Spec sync** — `.claude/spec.md`와 `src/App.jsx`를 비교해 차이가 있으면 코드에 먼저 반영
2. `/simplify` — code review and cleanup
3. Test & review — run `npm run build`, check for issues
4. Apply review findings
5. `git commit && git push origin main`

Remote: `https://github.com/caseKim/case-beta.git`

## Architecture

Single-file React app (`src/App.jsx`). No routing, no external game libraries.

### Coordinate system
Canvas is fixed at **390×693 (9:16)** logical pixels. CSS scales it to fit the viewport via `CANVAS_STYLE` (uses `min(100dvw, ...)` / `min(100dvh, ...)`). All game positions are in logical pixels — never use `canvas.width`/`canvas.height` or `window.innerWidth` for game logic.

### State split: refs vs React state
The game loop runs inside `requestAnimationFrame` and reads/writes **refs** directly for performance. React **state** is only used to trigger re-renders for UI:

| Ref | Purpose |
|---|---|
| `playerRef` | `{x, y, r}` — mutated by touch/mouse handler |
| `enemiesRef`, `bulletsRef`, `effectsRef` | game object arrays — mutated every frame |
| `statsRef` | `{bulletSpeed, bulletR, shootInterval, multiShot}` — mutated by upgrade cards |
| `xpRef` | `{current, level, max}` — source of truth for XP logic |
| `scoreRef` | raw frame counter; `score` state updates every 60 frames |
| `gameOverRef` | stops the rAF loop synchronously from inside the loop |
| `rectRef` | cached `getBoundingClientRect()` — updated only on resize |
| `lastShotRef` | rAF timestamp of last shot |

React state (`score`, `xp`, `level`, `cards`, `gameOver`) exists solely to drive the HUD and overlays.

### Pause mechanism
`paused` is derived — not stored: `const paused = cards.length > 0`. Setting `setCards([...])` pauses the game; `setCards([])` resumes it. Both the rAF loop and the enemy spawner `useEffect` depend on `[gameOver, paused]` and simply return early when either is true, so clearing cards restarts both automatically.

### Game loop flow (per frame)
1. Clear canvas
2. Maybe fire bullet(s) based on `stats.shootInterval`
3. Move bullets, cull off-screen
4. O(enemies × bullets) collision → collect hit indices in Sets
5. Spawn effects (`ring`, `particle` ×6, `text`) at each killed enemy position
6. Remove hit enemies/bullets; update XP; on level-up call `setCards(pickCards())` and `return` (stops loop)
7. Draw+cull effects in one pass (`liveEffects` array)
8. Draw bullets
9. Move+draw enemies; check player collision → `setGameOver(true)` and `return`
10. Draw player
11. Increment `scoreRef`; call `setScore` every 60 frames

### Adding upgrades
Add an entry to the `UPGRADES` array at the top of `App.jsx`:
```js
{ label: '...', desc: '...', apply: (stats, player) => { /* mutate stats or player */ } }
```
`apply` receives `statsRef.current` and `playerRef.current` directly.

### Adding enemy types
Enemy objects are plain `{x, y, r, speed}`. Color is derived from `speed` at draw time (`speed === FAST_SPEED ? '#ff9f0a' : '#ff2d55'`). To add a new type, add a speed constant and extend the spawn logic + color check in the draw loop.
