import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, deleteDoc, setDoc } from 'firebase/firestore'
import { getFb } from './firebase'
import { useToast } from '../components/Toasts'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const NAMES = ['tasks', 'events', 'meta']
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

/**
 * One data layer, two backends:
 *  - Firebase user  → Cloud Firestore at users/{uid}/{tasks|events|meta}, realtime via onSnapshot
 *  - Demo user      → localStorage
 */
export function StoreProvider({ user, children }) {
  const toast = useToast()
  const cloud = user.mode === 'firebase'
  const [data, setData] = useState({ tasks: [], events: [], meta: [] })
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setLoaded(false)
    if (cloud) {
      const { fs } = getFb()
      const ready = new Set()
      const unsubs = NAMES.map((n) =>
        onSnapshot(
          collection(fs, 'users', user.uid, n),
          (snap) => {
            setData((p) => ({ ...p, [n]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }))
            setPending(snap.metadata.hasPendingWrites)
            ready.add(n)
            if (ready.size === NAMES.length) setLoaded(true)
          },
          (err) => {
            console.error(err)
            toast(err.code === 'permission-denied' ? 'Database permission denied — publish firestore.rules' : `Database error: ${err.code}`)
          },
        ),
      )
      return () => unsubs.forEach((u) => u())
    }
    const next = {}
    NAMES.forEach((n) => {
      try {
        next[n] = JSON.parse(localStorage.getItem(`tf:${user.uid}:${n}`) || '[]')
      } catch {
        next[n] = []
      }
    })
    setData(next)
    setLoaded(true)
  }, [user.uid, cloud, toast])

  const save = useCallback(
    (n, item) => {
      const { id: given, ...rest } = item
      const payload = JSON.parse(JSON.stringify(rest)) // Firestore rejects `undefined`
      if (cloud) {
        const { fs } = getFb()
        const id = given || doc(collection(fs, 'users', user.uid, n)).id
        setDoc(doc(fs, 'users', user.uid, n, id), payload, { merge: true }).catch((e) => toast(`Couldn’t save: ${e.code || e.message}`))
        return id
      }
      const id = given || uid()
      setData((p) => {
        const rows = p[n]
        const i = rows.findIndex((x) => x.id === id)
        const row = { ...(i >= 0 ? rows[i] : {}), ...payload, id }
        const next = i >= 0 ? rows.map((x, j) => (j === i ? row : x)) : [...rows, row]
        try {
          localStorage.setItem(`tf:${user.uid}:${n}`, JSON.stringify(next))
        } catch {
          /* storage full/blocked */
        }
        return { ...p, [n]: next }
      })
      return id
    },
    [cloud, user.uid, toast],
  )

  const del = useCallback(
    (n, id) => {
      if (cloud) {
        const { fs } = getFb()
        deleteDoc(doc(fs, 'users', user.uid, n, id)).catch((e) => toast(`Couldn’t delete: ${e.code || e.message}`))
        return
      }
      setData((p) => {
        const next = p[n].filter((x) => x.id !== id)
        try {
          localStorage.setItem(`tf:${user.uid}:${n}`, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return { ...p, [n]: next }
      })
    },
    [cloud, user.uid, toast],
  )

  const value = useMemo(
    () => ({
      tasks: data.tasks,
      events: data.events,
      profile: data.meta.find((r) => r.id === 'profile') || null,
      loaded,
      pending,
      cloud,
      save,
      del,
    }),
    [data, loaded, pending, cloud, save, del],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
