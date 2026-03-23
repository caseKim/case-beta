import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

export const ENERGY_MAX = 10
export const ENERGY_RECHARGE_MS = 5 * 60 * 1000

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

const auth = getAuth(app)
const db = getFirestore(app)
const scoresRef = collection(db, 'scores')

export function ensureAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub()
      if (user) resolve(user.uid)
      else signInAnonymously(auth).then(({ user }) => resolve(user.uid))
    })
  })
}

function getDateKey() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function getWeekKey() {
  const d = new Date()
  // ISO 8601: Thursday of the current week determines the year and week number
  const thu = new Date(d)
  thu.setUTCDate(d.getUTCDate() + (4 - (d.getUTCDay() || 7)))
  const year = thu.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const week = Math.ceil(((thu - jan4) / 86400000 + (jan4.getUTCDay() || 7) - 3) / 7)
  return `${year}-${String(week).padStart(2, '0')}`
}

export async function submitScore({ uid, nickname, score, kills, time, stage }) {
  return addDoc(scoresRef, {
    uid, nickname, score, kills, time, stage,
    ts: serverTimestamp(),
    date: getDateKey(),
    yearWeek: getWeekKey(),
  })
}

export async function fetchEnergy(uid) {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  const now = Date.now()

  if (!snap.exists()) {
    await setDoc(ref, { energy: ENERGY_MAX, lastRechargeAt: now })
    return { energy: ENERGY_MAX, lastRechargeAt: now }
  }

  let { energy = ENERGY_MAX, lastRechargeAt = now } = snap.data()

  // Apply offline recharge (only when below ENERGY_MAX; gifts can push above it)
  if (energy < ENERGY_MAX) {
    const ticks = Math.floor((now - lastRechargeAt) / ENERGY_RECHARGE_MS)
    if (ticks > 0) {
      energy = Math.min(ENERGY_MAX, energy + ticks)
      lastRechargeAt = lastRechargeAt + ticks * ENERGY_RECHARGE_MS
      await updateDoc(ref, { energy, lastRechargeAt })
    }
  }

  return { energy, lastRechargeAt }
}

export async function saveEnergyState(uid, energy, lastRechargeAt) {
  await updateDoc(doc(db, 'users', uid), { energy, lastRechargeAt })
}

// 선물/이벤트로 에너지 지급 — ENERGY_MAX 초과 허용
// 오프라인 충전을 먼저 정산한 뒤 amount를 더함
export async function giftEnergy(uid, amount) {
  const { energy: cur } = await fetchEnergy(uid)  // 정산 포함된 현재값
  const newEnergy = cur + amount
  // 결과가 MAX 미만이면 지금부터 충전 타이머 시작, 이상이면 타이머 무관
  await updateDoc(doc(db, 'users', uid), { energy: newEnergy, lastRechargeAt: Date.now() })
  return newEnergy
}

export async function fetchMyBest(uid) {
  const q = query(scoresRef, where('uid', '==', uid))
  const snap = await getDocs(q)
  if (snap.empty) return 0
  return Math.max(...snap.docs.map(d => d.data().score))
}

export async function fetchLeaderboard(tab, uid) {
  let q
  if (tab === 'today') {
    q = query(scoresRef, where('date', '==', getDateKey()), orderBy('score', 'desc'), limit(50))
  } else if (tab === 'week') {
    q = query(scoresRef, where('yearWeek', '==', getWeekKey()), orderBy('score', 'desc'), limit(50))
  } else {
    q = query(scoresRef, orderBy('score', 'desc'), limit(50))
  }
  const snap = await getDocs(q)
  const raw = snap.docs.map(d => d.data())

  // uid 기준 중복 제거 (구버전 데이터는 nickname으로 fallback)
  const bestMap = new Map()
  for (const e of raw) {
    const key = e.uid || e.nickname
    if (!bestMap.has(key) || e.score > bestMap.get(key).score) {
      bestMap.set(key, e)
    }
  }
  const ranked = [...bestMap.values()].sort((a, b) => b.score - a.score)

  const entries = ranked.slice(0, 10)
  const myRank = uid ? ranked.findIndex(e => e.uid === uid) + 1 : 0
  const myEntry = uid ? bestMap.get(uid) ?? null : null

  return { entries, myRank, myEntry }
}
