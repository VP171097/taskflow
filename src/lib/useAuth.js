import { useCallback, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { getFb } from './firebase'

const MESSAGES = {
  'auth/unauthorized-domain': 'This domain isn’t authorised yet. Add it in Firebase → Authentication → Settings → Authorized domains.',
  'auth/operation-not-allowed': 'This sign-in method isn’t enabled. Firebase → Authentication → Sign-in method → enable it.',
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/missing-password': 'Please enter your password.',
  'auth/weak-password': 'Password is too weak — use at least 6 characters.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Network problem — check your connection.',
}
const explain = (e) => MESSAGES[e.code] || e.message || 'Something went wrong.'

/** user: undefined = still loading, null = signed out */
export function useAuth() {
  const [user, setUser] = useState(undefined)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    const fb = getFb()
    if (!fb) {
      setUser(null)
      return
    }
    return onAuthStateChanged(fb.auth, (u) => {
      setUser(u ? { uid: u.uid, name: u.displayName, email: u.email, photo: u.photoURL } : null)
    })
  }, [])

  const reset = () => {
    setError('')
    setInfo('')
  }

  const signIn = useCallback(async () => {
    const fb = getFb()
    if (!fb) return
    reset()
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(fb.auth, provider)
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        return signInWithRedirect(fb.auth, provider)
      }
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return
      setError(explain(e))
    }
  }, [])

  /** mode: 'signin' | 'signup' */
  const emailAuth = useCallback(async (mode, { email, password, name }) => {
    const fb = getFb()
    if (!fb) return false
    reset()
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(fb.auth, email.trim(), password)
        if (name?.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() })
          setUser((u) => (u ? { ...u, name: name.trim() } : u))
        }
      } else {
        await signInWithEmailAndPassword(fb.auth, email.trim(), password)
      }
      return true
    } catch (e) {
      setError(explain(e))
      return false
    }
  }, [])

  const resetPassword = useCallback(async (email) => {
    const fb = getFb()
    if (!fb) return
    reset()
    if (!email.trim()) return setError('Enter your email above first, then click “Forgot password?”.')
    try {
      await sendPasswordResetEmail(fb.auth, email.trim())
      setInfo('Password reset email sent — check your inbox (and spam folder).')
    } catch (e) {
      // don't reveal whether an account exists
      if (e.code === 'auth/user-not-found') setInfo('If an account exists for that email, a reset link is on its way.')
      else setError(explain(e))
    }
  }, [])

  const logout = useCallback(async () => {
    const fb = getFb()
    if (fb) await signOut(fb.auth)
    setUser(null)
  }, [])

  return { user, error, info, signIn, emailAuth, resetPassword, logout }
}
