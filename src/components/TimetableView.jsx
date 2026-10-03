import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/hooks'
import { DAYS, addDays, dayIdx, eventsForWeek, fmtT, layoutDay, shortDate, t12, toMin, weekStart } from '../lib/dates'

const HH = 56 // pixels per hour

export function useHourRange() {
  const { events, profile } = useStore()
  return useMemo(() => {
    let a = profile?.start ?? 6
    let b = profile?.end ?? 22
    for (const e of events) {
      const s = toMin(e.start)
      const f = toMin(e.end)
      if (s != null) a = Math.min(a, Math.floor(s / 60))
      if (f != null) b = Math.max(b, Math.ceil(f / 60))
    }
    return [Math.max(0, a), Math.min(24, Math.max(b, a + 1))]
  }, [events, profile])
}

export default function TimetableView({ wk, setWk, onNew, onEdit }) {
  const { events } = useStore()
  const now = useNow(60000)
  const [h0, h1] = useHourRange()
  const todayIdx = wk === 0 ? dayIdx(now) : -1
  const [selDay, setSelDay] = useState(dayIdx(new Date()))

  const ws = weekStart(wk)
  const byDay = useMemo(() => eventsForWeek(events, wk).map(layoutDay), [events, wk])
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const hours = Array.from({ length: h1 - h0 }, (_, i) => h0 + i)

  const clickCol = (d, e) => {
    if (e.target.closest('.ev')) return
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    const start = Math.min(h1 * 60 - 30, h0 * 60 + Math.floor((y / HH) * 2) * 30)
    onNew({ day: d, start: fmtT(start), end: fmtT(Math.min(1439, start + 60)) })
  }

  return (
    <section className="view">
      <div className="tt-head">
        <div>
          <h2>Weekly timetable</h2>
          <p className="muted">Click an empty slot to add, click a block to edit.</p>
        </div>
        <div className="tt-tools">
          <div className="weeknav">
            <button className="icon-btn" onClick={() => setWk(wk - 1)} aria-label="Previous week">‹</button>
            <button className="btn small ghost" onClick={() => setWk(0)}>This week</button>
            <button className="icon-btn" onClick={() => setWk(wk + 1)} aria-label="Next week">›</button>
          </div>
          <button className="btn primary" onClick={() => onNew({ day: Math.max(0, todayIdx), start: '09:00', end: '10:00' })}>+ Add event</button>
        </div>
      </div>
      <p className="wk-label">{shortDate(ws)} – {shortDate(addDays(ws, 6))}{wk === 0 ? ' · this week' : ''}</p>

      <div className="daychips">
        {DAYS.map((d, i) => (
          <button key={d} className={selDay === i ? 'active' : ''} onClick={() => setSelDay(i)}>
            {d} {addDays(ws, i).getDate()}
          </button>
        ))}
      </div>

      <div className="tt panel">
        <div className="tt-grid" style={{ '--hh': `${HH}px` }}>
          <div className="tt-corner" />
          {DAYS.map((d, i) => (
            <div key={d} className={`tt-dh ${i === todayIdx ? 'today' : ''} ${i === selDay ? 'sel' : ''}`}>
              {d}
              <b>{addDays(ws, i).getDate()}</b>
            </div>
          ))}
          <div className="tt-times" style={{ height: hours.length * HH }}>
            {hours.map((h, i) => (
              <span key={h} style={{ top: i * HH, transform: i === 0 ? 'translateY(2px)' : undefined }}>{t12(h * 60)}</span>
            ))}
          </div>
          {byDay.map((list, d) => (
            <div
              key={d}
              className={`tt-col ${d === todayIdx ? 'today' : ''} ${d === selDay ? 'sel' : ''}`}
              style={{ height: hours.length * HH }}
              onClick={(e) => clickCol(d, e)}
            >
              {list.map((e, idx) => {
                const s = Math.max(toMin(e.start), h0 * 60)
                const f = Math.min(toMin(e.end), h1 * 60)
                if (f <= s) return null
                const h = Math.max(22, ((f - s) / 60) * HH - 2)
                return (
                  <div
                    key={e.id}
                    className={`ev ${e.repeat === false ? 'once' : ''}`}
                    style={{
                      '--c': e.color || '#6366f1',
                      '--i': Math.min(idx, 10),
                      top: ((s - h0 * 60) / 60) * HH + 1,
                      height: h,
                      left: `calc(${(e._c / e._n) * 100}% + 2px)`,
                      width: `calc(${100 / e._n}% - 4px)`,
                    }}
                    onClick={() => onEdit(events.find((x) => x.id === e.id))}
                    title={`${e.title} · ${t12(e.start)}–${t12(e.end)}`}
                  >
                    <b>{e.title}</b>
                    {h >= 38 && <span>{t12(e.start)} – {t12(e.end)}</span>}
                    {h >= 56 && e.location && <span>📍 {e.location}</span>}
                  </div>
                )
              })}
              {d === todayIdx && nowMin >= h0 * 60 && nowMin <= h1 * 60 && (
                <div className="nowline" style={{ top: ((nowMin - h0 * 60) / 60) * HH }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
