import { useEffect, useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import { useStore } from '../lib/store'
import { useToast } from './Toasts'
import { useCountUp, useNow } from '../lib/hooks'
import { CATS, PERSONAS, PRIORITY_LABEL, QUOTES } from '../lib/constants'
import { DAYS, DAYS_LONG, MONTHS, dayIdx, dur, eventsOnDate, parseYmd, t12, toMin, ymd, pad } from '../lib/dates'

const dueInfo = (due, today) => {
  if (!due) return null
  const a = parseYmd(due)
  const b = parseYmd(today)
  const diff = Math.round((a - b) / 864e5)
  const label = `${DAYS[dayIdx(a)]} ${a.getDate()} ${MONTHS[a.getMonth()]}`
  if (diff < 0) return { text: `Overdue · ${label}`, cls: 'over' }
  if (diff === 0) return { text: 'Today', cls: 'soon' }
  if (diff === 1) return { text: 'Tomorrow', cls: 'soon' }
  return { text: label, cls: '' }
}

function Quote() {
  const [i, setI] = useState(() => Math.floor(Math.random() * QUOTES.length))
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % QUOTES.length), 12000)
    return () => clearInterval(id)
  }, [])
  return (
    <p className="quote muted" key={i}>
      “{QUOTES[i]}”
    </p>
  )
}

function NowNext({ events, now }) {
  const m = now.getHours() * 60 + now.getMinutes()
  const list = eventsOnDate(events, now)
  const cur = list.find((e) => toMin(e.start) <= m && m < toMin(e.end))
  const nxt = list.find((e) => toMin(e.start) > m)
  if (!cur && !nxt) return null
  const pct = cur ? ((m - toMin(cur.start)) / (toMin(cur.end) - toMin(cur.start))) * 100 : 0
  return (
    <div className="nownext">
      {cur && (
        <div className="nn" style={{ '--c': cur.color }}>
          <small>NOW</small>
          <b>{cur.title}</b>
          <span className="muted">ends in {dur(toMin(cur.end) - m)}</span>
          <div className="progress">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {nxt && (
        <div className="nn" style={{ '--c': nxt.color }}>
          <small>NEXT</small>
          <b>{nxt.title}</b>
          <span className="muted">in {dur(toMin(nxt.start) - m)} · {t12(nxt.start)}</span>
        </div>
      )}
    </div>
  )
}

export default function TasksView({ user, onEdit, onSplit, onTimetable }) {
  const { tasks, events, profile, save, del } = useStore()
  const toast = useToast()
  const now = useNow(30000)
  const today = ymd(now)
  const persona = PERSONAS[profile?.persona] || PERSONAS.custom

  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('due')
  const [quick, setQuick] = useState({ title: '', priority: 'med', due: '' })
  const [leaving, setLeaving] = useState(() => new Set())

  const stats = useMemo(() => {
    const done = tasks.filter((t) => t.done).length
    const active = tasks.length - done
    const overdue = tasks.filter((t) => !t.done && t.due && t.due < today).length
    return { done, active, overdue, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 }
  }, [tasks, today])
  const nPct = useCountUp(stats.pct)
  const nActive = useCountUp(stats.active)
  const nOver = useCountUp(stats.overdue)
  const nDone = useCountUp(stats.done)

  const list = useMemo(() => {
    const pr = { high: 0, med: 1, low: 2 }
    const s = q.trim().toLowerCase()
    return tasks
      .filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done))
      .filter((t) => !s || `${t.title} ${t.notes || ''} ${t.category || ''}`.toLowerCase().includes(s))
      .sort((a, b) => {
        if (!!a.done !== !!b.done) return a.done ? 1 : -1
        if (sort === 'new') return (b.createdAt || 0) - (a.createdAt || 0)
        const byDue = (a.due || '9999').localeCompare(b.due || '9999')
        const byPri = pr[a.priority] - pr[b.priority]
        return sort === 'priority' ? byPri || byDue : byDue || byPri
      })
  }, [tasks, filter, q, sort])

  const todayEvents = eventsOnDate(events, now)
  const todayTasks = tasks.filter((t) => !t.done && t.due === today)
  const m = now.getHours() * 60 + now.getMinutes()

  const toggle = (t) => {
    const done = !t.done
    save('tasks', { id: t.id, done, completedAt: done ? Date.now() : null })
    if (done) {
      const left = tasks.filter((x) => !x.done && x.id !== t.id).length
      confetti({ particleCount: left === 0 ? 160 : 50, spread: left === 0 ? 100 : 65, origin: { y: 0.75 }, disableForReducedMotion: true })
      if (left === 0 && tasks.length > 1) toast('Everything done — fantastic! 🎉')
    }
  }
  const remove = (t) => {
    setLeaving((s) => new Set(s).add(t.id))
    setTimeout(() => {
      del('tasks', t.id)
      setLeaving((s) => {
        const n = new Set(s)
        n.delete(t.id)
        return n
      })
      toast('Task deleted', { label: 'Undo', fn: () => save('tasks', t) })
    }, 220)
  }
  const submitQuick = (e) => {
    e.preventDefault()
    const title = quick.title.trim()
    if (!title) return
    save('tasks', { title, priority: quick.priority, due: quick.due, done: false, category: '', notes: '', createdAt: Date.now() })
    setQuick({ ...quick, title: '' })
  }

  const hr = now.getHours()
  const greet = hr < 5 ? 'Still up' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'
  const first = user.name ? `, ${user.name.split(' ')[0]}` : ''
  const circ = 97.4

  return (
    <section className="view">
      <div className="hero">
        <div>
          <h2>
            {greet}
            {first} <span className="wave">👋</span>
          </h2>
          <p className="muted">
            {DAYS_LONG[dayIdx(now)]}, {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()} · {pad(now.getHours())}:{pad(now.getMinutes())} · {persona.emoji} {persona.label}
          </p>
          <Quote />
        </div>
        <div className="stats">
          <div className="ring-wrap">
            <svg viewBox="0 0 36 36" className="ring">
              <circle cx="18" cy="18" r="15.5" className="ring-bg" />
              <circle cx="18" cy="18" r="15.5" className="ring-fg" style={{ strokeDashoffset: circ * (1 - stats.pct / 100) }} />
            </svg>
            <div className="ring-text">
              <b>{nPct}%</b>
              <small>done</small>
            </div>
          </div>
          <div className="stat"><b>{nActive}</b><small>Active</small></div>
          <div className="stat warn"><b>{nOver}</b><small>Overdue</small></div>
          <div className="stat ok"><b>{nDone}</b><small>Completed</small></div>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <form className="quick" onSubmit={submitQuick} autoComplete="off">
            <input value={quick.title} onChange={(e) => setQuick({ ...quick, title: e.target.value })} placeholder="Add a task and press Enter…" maxLength={140} />
            <select value={quick.priority} onChange={(e) => setQuick({ ...quick, priority: e.target.value })} aria-label="Priority">
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" value={quick.due} onChange={(e) => setQuick({ ...quick, due: e.target.value })} aria-label="Due date" />
            <button className="btn primary" type="submit">Add</button>
          </form>

          <div className="toolbar">
            <div className="seg">
              {[['all', 'All'], ['active', 'Active'], ['done', 'Done']].map(([k, l]) => (
                <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search tasks" />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="due">Sort: Due date</option>
              <option value="priority">Sort: Priority</option>
              <option value="new">Sort: Newest</option>
            </select>
          </div>

          <ul className="tasks">
            {list.map((t, i) => {
              const due = dueInfo(t.due, today)
              return (
                <li key={t.id} className={`task ${t.done ? 'done' : ''} ${leaving.has(t.id) ? 'out' : ''}`} data-p={t.priority} style={{ '--i': Math.min(i, 12) }}>
                  <button className="chk" onClick={() => toggle(t)} aria-label={t.done ? 'Mark as not done' : 'Mark as done'}>
                    {t.done && <svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                  <div className="t-body" onClick={() => onEdit(t)}>
                    <div className="t-title">{t.title}</div>
                    <div className="t-meta">
                      {due && !t.done && <span className={`chip ${due.cls}`}>📅 {due.text}</span>}
                      {t.category && <span className="chip"><i className="dot" style={{ background: CATS[t.category] || '#6b7280' }} />{t.category}</span>}
                      {t.priority === 'high' && !t.done && <span className="chip high">High</span>}
                    </div>
                  </div>
                  <div className="t-act">
                    <button onClick={() => onSplit(t)} title="Break down with AI">✨</button>
                    <button onClick={() => onEdit(t)} title="Edit">✎</button>
                    <button onClick={() => remove(t)} title="Delete">🗑</button>
                  </div>
                </li>
              )
            })}
          </ul>
          {!list.length && (
            <div className="empty">
              <div className="emoji">{tasks.length ? '🔍' : '🎯'}</div>
              <p>{tasks.length ? 'No tasks match.' : 'Nothing here yet. Add your first task above, or let AI import a list.'}</p>
            </div>
          )}
          {stats.done > 0 && (
            <button className="link" onClick={() => {
              const gone = tasks.filter((t) => t.done)
              gone.forEach((t) => del('tasks', t.id))
              toast(`Cleared ${gone.length} completed`, { label: 'Undo', fn: () => gone.forEach((t) => save('tasks', t)) })
            }}>Clear completed</button>
          )}
        </div>

        <aside className="panel side">
          <NowNext events={events} now={now} />
          <div className="side-head">
            <h3>Today</h3>
            <button className="link" onClick={onTimetable}>Open timetable →</button>
          </div>
          <ul className="today">
            {todayEvents.map((e) => (
              <li key={e.id} style={{ '--c': e.color }} className={toMin(e.end) <= m ? 'past' : toMin(e.start) <= m ? 'now' : ''}>
                <div>
                  <b>{e.title}</b>
                  <small>{t12(e.start)} – {t12(e.end)}{e.location ? ` · ${e.location}` : ''}</small>
                </div>
              </li>
            ))}
            {todayTasks.map((t) => (
              <li key={t.id} style={{ '--c': '#f59e0b' }}>
                <div><b>{t.title}</b><small>Task due today</small></div>
              </li>
            ))}
          </ul>
          {!todayEvents.length && !todayTasks.length && (
            <div className="empty small"><p>Nothing scheduled today 🎉</p></div>
          )}
        </aside>
      </div>
    </section>
  )
}
