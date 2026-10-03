import { useCallback, useEffect, useState } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { getFb } from './firebase'

const DEMO = { uid: 'demo', name: 'Demo User', email: 'Saved on this device only', photo: null, mode: 'local' }
const demoFlag = () => {
  try {
    return localStorage.getItem('tf:demo') === '1'
  } catch {
    return false
  }
}
const setDemoFlag = (on) => {
  try {
    if (on) localStorage.setItem('tf:demo', '1')
    else localStorage.removeItem('tf:demo')
  } catch {
    /* ignore */
  }
}

/** user: undefined = still loading, null = signed out */
export function useAuth() {
  const [user, setUser] = useState(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    const fb = getFb()
    if (!fb) {
      setUser(demoFlag() ? DEMO : null)
      return
    }
    return onAuthStateChanged(fb.auth, (u) => {
      if (u) setUser({ uid: u.uid, name: u.displayName, email: u.email, photo: u.photoURL, mode: 'firebase' })
      else setUser(demoFlag() ? DEMO : null)
    })
  }, [])

  const signIn = useCallback(async () => {
    const fb = getFb()
    if (!fb) return
    setError('')
    setDemoFlag(false)
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(fb.auth, provider)
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        return signInWithRedirect(fb.auth, provider)
      }
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return
      setError(
        e.code === 'auth/unauthorized-domain'
          ? 'This domain isn’t authorised yet. Add it in Firebase → Authentication → Settings → Authorized domains.'
          : e.code === 'auth/operation-not-allowed'
            ? 'Google sign-in isn’t enabled. Firebase → Authentication → Sign-in method → Google → Enable.'
            : e.message || 'Sign-in failed',
      )
    }
  }, [])

  const useDemo = useCallback(() => {
    setDemoFlag(true)
    setUser(DEMO)
  }, [])

  const logout = useCallback(async () => {
    setDemoFlag(false)
    const fb = getFb()
    if (fb) await signOut(fb.auth)
    setUser(null)
  }, [])

  return { user, error, signIn, useDemo, logout }
}
