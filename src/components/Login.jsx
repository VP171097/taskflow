import { useState } from 'react'
import { firebaseConfigured } from '../config'

export default function Login({ auth }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const signup = mode === 'signup'

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    await auth.emailAuth(mode, f)
    setBusy(false)
  }

  return (
    <section className="login">
      <div className="login-card">
        <div className="logo big">
          <LogoSvg />
        </div>
        <h1>TaskFlow</h1>
        <p className="muted">Your tasks and weekly timetable in one place — for work, study, family and everything between. AI-assisted and synced on every device.</p>

        <button className="btn google" onClick={auth.signIn} disabled={!firebaseConfigured}>
          <svg viewBox="0 0 48 48" width="20" height="20">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
            <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          Continue with Google
        </button>

        <div className="or"><span>or use email</span></div>

        <form className="auth-form" onSubmit={submit}>
          {signup && (
            <input value={f.name} onChange={set('name')} placeholder="Your name" autoComplete="name" maxLength={60} />
          )}
          <input type="email" value={f.email} onChange={set('email')} placeholder="Email address" autoComplete="email" required />
          <input
            type="password"
            value={f.password}
            onChange={set('password')}
            placeholder={signup ? 'Create a password (6+ characters)' : 'Password'}
            autoComplete={signup ? 'new-password' : 'current-password'}
            minLength={6}
            required
          />
          <button className="btn primary" disabled={busy || !firebaseConfigured}>
            {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="auth-links">
          {!signup && (
            <button type="button" className="link" onClick={() => auth.resetPassword(f.email)}>Forgot password?</button>
          )}
          <button type="button" className="link" onClick={() => setMode(signup ? 'signin' : 'signup')}>
            {signup ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
        </div>

        {auth.error && <p className="note err">{auth.error}</p>}
        {auth.info && <p className="note ok">{auth.info}</p>}
        {!firebaseConfigured && (
          <p className="note">
            Firebase isn’t configured yet. Copy <code>.env.example</code> to <code>.env</code> and fill it in (see README).
          </p>
        )}
      </div>
    </section>
  )
}

export function LogoSvg() {
  return (
    <svg viewBox="0 0 32 32">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path d="M9 16.5l4.5 4.5L23 11" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
