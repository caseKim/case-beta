import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore'

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

export async function submitScore({ uid, nickname, score, kills, time, stage }) {
  return addDoc(scoresRef, { uid, nickname, score, kills, time, stage, ts: serverTimestamp() })
}

export async function fetchLeaderboard(tab, uid) {
  let q
  if (tab === 'today' || tab === 'week') {
    const start = new Date()
    if (tab === 'week') start.setDate(start.getDate() - 7)
    start.setHours(0, 0, 0, 0)
    // Firestore requires orderBy(ts) first when filtering ts >= start;
    // score sort happens client-side after dedup, so fetch enough docs.
    q = query(scoresRef, where('ts', '>=', Timestamp.fromDate(start)), orderBy('ts'), limit(300))
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
