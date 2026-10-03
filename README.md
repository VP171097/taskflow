# TaskFlow — AI to-do & timetable planner

React + Vite app. **Firebase Authentication** (Google sign-in) + **Cloud Firestore** (realtime database) + **Gemini** (via Firebase AI Logic) — all on free plans.

## Features
- Google sign-in; data synced in realtime per user (offline-capable). Demo mode works with no setup (data stays in the browser).
- **Profiles** (working professional, college, school teen, kid, parent/homemaker, freelancer, custom) → categories, day hours and an optional **starter weekly timetable**.
- To-do list: priorities, due dates, categories, search/sort, undo, confetti, progress ring.
- Weekly timetable: click-to-add, recurring or one-off events, overlap layout, week navigation, live "now" line, mobile day view.
- **PDF export**: weekly grid + daily agenda + task list (⬇ button).
- **AI (Gemini)**: chat grounded in your data · *Import & build* (type/paste text, upload a photo/PDF of a messy to-do or timetable, build a timetable from a description, or review your schedule) with **accept/skip one by one** · *Plan my day* · ✨ break a task into steps.

## Setup (≈10 minutes)
1. **Create a Firebase project** at <https://console.firebase.google.com> (free Spark plan).
2. **Authentication** → Get started → Sign-in method → enable **Google**.
3. **Firestore Database** → Create database (production mode) → then **Rules** tab → paste `firestore.rules` → Publish.
4. **AI Logic** (left menu, "Build with Gemini") → Get started → choose **Gemini Developer API** (free tier, no card).
5. **Project settings → Your apps → Web (`</>`)** → register app → copy the config values into `.env` (copy `.env.example` first).
6. `npm install` then `npm run dev` → open the printed URL → sign in with Google.
   - `localhost` is authorised by default. For a deployed site add its domain under Authentication → Settings → **Authorized domains**.

### Deploy free (Firebase Hosting)
```bash
npm i -g firebase-tools
firebase login
firebase use --add        # pick your project
npm run build
firebase deploy
```

### AI without Firebase sign-in (demo mode)
Open ✨ AI and paste a free key from <https://aistudio.google.com/apikey>. It is stored only in your browser.

## Notes on AI accuracy
The model is given today's date, a 21-day calendar, your category list and your existing data, and must answer in a strict JSON schema at low temperature. Everything it returns is **re-validated in code** (dates, times, enums, ids, overlaps, duplicates) and shown for your approval before anything is saved. Handwriting/photo readings list their assumptions so you can check them.
