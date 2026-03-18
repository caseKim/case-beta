import { useEffect, useRef, useState } from 'react'

// Fixed logical resolution — 9:16 (standard mobile)
const GAME_W = 390
const GAME_H = 693

const PLAYER_R       = 18
const ENEMY_R        = 14
const ENEMY_SPEED    = 2
const FAST_SPEED     = 5
const HOMING_SPEED   = 2.5
const SPAWN_INTERVAL = 1200
const DEFAULT_STATS  = { bulletSpeed: 6, bulletR: 3, shootInterval: 400, multiShot: false }

// CSS: scale canvas container to fit viewport, keep 9:16
const CANVAS_STYLE = {
  display: 'block',
  width:  `min(100dvw, calc(100dvh * ${GAME_W} / ${GAME_H}))`,
  height: `min(100dvh, calc(100dvw * ${GAME_H} / ${GAME_W}))`,
}

const UPGRADES = [
  { icon: 'rapid',   label: 'Rapid Fire',    desc: 'Shoot interval -100ms', apply: s     => { s.shootInterval = Math.max(100, s.shootInterval - 100) } },
  { icon: 'swift',   label: 'Swift Bullets', desc: 'Bullet speed +3',       apply: s     => { s.bulletSpeed += 3 } },
  { icon: 'bigshot', label: 'Big Shot',      desc: 'Bullet radius +4',      apply: s     => { s.bulletR += 4 } },
  { icon: 'guard',   label: 'Wide Guard',    desc: 'Player radius +8',      apply: (s,p) => { p.r += 8 } },
  { icon: 'double',  label: 'Double Shot',   desc: 'Fire 2 bullets',        apply: s     => { s.multiShot = true } },
]

function collides(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y
  const sr = a.r + b.r
  return dx * dx + dy * dy < sr * sr
}

function pickCards() {
  return [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3)
}

const mono    = { fontFamily: 'monospace' }
const overlay = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }

function GameIcon({ name, size = 44 }) {
  const g = { stroke: '#b388ff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
  const v = `0 0 ${size} ${size}`
  const h = size / 2, q = size / 4, t = size * 3 / 4

  if (name === 'rapid') // Three upward chevrons (speed)
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <polyline points={`${q},${t} ${h},${h+4} ${t},${t}`}/>
      <polyline points={`${q},${h+4} ${h},${h-6} ${t},${h+4}`}/>
      <polyline points={`${q},${q+2} ${h},${q-8} ${t},${q+2}`}/>
    </g></svg>

  if (name === 'swift') // Bullet shape + speed lines
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={h} cy={h-6} r={7}/>
      <line x1={h} y1={h+1} x2={h} y2={t+2}/>
      <line x1={q-2} y1={h+4} x2={q+5} y2={h+4}/>
      <line x1={q-2} y1={h+10} x2={q+5} y2={h+10}/>
    </g></svg>

  if (name === 'bigshot') // Large outer ring + filled center dot
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={h} cy={h} r={size*0.38}/>
      <circle cx={h} cy={h} r={5} fill='#b388ff'/>
    </g></svg>

  if (name === 'guard') // Concentric expanding circles
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={h} cy={h} r={7}/>
      <circle cx={h} cy={h} r={13} strokeOpacity={0.6}/>
      <circle cx={h} cy={h} r={size*0.42} strokeOpacity={0.3}/>
    </g></svg>

  if (name === 'double') // Two parallel bullets
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={h-9} cy={h-6} r={5}/>
      <line x1={h-9} y1={h-1} x2={h-9} y2={t+2}/>
      <circle cx={h+9} cy={h-6} r={5}/>
      <line x1={h+9} y1={h-1} x2={h+9} y2={t+2}/>
    </g></svg>

  return null
}

function drawCircle(ctx, x, y, r, color, blur) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.fill()
}

export default function App() {
  const [started,  setStarted]  = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [cards,    setCards]    = useState([])
  const [score,    setScore]    = useState(0)
  const [xp,       setXp]       = useState(0)
  const [level,    setLevel]    = useState(1)

  const paused = cards.length > 0

  const canvasRef   = useRef(null)
  const enemiesRef  = useRef([])
  const bulletsRef  = useRef([])
  const effectsRef  = useRef([])
  const playerRef   = useRef({ x: GAME_W / 2, y: GAME_H - 80, r: PLAYER_R })
  const rafRef      = useRef(null)
  const scoreRef    = useRef(0)
  const gameOverRef = useRef(false)
  const xpRef       = useRef({ current: 0, level: 1, max: 5 })
  const statsRef    = useRef({ ...DEFAULT_STATS })
  const lastShotRef = useRef(0)
  const rectRef     = useRef(null)  // cached canvas bounding rect

  // Set canvas logical size once
  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width  = GAME_W
    canvas.height = GAME_H
    rectRef.current = canvas.getBoundingClientRect()
  }, [])

  // Move player — map CSS coords → game coords using cached rect
  useEffect(() => {
    const canvas = canvasRef.current
    const onMove = (e) => {
      e.preventDefault()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const rect = rectRef.current
      playerRef.current.x = (clientX - rect.left) * (GAME_W / rect.width)
    }
    const onResize = () => { rectRef.current = canvas.getBoundingClientRect() }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('resize', onResize)
    return () => {
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('touchmove', onMove)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Spawn enemies
  useEffect(() => {
    if (!started || gameOver || paused) return
    const id = setInterval(() => {
      const rand   = Math.random()
      const fast   = rand < 0.25
      const homing = rand >= 0.85
      enemiesRef.current.push({
        x:     ENEMY_R + Math.random() * (GAME_W - ENEMY_R * 2),
        y:     -ENEMY_R,
        r:     fast ? ENEMY_R - 4 : ENEMY_R,
        speed: fast ? FAST_SPEED : homing ? HOMING_SPEED : ENEMY_SPEED,
        color: homing ? '#bf5af2' : fast ? '#ff9f0a' : '#ff2d55',
        homing,
      })
    }, SPAWN_INTERVAL)
    return () => clearInterval(id)
  }, [started, gameOver, paused])

  // Game loop
  useEffect(() => {
    if (!started || gameOver || paused) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const loop = (ts) => {
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, GAME_W, GAME_H)

      const stats = statsRef.current
      const p     = playerRef.current

      // Shoot
      if (ts - lastShotRef.current >= stats.shootInterval) {
        bulletsRef.current.push({ x: p.x, y: p.y - p.r, r: stats.bulletR })
        if (stats.multiShot) {
          bulletsRef.current.push({ x: p.x - 14, y: p.y - p.r, r: stats.bulletR })
          bulletsRef.current.push({ x: p.x + 14, y: p.y - p.r, r: stats.bulletR })
        }
        lastShotRef.current = ts
      }

      // Move bullets
      bulletsRef.current = bulletsRef.current.filter(b => b.y > -b.r)
      for (const b of bulletsRef.current) b.y -= stats.bulletSpeed

      // Bullet-enemy collisions
      const hitEnemies = new Set()
      const hitBullets = new Set()
      for (let ei = 0; ei < enemiesRef.current.length; ei++)
        for (let bi = 0; bi < bulletsRef.current.length; bi++)
          if (collides(enemiesRef.current[ei], bulletsRef.current[bi])) {
            hitEnemies.add(ei); hitBullets.add(bi)
          }

      const kills = hitEnemies.size
      enemiesRef.current.forEach((e, i) => {
        if (!hitEnemies.has(i)) return
        for (let n = 0; n < 6; n++)
          effectsRef.current.push({ kind: 'particle', x: e.x, y: e.y, life: 1, angle: (n / 6) * Math.PI * 2 })
        effectsRef.current.push({ kind: 'ring', x: e.x, y: e.y, life: 1 })
        effectsRef.current.push({ kind: 'text', x: e.x, y: e.y, life: 1 })
      })
      enemiesRef.current = enemiesRef.current.filter((_, i) => !hitEnemies.has(i))
      bulletsRef.current = bulletsRef.current.filter((_, i) => !hitBullets.has(i))

      // Draw & cull effects in one pass
      const liveEffects = []
      for (const ef of effectsRef.current) {
        const a = ef.life
        if (ef.kind === 'ring') {
          ctx.beginPath()
          ctx.arc(ef.x, ef.y, ENEMY_R + (1 - a) * 24, 0, Math.PI * 2)
          ctx.strokeStyle = ctx.shadowColor = `rgba(255,120,50,${a})`
          ctx.shadowBlur = 8; ctx.lineWidth = 2
          ctx.stroke()
        } else if (ef.kind === 'particle') {
          const dist = (1 - a) * 28
          drawCircle(ctx, ef.x + Math.cos(ef.angle) * dist, ef.y + Math.sin(ef.angle) * dist, 3, `rgba(255,200,80,${a})`, 6)
        } else {
          ctx.globalAlpha = a
          ctx.fillStyle   = '#ffe600'
          ctx.font        = 'bold 15px monospace'
          ctx.textAlign   = 'center'
          ctx.fillText('+1', ef.x, ef.y - (1 - a) * 32)
          ctx.globalAlpha = 1
        }
        ef.life -= 0.055
        if (ef.life > 0) liveEffects.push(ef)
      }
      effectsRef.current = liveEffects

      // Draw bullets
      for (const b of bulletsRef.current)
        drawCircle(ctx, b.x, b.y, b.r, '#ffe600', 10)

      // Move & draw enemies
      enemiesRef.current = enemiesRef.current.filter(e =>
        e.y < GAME_H + ENEMY_R && e.y > -ENEMY_R * 2 &&
        e.x > -ENEMY_R * 2   && e.x < GAME_W + ENEMY_R * 2
      )
      for (const e of enemiesRef.current) {
        if (e.homing) {
          const dx = p.x - e.x, dy = p.y - e.y
          const dist = Math.hypot(dx, dy) || 1
          e.x += (dx / dist) * e.speed
          e.y += (dy / dist) * e.speed
        } else {
          e.y += e.speed
        }
        if (collides(e, p)) { gameOverRef.current = true; setGameOver(true); return }
        drawCircle(ctx, e.x, e.y, e.r, e.color, 14)
      }

      // Draw player
      drawCircle(ctx, p.x, p.y, p.r, '#00e5ff', 18)

      // XP — checked after drawing so the freeze frame shows all entities
      if (kills > 0) {
        const x = xpRef.current
        x.current += kills
        if (x.current >= x.max) {
          x.current -= x.max
          x.level += 1
          x.max = Math.floor(x.max * 1.5)
          setLevel(x.level)
          setCards(pickCards())
          setXp(x.current / x.max)
          return
        }
        setXp(x.current / x.max)
      }

      scoreRef.current += 1
      if (scoreRef.current % 60 === 0) setScore(s => s + 1)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [started, gameOver, paused])

  const selectCard = (upgrade) => {
    upgrade.apply(statsRef.current, playerRef.current)
    setCards([])
  }

  const restart = () => {
    enemiesRef.current  = []
    bulletsRef.current  = []
    effectsRef.current  = []
    scoreRef.current    = 0
    lastShotRef.current = 0
    gameOverRef.current = false
    playerRef.current   = { x: GAME_W / 2, y: GAME_H - 80, r: PLAYER_R }
    xpRef.current       = { current: 0, level: 1, max: 5 }
    statsRef.current    = { ...DEFAULT_STATS }
    setScore(0); setXp(0); setLevel(1); setCards([]); setGameOver(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}>
      <div style={{ position: 'relative', ...CANVAS_STYLE }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

        {/* HUD */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '12px 16px', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ ...mono, color: '#00e5ff', fontSize: 18 }}>SCORE: {score}</span>
            <span style={{ ...mono, color: '#b388ff', fontSize: 14 }}>LV {level}</span>
          </div>
          <div style={{ height: 5, background: '#1a1a2e', borderRadius: 3 }}>
            <div style={{ width: `${xp * 100}%`, height: '100%', background: '#b388ff', boxShadow: '0 0 8px #b388ff', borderRadius: 3, transition: 'width 0.1s' }} />
          </div>
        </div>

        {/* Start screen */}
        {!started && (
          <div style={{ ...overlay, background: '#0a0a0f', gap: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ ...mono, color: '#00e5ff', fontSize: 36, letterSpacing: 6, textShadow: '0 0 20px #00e5ff' }}>VOID</div>
              <div style={{ ...mono, color: '#b388ff', fontSize: 13, letterSpacing: 3, textShadow: '0 0 10px #b388ff' }}>SURVIVOR</div>
            </div>
            <button onClick={() => setStarted(true)} style={{
              background: 'transparent', border: '1px solid #00e5ff',
              color: '#00e5ff', ...mono, fontSize: 16, letterSpacing: 4,
              padding: '14px 40px', borderRadius: 6, cursor: 'pointer',
              textShadow: '0 0 10px #00e5ff', boxShadow: '0 0 16px rgba(0,229,255,0.2)',
              WebkitTapHighlightColor: 'transparent',
            }}>START</button>
          </div>
        )}

        {/* Level-up overlay */}
        {cards.length > 0 && (
          <div style={{ ...overlay, background: 'rgba(10,10,15,0.72)', gap: 16, padding: '0 12px' }}>
            <div style={{ ...mono, color: '#b388ff', fontSize: 22, letterSpacing: 4, textShadow: '0 0 12px #b388ff' }}>LEVEL UP</div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              {cards.map((c) => (
                <button key={c.label} onClick={() => selectCard(c)} style={{
                  flex: 1, padding: '28px 8px 24px',
                  background: '#0d0d1a', border: '1px solid #b388ff',
                  borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  <GameIcon name={c.icon}/>
                  <div style={{ ...mono, color: '#b388ff', fontSize: 12 }}>{c.label}</div>
                  <div style={{ ...mono, color: '#555', fontSize: 11, lineHeight: 1.5 }}>{c.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {gameOver && (
          <div style={{ ...overlay, gap: 14 }}>
            <div style={{ ...mono, color: '#ff2d55', fontSize: 38 }}>GAME OVER</div>
            <div style={{ ...mono, color: '#888', fontSize: 16 }}>Score: {score}</div>
            <button onClick={restart} style={{
              marginTop: 8, background: '#00e5ff', color: '#0a0a0f',
              border: 'none', padding: '14px 36px', ...mono,
              fontSize: 17, cursor: 'pointer', borderRadius: 6,
              WebkitTapHighlightColor: 'transparent',
            }}>
              RESTART
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
