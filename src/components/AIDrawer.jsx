import { useCallback, useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { useStore } from '../lib/store'
import { useToast } from './Toasts'
import { PERSONAS, catColor } from '../lib/constants'
import { DAYS_LONG, dayIdx, eventsOnDate, fmtT, t12, toMin, ymd } from '../lib/dates'
import {
  KEY_LS, PLAN_SCHEMA, PROPOSAL_SCHEMA, aiGenerate, aiJSON, aiProvider, chatSystem, fileToPart,
  friendlyError, importPrompt, importSystem, nowInfo, planSystem,
} from '../lib/ai'
import { applyProposal, normalizeProposals } from '../lib/proposals'

/* tiny, safe markdown: **bold**, "- " bullets, paragraphs */
function md(t) {
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const inl = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  let out = ''
  let list = false
  for (const line of esc(t).split('\n')) {
    const m = /^\s*[-*•]\s+(.*)/.exec(line)
    if (m) {
      if (!list) out += '<ul>'
      list = true
      out += `<li>${inl(m[1])}</li>`
    } else {
      if (list) out += '</ul>'
      list = false
      if (line.trim()) out += `<p>${inl(line)}</p>`
    }
  }
  return out + (list ? '</ul>' : '')
}

/* ============================ Chat ============================ */
const CHIPS = ['What’s due this week?', 'What’s overdue?', 'Am I free tomorrow afternoon?', 'Summarise my week']

function ChatPane({ user }) {
  const { tasks, events, profile } = useStore()
  const persona = PERSONAS[profile?.persona] || PERSONAS.custom
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const log = useRef(null)

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [msgs])

  const send = async (q) => {
    q = q.trim()
    if (!q || busy) return
    setInput('')
    setBusy(true)
    const history = msgs.slice(-6).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'bot', text: '' }])
    const set = (patch) => setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, ...patch } : x)))
    try {
      await aiGenerate({
        user,
        system: chatSystem({ persona, tasks, events }),
        parts: [{ text: `${history ? `Conversation so far:\n${history}\n\n` : ''}User: ${q}` }],
        temperature: 0.3,
        onChunk: (t) => set({ text: t }),
      })
    } catch (e) {
      set({ text: friendlyError(e), err: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ai-pane">
      <div className="chat-log" ref={log}>
        {!msgs.length && <div className="empty small"><div className="emoji">💬</div><p>Ask anything about your tasks and timetable. Answers come only from your own data.</p></div>}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role} ${m.err ? 'err' : ''}`}>
            {m.role === 'bot' && !m.text ? <span className="dots"><span /><span /><span /></span> : m.role === 'bot' ? <div dangerouslySetInnerHTML={{ __html: md(m.text) }} /> : m.text}
          </div>
        ))}
      </div>
      <div className="chips">{CHIPS.map((c) => <button key={c} onClick={() => send(c)} disabled={busy}>{c}</button>)}</div>
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(input) }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your tasks & schedule…" autoComplete="off" />
        <button className="btn primary" disabled={busy || !input.trim()}>Send</button>
      </form>
    </section>
  )
}

/* ====================== Import / build / review ====================== */
const MODES = {
  extract: ['Read my notes / photo / PDF', 'Type or paste a to-do list or timetable, or upload a photo/PDF of a handwritten or printed one.'],
  build: ['Build my timetable', 'Describe your situation (job hours, classes, kids, commute…) and AI drafts a full weekly timetable.'],
  review: ['Review my schedule', 'AI audits your current tasks & timetable and suggests fixes: overlaps, missing breaks, overdue items.'],
  breakdown: ['Break down a task', 'AI splits a big task into small steps.'],
}

function ImportPane({ user, seed }) {
  const { tasks, events, profile, save, del } = useStore()
  const toast = useToast()
  const persona = PERSONAS[profile?.persona] || PERSONAS.custom
  const [mode, setMode] = useState('extract')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  const run = useCallback(
    async (m = mode, t = text, f = file) => {
      if (m !== 'review' && !t.trim() && !f) return setErr('Type something or upload a photo / PDF first.')
      setBusy(true)
      setErr('')
      setRes(null)
      try {
        const parts = [{ text: importPrompt(m, t.trim(), !!f) }]
        if (f) parts.push(f.part)
        const out = await aiJSON({
          user,
          system: importSystem(m, { persona, profile, tasks, events }),
          parts,
          schema: PROPOSAL_SCHEMA,
          think: f || m !== 'extract' ? 1024 : 0,
        })
        const r = normalizeProposals(out, { tasks, events })
        setRes(r)
        if (!r.list.length && !r.dropped.length) setErr(r.summary || 'The AI found nothing to add or change.')
      } catch (e) {
        setErr(friendlyError(e))
      } finally {
        setBusy(false)
      }
    },
    [mode, text, file, user, persona, profile, tasks, events],
  )

  useEffect(() => {
    if (!seed) return
    setMode(seed.mode)
    setText(seed.text)
    setFile(null)
    setRes(null)
    setErr('')
    if (seed.autorun) run(seed.mode, seed.text, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  const takeFile = async (f) => {
    if (!f) return
    try {
      const part = await fileToPart(f)
      setFile({ name: f.name || 'pasted image', part, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null })
      setErr('')
      if (mode === 'review' || mode === 'breakdown') setMode('extract')
    } catch (e) {
      setErr(e.message)
    }
  }

  const setStatus = (i, status) => setRes((r) => ({ ...r, list: r.list.map((p, j) => (j === i ? { ...p, status } : p)) }))
  const accept = (i) => {
    applyProposal(res.list[i], { save, del })
    setStatus(i, 'accepted')
  }
  const acceptAll = () => {
    const todo = res.list.filter((p) => p.status === 'pending' && !p.dup)
    todo.forEach((p) => applyProposal(p, { save, del }))
    setRes((r) => ({ ...r, list: r.list.map((p) => (p.status === 'pending' && !p.dup ? { ...p, status: 'accepted' } : p)) }))
    toast(`Applied ${todo.length} change${todo.length === 1 ? '' : 's'}`)
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.8 }, disableForReducedMotion: true })
  }
  const skipAll = () => setRes((r) => ({ ...r, list: r.list.map((p) => (p.status === 'pending' ? { ...p, status: 'skipped' } : p)) }))

  const reviewed = res ? res.list.filter((p) => p.status !== 'pending').length : 0
  const pendingN = res ? res.list.length - reviewed : 0

  return (
    <section className="ai-pane" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); takeFile(e.dataTransfer.files[0]) }}>
      <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="What should AI do?">
        {['extract', 'build', 'review'].map((k) => <option key={k} value={k}>{MODES[k][0]}</option>)}
        {mode === 'breakdown' && <option value="breakdown">{MODES.breakdown[0]}</option>}
      </select>
      <p className="muted small">{MODES[mode][1]}</p>
      {mode !== 'review' && (
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); takeFile(f) } }}
          placeholder={mode === 'build' ? 'e.g. I work 9–6 Mon–Fri, 1h commute each way, MBA class Tue & Thu 7–9pm, two kids with school drop at 8…' : 'e.g. Maths test next Friday 3pm, submit physics report by Tuesday (high), gym Mon & Wed 6–7pm'}
        />
      )}
      {mode === 'review' && <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Optional focus, e.g. “I feel overloaded on Thursdays”" />}
      {mode !== 'review' && mode !== 'breakdown' && (
        <div className="drop">
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { takeFile(e.target.files[0]); e.target.value = '' }} />
          {file ? (
            <div className="file">
              {file.url && <img src={file.url} alt="Uploaded preview" />}
              <span>{file.name}</span>
              <button className="icon-btn" onClick={() => setFile(null)} aria-label="Remove file">✕</button>
            </div>
          ) : (
            <button className="btn ghost small" onClick={() => fileRef.current.click()}>📎 Upload photo / PDF of a to-do or timetable</button>
          )}
          <small className="muted">You can also drag & drop or paste a screenshot.</small>
        </div>
      )}
      <button className="btn primary" onClick={() => run()} disabled={busy}>{busy ? 'Reading…' : mode === 'build' ? 'Build timetable' : mode === 'review' ? 'Review my schedule' : 'Analyse with AI'}</button>

      {busy && <><div className="skel" /><div className="skel" /><div className="skel" /></>}
      {err && !busy && <div className="warn-box">{err}</div>}

      {res && !busy && (
        <div className="results">
          {res.summary && <p className="summary">{res.summary}</p>}
          {res.assumptions.length > 0 && <div className="warn-box"><b>AI assumptions — please check</b><ul>{res.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
          {res.dropped.length > 0 && <div className="warn-box"><b>Couldn’t use {res.dropped.length} item{res.dropped.length > 1 ? 's' : ''}</b><ul>{res.dropped.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
          {res.list.length > 0 && (
            <>
              <div className="bulk">
                <span>{reviewed}/{res.list.length} reviewed</span>
                {pendingN > 0 && <><button className="btn small primary" onClick={acceptAll}>Accept all</button><button className="btn small ghost" onClick={skipAll}>Skip all</button></>}
              </div>
              {res.list.map((p, i) => <ProposalCard key={i} p={p} onAccept={() => accept(i)} onSkip={() => setStatus(i, 'skipped')} />)}
              {pendingN === 0 && <p className="summary">All reviewed ✨ Your {res.list.some((p) => p.kind === 'event') ? 'timetable' : 'list'} is up to date.</p>}
            </>
          )}
        </div>
      )}
    </section>
  )
}

function ProposalCard({ p, onAccept, onSkip }) {
  const f = p.fields
  const detail =
    p.op !== 'add'
      ? null
      : p.kind === 'task'
        ? [f.priority && `${f.priority === 'med' ? 'Medium' : f.priority} priority`, f.due && `due ${f.due}`, f.category].filter(Boolean).join(' · ')
        : [f.repeat ? `Every ${DAYS_LONG[f.day]}` : `${DAYS_LONG[f.day]} ${f.date}`, `${t12(f.start)} – ${t12(f.end)}`, f.category, f.location].filter(Boolean).join(' · ')
  const opLabel = p.op === 'add' ? `Add ${p.kind}` : p.op === 'update' ? `Change ${p.kind}` : `Remove ${p.kind}`
  return (
    <div className={`ai-item ${p.status}`}>
      <div className="pbody">
        <span className={`pill ${p.op === 'delete' ? 'remove' : p.kind}`}>{opLabel}</span>
        <b>{p.title}</b>
        {detail && <small>{detail}</small>}
        {p.changes.length > 0 && <ul className="chg">{p.changes.map(([k, a, b]) => <li key={k}><span>{k}:</span> <s>{a}</s> → <b>{b}</b></li>)}</ul>}
        {p.reason && <small className="why">💡 {p.reason}</small>}
        {p.warns.map((w, i) => <small key={i} className="pw">⚠ {w}</small>)}
      </div>
      <div className="pact">
        {p.status === 'pending' ? (
          <>
            <button className="btn small primary" onClick={onAccept} title="Apply this change">✓</button>
            <button className="btn small ghost" onClick={onSkip} title="Skip">✕</button>
          </>
        ) : (
          <span className={`st ${p.status}`}>{p.status === 'accepted' ? 'Applied ✓' : 'Skipped'}</span>
        )}
      </div>
    </div>
  )
}

/* ============================ Plan my day ============================ */
function PlanPane({ user }) {
  const { tasks, events, profile, save } = useStore()
  const toast = useToast()
  const persona = PERSONAS[profile?.persona] || PERSONAS.custom
  const [focus, setFocus] = useState('')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState(null)
  const [err, setErr] = useState('')
  const [added, setAdded] = useState(false)

  const run = async () => {
    setErr('')
    setPlan(null)
    setAdded(false)
    const now = new Date()
    const m = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5
    const endMin = Math.min(1439, (profile?.end ?? persona.end) * 60)
    const open = tasks.filter((t) => !t.done)
    if (!open.length) return setErr('You have no open tasks to plan 🎉')
    if (m >= endMin - 20) return setErr('Not much of the day is left — try again tomorrow morning.')
    const fixed = eventsOnDate(events, now).filter((e) => toMin(e.end) > m)
    setBusy(true)
    try {
      const out = await aiJSON({
        user,
        system: `${planSystem}\n${nowInfo()}`,
        parts: [{ text: JSON.stringify({
          now: fmtT(m), dayEnd: fmtT(endMin), userNote: focus || null,
          fixedEvents: fixed.map((e) => ({ title: e.title, start: e.start, end: e.end })),
          openTasks: open.slice(0, 40).map((t) => ({ id: t.id, title: t.title, priority: t.priority, due: t.due || null, category: t.category || null, notes: t.notes?.slice(0, 80) || null })),
        }) }],
        schema: PLAN_SCHEMA,
        think: 1024,
      })
      // Never trust the model's schedule: re-check ids, window and overlaps
      const taken = fixed.map((e) => [toMin(e.start), toMin(e.end)])
      const used = new Set()
      const blocks = []
      let dropped = 0
      const cand = (out.blocks || []).map((b) => ({ ...b, s: toMin(b.start), f: toMin(b.end), task: open.find((t) => t.id === b.taskId) })).sort((a, b) => (a.s ?? 0) - (b.s ?? 0))
      for (const b of cand) {
        const bad = !b.task || used.has(b.task.id) || b.s == null || b.f == null || b.f <= b.s || b.s < m || b.f > endMin || taken.some(([a, z]) => b.s < z && a < b.f)
        if (bad) { dropped++; continue }
        used.add(b.task.id)
        taken.push([b.s, b.f])
        blocks.push(b)
      }
      setPlan({
        summary: out.summary || '',
        tips: (out.tips || []).slice(0, 3),
        blocks, dropped, fixed,
        left: open.filter((t) => !used.has(t.id)),
      })
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const addAll = () => {
    const today = new Date()
    plan.blocks.forEach((b) =>
      save('events', { title: b.task.title, day: dayIdx(today), date: ymd(today), repeat: false, start: b.start, end: b.end, category: b.task.category || '', color: catColor(b.task.category, b.task.title), location: '', createdAt: Date.now() }),
    )
    setAdded(true)
    toast(`Added ${plan.blocks.length} blocks to today’s timetable`)
  }

  const rows = plan ? [...plan.fixed.map((e) => ({ s: toMin(e.start), f: toMin(e.end), title: e.title, fixed: true, color: e.color })), ...plan.blocks.map((b) => ({ s: b.s, f: b.f, title: b.task.title, reason: b.reason, color: catColor(b.task.category, b.task.title) }))].sort((a, b) => a.s - b.s) : []

  return (
    <section className="ai-pane">
      <p className="muted small">Builds a realistic plan for the rest of today around your fixed events, putting overdue and high-priority tasks first.</p>
      <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Optional: “only 3 hours free”, “low energy after 6pm”…" />
      <button className="btn primary" onClick={run} disabled={busy}>{busy ? 'Planning…' : 'Plan my day'}</button>
      {busy && <><div className="skel" /><div className="skel" /><div className="skel" /></>}
      {err && !busy && <div className="warn-box">{err}</div>}
      {plan && !busy && (
        <div className="results">
          {plan.summary && <p className="summary">{plan.summary}</p>}
          <div className="tl">
            {rows.map((r, i) => (
              <div key={i} className={r.fixed ? 'fixed' : ''} style={{ '--c': r.color }}>
                <span className="t">{t12(r.s)} – {t12(r.f)}</span>
                <span><b>{r.title}</b>{r.fixed && <small> · fixed</small>}{r.reason && <small className="why"> · {r.reason}</small>}</span>
              </div>
            ))}
          </div>
          {plan.left.length > 0 && <div className="warn-box"><b>Didn’t fit today</b><ul>{plan.left.map((t) => <li key={t.id}>{t.title}</li>)}</ul></div>}
          {plan.dropped > 0 && <small className="muted">{plan.dropped} AI suggestion{plan.dropped > 1 ? 's were' : ' was'} discarded for clashing with your events.</small>}
          {plan.tips.length > 0 && <ul className="tips">{plan.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
          {plan.blocks.length > 0 && <button className="btn primary" onClick={addAll} disabled={added}>{added ? 'Added ✓' : 'Add these blocks to today’s timetable'}</button>}
        </div>
      )}
    </section>
  )
}

/* ============================ Drawer ============================ */
export default function AIDrawer({ open, tab, setTab, onClose, user, seed }) {
  const [ver, setVer] = useState(0)
  const [key, setKey] = useState('')
  const provider = aiProvider(user)
  void ver

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && open && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open, onClose])

  const saveKey = (e) => {
    e.preventDefault()
    try { localStorage.setItem(KEY_LS, key.trim()) } catch { /* ignore */ }
    setKey('')
    setVer((v) => v + 1)
  }
  const removeKey = () => {
    try { localStorage.removeItem(KEY_LS) } catch { /* ignore */ }
    setVer((v) => v + 1)
  }

  return (
    <>
      {open && <div className="scrim" onClick={onClose} />}
      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <h3>✨ AI assistant</h3>
          <span className="badge" title="Gemini">{provider === 'firebase' ? 'Gemini · Firebase' : provider === 'key' ? 'Gemini · your key' : 'Not connected'}</span>
          {provider === 'key' && <button className="link" onClick={removeKey}>Remove key</button>}
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="seg wide">
          {[['chat', 'Chat'], ['import', 'Import & build'], ['plan', 'Plan my day']].map(([k, l]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {!provider ? (
          <div className="ai-setup">
            <p><b>Connect Gemini (free)</b></p>
            <p className="muted">Sign in with Google to use Gemini through Firebase — no key needed. In demo mode, paste a free key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>. It stays in this browser only.</p>
            <form className="quick keyform" onSubmit={saveKey}>
              <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Gemini API key" autoComplete="off" />
              <button className="btn primary small" disabled={!key.trim()}>Save</button>
            </form>
          </div>
        ) : (
          <>
            <div className={tab === 'chat' ? 'pane-wrap' : 'hidden'}><ChatPane user={user} /></div>
            <div className={tab === 'import' ? 'pane-wrap' : 'hidden'}><ImportPane user={user} seed={seed} /></div>
            <div className={tab === 'plan' ? 'pane-wrap' : 'hidden'}><PlanPane user={user} /></div>
          </>
        )}
      </aside>
    </>
  )
}
