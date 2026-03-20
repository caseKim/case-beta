import { useEffect, useRef, useState } from 'react'
import { submitScore, fetchLeaderboard } from './firebase'

// Fixed logical resolution — 9:16 (standard mobile)
const GAME_W = 390
const GAME_H = 693

const PLAYER_R       = 18
const WING_R         = 8    // companion plane radius
const WING_OFFSET    = 30   // horizontal distance from player center to wing
const ENEMY_R        = 14
const ENEMY_SPEED    = 2
const FAST_SPEED     = 5
const HOMING_SPEED   = 2.5
const STAGE_PLAY_DURATION = 12000  // ms of normal trickle before wave warning
const WARNING_DURATION    = 2000   // ms of WARNING display before wave
const WAVE_MAX_DURATION   = 5000   // ms max for wave phase
const WAVE_BASE_COUNT     = 25     // enemies per wave (base)
const LASER_W             = 4      // laser beam collision half-width
const WING_MISSILE_R    = 4
const WING_MISSILE_SPD  = 5
const WING_MISSILE_INT  = 2000  // ms between wing missile shots
const SPAWN_INTERVAL    = 1100
const SHOOTER_R         = 12
const SHOOTER_SPEED     = 1.2
const SHOOTER_COLOR     = '#30d158'  // neon green
const SHOOTER_MISSILE_COLOR = '#ff453a'  // red-orange (distinct from Shooter body)
const SPLITTER_R        = 20
const SPLITTER_COLOR    = '#ffd60a'  // yellow
const SPLIT_R           = 8
const SPLIT_COLOR       = '#ffe066'  // light yellow (sub-enemy)
const GHOST_COLOR       = '#5ac8fa'  // cyan (distinct from Homing purple)
const GHOST_CYCLE       = 180        // frames per invincibility cycle (3s)
const GHOST_INVINCIBLE_AT = 120      // frame within cycle where invincibility starts (2s on, 1s invincible)
const ARMORED_R         = 22
const ARMORED_COLOR     = '#8e9fb5'  // metallic blue-gray
const ARMOR_DMG_MULT    = 0.5       // all incoming damage multiplier
const MISSILE_R         = 5
const MISSILE_SPEED     = 4
const MISSILE_INTERVAL  = 2500       // ms between shots
const CANNON_INTERVAL    = 1800   // ms between cannon shots
const CANNON_SPEED       = 4      // px/frame toward target
const CANNON_BASE_POWER  = 5
const CANNON_BASE_RADIUS = 65
const CANNON_FIXED_RANGE = 320  // px ahead (upward) where the shell explodes
const ORB_R            = 6      // orb collision + draw radius
const ORB_ORBIT_R      = 52     // orbit distance from player center
const ORB_SPEED        = 0.045  // radians per frame
const ORB_DAMAGE       = 1.5    // damage per hit
const ORB_HIT_INTERVAL = 800    // ms cooldown per enemy
const DEFAULT_STATS     = { bulletSpeed: 5, bulletR: 3, bulletPower: 1, shootInterval: 650, shotCount: 1 }

const NICKNAME_ADJS = [
  'VOID','NEON','DARK','IRON','SWIFT','COLD','DEAD','LOST','WILD','PALE',
  'GRIM','ROGUE','CYBER','SOLAR','LUNAR','ASTRAL','ATOMIC','LASER','ULTRA','HYPER',
  'ALPHA','OMEGA','SIGMA','DELTA','GAMMA','FROZEN','HOLLOW','BROKEN','SILENT','FIERCE',
  'LETHAL','SAVAGE','BRUTAL','TOXIC','CHROME','SCARLET','CRIMSON','COBALT','AMBER','ONYX',
  'AZURE','GOLDEN','SILVER','BRONZE','TITAN','STELLAR','COSMIC','PHANTOM','SHADOW','GHOST',
  'STORM','FROST','ETERNAL','MORTAL','PRIMAL','ANCIENT','FATAL','DREAD','BLEAK','WARPED',
  'NOVA','FLUX','SURGE','SHOCK','VOLT','KEEN','VENOM','CHAOS','HAVOC','RUINED',
  'FALLEN','STARK','SCORCHED','WASTED','DRAINED','ALERT','RAPID','DENSE','SOLID','VAST',
  'MASSIVE','MICRO','NANO','QUANTUM','DIGITAL','HYBRID','PRIME','APEX','META','DIVINE',
  'INFERNAL','BRIGHT','FAINT','GLOWING','MOLTEN','CRACKED','SHATTERED','FORGED','RAGING','CRAZED',
  'SERENE','FERAL','SPECTRAL','ETHEREAL','NULL','STATIC','KINETIC','THERMAL','MAGNETIC','ELECTRIC',
  'FRACTAL','CURVED','INVERTED','PARALLEL','NEURAL','VIRAL','CRYPTIC','MYSTIC','ARCANE','SACRED',
  'OBSIDIAN','TITANIUM','PLATINUM','CARBON','CYAN','TEAL','MAGENTA','DOOMED','EXILED','FRACTURED',
  'CORRUPTED','TAINTED','DAMNED','DESOLATE','BLAZING','SUPREME','PHOTONIC','SONIC','IONIC','NEUTRON',
  'GALACTIC','ZENITH','VORTEX','INDIGO','VIOLET','SAPPHIRE','RUBY','EMERALD','JADE','IVORY',
  'BURNING','SHINING','DRIFTING','SMASHED','TENSE','RIGID','SHARP','BLUNT','CLEAN','PURE',
  'CRISP','COOL','WARM','ICED','SMOKY','SPARSE','THICK','SOFT','HARD','LOUD',
  'FAST','SLOW','HIGH','WIDE','NARROW','HUGE','TINY','BOLD','PROUD','BRAVE',
  'FREE','BOUND','OPEN','SEALED','OLD','YOUNG','FRESH','IDLE','ACTIVE','PRIMED',
  'CHARGED','LOADED','EMPTY','FULL','CLEAR','FOGGY','DIM','VIVID','STRONG','WEAK',
  'BINARY','DUAL','LONE','LAST','FINAL','ULTIMATE','BLIGHTED','FORSAKEN','FRENZIED','DOMINANT',
  'SEARING','RUTHLESS','CURSED','BLESSED','VEILED','TWISTED','HUSHED','ERASED','MASKED','STEALTHY',
  'MIRAGE','WIRED','SUBZERO','UNHOLY','FUELED','VISCOUS','SUNKEN','ORBITAL','BENDING','LIMINAL',
  'ABYSSAL','HEXED','DUSK','DAWN','TWILIGHT','APOGEE','MIDNIGHT','UMBRAL','ASTRO','SOLARIS',
  'POLAR','BRINE','ASHEN','SHROUDED','BARREN','VACANT','ADRIFT','SABLE','ARGENT','AUREATE',
  'MURKY','OPAQUE','RADIANT','LUCENT','INCENDIARY','SCORCHING','SHATTERING','CRUSHING','PIERCING','SLICING',
  'WARBLING','HOWLING','SCREAMING','MUTED','BOOMING','CRACKLING','HUMMING','BUZZING','WHIRRING','PULSING',
  'WRITHING','COILING','STRIKING','LUNGING','DIVING','SOARING','PLUNGING','SPIRALING','ORBITING','IMPLODING',
  'COLLAPSING','ERUPTING','IGNITING','DETONATING','FREEZING','MELTING','DISSOLVING','PHASING','SHIFTING','WARPING',
]

const NICKNAME_NOUNS = [
  'WOLF','FOX','HAWK','EAGLE','SHARK','VIPER','COBRA','RAVEN','OWL','BEAR',
  'LION','TIGER','PANTHER','LYNX','FALCON','OSPREY','CONDOR','PHOENIX','DRAGON','SERPENT',
  'HYDRA','KRAKEN','TITAN','SPECTER','WRAITH','SHADE','REVENANT','PHANTOM','BANSHEE','GHOUL',
  'STAR','SUN','MOON','COMET','METEOR','ASTEROID','PULSAR','QUASAR','NEBULA','NOVA',
  'RIFT','GATE','PORTAL','NEXUS','CORE','SHELL','RING','BELT','CLOUD','VOID',
  'BLADE','SWORD','LANCE','ARROW','BOLT','CANNON','GUN','RIFLE','SNIPER','SIEGE',
  'SHIELD','ARMOR','HELM','AEGIS','BASTION','FORTRESS','BUNKER','TURRET','SENTRY','BULWARK',
  'MATRIX','VECTOR','CIPHER','CODE','SIGNAL','PULSE','WAVE','FLUX','FIELD','FORCE',
  'MASS','CHARGE','SPIN','ORBIT','CYCLE','PHASE','NODE','GRID','MESH','LINK',
  'DRONE','MECH','UNIT','FRAME','HULL','PLATE','EDGE','POINT','CLAW','FANG',
  'TALON','SPINE','THORN','BARB','SPIKE','HOOK','CHAIN','WIRE','GEAR','COIL',
  'FIRE','ICE','STORM','THUNDER','LIGHTNING','WIND','SHADOW','LIGHT','DARK','FLAME',
  'BLOOD','BONE','SKULL','SOUL','SPIRIT','MIND','WILL','FATE','DOOM','OMEN',
  'KING','KNIGHT','ROOK','DUKE','LORD','COUNT','BARON','WARDEN','MARSHAL','SENTINEL',
  'PILOT','GUNNER','SCOUT','RANGER','HUNTER','STALKER','ASSASSIN','REAPER','DRIFTER','RAIDER',
  'FLARE','BURST','BLAST','BANG','BOOM','CRACK','SHATTER','RUPTURE','FRACTURE','BREACH',
  'ZERO','PRIME','PIVOT','AXIS','POLE','PEAK','CREST','VERTEX','APEX','ZENITH',
  'CROW','KITE','WREN','CRANE','HERON','IBIS','JAY','SWIFT','EGRET','KESTREL',
  'ORCA','MARLIN','PIKE','BASS','MANTA','MORAY','LEECH','CRAB','MANTIS','HORNET',
  'RUBY','ONYX','JADE','OPAL','PEARL','GARNET','TOPAZ','QUARTZ','FLINT','SHARD',
  'ATLAS','ORION','LYRA','VEGA','RIGEL','SIRIUS','ALTAIR','DENEB','SPICA','ANTARES',
  'DRIFT','WAKE','TIDE','CURRENT','FLOW','STREAM','ABYSS','DEPTH','TRENCH','SWELL',
  'ECHO','TONE','CHORD','BEAT','HUM','TEMPO','CHIME','NOISE','STATIC','FEEDBACK',
  'MARK','SEAL','RUNE','GLYPH','SIGIL','IMPRINT','KEY','LOCK','BRAND','STAMP',
  'CRATER','CANYON','GORGE','CHASM','CLEFT','FAULT','FISSURE','CREVICE','SEAM','SCAR',
  'TOWER','SPIRE','OBELISK','MONOLITH','PILLAR','ARCH','VAULT','DOME','SPEAR','SUMMIT',
  'EMBER','SPARK','BLAZE','INFERNO','PYRE','BEACON','TORCH','CINDER','GLOW','ASH',
  'QUBIT','SCALAR','TENSOR','QUARK','BOSON','PHOTON','MESON','LEPTON','PROTON','NEUTRINO',
  'AGENT','PROXY','GHOST','CLONE','COPY','MIMIC','STAIN','REMNANT','RELIC','VESTIGE',
  'ZEPHYR','SQUALL','GALE','TYPHOON','CYCLONE','VORTEX','MAELSTROM','TEMPEST','BLIZZARD','TSUNAMI',
]

const makeDefaultNickname = () => {
  const adj  = NICKNAME_ADJS[Math.floor(Math.random() * NICKNAME_ADJS.length)]
  const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)]
  return `${adj}_${noun}`
}
const SHOT_SPREAD    = 12 * (Math.PI / 180)  // radians between adjacent bullets
const SHOT_SPREAD_SX = Math.sin(SHOT_SPREAD)
const SHOT_SPREAD_CX = Math.cos(SHOT_SPREAD)

// CSS: scale canvas container to fit viewport, keep 9:16
const CANVAS_STYLE = {
  display: 'block',
  width:  `min(100dvw, calc(100dvh * ${GAME_W} / ${GAME_H}))`,
  height: `min(100dvh, calc(100dvw * ${GAME_H} / ${GAME_W}))`,
}

const UPGRADES = [
  { icon: 'rapid',   label: 'Rapid Fire',    desc: 'Shoot interval -50ms',  apply: s     => { s.shootInterval = Math.max(100, s.shootInterval - 50) } },
  { icon: 'power',   label: 'Power Up',      desc: 'Bullet power +0.5',     apply: s     => { s.bulletPower += 0.5 } },
  { icon: 'shield',      label: 'Shield',       desc: 'Activate shield',    apply: (s,p) => { p.shieldActive = true; p.shieldR = p.r + 14; p.shieldPower = 1 } },
  { icon: 'shieldrange', label: 'Shield Range', desc: 'Shield radius +8',   apply: (s,p) => { p.shieldR += 8 } },
  { icon: 'shieldpower', label: 'Shield Power', desc: 'Shield power +1',    apply: (s,p) => { p.shieldPower += 1 } },
  { icon: 'addshot', label: 'Add Shot',      desc: '+1 bullet (spread)',    apply: s     => { s.shotCount += 1 } },
  { icon: 'wingR',   label: 'Left Wing',    desc: 'Laser 1 dmg/s',         apply: (s,p) => { p.leftWing = true;  p.leftWingLevel = 1; p.laserDps = 0.4; p.leftWingLaserCount = 1 } },
  { icon: 'wingL',   label: 'Right Wing',   desc: 'Homing missile (pow 2)', apply: (s,p) => { p.rightWing = true; p.rightWingLevel = 1; p.rightWingPower = 2; p.rightWingLastShot = 0; p.rightWingMissileCount = 1 } },
  { icon: 'wingRup',   label: 'Left Wing Power+',  desc: 'Laser power +0.2/s',          apply: (s,p) => { p.leftWingLevel = 2; p.laserDps += 0.2 } },
  { icon: 'lasercount', label: 'Left Wing Shot+',  desc: '+1 laser beam per frame',     apply: (s,p) => { p.leftWingLaserCount += 1 } },
  { icon: 'wingLup',      label: 'Right Wing Power+', desc: 'Missile power +1',            apply: (s,p) => { p.rightWingLevel = 2; p.rightWingPower += 1 } },
  { icon: 'missilecount', label: 'Right Wing Shot+',  desc: '+1 homing missile per salvo', apply: (s,p) => { p.rightWingMissileCount += 1 } },
  { icon: 'cannon',      label: 'Cannon',       desc: 'AoE mortar (pow 5, r 65)', apply: (s,p) => { p.cannonActive = true; p.cannonPower = CANNON_BASE_POWER; p.cannonRadius = CANNON_BASE_RADIUS; p.cannonLastShot = 0 } },
  { icon: 'cannonpower', label: 'Cannon Power+', desc: 'Cannon damage +2',         apply: (s,p) => { p.cannonPower += 2 } },
  { icon: 'cannonrange', label: 'Cannon Range+', desc: 'Blast radius +15',         apply: (s,p) => { p.cannonRadius += 15 } },
  { icon: 'orb',      label: 'Orb',      desc: 'Orbiting orb (dmg 1.5)',  apply: (s,p) => { p.orbActive = true; p.orbCount = 1; p.orbAngle = 0 } },
  { icon: 'orbcount', label: 'Add Orb',  desc: '+1 orbiting orb',         apply: (s,p) => { p.orbCount += 1 } },
]

// Returns up to `count` nearest enemies sorted by distance. skipSet: Set of indices to exclude.
function getNearestEnemies(enemies, ox, oy, count, skipSet) {
  const results = []
  for (let ei = 0; ei < enemies.length; ei++) {
    if (skipSet && skipSet.has(ei)) continue
    const e = enemies[ei]
    const d = Math.hypot(e.x - ox, e.y - oy)
    let ins = results.length
    while (ins > 0 && results[ins - 1].d > d) ins--
    if (ins < count) {
      results.splice(ins, 0, { e, ei, d })
      if (results.length > count) results.pop()
    }
  }
  return results
}

const ghostInvincible = e => e.ghost && (e.ghostTick % GHOST_CYCLE) >= GHOST_INVINCIBLE_AT

function pushHitEffect(effects, x, y) {
  effects.push({ kind: 'hit', x, y, life: 1, decay: 0.18 })
}

function collides(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y
  const sr = a.r + b.r
  return dx * dx + dy * dy < sr * sr
}

function pickCards(stats, player) {
  return [...UPGRADES]
    .filter(u => {
      if (u.icon === 'addshot' && stats.shotCount >= 7) return false
      if (u.icon === 'rapid' && stats.shootInterval <= 100) return false
      if (u.icon === 'shield' && player.shieldActive) return false
      if ((u.icon === 'shieldrange' || u.icon === 'shieldpower') && !player.shieldActive) return false
      if (u.icon === 'wingR'   && player.leftWing) return false
      if (u.icon === 'wingL'   && player.rightWing) return false
      if (u.icon === 'wingRup' && (!player.leftWing  || player.leftWingLevel  >= 2)) return false
      if (u.icon === 'wingLup' && (!player.rightWing || player.rightWingLevel >= 2)) return false
      if (u.icon === 'missilecount' && (!player.rightWing || player.rightWingMissileCount >= 3)) return false
      if (u.icon === 'lasercount' && (!player.leftWing || player.leftWingLaserCount >= 3)) return false
      if (u.icon === 'cannon'      && player.cannonActive) return false
      if ((u.icon === 'cannonpower' || u.icon === 'cannonrange') && !player.cannonActive) return false
      if (u.icon === 'orb'      && player.orbActive) return false
      if (u.icon === 'orbcount' && (!player.orbActive || player.orbCount >= 5)) return false
      return true
    })
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
}

const mono    = { fontFamily: 'monospace' }
const overlay = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
const RECORD_CSS = `@keyframes recordPulse{0%,100%{opacity:0.6;transform:scale(1)}50%{opacity:1;transform:scale(1.12)}}@keyframes recordGlow{0%,100%{text-shadow:0 0 12px #ffe600}50%{text-shadow:0 0 32px #ffe600,0 0 60px rgba(255,230,0,0.6)}}`

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

  if (name === 'power') // Upward arrow inside circle (power up)
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={h} cy={h} r={size*0.38}/>
      <polyline points={`${h-8},${h+6} ${h},${h-8} ${h+8},${h+6}`}/>
      <line x1={h} y1={h-8} x2={h} y2={h+10}/>
    </g></svg>

  if (name === 'shield') // Outer ring (shield) + inner dot (player)
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={h} cy={h} r={size*0.38}/>
      <circle cx={h} cy={h} r={6} fill='#b388ff'/>
    </g></svg>

  if (name === 'shieldrange') // Expanding rings outward
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={h} cy={h} r={5} fill='#b388ff'/>
      <circle cx={h} cy={h} r={12} strokeOpacity={0.7}/>
      <circle cx={h} cy={h} r={size*0.38} strokeOpacity={0.4}/>
      <line x1={h} y1={q-2} x2={h} y2={q-8}/>
      <line x1={t+2} y1={h} x2={t+8} y2={h}/>
      <line x1={h} y1={t+2} x2={h} y2={t+8}/>
      <line x1={q-2} y1={h} x2={q-8} y2={h}/>
    </g></svg>

  if (name === 'shieldpower') // Ring with cross (power marks)
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={h} cy={h} r={size*0.38}/>
      <line x1={h} y1={h-10} x2={h} y2={h+10}/>
      <line x1={h-10} y1={h} x2={h+10} y2={h}/>
    </g></svg>

  if (name === 'addshot') // Three spread bullets diverging upward from center
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={h} cy={q} r={5}/>
      <line x1={h} y1={q+5} x2={h} y2={t}/>
      <circle cx={h-12} cy={q+6} r={4}/>
      <line x1={h-12} y1={q+10} x2={h} y2={t}/>
      <circle cx={h+12} cy={q+6} r={4}/>
      <line x1={h+12} y1={q+10} x2={h} y2={t}/>
    </g></svg>

  if (name === 'wingL') // Left companion: dot on left + arrow up, center dot
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={q-2} cy={h} r={6}/>
      <line x1={q-2} y1={h-6} x2={q-2} y2={q+2}/>
      <polyline points={`${q-7},${q+7} ${q-2},${q+2} ${q+3},${q+7}`}/>
      <circle cx={h+4} cy={h+4} r={4}/>
    </g></svg>

  if (name === 'wingR') // Right companion: dot on right + arrow up, center dot
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={t+2} cy={h} r={6}/>
      <line x1={t+2} y1={h-6} x2={t+2} y2={q+2}/>
      <polyline points={`${t-3},${q+7} ${t+2},${q+2} ${t+7},${q+7}`}/>
      <circle cx={h-4} cy={h+4} r={4}/>
    </g></svg>

  if (name === 'wingLup') // Left wing upgraded: dot + two spread arrows
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={q-2} cy={h} r={6}/>
      <line x1={q-2} y1={h-6} x2={q-2} y2={q+2}/>
      <polyline points={`${q-7},${q+7} ${q-2},${q+2} ${q+3},${q+7}`}/>
      <line x1={q-2} y1={h-4} x2={q-10} y2={q+4}/>
      <circle cx={h+4} cy={h+4} r={4}/>
    </g></svg>

  if (name === 'wingRup') // Right wing upgraded: dot + two spread arrows
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={t+2} cy={h} r={6}/>
      <line x1={t+2} y1={h-6} x2={t+2} y2={q+2}/>
      <polyline points={`${t-3},${q+7} ${t+2},${q+2} ${t+7},${q+7}`}/>
      <line x1={t+2} y1={h-4} x2={t+10} y2={q+4}/>
      <circle cx={h-4} cy={h+4} r={4}/>
    </g></svg>

  if (name === 'lasercount') // Right wing dot firing two diverging laser lines upward
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={t+2} cy={h} r={6}/>
      <line x1={t+2} y1={h-6} x2={t-4} y2={q+2}/>
      <line x1={t+2} y1={h-6} x2={t+8} y2={q+2}/>
      <circle cx={h-4} cy={h+4} r={4}/>
    </g></svg>

  if (name === 'missilecount') // Wing dot firing two diverging missiles upward
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={q-2} cy={h} r={6}/>
      <line x1={q-2} y1={h-6} x2={q-8} y2={q+2}/>
      <polyline points={`${q-13},${q+7} ${q-8},${q+2} ${q-3},${q+7}`}/>
      <line x1={q-2} y1={h-6} x2={q+4} y2={q+2}/>
      <polyline points={`${q-1},${q+7} ${q+4},${q+2} ${q+9},${q+7}`}/>
      <circle cx={h+4} cy={h+4} r={4}/>
    </g></svg>

  if (name === 'cannon' || name === 'cannonpower' || name === 'cannonrange') {
    const arc = `M ${q+4} ${t-2} Q ${h+6} ${q-2} ${t} ${h}`
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={q} cy={t} r={4} fill='#b388ff'/>
      <path d={arc} fill="none"/>
      {name === 'cannon' && <><circle cx={t} cy={h} r={5}/><circle cx={t} cy={h} r={11} strokeOpacity={0.55}/></>}
      {name === 'cannonpower' && <><circle cx={t} cy={h} r={5}/><line x1={t-9} y1={h} x2={t+9} y2={h}/><line x1={t} y1={h-9} x2={t} y2={h+9}/></>}
      {name === 'cannonrange' && <><circle cx={t} cy={h} r={4}/><circle cx={t} cy={h} r={10} strokeOpacity={0.6}/><circle cx={t} cy={h} r={16} strokeOpacity={0.3}/></>}
    </g></svg>
  }

  if (name === 'orb') // Center dot with one orbiting circle
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={h} cy={h} r={5} fill='#b388ff'/>
      <circle cx={h} cy={h} r={size*0.36} strokeOpacity={0.3} strokeDasharray="3 4"/>
      <circle cx={h + size*0.36} cy={h} r={7}/>
    </g></svg>

  if (name === 'orbcount') // Center dot with two orbiting circles
    return <svg width={size} height={size} viewBox={v}><g {...g}>
      <circle cx={h} cy={h} r={5} fill='#b388ff'/>
      <circle cx={h} cy={h} r={size*0.36} strokeOpacity={0.3} strokeDasharray="3 4"/>
      <circle cx={h + size*0.36} cy={h} r={6}/>
      <circle cx={h - size*0.36} cy={h} r={6}/>
    </g></svg>

  return null
}

function drawCircle(ctx, x, y, r, color, blur) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.fill()
  ctx.shadowBlur = 0
}

export default function App() {
  const [started,   setStarted]  = useState(false)
  const [gameOver,  setGameOver] = useState(false)
  const [cards,     setCards]    = useState([])
  const [score,     setScore]    = useState(0)
  const [xp,        setXp]       = useState(0)
  const [level,     setLevel]    = useState(1)
  const [stage,        setStage]        = useState(1)
  const [stageAnn,     setStageAnn]    = useState(0)      // 0 = hidden
  const [waveWarning,  setWaveWarning] = useState(false)
  const [highScore,    setHighScore]   = useState(() => parseInt(localStorage.getItem('voidHighScore') || '0'))
  const [isNewRecord,  setIsNewRecord] = useState(false)
  const [finalStats,   setFinalStats]  = useState({ time: 0, kills: 0 })
  const [nickname,     setNickname]    = useState(() => localStorage.getItem('voidNickname') || '')
  const [nicknameInput, setNicknameInput] = useState(() => localStorage.getItem('voidNickname') ? '' : makeDefaultNickname())
  const [lbTab,    setLbTab]    = useState('today')
  const [lbEntries, setLbEntries] = useState([])
  const [lbMyRank,  setLbMyRank]  = useState(0)
  const [lbMyEntry, setLbMyEntry] = useState(null)
  const [lbLoading, setLbLoading] = useState(false)

  const paused = cards.length > 0

  const canvasRef   = useRef(null)
  const enemiesRef      = useRef([])
  const bulletsRef      = useRef([])
  const effectsRef      = useRef([])
  const enemyBulletsRef = useRef([])
  const cannonShellsRef = useRef([])
  const playerRef   = useRef({ x: GAME_W / 2, y: GAME_H - 80, r: PLAYER_R, shieldActive: false, shieldR: 0, shieldPower: 0, leftWing: false, rightWing: false, leftWingLevel: 0, rightWingLevel: 0, laserDps: 0, leftWingLaserCount: 1, rightWingPower: 0, rightWingLastShot: 0, rightWingMissileCount: 1, cannonActive: false, cannonPower: CANNON_BASE_POWER, cannonRadius: CANNON_BASE_RADIUS, cannonLastShot: 0, orbActive: false, orbCount: 1, orbAngle: 0 })
  const rafRef      = useRef(null)
  const scoreRef    = useRef(0)
  const timeRef     = useRef(0)
  const killCountRef = useRef(0)
  const gameOverRef = useRef(false)
  const xpRef       = useRef({ current: 0, level: 1, max: 4 })
  const statsRef    = useRef({ ...DEFAULT_STATS })
  const lastShotRef = useRef(0)
  const rectRef     = useRef(null)  // cached canvas bounding rect
  const stageRef        = useRef(1)
  const stagePhaseRef      = useRef('playing')  // 'playing' | 'warning' | 'wave'
  const advanceStageRef    = useRef(null)       // called from game loop on early wave clear
  const waveAllSpawnedRef  = useRef(false)      // true once all wave enemies are in the field
  const waveRemainingRef   = useRef(0)          // enemies still to be spawned (survives pause)
  const phaseStartRef      = useRef(0)          // Date.now() when current phase began
  const stageAnnTimer   = useRef(null)
  const targetXRef      = useRef(GAME_W / 2)
  const invincibleRef   = useRef(0)  // frames remaining of post-levelup invincibility

  const showStage = (n) => {
    if (stageAnnTimer.current) clearTimeout(stageAnnTimer.current)
    setStage(n)
    setStageAnn(n)
    stageAnnTimer.current = setTimeout(() => setStageAnn(0), 2200)
  }

  // Set canvas logical size once; clear stageAnn timer on unmount
  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width  = GAME_W
    canvas.height = GAME_H
    rectRef.current = canvas.getBoundingClientRect()
    return () => clearTimeout(stageAnnTimer.current)
  }, [])

  // Move player — map CSS coords → game coords using cached rect
  useEffect(() => {
    const canvas = canvasRef.current
    const onMove = (e) => {
      e.preventDefault()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const rect = rectRef.current
      targetXRef.current = (clientX - rect.left) * (GAME_W / rect.width)
    }
    const onResize = () => { rectRef.current = canvas.getBoundingClientRect() }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('touchstart', onMove, { passive: false })
    canvas.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('resize', onResize)
    return () => {
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('touchstart', onMove)
      canvas.removeEventListener('touchmove', onMove)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Spawn enemies
  useEffect(() => {
    if (!started || gameOver || paused) return

    const makeEnemy = (s) => {
      const rand     = Math.random()
      const fast     = rand < 0.25
      const shooter  = !fast && rand >= 0.90
      const homing   = !fast && !shooter && rand >= 0.85
      const speedScale = 1 + (s - 1) * 0.025
      const baseHp = 1 + Math.floor(s / 4)
      const splitter = !fast && !shooter && !homing && rand >= 0.80 && baseHp >= 2
      const ghost    = !fast && !shooter && !homing && !splitter && rand >= 0.75 && s >= 7
      const armored  = !fast && !shooter && !homing && !splitter && !ghost && rand >= 0.70 && s >= 10
      const maxHp = splitter ? baseHp + 1 : armored ? baseHp * 2 + 1 : baseHp
      const r = fast ? ENEMY_R - 4 : shooter ? SHOOTER_R : splitter ? SPLITTER_R : armored ? ARMORED_R : ENEMY_R
      return {
        x: ENEMY_R + Math.random() * (GAME_W - ENEMY_R * 2), y: -r, r,
        speed: (fast ? FAST_SPEED : shooter ? SHOOTER_SPEED : homing ? HOMING_SPEED : splitter ? ENEMY_SPEED * 0.8 : armored ? ENEMY_SPEED * 0.6 : ENEMY_SPEED) * speedScale,
        color: shooter ? SHOOTER_COLOR : homing ? '#bf5af2' : fast ? '#ff9f0a' : splitter ? SPLITTER_COLOR : ghost ? GHOST_COLOR : armored ? ARMORED_COLOR : '#ff2d55',
        font:  `${Math.round(r * 0.9)}px monospace`,
        homing, shooter, splitter, ghost, ...(ghost ? { ghostTick: 0 } : {}), armored, lastShot: 0, hp: maxHp, maxHp,
      }
    }

    const timers = { wave: null, spawn: null, trickle: null }

    const endWave = () => {
      // Stage advances when wave clears
      const s = stageRef.current + 1
      stageRef.current = s
      scoreRef.current += (s - 1) * 10
      showStage(s)
      stagePhaseRef.current = 'playing'
      advanceStageRef.current = null
      waveAllSpawnedRef.current = false
      scheduleWarning()
    }

    const startWave = () => {
      stagePhaseRef.current = 'wave'
      waveAllSpawnedRef.current = false
      setWaveWarning(false)
      effectsRef.current.push({ kind: 'waveFlash', life: 1, decay: 0.035 })

      // Spawn wave enemies rapidly over 3s using current stage stats
      const s = stageRef.current
      const count = WAVE_BASE_COUNT + Math.floor((s - 1) / 2)
      const spawnMs = Math.floor(3000 / count)
      waveRemainingRef.current = count
      const spawnNext = () => {
        if (waveRemainingRef.current > 0 && stagePhaseRef.current === 'wave') {
          enemiesRef.current.push({ ...makeEnemy(s), isWave: true })
          waveRemainingRef.current--
          if (waveRemainingRef.current > 0) timers.spawn = setTimeout(spawnNext, spawnMs)
          else waveAllSpawnedRef.current = true
        }
      }
      spawnNext()

      // Max wave duration then auto-advance
      timers.wave = setTimeout(() => { clearTimeout(timers.spawn); waveAllSpawnedRef.current = true; endWave() }, WAVE_MAX_DURATION)
      advanceStageRef.current = () => { clearTimeout(timers.wave); clearTimeout(timers.spawn); endWave() }
    }

    const startWarning = () => {
      stagePhaseRef.current = 'warning'
      phaseStartRef.current = Date.now()
      setWaveWarning(true)
      timers.wave = setTimeout(startWave, WARNING_DURATION)
    }

    const playDuration = () => STAGE_PLAY_DURATION + (stageRef.current === 1 ? 3000 : 0)

    const scheduleWarning = () => {
      stagePhaseRef.current = 'playing'
      phaseStartRef.current = Date.now()
      timers.wave = setTimeout(startWarning, playDuration())
    }

    // Phase-aware restart (after level-up pause) — resume with remaining time
    const phase = stagePhaseRef.current
    if (phase === 'wave') {
      // Resume: continue spawning any remaining wave enemies
      const s = stageRef.current
      const spawnMs = Math.floor(3000 / (WAVE_BASE_COUNT + Math.floor((s - 1) / 2)))
      const spawnNext = () => {
        if (waveRemainingRef.current > 0 && stagePhaseRef.current === 'wave') {
          enemiesRef.current.push({ ...makeEnemy(s), isWave: true })
          waveRemainingRef.current--
          if (waveRemainingRef.current > 0) timers.spawn = setTimeout(spawnNext, spawnMs)
          else waveAllSpawnedRef.current = true
        }
      }
      if (waveRemainingRef.current > 0) spawnNext()
      else waveAllSpawnedRef.current = true
      timers.wave = setTimeout(() => { clearTimeout(timers.spawn); waveAllSpawnedRef.current = true; endWave() }, WAVE_MAX_DURATION)
      advanceStageRef.current = () => { clearTimeout(timers.wave); clearTimeout(timers.spawn); endWave() }
    } else if (phase === 'warning') {
      const elapsed = Date.now() - phaseStartRef.current
      const remaining = Math.max(0, WARNING_DURATION - elapsed)
      timers.wave = setTimeout(startWave, remaining)
    } else {
      const elapsed = phaseStartRef.current > 0 ? Date.now() - phaseStartRef.current : 0
      const remaining = Math.max(0, playDuration() - elapsed)
      phaseStartRef.current = Date.now() - elapsed  // ensure it's set
      timers.wave = setTimeout(startWarning, remaining)
    }

    // Trickle — only during 'playing' phase
    const scheduleTrickle = () => {
      const interval = Math.max(500, SPAWN_INTERVAL - (stageRef.current - 1) * 30)
      timers.trickle = setTimeout(() => {
        if (stagePhaseRef.current === 'playing') enemiesRef.current.push(makeEnemy(stageRef.current))
        scheduleTrickle()
      }, interval)
    }
    scheduleTrickle()

    return () => Object.values(timers).forEach(clearTimeout)
  }, [started, gameOver, paused])

  // Announce stage 1 on game start (only once, not on every resume)
  useEffect(() => {
    if (started && !gameOver) {
      phaseStartRef.current = Date.now()
      showStage(1)
    }
  }, [started])

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
      const wingY = p.y + p.r - WING_R  // wing center y, used throughout frame

      // Smooth player movement (lerp toward touch/mouse target)
      const dx = targetXRef.current - p.x
      if (Math.abs(dx) > 0.1) p.x += dx * 0.25

      // Player shoot
      if (ts - lastShotRef.current >= stats.shootInterval) {
        const n = stats.shotCount
        for (let i = 0; i < n; i++) {
          const angle = (i - (n - 1) / 2) * SHOT_SPREAD
          bulletsRef.current.push({
            x: p.x, y: p.y - p.r, r: stats.bulletR,
            vx: Math.sin(angle) * stats.bulletSpeed,
            vy: -Math.cos(angle) * stats.bulletSpeed,
          })
        }
        lastShotRef.current = ts
      }

      // Orb positions — computed once per frame, used for collision + drawing
      const orbPositions = []
      if (p.orbActive) {
        p.orbAngle += ORB_SPEED
        for (let i = 0; i < p.orbCount; i++) {
          const angle = p.orbAngle + (i / p.orbCount) * Math.PI * 2
          orbPositions.push({ x: p.x + Math.cos(angle) * ORB_ORBIT_R, y: p.y + Math.sin(angle) * ORB_ORBIT_R })
        }
      }

      // Right wing — fire homing missiles toward N nearest enemies
      if (p.rightWing && ts - p.rightWingLastShot >= WING_MISSILE_INT) {
        const wMx = p.x + WING_OFFSET
        const count = p.rightWingMissileCount || 1
        const targets = getNearestEnemies(enemiesRef.current, wMx, wingY, count, null)
        if (targets.length > 0) {
          for (const { e: target } of targets) {
            const ddx = target.x - wMx, ddy = target.y - wingY
            const dist = Math.hypot(ddx, ddy) || 1
            bulletsRef.current.push({
              x: wMx, y: wingY, r: WING_MISSILE_R,
              vx: (ddx / dist) * WING_MISSILE_SPD,
              vy: (ddy / dist) * WING_MISSILE_SPD,
              power: p.rightWingPower, homingTarget: target,
            })
          }
          p.rightWingLastShot = ts
        }
      }

      // Move bullets (homing missiles track their target)
      bulletsRef.current = bulletsRef.current.filter(b => b.y > -b.r && b.x > -b.r && b.x < GAME_W + b.r)
      for (const b of bulletsRef.current) {
        if (b.homingTarget) {
          const t = enemiesRef.current.includes(b.homingTarget) ? b.homingTarget : enemiesRef.current[0]
          if (t) {
            const ddx = t.x - b.x, ddy = t.y - b.y
            const dist = Math.hypot(ddx, ddy) || 1
            b.vx = (ddx / dist) * WING_MISSILE_SPD
            b.vy = (ddy / dist) * WING_MISSILE_SPD
          }
        }
        b.x += b.vx; b.y += b.vy
      }

      // Cannon — fire straight ahead to fixed range
      if (p.cannonActive && ts - p.cannonLastShot >= CANNON_INTERVAL) {
        cannonShellsRef.current.push({
          x: p.x, y: p.y - p.r,
          tx: p.x, ty: p.y - p.r - CANNON_FIXED_RANGE,
        })
        p.cannonLastShot = ts
      }

      // Move cannon shells — collect explosions
      const cannonExplosions = []
      cannonShellsRef.current = cannonShellsRef.current.filter(shell => {
        const sdx = shell.tx - shell.x, sdy = shell.ty - shell.y
        const sdist = Math.hypot(sdx, sdy)
        if (sdist <= CANNON_SPEED) {
          cannonExplosions.push({ x: shell.tx, y: shell.ty })
          return false
        }
        shell.x += (sdx / sdist) * CANNON_SPEED
        shell.y += (sdy / sdist) * CANNON_SPEED
        return true
      })

      // Bullet-enemy collisions (HP-aware)
      const hitEnemies = new Set()
      const hitBullets = new Set()
      // Cannon AoE damage
      for (const exp of cannonExplosions) {
        effectsRef.current.push({ kind: 'cannonBlast', x: exp.x, y: exp.y, life: 1, decay: 0.04, radius: p.cannonRadius })
        for (let n = 0; n < 8; n++)
          effectsRef.current.push({ kind: 'cannonParticle', x: exp.x, y: exp.y, life: 1, angle: (n / 8) * Math.PI * 2 })
        for (let ei = 0; ei < enemiesRef.current.length; ei++) {
          if (hitEnemies.has(ei)) continue
          const e = enemiesRef.current[ei]
          if (ghostInvincible(e)) continue
          const ed = Math.hypot(e.x - exp.x, e.y - exp.y)
          if (ed < p.cannonRadius) {
            const dmg = (ed < p.cannonRadius * 0.4 ? p.cannonPower : p.cannonPower * (1 - ed / p.cannonRadius)) * (e.armored ? ARMOR_DMG_MULT : 1)
            e.hp -= dmg
            if (e.hp <= 0) hitEnemies.add(ei)
            else pushHitEffect(effectsRef.current, e.x, e.y)
          }
        }
      }

      for (let ei = 0; ei < enemiesRef.current.length; ei++) {
        if (hitEnemies.has(ei)) continue
        const e = enemiesRef.current[ei]
        if (ghostInvincible(e)) continue
        for (let bi = 0; bi < bulletsRef.current.length; bi++) {
          if (hitBullets.has(bi)) continue
          if (collides(e, bulletsRef.current[bi])) {
            hitBullets.add(bi)
            e.hp -= (bulletsRef.current[bi].power ?? stats.bulletPower) * (e.armored ? ARMOR_DMG_MULT : 1)
            if (e.hp <= 0) { hitEnemies.add(ei); break }
            // hit but not dead — flash effect
            pushHitEffect(effectsRef.current, e.x, e.y)
          }
        }
      }

      // Shield-enemy collisions
      if (p.shieldActive) {
        const shield = { x: p.x, y: p.y, r: p.shieldR }
        for (let ei = 0; ei < enemiesRef.current.length; ei++) {
          if (hitEnemies.has(ei)) continue
          const e = enemiesRef.current[ei]
          if (ghostInvincible(e)) continue
          if (!collides(e, shield)) continue
          if (ts - (e.shieldHitAt || 0) < 600) continue
          e.shieldHitAt = ts
          e.hp -= p.shieldPower * (e.armored ? ARMOR_DMG_MULT : 1)
          if (e.hp <= 0) hitEnemies.add(ei)
          else pushHitEffect(effectsRef.current, e.x, e.y)
        }
      }

      // Orb — contact damage on enemies (cooldown per enemy)
      for (let ei = 0; ei < enemiesRef.current.length; ei++) {
        if (hitEnemies.has(ei)) continue
        const e = enemiesRef.current[ei]
        if (ghostInvincible(e)) continue
        for (const orb of orbPositions) {
          const odx = e.x - orb.x, ody = e.y - orb.y, osr = ORB_R + e.r
          if (odx * odx + ody * ody < osr * osr) {
            if (ts - (e.orbHitAt || 0) < ORB_HIT_INTERVAL) break
            e.orbHitAt = ts
            e.hp -= ORB_DAMAGE * (e.armored ? ARMOR_DMG_MULT : 1)
            if (e.hp <= 0) hitEnemies.add(ei)
            else pushHitEffect(effectsRef.current, e.x, e.y)
            break
          }
        }
      }

      // Laser — left wing locks onto nearest enemy
      let laserTargets = []
      if (p.leftWing) {
        const lwx = p.x - WING_OFFSET
        const count = p.leftWingLaserCount || 1
        laserTargets = getNearestEnemies(enemiesRef.current, lwx, wingY, count, hitEnemies)
        for (const t of laserTargets) {
          if (ghostInvincible(t.e)) continue
          t.e.hp -= (p.laserDps / 60) * (t.e.armored ? ARMOR_DMG_MULT : 1)
          if (t.e.hp <= 0) hitEnemies.add(t.ei)
        }
      }

      // Lingering cannon blast — enemies passing through active effect zone take gradual damage
      for (const ef of effectsRef.current) {
        if (ef.kind !== 'cannonBlast' || ef.life <= 0.2) continue
        const r2 = ef.radius * ef.radius
        for (let ei = 0; ei < enemiesRef.current.length; ei++) {
          if (hitEnemies.has(ei)) continue
          const e = enemiesRef.current[ei]
          const ddx = e.x - ef.x, ddy = e.y - ef.y
          if (ddx * ddx + ddy * ddy < r2 && !ghostInvincible(e)) {
            e.hp -= ef.life * 0.04 * p.cannonPower * (e.armored ? ARMOR_DMG_MULT : 1)
            if (e.hp <= 0) hitEnemies.add(ei)
          }
        }
      }

      const kills = hitEnemies.size
      const splitSpawns = []
      enemiesRef.current.forEach((e, i) => {
        if (!hitEnemies.has(i)) return
        for (let n = 0; n < 6; n++)
          effectsRef.current.push({ kind: 'particle', x: e.x, y: e.y, life: 1, angle: (n / 6) * Math.PI * 2 })
        effectsRef.current.push({ kind: 'ring', x: e.x, y: e.y, life: 1 })
        effectsRef.current.push({ kind: 'text', x: e.x, y: e.y, life: 1 })
        if (e.splitter) {
          for (let n = 0; n < e.maxHp; n++) {
            const angle = (n / e.maxHp) * Math.PI * 2
            splitSpawns.push({
              x: e.x + Math.cos(angle) * e.r, y: e.y + Math.sin(angle) * e.r,
              r: SPLIT_R, speed: ENEMY_SPEED * 1.4, color: SPLIT_COLOR,
              font: `${Math.round(SPLIT_R * 0.9)}px monospace`,
              homing: false, shooter: false, splitter: false, ghost: false, ghostTick: 0, lastShot: 0,
              hp: 1, maxHp: 1, isWave: e.isWave,
            })
          }
        }
      })
      enemiesRef.current = [...enemiesRef.current.filter((_, i) => !hitEnemies.has(i)), ...splitSpawns]
      bulletsRef.current = bulletsRef.current.filter((_, i) => !hitBullets.has(i))

      // Wave completion — all wave enemies killed or passed off-screen
      if (stagePhaseRef.current === 'wave' && waveAllSpawnedRef.current && !enemiesRef.current.some(e => e.isWave))
        advanceStageRef.current?.()

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
        } else if (ef.kind === 'waveFlash') {
          ctx.strokeStyle = `rgba(255,160,0,${ef.life * 0.9})`
          ctx.lineWidth = 28
          ctx.strokeRect(0, 0, GAME_W, GAME_H)
        } else if (ef.kind === 'hit') {
          drawCircle(ctx, ef.x, ef.y, ef.life * 10, `rgba(255,255,255,${ef.life * 0.4})`, 10)
        } else if (ef.kind === 'cannonBlast') {
          ctx.beginPath()
          ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI * 2)
          ctx.strokeStyle = ctx.shadowColor = `rgba(26,111,255,${ef.life})`
          ctx.shadowBlur = 18; ctx.lineWidth = 3
          ctx.stroke()
          ctx.fillStyle = `rgba(26,111,255,${ef.life * 0.12})`
          ctx.fill()
          ctx.shadowBlur = 0
        } else if (ef.kind === 'cannonParticle') {
          const dist = (1 - ef.life) * 40
          drawCircle(ctx, ef.x + Math.cos(ef.angle) * dist, ef.y + Math.sin(ef.angle) * dist, 3, `rgba(80,150,255,${ef.life})`, 8)
        } else {
          ctx.globalAlpha = a
          ctx.fillStyle   = '#ffe600'
          ctx.font        = 'bold 15px monospace'
          ctx.textAlign   = 'center'
          ctx.fillText('+1', ef.x, ef.y - (1 - a) * 32)
          ctx.globalAlpha = 1
        }
        ef.life -= ef.decay ?? 0.055
        if (ef.life > 0) liveEffects.push(ef)
      }
      effectsRef.current = liveEffects

      // Draw bullets (homing missiles in orange, regular in yellow)
      for (const b of bulletsRef.current)
        drawCircle(ctx, b.x, b.y, b.r, b.homingTarget ? '#00e5ff' : '#ffffff', b.homingTarget ? 14 : 10)

      // Draw cannon shells (green)
      for (const shell of cannonShellsRef.current)
        drawCircle(ctx, shell.x, shell.y, 5, '#1a6fff', 14)

      // Draw orbs
      for (const orb of orbPositions)
        drawCircle(ctx, orb.x, orb.y, ORB_R, '#ffe600', 18)

      // Move & draw enemies
      enemiesRef.current = enemiesRef.current.filter(e =>
        e.y < GAME_H + ENEMY_R && e.y > -ENEMY_R * 2 &&
        e.x > -ENEMY_R * 2   && e.x < GAME_W + ENEMY_R * 2
      )
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const e of enemiesRef.current) {
        if (e.homing) {
          const dx = p.x - e.x, dy = p.y - e.y
          const dist = Math.hypot(dx, dy) || 1
          e.x += (dx / dist) * e.speed
          e.y += (dy / dist) * e.speed
        } else {
          e.y += e.speed
        }
        // Shooter fires missiles toward player
        if (e.shooter && e.y < p.y && ts - e.lastShot >= MISSILE_INTERVAL) {
          e.lastShot = ts
          const dx = p.x - e.x, dy = p.y - e.y
          const dist = Math.hypot(dx, dy) || 1
          enemyBulletsRef.current.push({
            x: e.x, y: e.y + e.r,
            r: MISSILE_R,
            vx: (dx / dist) * MISSILE_SPEED,
            vy: (dy / dist) * MISSILE_SPEED,
          })
        }
        if (e.ghost) e.ghostTick++
        const invincible = ghostInvincible(e)
        if (invincible) ctx.globalAlpha = 0.2 + 0.15 * Math.sin(e.ghostTick * 0.25)
        const hitPlayer = !invincible && collides(e, p) && invincibleRef.current <= 0
        drawCircle(ctx, e.x, e.y, e.r, e.color, invincible ? 16 : 6)
        ctx.globalAlpha = 1
        if (hitPlayer) { gameOverRef.current = true; setGameOver(true); return }
        // HP arc gauge — curved inside bottom of enemy circle
        {
          const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp))
          const arcR = e.r * 0.72
          // bottom arc: from lower-right (0.15π) clockwise to lower-left (0.85π), passing through π/2 (bottom)
          const aStart = Math.PI * 0.15
          const aEnd   = Math.PI * 0.85
          const aFull  = aEnd - aStart
          // lighten enemy color for gauge fill
          const hr = parseInt(e.color.slice(1,3),16), hg = parseInt(e.color.slice(3,5),16), hb = parseInt(e.color.slice(5,7),16)
          const lr = Math.min(255, hr + 90), lg = Math.min(255, hg + 90), lb = Math.min(255, hb + 90)
          const gaugeColor = `rgb(${lr},${lg},${lb})`
          // track (dark semi-transparent)
          ctx.beginPath()
          ctx.arc(e.x, e.y, arcR, aStart, aEnd)
          ctx.strokeStyle = 'rgba(0,0,0,0.4)'
          ctx.lineWidth = e.r * 0.18
          ctx.lineCap = 'round'
          ctx.stroke()
          // fill
          if (ratio > 0) {
            ctx.beginPath()
            ctx.arc(e.x, e.y, arcR, aEnd - aFull * ratio, aEnd)
            ctx.strokeStyle = gaugeColor
            ctx.lineWidth = e.r * 0.18
            ctx.lineCap = 'round'
            ctx.stroke()
          }
        }
      }
      ctx.textBaseline = 'alphabetic'

      // Orb vs enemy missiles — destroy on contact
      enemyBulletsRef.current = enemyBulletsRef.current.filter(m => {
        for (const orb of orbPositions) {
          const mdx = m.x - orb.x, mdy = m.y - orb.y, msr = ORB_R + m.r
          if (mdx * mdx + mdy * mdy < msr * msr) {
            pushHitEffect(effectsRef.current, m.x, m.y)
            return false
          }
        }
        return true
      })

      // Enemy missiles — move, draw, check player collision (shield does not block)
      enemyBulletsRef.current = enemyBulletsRef.current.filter(m =>
        m.y < GAME_H + m.r && m.y > -m.r && m.x > -m.r && m.x < GAME_W + m.r
      )
      for (const m of enemyBulletsRef.current) {
        m.x += m.vx; m.y += m.vy
        if (collides(m, p) && invincibleRef.current <= 0) { gameOverRef.current = true; setGameOver(true); return }
        drawCircle(ctx, m.x, m.y, m.r, SHOOTER_MISSILE_COLOR, 14)
      }

      // Draw laser beams — left wing toward N nearest targets (or straight up if no enemy)
      if (p.leftWing) {
        const lwx = p.x - WING_OFFSET, lwy = wingY - WING_R
        ctx.strokeStyle = ctx.shadowColor = '#ff6060'
        ctx.shadowBlur = 8; ctx.lineWidth = 2
        const beams = laserTargets.length > 0 ? laserTargets : [null]
        for (const t of beams) {
          const tx = t ? t.e.x : lwx
          const ty = t ? t.e.y : 0
          ctx.beginPath(); ctx.moveTo(lwx, lwy); ctx.lineTo(tx, ty); ctx.stroke()
        }
        ctx.shadowBlur = 0
      }

      // Draw player
      if (invincibleRef.current > 0) invincibleRef.current--
      if (invincibleRef.current > 0) ctx.globalAlpha = 0.2 + 0.15 * Math.sin(timeRef.current * 0.25)
      drawCircle(ctx, p.x, p.y, p.r, '#00e5ff', 8)
      ctx.globalAlpha = 1

      // Cannon indicator — small green dot at player top-center
      if (p.cannonActive)
        drawCircle(ctx, p.x, p.y - p.r - 5, 4, '#1a6fff', 10)

      // Draw companion wings — bottom-aligned to player
      if (p.leftWing)  drawCircle(ctx, p.x - WING_OFFSET, wingY, WING_R, '#ff6060', 10)
      if (p.rightWing) drawCircle(ctx, p.x + WING_OFFSET, wingY, WING_R, '#ff6060', 10)

      // Draw shield — one ring per power level (ceil), spaced 5px apart
      if (p.shieldActive) {
        const ringCount = Math.ceil(p.shieldPower)
        ctx.strokeStyle = 'rgba(0,229,255,0.5)'
        ctx.shadowColor = '#00e5ff'
        ctx.shadowBlur  = 14
        ctx.lineWidth   = 2
        for (let i = 0; i < ringCount; i++) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.shieldR + i * 5, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.shadowBlur  = 0
      }

      // XP — checked after drawing so the freeze frame shows all entities
      if (kills > 0) {
        const x = xpRef.current
        x.current += kills
        if (x.current >= x.max) {
          x.current -= x.max
          x.level += 1
          x.max = Math.floor(x.max * 1.3)
          setLevel(x.level)
          setCards(pickCards(stats, p))
          setXp(x.current / x.max)
          return
        }
        setXp(x.current / x.max)
      }

      if (kills > 0) {
        killCountRef.current += kills
        scoreRef.current += kills
      }

      timeRef.current += 1
      const tickSecond = timeRef.current % 60 === 0
      if (tickSecond) scoreRef.current += 1
      if (kills > 0 || tickSecond) setScore(scoreRef.current)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [started, gameOver, paused])

  useEffect(() => {
    if (!gameOver) return
    const secs = Math.floor(timeRef.current / 60)
    const kills = killCountRef.current
    setFinalStats({ time: secs, kills })
    const prev = parseInt(localStorage.getItem('voidHighScore') || '0')
    if (scoreRef.current > prev) {
      localStorage.setItem('voidHighScore', String(scoreRef.current))
      setHighScore(scoreRef.current)
      setIsNewRecord(true)
    }
    if (nickname && scoreRef.current > 0) {
      submitScore({ nickname, score: scoreRef.current, kills, time: secs, stage: stageRef.current })
    }
  }, [gameOver])

  const confirmNickname = () => {
    const n = nicknameInput.trim() || makeDefaultNickname()
    localStorage.setItem('voidNickname', n)
    setNickname(n)
  }

  const loadLeaderboard = async (tab) => {
    setLbLoading(true)
    try {
      const { entries, myRank, myEntry } = await fetchLeaderboard(tab, nickname)
      setLbEntries(entries)
      setLbMyRank(myRank)
      setLbMyEntry(myEntry)
      setLbTab(tab)
    } catch (e) {
      console.error(e)
    } finally {
      setLbLoading(false)
    }
  }

  useEffect(() => {
    if (!started) loadLeaderboard('today')
  }, [started])

  const selectCard = (upgrade) => {
    upgrade.apply(statsRef.current, playerRef.current)
    playerRef.current.x = targetXRef.current  // snap to current finger position
    invincibleRef.current = 90                // 1.5s invincibility on resume
    setCards([])
  }

  const restart = () => {
    enemiesRef.current      = []
    bulletsRef.current      = []
    effectsRef.current      = []
    enemyBulletsRef.current = []
    cannonShellsRef.current = []
    scoreRef.current    = 0
    timeRef.current     = 0
    killCountRef.current = 0
    lastShotRef.current = 0
    gameOverRef.current        = false
    stageRef.current           = 1
    stagePhaseRef.current      = 'playing'
    advanceStageRef.current    = null
    waveAllSpawnedRef.current  = false
    waveRemainingRef.current   = 0
    phaseStartRef.current      = 0
    targetXRef.current         = GAME_W / 2
    invincibleRef.current      = 0
    setStageAnn(0)
    setWaveWarning(false)
    playerRef.current   = { x: GAME_W / 2, y: GAME_H - 80, r: PLAYER_R, shieldActive: false, shieldR: 0, shieldPower: 0, leftWing: false, rightWing: false, leftWingLevel: 0, rightWingLevel: 0, laserDps: 0, leftWingLaserCount: 1, rightWingPower: 0, rightWingLastShot: 0, rightWingMissileCount: 1, cannonActive: false, cannonPower: CANNON_BASE_POWER, cannonRadius: CANNON_BASE_RADIUS, cannonLastShot: 0, orbActive: false, orbCount: 1, orbAngle: 0 }
    xpRef.current       = { current: 0, level: 1, max: 4 }
    statsRef.current    = { ...DEFAULT_STATS }
    setIsNewRecord(false)
    setFinalStats({ time: 0, kills: 0 })
    setScore(0); setXp(0); setLevel(1); setStage(1); setCards([]); setGameOver(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}>
      <div style={{ position: 'relative', ...CANVAS_STYLE }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

        {/* HUD */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '12px 16px', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ ...mono, color: '#00e5ff', fontSize: 14 }}>SCORE {score}</span>
            <span style={{ ...mono, color: '#ffe600', fontSize: 14 }}>STAGE {stage}</span>
            <span style={{ ...mono, color: '#b388ff', fontSize: 14 }}>LV {level}</span>
          </div>
          <div style={{ height: 5, background: '#1a1a2e', borderRadius: 3 }}>
            <div style={{ width: `${xp * 100}%`, height: '100%', background: '#b388ff', boxShadow: '0 0 8px #b388ff', borderRadius: 3, transition: 'width 0.1s' }} />
          </div>
        </div>

        {/* Start screen */}
        {!started && (
          <div style={{ ...overlay, background: '#0a0a0f', gap: 18, padding: '28px 20px', overflowY: 'auto', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ ...mono, color: '#00e5ff', fontSize: 36, letterSpacing: 6, textShadow: '0 0 20px #00e5ff' }}>VOID</div>
              <div style={{ ...mono, color: '#b388ff', fontSize: 13, letterSpacing: 3, textShadow: '0 0 10px #b388ff' }}>SURVIVOR</div>
            </div>

            {!nickname ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
                <div style={{ ...mono, color: '#555', fontSize: 11, letterSpacing: 2 }}>ENTER NICKNAME</div>
                <input
                  value={nicknameInput}
                  onChange={e => setNicknameInput(e.target.value.toUpperCase().slice(0, 14))}
                  onKeyDown={e => { if (e.key === 'Enter') confirmNickname() }}
                  maxLength={14}
                  autoFocus
                  placeholder="PLAYER"
                  style={{ background: '#111', border: '1px solid #444', color: '#fff', ...mono, fontSize: 18, textAlign: 'center', padding: '10px 16px', borderRadius: 6, width: '60%', letterSpacing: 3, outline: 'none' }}
                />
                <button onClick={confirmNickname} style={{
                  background: 'transparent', border: '1px solid #00e5ff', color: '#00e5ff',
                  ...mono, fontSize: 13, letterSpacing: 4, padding: '10px 28px', borderRadius: 6, cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}>CONFIRM</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ ...mono, color: '#444', fontSize: 11, letterSpacing: 2 }}>PLAYER</div>
                  <div style={{ ...mono, color: '#00e5ff', fontSize: 15, letterSpacing: 3 }}>{nickname}</div>
                  <button onClick={() => { setNickname(''); setNicknameInput('') }} style={{ background: 'none', border: 'none', color: '#444', fontSize: 11, cursor: 'pointer', ...mono, padding: 0 }}>✕</button>
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

            {/* Leaderboard */}
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
                {['today', 'week', 'all'].map(tab => (
                  <button key={tab} onClick={() => loadLeaderboard(tab)} style={{
                    background: lbTab === tab ? 'rgba(179,136,255,0.12)' : 'transparent',
                    border: `1px solid ${lbTab === tab ? '#b388ff' : '#2a2a3a'}`,
                    color: lbTab === tab ? '#b388ff' : '#444',
                    ...mono, fontSize: 10, letterSpacing: 2,
                    padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                    {tab === 'today' ? 'TODAY' : tab === 'week' ? 'WEEK' : 'ALL TIME'}
                  </button>
                ))}
              </div>
              {lbLoading ? (
                <div style={{ ...mono, color: '#333', fontSize: 11, textAlign: 'center', letterSpacing: 2 }}>LOADING...</div>
              ) : lbEntries.length === 0 ? (
                <div style={{ ...mono, color: '#333', fontSize: 11, textAlign: 'center', letterSpacing: 2 }}>NO RECORDS YET</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {lbEntries.map((e, i) => {
                    const isMe = e.nickname === nickname
                    return (
                      <div key={`${e.nickname}-${e.score}-${i}`} style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', background: isMe ? 'rgba(0,229,255,0.07)' : i === 0 ? 'rgba(255,230,0,0.04)' : 'transparent', borderRadius: 4, border: isMe ? '1px solid rgba(0,229,255,0.2)' : '1px solid transparent' }}>
                        <span style={{ ...mono, color: i === 0 ? '#ffe600' : i < 3 ? '#888' : '#333', fontSize: 11, width: 18 }}>{i + 1}</span>
                        <span style={{ ...mono, color: isMe ? '#00e5ff' : i === 0 ? '#ffe600' : '#888', fontSize: 12, flex: 1, marginLeft: 6 }}>{e.nickname}</span>
                        <span style={{ ...mono, color: isMe ? '#00e5ff' : i === 0 ? '#ffe600' : '#00e5ff', fontSize: 13 }}>{e.score}</span>
                      </div>
                    )
                  })}
                  {lbMyRank > 10 && lbMyEntry && (
                    <>
                      <div style={{ ...mono, color: '#2a2a3a', fontSize: 10, textAlign: 'center', letterSpacing: 1, padding: '2px 0' }}>···</div>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', background: 'rgba(0,229,255,0.07)', borderRadius: 4, border: '1px solid rgba(0,229,255,0.2)' }}>
                        <span style={{ ...mono, color: '#444', fontSize: 11, width: 18 }}>{lbMyRank}</span>
                        <span style={{ ...mono, color: '#00e5ff', fontSize: 12, flex: 1, marginLeft: 6 }}>{lbMyEntry.nickname}</span>
                        <span style={{ ...mono, color: '#00e5ff', fontSize: 13 }}>{lbMyEntry.score}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
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

        {/* Wave warning */}
        {waveWarning && !paused && (
          <div style={{ ...overlay, pointerEvents: 'none' }}>
            <style>{`@keyframes warn{0%,100%{opacity:0.2}50%{opacity:1}}`}</style>
            <div style={{ ...mono, color: '#ff3b30', fontSize: 36, letterSpacing: 10, textShadow: '0 0 24px #ff3b30', animation: 'warn 0.5s ease-in-out infinite' }}>WARNING</div>
            <div style={{ ...mono, color: '#ff9f0a', fontSize: 14, letterSpacing: 4, marginTop: 10, opacity: 0.8 }}>WAVE INCOMING</div>
          </div>
        )}

        {/* Stage announcement */}
        {stageAnn > 0 && !paused && (
          <div style={{ ...overlay, pointerEvents: 'none' }}>
            <style>{`@keyframes stageIn{0%{transform:scale(2.5);opacity:0}15%{transform:scale(1);opacity:1}65%{opacity:1}100%{opacity:0}}`}</style>
            <div key={stageAnn} style={{ ...mono, color: '#ffe600', fontSize: 52, letterSpacing: 8, textShadow: '0 0 24px #ffe600, 0 0 60px rgba(255,230,0,0.4)', animation: 'stageIn 2.2s ease-out forwards' }}>
              STAGE {stageAnn}
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {gameOver && (() => {
          const m = String(Math.floor(finalStats.time / 60)).padStart(2, '0')
          const s = String(finalStats.time % 60).padStart(2, '0')
          return (
            <div style={{ ...overlay, gap: 10 }}>
              <style>{RECORD_CSS}</style>
              <div style={{ ...mono, color: '#ff2d55', fontSize: 38 }}>GAME OVER</div>
              {isNewRecord && (
                <div style={{ ...mono, color: '#ffe600', fontSize: 15, letterSpacing: 4, animation: 'recordPulse 0.8s ease-in-out infinite, recordGlow 0.8s ease-in-out infinite' }}>
                  NEW RECORD!
                </div>
              )}
              <div style={{ ...mono, color: '#fff', fontSize: 22, marginTop: 4 }}>{score}</div>
              {!isNewRecord && highScore > 0 && (
                <div style={{ ...mono, color: '#ffe600', fontSize: 13 }}>BEST {highScore}</div>
              )}
              <div style={{ display: 'flex', gap: 24, marginTop: 6 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...mono, color: '#555', fontSize: 11, letterSpacing: 2, marginBottom: 3 }}>TIME</div>
                  <div style={{ ...mono, color: '#aaa', fontSize: 15 }}>{m}:{s}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...mono, color: '#555', fontSize: 11, letterSpacing: 2, marginBottom: 3 }}>KILLS</div>
                  <div style={{ ...mono, color: '#aaa', fontSize: 15 }}>{finalStats.kills}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button onClick={restart} style={{
                  background: '#00e5ff', color: '#0a0a0f',
                  border: 'none', padding: '14px 28px', ...mono,
                  fontSize: 17, cursor: 'pointer', borderRadius: 6,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  RESTART
                </button>
                <button onClick={() => { restart(); setStarted(false) }} style={{
                  background: 'transparent', color: '#555',
                  border: '1px solid #333', padding: '14px 20px', ...mono,
                  fontSize: 14, cursor: 'pointer', borderRadius: 6,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  MENU
                </button>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
