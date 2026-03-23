import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore'

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
