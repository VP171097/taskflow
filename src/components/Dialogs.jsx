import { useState } from 'react'
import Modal from './Modal'
import { useStore } from '../lib/store'
import { useToast } from './Toasts'
import { CATS, PERSONAS, PRIORITY_LABEL, SWATCHES, TEMPLATES, catColor } from '../lib/constants'
import { DAYS_LONG, dayIdx, addDays, parseYmd, t12, toMin, weekStart, ymd } from '../lib/dates'

function useCats() {
  const { tasks, events, profile } = useStore()
  const persona = PERSONAS[profile?.persona] || PERSONAS.custom
  return [...new Set([...persona.cats, ...tasks.map((t) => t.category), ...events.map((e) => e.category)].filter(Boolean))]
}

/* ---------------- Task ---------------- */
export function TaskDialog({ open, task, onClose }) {
  return (
    <Modal open={open} onClose={onClose}>
      <TaskForm task={task} onClose={onClose} />
    </Modal>
  )
}

function TaskForm({ task, onClose }) {
  const { save, del } = useStore()
  const toast = useToast()
  const cats = useCats()
  const [f, setF] = useState({ title: '', notes: '', priority: 'med', due: '', category: '', ...task })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    if (!f.title.trim()) return
    save('tasks', { ...f, title: f.title.trim(), done: !!f.done, createdAt: f.createdAt || Date.now() })
    onClose()
  }
  return (
    <form className="dlg" onSubmit={submit} autoComplete="off">
      <h3>{task?.id ? 'Edit task' : 'New task'}</h3>
      <label>Title<input value={f.title} onChange={set('title')} required maxLength={140} autoFocus /></label>
      <label>Notes<textarea rows={3} value={f.notes || ''} onChange={set('notes')} maxLength={500} /></label>
      <div className="row">
        <label>Priority
          <select value={f.priority} onChange={set('priority')}>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Due date<input type="date" value={f.due || ''} onChange={set('due')} /></label>
      </div>
      <label>Category
        <input value={f.category || ''} onChange={set('category')} maxLength={24} list="task-cats" placeholder="e.g. Work, Study, Home" />
        <datalist id="task-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <div className="actions">
        {task?.id && (
          <button type="button" className="btn ghost danger" onClick={() => {
            del('tasks', task.id)
            onClose()
            toast('Task deleted', { label: 'Undo', fn: () => save('tasks', task) })
          }}>Delete</button>
        )}
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn primary">Save</button>
      </div>
    </form>
  )
}

/* ---------------- Event ---------------- */
export function EventDialog({ open, event, preset, wk, onClose }) {
  return (
    <Modal open={open} onClose={onClose}>
      <EventForm event={event} preset={preset} wk={wk} onClose={onClose} />
    </Modal>
  )
}

function EventForm({ event, preset, wk, onClose }) {
  const { save, del, events } = useStore()
  const toast = useToast()
  const cats = useCats()
  const editing = !!event?.id
  const base = event || preset || {}
  const oneOffDay = event?.repeat === false && event.date ? dayIdx(parseYmd(event.date) || new Date()) : null
  const [f, setF] = useState({
    title: '',
    day: 0,
    start: '09:00',
    end: '10:00',
    location: '',
    category: '',
    color: SWATCHES[0],
    repeat: true,
    ...base,
    ...(oneOffDay != null ? { day: oneOffDay } : {}),
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    if (!f.title.trim()) return
    if (toMin(f.end) <= toMin(f.start)) return toast('End time must be after the start time')
    const day = +f.day
    let date = ''
    if (!f.repeat) {
      date = event?.repeat === false && event.date && dayIdx(parseYmd(event.date)) === day ? event.date : ymd(addDays(weekStart(wk), day))
    }
    save('events', {
      ...(editing ? { id: event.id } : { createdAt: Date.now() }),
      title: f.title.trim(),
      day,
      start: f.start,
      end: f.end,
      location: (f.location || '').trim(),
      category: f.category || '',
      color: f.color,
      repeat: !!f.repeat,
      date,
    })
    const clash = events.find((x) => x.id !== event?.id && x.repeat !== false && f.repeat && x.day === day && toMin(x.start) < toMin(f.end) && toMin(f.start) < toMin(x.end))
    if (clash) toast(`Saved — heads up: overlaps “${clash.title}” (${t12(clash.start)}–${t12(clash.end)})`)
    onClose()
  }

  return (
    <form className="dlg" onSubmit={submit} autoComplete="off">
      <h3>{editing ? 'Edit event' : 'New event'}</h3>
      <label>Title<input value={f.title} onChange={set('title')} required maxLength={80} placeholder="e.g. Mathematics, Team stand-up, School run" autoFocus /></label>
      <div className="row">
        <label>Day<select value={f.day} onChange={set('day')}>{DAYS_LONG.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
        <label>Category
          <select value={f.category || ''} onChange={(e) => setF({ ...f, category: e.target.value, color: e.target.value ? catColor(e.target.value) : f.color })}>
            <option value="">None</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <label>Start<input type="time" value={f.start} onChange={set('start')} required /></label>
        <label>End<input type="time" value={f.end} onChange={set('end')} required /></label>
      </div>
      <label>Location / link<input value={f.location || ''} onChange={set('location')} maxLength={40} placeholder="Room, office, Zoom…" /></label>
      <label>Colour
        <div className="swatches">
          {[...new Set([f.color, ...SWATCHES, ...Object.values(CATS)])].slice(0, 14).map((c) => (
            <button type="button" key={c} className={`sw ${f.color === c ? 'sel' : ''}`} style={{ '--c': c }} onClick={() => setF({ ...f, color: c })} aria-label={`Colour ${c}`} />
          ))}
        </div>
      </label>
      <label className="check"><input type="checkbox" checked={!!f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.checked })} /> Repeats every week</label>
      <div className="actions">
        {editing && (
          <button type="button" className="btn ghost danger" onClick={() => {
            del('events', event.id)
            onClose()
            toast('Event deleted', { label: 'Undo', fn: () => save('events', event) })
          }}>Delete</button>
        )}
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn primary">Save</button>
      </div>
    </form>
  )
}

/* ---------------- Profile / onboarding ---------------- */
export function ProfileDialog({ open, forced, onClose }) {
  return (
    <Modal open={open} onClose={onClose} locked={forced}>
      <ProfileForm forced={forced} onClose={onClose} />
    </Modal>
  )
}

const hourOpts = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

function ProfileForm({ forced, onClose }) {
  const { profile, events, save } = useStore()
  const toast = useToast()
  const [persona, setPersona] = useState(profile?.persona || 'professional')
  const [start, setStart] = useState(profile?.start ?? PERSONAS[profile?.persona || 'professional'].start)
  const [end, setEnd] = useState(profile?.end ?? PERSONAS[profile?.persona || 'professional'].end)
  const [tpl, setTpl] = useState(!profile && !events.length)

  const pick = (k) => {
    setPersona(k)
    setStart(PERSONAS[k].start)
    setEnd(PERSONAS[k].end)
  }

  const submit = (e) => {
    e.preventDefault()
    if (end <= start) return toast('Day must end after it starts')
    const rows = tpl ? TEMPLATES[persona] || [] : []
    const count = rows.reduce((n, r) => n + r[1].length, 0)
    if (count && events.length && !window.confirm(`This adds ${count} weekly events to your existing timetable. Continue?`)) return
    save('meta', { id: 'profile', persona, start, end })
    rows.forEach(([title, days, s, f, cat]) =>
      days.forEach((d) =>
        save('events', { title, day: d, start: s, end: f, category: cat, color: catColor(cat, title), repeat: true, date: '', location: '', createdAt: Date.now() }),
      ),
    )
    if (count) toast(`Added a starter timetable (${count} events) — edit anything you like`)
    onClose()
  }

  return (
    <form className="dlg wide" onSubmit={submit}>
      <h3>{forced ? 'Set up your planner' : 'Profile & hours'}</h3>
      <p className="muted">Pick what describes you best. Categories, timetable hours, starter schedules and AI suggestions adapt to it. You can change this any time.</p>
      <div className="pgrid">
        {Object.entries(PERSONAS).map(([k, p]) => (
          <label key={k} className={`pcard ${persona === k ? 'sel' : ''}`}>
            <input type="radio" name="persona" checked={persona === k} onChange={() => pick(k)} />
            <span className="pe">{p.emoji}</span>
            <b>{p.label}</b>
            <small>{p.blurb}</small>
          </label>
        ))}
      </div>
      <div className="row">
        <label>Day starts
          <select value={start} onChange={(e) => setStart(+e.target.value)}>{hourOpts(0, 12).map((h) => <option key={h} value={h}>{t12(h * 60)}</option>)}</select>
        </label>
        <label>Day ends
          <select value={end} onChange={(e) => setEnd(+e.target.value)}>{hourOpts(13, 24).map((h) => <option key={h} value={h}>{h === 24 ? 'Midnight' : t12(h * 60)}</option>)}</select>
        </label>
      </div>
      {(TEMPLATES[persona] || []).length > 0 && (
        <label className="check">
          <input type="checkbox" checked={tpl} onChange={(e) => setTpl(e.target.checked)} />
          Add a starter weekly timetable for this profile (fully editable)
        </label>
      )}
      <div className="actions">
        <span className="spacer" />
        {!forced && <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>}
        <button type="submit" className="btn primary">{forced ? 'Get started' : 'Save'}</button>
      </div>
    </form>
  )
}
