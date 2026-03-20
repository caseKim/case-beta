import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore'

const app = initializeApp({
  apiKey: 'AIzaSyDluNqxNbkRiiNdvHQyLL0oC5yHVaGE-p0',
  authDomain: 'case-beta.firebaseapp.com',
  projectId: 'case-beta',
  storageBucket: 'case-beta.firebasestorage.app',
  messagingSenderId: '1070070689537',
  appId: '1:1070070689537:web:22f7c229102dbe59dc3500',
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
