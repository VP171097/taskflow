import { GEMINI_MODEL } from '../config'
import { getFb } from './firebase'
import { DAYS_LONG, dayIdx, pad, ymd } from './dates'

export const KEY_LS = 'tf:aikey'
const safeGet = (k) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

/** 'firebase' = Gemini through Firebase AI Logic (no key in the browser), 'key' = user-supplied key, null = off */
export const aiProvider = (user) => (user?.mode === 'firebase' ? 'firebase' : safeGet(KEY_LS) ? 'key' : null)

const textOf = (j) => (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')

async function viaFirebase(system, parts, gc, onChunk) {
  const { getAI, getGenerativeModel, GoogleAIBackend } = await import('firebase/ai')
  const ai = getAI(getFb().app, { backend: new GoogleAIBackend() })
  const model = getGenerativeModel(ai, { model: GEMINI_MODEL, generationConfig: gc, systemInstruction: system })
  if (onChunk) {
    const r = await model.generateContentStream(parts)
    let full = ''
    for await (const c of r.stream) {
      full += c.text()
      onChunk(full)
    }
    return full
  }
  const r = await model.generateContent(parts)
  return r.response.text()
}

async function viaRest(system, parts, gc, onChunk) {
  const key = safeGet(KEY_LS)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:${
    onChunk ? 'streamGenerateContent?alt=sse' : 'generateContent'
  }`
  const body = { contents: [{ role: 'user', parts }], generationConfig: gc }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw Object.assign(new Error(j.error?.message || res.statusText), { status: res.status })
  }
  if (!onChunk) return textOf(await res.json())
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (line.startsWith('data:')) {
        try {
          full += textOf(JSON.parse(line.slice(5)))
          onChunk(full)
        } catch {
          /* partial chunk */
        }
      }
    }
  }
  return full
}

export async function aiGenerate({ user, system, parts, schema, temperature = 0.2, think = 0, onChunk }) {
  const provider = aiProvider(user)
  if (!provider) throw Object.assign(new Error('AI is not connected'), { code: 'no-ai' })
  const gc = { temperature, thinkingConfig: { thinkingBudget: think } }
  if (schema) {
    gc.responseMimeType = 'application/json'
    gc.responseSchema = schema
  }
  const run = (g) => (provider === 'firebase' ? viaFirebase(system, parts, g, onChunk) : viaRest(system, parts, g, onChunk))
  try {
    return await run(gc)
  } catch (e) {
    // some model versions reject thinkingConfig – retry once without it
    if (/thinking/i.test(e.message || '')) {
      const g = { ...gc }
      delete g.thinkingConfig
      return run(g)
    }
    throw e
  }
}

const parseJSON = (t) => JSON.parse(t.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim())

export async function aiJSON(opts) {
  let text = await aiGenerate(opts)
  try {
    return parseJSON(text)
  } catch {
    text = await aiGenerate({ ...opts, temperature: 0 }) // one retry on malformed JSON
    try {
      return parseJSON(text)
    } catch {
      throw new Error('The AI returned an unreadable answer. Please try again.')
    }
  }
}

export function friendlyError(e) {
  const m = e?.message || ''
  if (e?.code === 'no-ai') return 'Connect Gemini first (sign in with Google, or add a free API key).'
  if (e?.status === 429 || /quota|rate.?limit|resource.?exhausted|429/i.test(m))
    return 'Free-tier limit reached — wait a minute and try again.'
  if (/api key not valid|API_KEY_INVALID|invalid api key/i.test(m)) return 'That API key was rejected. Check it in Google AI Studio.'
  if (/not been used|disabled|not enabled|permission|PERMISSION_DENIED|403/i.test(m))
    return 'Gemini isn’t enabled for this Firebase project yet. Firebase console → AI Logic → Get started (Gemini Developer API).'
  if (/network|failed to fetch|offline/i.test(m)) return 'Network problem — check your connection.'
  return m.slice(0, 180) || 'Something went wrong with the AI request.'
}

const toB64 = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1])
    r.onerror = rej
    r.readAsDataURL(blob)
  })

/** Turns an uploaded image/PDF into a Gemini inline-data part (images are downscaled for speed). */
export async function fileToPart(file) {
  if (file.type === 'application/pdf') {
    if (file.size > 10e6) throw new Error('That PDF is larger than 10 MB.')
    return { inlineData: { mimeType: 'application/pdf', data: await toB64(file) } }
  }
  if (!file.type.startsWith('image/')) throw new Error('Please upload a photo, screenshot or PDF.')
  let bmp
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw new Error('Couldn’t read that image (HEIC isn’t supported — use JPG or PNG).')
  }
  const s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
  const cv = document.createElement('canvas')
  cv.width = Math.round(bmp.width * s)
  cv.height = Math.round(bmp.height * s)
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.drawImage(bmp, 0, 0, cv.width, cv.height)
  return { inlineData: { mimeType: 'image/jpeg', data: cv.toDataURL('image/jpeg', 0.88).split(',')[1] } }
}

/* ---------- grounding context: exact dates & the user's data ---------- */

export function nowInfo() {
  const n = new Date()
  const cal = []
  for (let i = 0; i < 21; i++) {
    const x = new Date(n)
    x.setDate(n.getDate() + i)
    cal.push(`${DAYS_LONG[dayIdx(x)]} ${ymd(x)}${i === 0 ? ' (today)' : i === 1 ? ' (tomorrow)' : ''}`)
  }
  return `Current local date/time: ${ymd(n)} ${pad(n.getHours())}:${pad(n.getMinutes())} (${DAYS_LONG[dayIdx(n)]}), timezone ${
    Intl.DateTimeFormat().resolvedOptions().timeZone
  }. Weeks start on Monday.\nCalendar for the next 21 days (use it to resolve "next Friday", "tomorrow" etc.):\n${cal.join('\n')}`
}

export const snapshot = (tasks, events) =>
  JSON.stringify({
    tasks: tasks.slice(0, 150).map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      due: t.due || null,
      done: !!t.done,
      category: t.category || null,
      notes: t.notes ? t.notes.slice(0, 80) : null,
    })),
    events: events.slice(0, 200).map((e) => ({
      id: e.id,
      title: e.title,
      day: DAYS_LONG[e.day],
      start: e.start,
      end: e.end,
      category: e.category || null,
      location: e.location || null,
      repeats_weekly: e.repeat !== false,
      date: e.date || null,
    })),
  })

/* ---------- schemas ---------- */

const S = (type, extra = {}) => ({ type, ...extra })

export const PROPOSAL_SCHEMA = S('object', {
  properties: {
    summary: S('string'),
    assumptions: S('array', { items: S('string') }),
    proposals: S('array', {
      items: S('object', {
        properties: {
          op: S('string', { enum: ['add', 'update', 'delete'] }),
          kind: S('string', { enum: ['task', 'event'] }),
          id: S('string'),
          title: S('string'),
          notes: S('string'),
          priority: S('string', { enum: ['low', 'med', 'high'] }),
          due: S('string'),
          category: S('string'),
          done: S('boolean'),
          day: S('string'),
          date: S('string'),
          start: S('string'),
          end: S('string'),
          repeat: S('boolean'),
          location: S('string'),
          reason: S('string'),
        },
        required: ['op', 'kind'],
      }),
    }),
  },
  required: ['proposals'],
})

export const PLAN_SCHEMA = S('object', {
  properties: {
    summary: S('string'),
    blocks: S('array', {
      items: S('object', {
        properties: { taskId: S('string'), start: S('string'), end: S('string'), reason: S('string') },
        required: ['taskId', 'start', 'end'],
      }),
    }),
    tips: S('array', { items: S('string') }),
  },
  required: ['summary', 'blocks'],
})

/* ---------- prompts ---------- */

const RULES = `Formatting rules: dates are YYYY-MM-DD; times are 24-hour HH:MM; days are Mon, Tue, Wed, Thu, Fri, Sat or Sun; priority is low, med or high. Leave a field out when unknown — never guess a date or time that the user did not give or imply. For "update" and "delete", copy the id EXACTLY from the existing data. Weekly timetable entries are events with repeat=true and a day; one-off dated events use repeat=false and a date. Keep titles short and clean (fix obvious spelling, keep the user's wording). Each proposal gets a short "reason" (what in the source/situation led to it).`

export function importSystem(mode, { persona, profile, tasks, events }) {
  const intro = `You are TaskFlow's scheduling assistant. The user is: ${persona.label}. Their usual categories: ${persona.cats.join(', ')} (use these names for "category" when one fits). Their day runs roughly ${profile?.start ?? persona.start}:00–${Math.min(profile?.end ?? persona.end, 24)}:00.\n${nowInfo()}\n\nExisting data (JSON):\n${snapshot(tasks, events)}\n\n${RULES}\n\n`
  const modes = {
    extract: `TASK: Read the user's text and/or the attached photo/PDF (it may be a messy handwritten to-do list or a timetable grid) and turn EVERYTHING in it into "add" proposals. Handwriting can be unclear: use your best reading and note uncertain words in "assumptions"; never invent entries that are not in the source. For a timetable grid, each cell is one weekly event (repeat=true) with its day and start/end time; if the grid only has period numbers, use the legend/time column shown. If an entry has no readable time, skip it and mention that in "assumptions". If an entry already exists in the existing data, do not add it again — only propose "update" when a detail genuinely differs.`,
    build: `TASK: Build a complete, realistic weekly timetable from the user's description. Put every commitment they mention at the exact times given. Fill the rest sensibly for this kind of person — meals, rest, wind-down before sleep, exercise, family, study — and state in each such proposal's "reason" that it is a suggestion. No two events may overlap on the same day, and everything must fit inside their day. Output "add" proposals (events, plus tasks if they mention deadlines). Don't duplicate existing items.`,
    review: `TASK: Audit the existing schedule and tasks. Look for overlapping events, missing meals/rest/sleep wind-down, overloaded days, tasks that are overdue, tasks with no due date that probably need one, duplicates, and unrealistic back-to-back blocks. Propose at most 12 concrete "update", "delete" or "add" changes, most valuable first, each with a clear "reason". Only propose changes you can justify from the data; if the schedule is healthy say so in "summary" and return few or no proposals.`,
    breakdown: `TASK: Split the given task into 3–6 specific, ordered, actionable subtasks as "add" proposals with kind="task" (titles start with a verb, are short, and are not copies of the parent). Give each a sensible due date no later than the parent's deadline when one exists, and the same category.`,
  }
  return intro + modes[mode] + `\n\nAlways fill "summary" (one sentence) and list any guesses in "assumptions".`
}

export const importPrompt = (mode, text, hasFile) => {
  if (mode === 'build') return `My situation:\n${text}`
  if (mode === 'review') return `Review my current schedule and tasks.${text ? `\nWhat I care about: ${text}` : ''}`
  if (mode === 'breakdown') return text
  return `${text ? `Text:\n${text}\n` : ''}${hasFile ? 'Also read the attached file carefully.' : ''}`.trim()
}

export const chatSystem = ({ persona, tasks, events }) =>
  `You are TaskFlow's friendly planning assistant for a user who is: ${persona.label}.\n${nowInfo()}\n\nThe user's data (JSON):\n${snapshot(tasks, events)}\n\nRules: answer ONLY from this data and general planning advice. If the data doesn't contain what is asked, say so plainly — never invent tasks, events or times. When listing, be concise (short bullets, bold key words) and give exact dates/times. You cannot change data yourself; if the user wants to add or change things, tell them to use the "Import & build" tab.`

export const planSystem = `You are a careful day planner. You get the current time, the window of the day that is still available, fixed events (cannot move) and open tasks. Build a realistic plan for the rest of today: schedule tasks ONLY inside free gaps (never overlap a fixed event or another block), use each task's real id, prefer overdue → high priority → earliest due date, estimate sensible durations (15–120 minutes; split nothing), leave 5–10 minute breaks between long blocks, and stay inside the window. It is fine not to schedule everything — skip lower-priority tasks that don't fit. Return times as 24-hour HH:MM. "summary" is one or two sentences; "tips" has at most 3 short, practical tips; each block's "reason" is under 12 words.`
