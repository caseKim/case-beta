import { useEffect, useRef, useState } from 'react'

const PLAYER_R = 24
const ENEMY_R  = 18
const ENEMY_SPEED   = 2
const SPAWN_INTERVAL = 1200

const UPGRADES = [
  { label: 'Rapid Fire',    desc: 'Shoot interval -100ms', apply: s => { s.shootInterval = Math.max(100, s.shootInterval - 100) } },
  { label: 'Swift Bullets', desc: 'Bullet speed +3',       apply: s => { s.bulletSpeed += 3 } },
  { label: 'Big Shot',      desc: 'Bullet radius +4',      apply: s => { s.bulletR += 4 } },
  { label: 'Wide Guard',    desc: 'Player radius +8',      apply: (s, p) => { p.r += 8 } },
  { label: 'Double Shot',   desc: 'Fire 2 bullets',        apply: s => { s.multiShot = true } },
]

function collides(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy) < a.r + b.r
}

function pickCards() {
  return [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3)
}

function getSize() {
  return { w: window.innerWidth, h: window.innerHeight }
}

export default function App() {
  const [gameOver, setGameOver] = useState(false)
  const [paused, setPaused]     = useState(false)
  const [cards, setCards]       = useState([])
  const [score, setScore]       = useState(0)
  const [xp, setXp]             = useState(0)
  const [level, setLevel]       = useState(1)

  const canvasRef   = useRef(null)
  const enemiesRef  = useRef([])
  const bulletsRef  = useRef([])
  const playerRef   = useRef(null)   // initialized on mount
  const rafRef      = useRef(null)
  const scoreRef    = useRef(0)
  const gameOverRef = useRef(false)
  const xpRef       = useRef({ current: 0, level: 1, max: 5 })
  const statsRef    = useRef({ bulletSpeed: 6, bulletR: 5, shootInterval: 400, multiShot: false })
  const lastShotRef = useRef(0)

  // Init player once on mount
  if (!playerRef.current) {
    const { w, h } = getSize()
    playerRef.current = { x: w / 2, y: h - 80, r: PLAYER_R }
  }

  // Resize canvas + reposition player
  useEffect(() => {
    const canvas = canvasRef.current
    const onResize = () => {
      const { w, h } = getSize()
      canvas.width  = w
      canvas.height = h
      playerRef.current.y = h - 80
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Move player via touch / mouse
  useEffect(() => {
    const canvas = canvasRef.current
    const onMove = (e) => {
      e.preventDefault()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      playerRef.current.x = clientX
    }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('touchmove', onMove, { passive: false })
    return () => {
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('touchmove', onMove)
    }
  }, [])

  // Spawn enemies
  useEffect(() => {
    if (gameOver || paused) return
    const id = setInterval(() => {
      if (gameOverRef.current) return
      const canvas = canvasRef.current
      enemiesRef.current.push({
        x: ENEMY_R + Math.random() * (canvas.width - ENEMY_R * 2),
        y: -ENEMY_R,
        r: ENEMY_R,
      })
    }, SPAWN_INTERVAL)
    return () => clearInterval(id)
  }, [gameOver, paused])

  // Game loop
  useEffect(() => {
    if (gameOver || paused) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const loop = (ts) => {
      const { width: W, height: H } = canvas
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, W, H)

      const stats = statsRef.current
      const p = playerRef.current

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
      enemiesRef.current = enemiesRef.current.filter((_, i) => !hitEnemies.has(i))
      bulletsRef.current = bulletsRef.current.filter((_, i) => !hitBullets.has(i))

      // XP
      if (kills > 0) {
        const x = xpRef.current
        x.current += kills
        if (x.current >= x.max) {
          x.current -= x.max
          x.level += 1
          x.max = Math.floor(x.max * 1.5)
          setLevel(x.level)
          setCards(pickCards())
          setPaused(true)
          setXp(x.current / x.max)
          return
        }
        setXp(x.current / x.max)
      }

      // Draw bullets
      for (const b of bulletsRef.current) {
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fillStyle = ctx.shadowColor = '#ffe600'
        ctx.shadowBlur = 10
        ctx.fill()
      }

      // Move & draw enemies
      enemiesRef.current = enemiesRef.current.filter(e => e.y < H + ENEMY_R)
      for (const e of enemiesRef.current) {
        e.y += ENEMY_SPEED
        if (collides(e, p)) {
          gameOverRef.current = true
          setGameOver(true)
          return
        }
        ctx.beginPath()
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2)
        ctx.fillStyle = ctx.shadowColor = '#ff2d55'
        ctx.shadowBlur = 14
        ctx.fill()
      }

      // Draw player
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = ctx.shadowColor = '#00e5ff'
      ctx.shadowBlur = 18
      ctx.fill()

      scoreRef.current += 1
      if (scoreRef.current % 60 === 0) setScore(s => s + 1)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [gameOver, paused])

  const selectCard = (upgrade) => {
    upgrade.apply(statsRef.current, playerRef.current)
    setCards([])
    setPaused(false)
  }

  const restart = () => {
    const { w, h } = getSize()
    enemiesRef.current  = []
    bulletsRef.current  = []
    scoreRef.current    = 0
    lastShotRef.current = 0
    gameOverRef.current = false
    playerRef.current   = { x: w / 2, y: h - 80, r: PLAYER_R }
    xpRef.current       = { current: 0, level: 1, max: 5 }
    statsRef.current    = { bulletSpeed: 6, bulletR: 5, shootInterval: 400, multiShot: false }
    setScore(0); setXp(0); setLevel(1); setCards([]); setPaused(false); setGameOver(false)
  }

  const mono = { fontFamily: 'monospace' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0f', touchAction: 'none' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />

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

      {/* Level-up overlay */}
      {cards.length > 0 && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
          <div style={{ ...mono, color: '#b388ff', fontSize: 24, marginBottom: 4 }}>LEVEL UP</div>
          {cards.map((c) => (
            <button key={c.label} onClick={() => selectCard(c)} style={{
              width: '100%', maxWidth: 340, padding: '18px 20px',
              background: '#0d0d1a', border: '1px solid #b388ff',
              borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <div style={{ ...mono, color: '#b388ff', fontSize: 16, marginBottom: 4 }}>{c.label}</div>
              <div style={{ ...mono, color: '#666', fontSize: 13 }}>{c.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* Game over overlay */}
      {gameOver && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
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
  )
}
