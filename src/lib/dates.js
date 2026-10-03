export const pad = (n) => String(n).padStart(2, '0')
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '')
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return d.getMonth() === +m[2] - 1 ? d : null
}

/** Monday = 0 … Sunday = 6 */
export const dayIdx = (d) => (d.getDay() + 6) % 7

export const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function weekStart(off = 0) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return addDays(d, -dayIdx(d) + off * 7)
}

export const shortDate = (d) => `${DAYS[dayIdx(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`

export function toMin(t) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t || '')
  return m ? +m[1] * 60 + +m[2] : null
}
export const fmtT = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

export function t12(t) {
  const m = typeof t === 'number' ? t : toMin(t)
  if (m == null) return t || ''
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h % 12 || 12}${mm ? ':' + pad(mm) : ''} ${h < 12 || h === 24 ? 'AM' : 'PM'}`
}

export const dur = (x) => (x >= 60 ? `${Math.floor(x / 60)}h${x % 60 ? ` ${x % 60}m` : ''}` : `${x} min`)

/** Day index (0-6) an event falls on, resolving one-off events through their date. */
export const eventDay = (e) => {
  if (e.repeat === false && e.date) {
    const d = parseYmd(e.date)
    if (d) return dayIdx(d)
  }
  return e.day
}

export const byStart = (a, b) => (toMin(a.start) ?? 0) - (toMin(b.start) ?? 0)

export function eventsOnDate(events, d) {
  const di = dayIdx(d)
  const ds = ymd(d)
  return events.filter((e) => (e.repeat !== false ? e.day === di : e.date === ds)).sort(byStart)
}

/** Events grouped by weekday for the week at offset `off` (repeating + that week's one-offs). */
export function eventsForWeek(events, off) {
  const ws = weekStart(off)
  const a = ymd(ws)
  const b = ymd(addDays(ws, 7))
  const days = [[], [], [], [], [], [], []]
  for (const e of events) {
    if (e.repeat !== false) days[e.day]?.push(e)
    else if (e.date >= a && e.date < b) days[eventDay(e)]?.push(e)
  }
  days.forEach((l) => l.sort(byStart))
  return days
}

/** Side-by-side layout for overlapping events in one day. */
export function layoutDay(list) {
  const evs = [...list].sort(byStart)
  const out = []
  let cluster = []
  let clusterEnd = 0
  const flush = () => {
    const cols = []
    const placed = cluster.map((e) => {
      let i = cols.findIndex((end) => end <= toMin(e.start))
      if (i < 0) {
        i = cols.length
        cols.push(0)
      }
      cols[i] = toMin(e.end)
      return { e, c: i }
    })
    placed.forEach((p) => out.push({ ...p.e, _c: p.c, _n: cols.length }))
    cluster = []
  }
  for (const e of evs) {
    if (cluster.length && toMin(e.start) >= clusterEnd) flush()
    cluster.push(e)
    clusterEnd = Math.max(clusterEnd, toMin(e.end))
  }
  if (cluster.length) flush()
  return out
}

/** True when two events occupy overlapping time on the same day. */
export function sameSlot(a, b) {
  if (eventDay(a) !== eventDay(b)) return false
  if (a.repeat === false && b.repeat === false && a.date !== b.date) return false
  return toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end)
}
