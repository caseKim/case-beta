# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Game Spec

`.claude/spec.md` — 게임의 모든 수치/동작을 정의한 스펙 파일. 이 파일을 수정하면 Claude가 읽고 `src/App.jsx`에 반영한다.

> spec.md와 실제 코드가 다를 수 있다. 실제 구현은 `src/App.jsx`가 정답이다.

## Commands

```bash
npm run dev      # start dev server (Vite HMR)
npm run build    # production build → dist/
npm run preview  # serve dist/ locally
```

No test runner is configured.

## Deploy Workflow

When the user says "배포해줘":
1. **Spec sync (양방향)** — `.claude/spec.md`와 `src/App.jsx`를 비교:
   - spec.md에만 있는 변경 → 코드에 반영
   - 코드에만 있는 변경 → spec.md에 반영 (코드가 정답)
2. `/simplify` — code review and cleanup
3. Test & review — run `npm run build`, check for issues
4. Apply review findings
5. `git commit && git push origin main`

Remote: `https://github.com/caseKim/case-beta.git`

## Architecture

Single-file React app (`src/App.jsx`). No routing, no external game libraries.

### Coordinate system
Canvas is fixed at **390×693 (9:16)** logical pixels. CSS scales it to fit the viewport via `CANVAS_STYLE`. All game positions are in logical pixels — never use `canvas.width`/`canvas.height` or `window.innerWidth` for game logic.

### State split: refs vs React state
The game loop runs inside `requestAnimationFrame` and reads/writes **refs** directly for performance. React **state** is only used to trigger re-renders for UI.

Key refs:

| Ref | Purpose |
|---|---|
| `playerRef` | `{x, y, r, shieldActive, leftWing, rightWing, cannonActive, …}` — mutated by input handler and upgrades |
| `enemiesRef`, `bulletsRef`, `effectsRef` | game object arrays — mutated every frame |
| `enemyBulletsRef`, `cannonShellsRef` | enemy projectiles and player cannon shells |
| `statsRef` | `{bulletSpeed, bulletR, bulletPower, shootInterval, shotCount}` — mutated by upgrade cards |
| `xpRef` | `{current, level, max}` — source of truth for XP logic |
| `scoreRef` | actual score accumulator (time + kills + stage bonuses) |
| `timeRef` | raw frame counter for survival time (÷60 = seconds) |
| `killCountRef` | cumulative kill count for the current run |
| `gameOverRef` | stops the rAF loop synchronously from inside the loop |
| `rectRef` | cached `getBoundingClientRect()` — updated only on resize |
| `lastShotRef` | rAF timestamp of last shot |
| `stageRef` | current stage number |
| `stagePhaseRef` | `'playing' \| 'warning' \| 'wave'` |
| `phaseStartRef` | `Date.now()` when the current playing/warning phase began — used to resume with correct remaining time after level-up pause |
| `waveRemainingRef` | enemies still to be spawned in the current wave (survives pause) |
| `energyCurRef` | current energy value for recharge interval (avoids stale closure) |
| `energyLastRechargeRef` | unix ms timestamp of last recharge tick — used to calculate offline recharge on load |

React state (`score`, `xp`, `level`, `stage`, `cards`, `gameOver`, `highScore`, `isNewRecord`, `finalStats`, `energy`, `nextRechargeSec`) exists solely to drive the HUD and overlays.

### Pause mechanism
`paused` is derived — not stored: `const paused = cards.length > 0`. Setting `setCards([...])` pauses the game; `setCards([])` resumes it. Both the rAF loop and the enemy spawner `useEffect` depend on `[gameOver, paused]` and return early when either is true.

The spawner effect is phase-aware on resume: it reads `stagePhaseRef` and `phaseStartRef` to continue with the correct remaining time instead of restarting the full interval.

### Score system
Score = **survival time** (1pt/sec) + **kills** (1pt each) + **stage bonuses** ((stage−1)×10 on each stage advance). All contributions are accumulated into `scoreRef.current`; `setScore(scoreRef.current)` is called whenever the score changes. High score is persisted to `localStorage` under key `voidHighScore`.

### Stage / wave cycle
Each stage: `playing → warning → wave → (next stage) playing → …`

- **playing**: trickle spawn every `max(600, 1300 − (stage−1)×40)` ms. Duration = `STAGE_PLAY_DURATION` (12 s), **except stage 1 which gets +3 s**.
- **warning**: 2 s overlay, no trickle.
- **wave**: `25 + floor((stage−1)/2)` enemies spawned over 3 s. Wave ends when all wave enemies (`isWave: true`) are killed or pass off-screen, or after 5 s max. Stage number increments on wave *end*, not wave start.

### Game loop flow (per frame)
1. Clear canvas
2. Smooth player X toward touch/mouse target (lerp 0.25)
3. Fire bullet(s) based on `stats.shootInterval`; right wing fires homing missile
4. Move bullets (homing missiles re-target each frame); cull off-screen
5. Fire / move cannon shells; collect explosions
6. Collision pass: cannon AoE → bullet×enemy → shield×enemy → laser×enemy (all HP-aware, collect hit indices in Sets)
7. Spawn death effects (`ring`, `particle ×6`, `text`) for each killed enemy
8. Remove hit enemies/bullets; check wave completion
9. Draw & cull effects in one pass
10. Draw bullets, cannon shells
11. Move & draw enemies; check player collision → game over
12. Draw player, wings, shield, laser beam
13. XP update; on level-up → `setCards(pickCards())` and `return`
14. Accumulate score: `scoreRef += kills` (if any); `scoreRef += 1` every 60 frames (survival time)

### Adding upgrades
Add an entry to the `UPGRADES` array:
```js
{ icon: 'iconName', label: '...', desc: '...', apply: (stats, player) => { /* mutate */ } }
```
- `icon` must match a case in `GameIcon` component (SVG icons inline in the file).
- Add a filter condition in `pickCards()` if the upgrade should only appear once or require a prerequisite.

### Adding enemy types
Enemy objects: `{x, y, r, speed, color, font, homing, shooter, hp, maxHp, …}`. Color is set explicitly at spawn in `makeEnemy()`. Add a speed constant, extend the spawn probability logic in `makeEnemy`, and handle movement/draw in the game loop.
