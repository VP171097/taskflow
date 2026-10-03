import { CATS, PRIORITIES, catColor } from './constants'
import { DAYS, DAYS_LONG, dayIdx, eventDay, fmtT, parseYmd, sameSlot, t12, toMin, ymd } from './dates'

const has = (v) => v !== undefined && v !== null && String(v).trim() !== ''

const matchCat = (s) => {
  const t = String(s).trim()
  const k = Object.keys(CATS).find((x) => x.toLowerCase() === t.toLowerCase())
  return k || t.slice(0, 24)
}

/**
 * Validates raw AI fields against a base item and returns the fully-resolved item.
 * Returns { error } when the item is unusable, otherwise { fields, warns }.
 * Nothing the AI says is trusted: dates, times, enums and ids are all re-checked here.
 */
export function buildFields(kind, raw, base) {
  const c = { ...base }
  const warns = []
  if (has(raw.title)) c.title = String(raw.title).trim().slice(0, kind === 'task' ? 140 : 80)
  if (!c.title) return { error: 'no title' }
  if (has(raw.notes)) c.notes = String(raw.notes).slice(0, 500)
  if (has(raw.category)) c.category = matchCat(raw.category)

  if (kind === 'task') {
    if (PRIORITIES.includes(raw.priority)) c.priority = raw.priority
    if (has(raw.due)) {
      const d = parseYmd(String(raw.due))
      if (d) c.due = ymd(d)
      else warns.push(`Couldn’t read the due date “${raw.due}”`)
    }
    if (typeof raw.done === 'boolean') c.done = raw.done
    return { fields: c, warns }
  }

  if (has(raw.location)) c.location = String(raw.location).slice(0, 40)
  if (typeof raw.repeat === 'boolean') c.repeat = raw.repeat
  if (has(raw.date)) {
    const d = parseYmd(String(raw.date))
    if (d) {
      c.date = ymd(d)
      if (raw.repeat !== true) c.repeat = false
      c.day = dayIdx(d)
    } else warns.push(`Couldn’t read the date “${raw.date}”`)
  }
  if (has(raw.day) && !(c.repeat === false && c.date)) {
    const i = DAYS.findIndex((x) => String(raw.day).toLowerCase().startsWith(x.toLowerCase()))
    if (i >= 0) c.day = i
  }
  if (c.day == null) return { error: 'no day' }
  if (has(raw.start)) {
    const m = toMin(String(raw.start))
    if (m == null) return { error: `unreadable start time “${raw.start}”` }
    c.start = fmtT(m)
  }
  if (!c.start) return { error: 'no start time' }
  if (has(raw.end)) {
    const m = toMin(String(raw.end))
    if (m == null) return { error: `unreadable end time “${raw.end}”` }
    c.end = fmtT(m)
  } else if (!c.end) {
    c.end = fmtT(Math.min(1439, toMin(c.start) + 60))
    warns.push('No end time given — assumed 1 hour')
  }
  if (toMin(c.end) <= toMin(c.start)) return { error: 'end time is not after start time' }
  if (c.repeat === false && !c.date) {
    c.repeat = true
    warns.push('One-off event had no date — made it weekly')
  }
  if (c.repeat !== false) {
    c.repeat = true
    c.date = ''
  }
  if (has(raw.category) || !c.color) c.color = catColor(c.category, c.title)
  return { fields: c, warns }
}

const TASK_DEFAULTS = { done: false, priority: 'med', due: '', category: '', notes: '' }
const EVENT_DEFAULTS = { repeat: true, date: '', location: '', category: '' }

const LABELS = {
  title: 'Title',
  notes: 'Notes',
  priority: 'Priority',
  due: 'Due',
  category: 'Category',
  day: 'Day',
  date: 'Date',
  start: 'Start',
  end: 'End',
  location: 'Location',
  repeat: 'Repeats',
  done: 'Status',
}
const show = (k, v) => {
  if (v === '' || v == null) return '—'
  if (k === 'day') return DAYS_LONG[v]
  if (k === 'start' || k === 'end') return t12(v)
  if (k === 'repeat') return v ? 'Weekly' : 'One-off'
  if (k === 'done') return v ? 'Done' : 'Open'
  return String(v)
}

function normOne(r, { tasks, events }) {
  const op = ['add', 'update', 'delete'].includes(r.op) ? r.op : 'add'
  const kind = r.kind === 'event' ? 'event' : 'task'
  const pool = kind === 'event' ? events : tasks
  const reason = has(r.reason) ? String(r.reason).slice(0, 200) : ''

  if (op === 'delete') {
    const ex = pool.find((x) => x.id === r.id)
    return ex ? { op, kind, id: ex.id, base: ex, fields: {}, changes: [], title: ex.title, reason, warns: [], status: 'pending' } : { drop: 'delete of an unknown item' }
  }

  const base = op === 'update' ? pool.find((x) => x.id === r.id) : null
  if (op === 'update' && !base) return { drop: `update of an unknown ${kind}` }

  const built = buildFields(kind, r, base || (kind === 'task' ? TASK_DEFAULTS : EVENT_DEFAULTS))
  if (built.error) return { drop: `“${r.title || 'untitled'}” skipped: ${built.error}` }

  if (op === 'update') {
    const changes = Object.keys(built.fields)
      .filter((k) => LABELS[k] && built.fields[k] !== base[k] && !(built.fields[k] === '' && base[k] == null))
      .map((k) => [LABELS[k], show(k, base[k]), show(k, built.fields[k])])
    if (!changes.length) return { drop: null }
    const fields = {}
    Object.keys(built.fields).forEach((k) => {
      if (built.fields[k] !== base[k]) fields[k] = built.fields[k]
    })
    return { op, kind, id: base.id, base, fields, changes, title: built.fields.title, reason, warns: built.warns, status: 'pending' }
  }

  const f = built.fields
  const lc = f.title.toLowerCase()
  const dup =
    kind === 'task'
      ? tasks.some((t) => !t.done && t.title.toLowerCase() === lc)
      : events.some((e) => e.title.toLowerCase() === lc && eventDay(e) === eventDay(f) && e.start === f.start)
  const warns = [...built.warns]
  if (dup) warns.push('Looks like this already exists')
  return { op, kind, fields: f, changes: [], title: f.title, reason, warns, dup, status: 'pending' }
}

function markOverlaps(list, events) {
  const evs = list.filter((p) => p.kind === 'event' && p.op !== 'delete')
  const resolved = (p) => ({ ...(p.base || {}), ...p.fields })
  const removed = new Set(list.filter((p) => p.op === 'delete' && p.kind === 'event').map((p) => p.id))
  for (const p of evs) {
    const a = resolved(p)
    const others = [
      ...events.filter((e) => e.id !== p.id && !removed.has(e.id)),
      ...evs.filter((q) => q !== p).map(resolved),
    ]
    const hit = others.find((o) => sameSlot(a, o))
    if (hit) p.warns.push(`Overlaps with “${hit.title}” (${t12(hit.start)}–${t12(hit.end)})`)
  }
}

export function normalizeProposals(out, ctx) {
  const raw = Array.isArray(out?.proposals) ? out.proposals.slice(0, 60) : []
  const list = []
  const dropped = []
  for (const r of raw) {
    const p = normOne(r || {}, ctx)
    if (p.drop === undefined) list.push(p)
    else if (p.drop) dropped.push(p.drop)
  }
  markOverlaps(list, ctx.events)
  return {
    summary: has(out?.summary) ? String(out.summary).slice(0, 300) : '',
    assumptions: (out?.assumptions || []).filter(has).slice(0, 8).map(String),
    dropped,
    list,
  }
}

export function applyProposal(p, { save, del }) {
  const coll = p.kind === 'event' ? 'events' : 'tasks'
  if (p.op === 'delete') del(coll, p.id)
  else if (p.op === 'update') save(coll, { id: p.id, ...p.fields })
  else save(coll, { ...p.fields, createdAt: Date.now() })
}
