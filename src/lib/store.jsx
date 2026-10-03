import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, deleteDoc, setDoc } from 'firebase/firestore'
import { getFb } from './firebase'
import { useToast } from '../components/Toasts'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const NAMES = ['tasks', 'events', 'meta']

/** Cloud Firestore data layer at users/{uid}/{tasks|events|meta}, realtime via onSnapshot. */
export function StoreProvider({ user, children }) {
  const toast = useToast()
  const [data, setData] = useState({ tasks: [], events: [], meta: [] })
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setLoaded(false)
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
  }, [user.uid, toast])

  const save = useCallback(
    (n, item) => {
      const { id: given, ...rest } = item
      const payload = JSON.parse(JSON.stringify(rest)) // Firestore rejects `undefined`
      const { fs } = getFb()
      const id = given || doc(collection(fs, 'users', user.uid, n)).id
      setDoc(doc(fs, 'users', user.uid, n, id), payload, { merge: true }).catch((e) => toast(`Couldn’t save: ${e.code || e.message}`))
      return id
    },
    [user.uid, toast],
  )

  const del = useCallback(
    (n, id) => {
      const { fs } = getFb()
      deleteDoc(doc(fs, 'users', user.uid, n, id)).catch((e) => toast(`Couldn’t delete: ${e.code || e.message}`))
    },
    [user.uid, toast],
  )

  const value = useMemo(
    () => ({
      tasks: data.tasks,
      events: data.events,
      profile: data.meta.find((r) => r.id === 'profile') || null,
      loaded,
      pending,
      save,
      del,
    }),
    [data, loaded, pending, save, del],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
