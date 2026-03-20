import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore'

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

const db = getFirestore(app)

export async function submitScore({ nickname, score, kills, time, stage }) {
  return addDoc(collection(db, 'scores'), {
    nickname, score, kills, time, stage,
    ts: serverTimestamp(),
  })
}

const scoresRef = collection(db, 'scores')

export async function fetchLeaderboard(tab) {
  let q
  if (tab === 'today') {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    q = query(scoresRef, where('ts', '>=', Timestamp.fromDate(start)), orderBy('score', 'desc'), limit(10))
  } else if (tab === 'week') {
    const start = new Date()
    start.setDate(start.getDate() - 7)
    start.setHours(0, 0, 0, 0)
    q = query(scoresRef, where('ts', '>=', Timestamp.fromDate(start)), orderBy('score', 'desc'), limit(10))
  } else {
    q = query(scoresRef, orderBy('score', 'desc'), limit(10))
  }
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}
