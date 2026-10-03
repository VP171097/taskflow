import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { firebaseConfig, firebaseConfigured } from '../config'

let inst = null

/** Lazily initialises Firebase. Returns null when no Firebase config is provided. */
export function getFb() {
  if (!firebaseConfigured) return null
  if (!inst) {
    const app = initializeApp(firebaseConfig)
    inst = {
      app,
      auth: getAuth(app),
      // offline-capable Firestore (data cached locally, syncs when back online)
      fs: initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      }),
    }
  }
  return inst
}
