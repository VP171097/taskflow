import { CATS, PERSONAS, PRIORITY_LABEL } from './constants'
import { DAYS, DAYS_LONG, addDays, eventsForWeek, layoutDay, shortDate, t12, toMin, weekStart, ymd } from './dates'

const rgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (hex, a = 0.82) => rgb(hex).map((v) => Math.round(v * (1 - a) + 255 * a))

/** Builds a structured, printable PDF: weekly grid, day-by-day agenda and task list. */
export async function makePdf({ user, profile, tasks, events, wk = 0, hours: [h0, h1] }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const persona = PERSONAS[profile?.persona] || PERSONAS.custom
  const ws = weekStart(wk)
  const we = addDays(ws, 6)
  const range = `${shortDate(ws)} – ${shortDate(we)} ${we.getFullYear()}`
  const owner = user?.name && user.mode === 'firebase' ? user.name : 'My planner'
  const BRAND = [99, 102, 241]
  const INK = [18, 20, 42]
  const GREY = [107, 112, 144]

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297
  const H = 210
  const M = 10

  const banner = (title, sub) => {
    doc.setFillColor(...BRAND)
    doc.roundedRect(M, M, W - 2 * M, 20, 3, 3, 'F')
    doc.setTextColor(255)
    doc.setFont('helvetica', 'bold').setFontSize(18).text(title, M + 6, M + 9.5)
    doc.setFont('helvetica', 'normal').setFontSize(9).text(sub, M + 6, M + 16)
    doc.setFont('helvetica', 'bold').setFontSize(12).text('TaskFlow', W - M - 6, M + 9.5, { align: 'right' })
    doc.setFont('helvetica', 'normal').setFontSize(8).text(persona.label, W - M - 6, M + 16, { align: 'right' })
  }

  /* ---- page 1: weekly grid ---- */
  banner('Weekly Timetable', `${owner}  ·  ${range}`)
  const rows = Math.max(1, h1 - h0)
  const top = M + 24
  const headH = 9
  const timeW = 14
  const colW = (W - 2 * M - timeW) / 7
  const bodyTop = top + headH
  const bodyH = H - M - 14 - bodyTop
  const rowH = bodyH / rows
  const week = eventsForWeek(events, wk)

  doc.setDrawColor(228, 230, 242)
  doc.setLineWidth(0.2)
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 0) {
      doc.setFillColor(246, 247, 252)
      doc.rect(M + timeW, bodyTop + r * rowH, colW * 7, rowH, 'F')
    }
    doc.setTextColor(...GREY).setFont('helvetica', 'normal').setFontSize(6.5)
    doc.text(t12((h0 + r) * 60), M + timeW - 1.5, bodyTop + r * rowH + 2.4, { align: 'right' })
  }
  for (let d = 0; d < 7; d++) {
    const x = M + timeW + d * colW
    doc.setFillColor(238, 240, 252)
    doc.rect(x, top, colW, headH, 'F')
    doc.setTextColor(...INK).setFont('helvetica', 'bold').setFontSize(9).text(DAYS[d], x + colW / 2, top + 4, { align: 'center' })
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...GREY)
    doc.text(String(addDays(ws, d).getDate()), x + colW / 2, top + 7.5, { align: 'center' })
    doc.line(x, top, x, bodyTop + bodyH)
  }
  doc.line(M + timeW + 7 * colW, top, M + timeW + 7 * colW, bodyTop + bodyH)
  doc.line(M + timeW, bodyTop + bodyH, M + timeW + 7 * colW, bodyTop + bodyH)

  const used = new Set()
  week.forEach((list, d) => {
    layoutDay(list).forEach((e) => {
      const s = Math.max(toMin(e.start), h0 * 60)
      const f = Math.min(toMin(e.end), h1 * 60)
      if (f <= s) return
      const w = colW / e._n
      const x = M + timeW + d * colW + e._c * w + 0.4
      const y = bodyTop + ((s - h0 * 60) / 60) * rowH + 0.3
      const h = ((f - s) / 60) * rowH - 0.6
      const color = e.color || CATS[e.category] || '#6366f1'
      used.add(e.category || '')
      doc.setFillColor(...mix(color)).roundedRect(x, y, w - 0.8, h, 1, 1, 'F')
      doc.setFillColor(...rgb(color)).rect(x, y, 1, h, 'F')
      doc.setTextColor(...INK).setFont('helvetica', 'bold').setFontSize(6.8)
      const maxLines = Math.max(1, Math.floor((h - 1) / 2.9))
      const lines = doc.splitTextToSize(e.title, w - 3.4).slice(0, maxLines)
      doc.text(lines, x + 1.8, y + 2.6)
      const used2 = lines.length * 2.9
      if (h > used2 + 3) {
        doc.setFont('helvetica', 'normal').setFontSize(5.8).setTextColor(...GREY)
        doc.text(`${t12(e.start)} – ${t12(e.end)}`, x + 1.8, y + 2.6 + used2 - 0.2)
      }
    })
  })

  // legend
  const cats = [...used].filter(Boolean)
  let lx = M
  doc.setFontSize(7).setFont('helvetica', 'normal')
  cats.forEach((c) => {
    doc.setFillColor(...rgb(CATS[c] || '#6b7280')).roundedRect(lx, H - M - 9, 3, 3, 0.8, 0.8, 'F')
    doc.setTextColor(...GREY).text(c, lx + 4.5, H - M - 6.6)
    lx += 8 + doc.getTextWidth(c)
  })

  /* ---- page 2: day-by-day agenda ---- */
  doc.addPage()
  banner('Daily Agenda', `${owner}  ·  ${range}`)
  const body = []
  week.forEach((list, d) => {
    if (!list.length) body.push([{ content: DAYS_LONG[d], styles: { fontStyle: 'bold' } }, '—', 'Nothing scheduled', '', ''])
    list.forEach((e, i) =>
      body.push([
        i === 0 ? { content: DAYS_LONG[d], styles: { fontStyle: 'bold' } } : '',
        `${t12(e.start)} – ${t12(e.end)}`,
        e.title,
        e.category || '',
        e.location || '',
      ]),
    )
  })
  autoTable(doc, {
    startY: top + 2,
    margin: { left: M, right: M, bottom: 16 },
    head: [['Day', 'Time', 'Activity', 'Category', 'Location']],
    body,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: INK, lineColor: [228, 230, 242] },
    headStyles: { fillColor: BRAND, textColor: 255 },
    alternateRowStyles: { fillColor: [247, 248, 253] },
    columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 42 }, 3: { cellWidth: 34 }, 4: { cellWidth: 50 } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 3 && CATS[d.cell.raw]) d.cell.styles.textColor = rgb(CATS[d.cell.raw])
    },
  })

  /* ---- tasks ---- */
  doc.addPage()
  const today = ymd(new Date())
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)
  const order = { high: 0, med: 1, low: 2 }
  open.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || order[a.priority] - order[b.priority])
  const overdue = open.filter((t) => t.due && t.due < today).length
  banner('To-Do List', `${open.length} open  ·  ${done.length} completed  ·  ${overdue} overdue`)
  autoTable(doc, {
    startY: top + 2,
    margin: { left: M, right: M, bottom: 16 },
    head: [['Status', 'Task', 'Priority', 'Due', 'Category', 'Notes']],
    body: [...open, ...done].map((t) => [
      t.done ? 'Done' : t.due && t.due < today ? 'Overdue' : 'Open',
      t.title,
      PRIORITY_LABEL[t.priority] || '',
      t.due || '',
      t.category || '',
      t.notes || '',
    ]),
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: INK, lineColor: [228, 230, 242] },
    headStyles: { fillColor: BRAND, textColor: 255 },
    alternateRowStyles: { fillColor: [247, 248, 253] },
    columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 22 }, 3: { cellWidth: 26 }, 4: { cellWidth: 30 }, 5: { cellWidth: 70 } },
    didParseCell: (d) => {
      if (d.section !== 'body') return
      const t = [...open, ...done][d.row.index]
      if (t?.done) d.cell.styles.textColor = GREY
      else if (d.column.index === 0 && d.cell.raw === 'Overdue') d.cell.styles.textColor = [239, 68, 68]
      else if (d.column.index === 2 && t?.priority === 'high') d.cell.styles.textColor = [239, 68, 68]
    },
  })

  // footer on every page
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...GREY)
    doc.text(`Generated by TaskFlow on ${new Date().toLocaleDateString()}`, M, H - 5)
    doc.text(`Page ${i} of ${n}`, W - M, H - 5, { align: 'right' })
  }
  doc.save(`TaskFlow-${ymd(ws)}.pdf`)
}
