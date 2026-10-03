import { useState } from 'react'
import { useAuth } from './lib/useAuth'
import { StoreProvider, useStore } from './lib/store'
import { useTheme } from './lib/hooks'
import { makePdf } from './lib/pdf'
import { useToast } from './components/Toasts'
import Login from './components/Login'
import TopBar from './components/TopBar'
import TasksView from './components/TasksView'
import TimetableView, { useHourRange } from './components/TimetableView'
import AIDrawer from './components/AIDrawer'
import { EventDialog, ProfileDialog, TaskDialog } from './components/Dialogs'

function Shell({ auth }) {
  const { user } = auth
  const store = useStore()
  const toast = useToast()
  const hours = useHourRange()
  const [theme, toggleTheme] = useTheme()
  const [view, setView] = useState('tasks')
  const [wk, setWk] = useState(0)
  const [ai, setAi] = useState({ open: false, tab: 'chat', seed: null })
  const [taskDlg, setTaskDlg] = useState({ open: false, task: null })
  const [eventDlg, setEventDlg] = useState({ open: false, event: null, preset: null })
  const [profileOpen, setProfileOpen] = useState(false)

  const needsProfile = store.loaded && !store.profile

  const openAI = (tab, seed) => setAi((a) => ({ open: true, tab, seed: seed ? { ...seed } : a.seed }))

  const downloadPdf = async () => {
    toast('Preparing your PDF…')
    try {
      await makePdf({ user, profile: store.profile, tasks: store.tasks, events: store.events, wk: view === 'timetable' ? wk : 0, hours })
    } catch (e) {
      console.error(e)
      toast('Couldn’t create the PDF')
    }
  }

  const splitTask = (t) =>
    openAI('import', {
      mode: 'breakdown',
      autorun: true,
      text: `Break down this task: "${t.title}"${t.due ? ` (due ${t.due})` : ''}${t.category ? ` [category: ${t.category}]` : ''}${t.notes ? `. Notes: ${t.notes}` : ''}`,
    })

  return (
    <div className="app">
      <div className="blobs" aria-hidden="true"><i /><i /><i /></div>
      <TopBar
        user={user}
        view={view}
        setView={setView}
        onAI={openAI}
        onPdf={downloadPdf}
        onProfile={() => setProfileOpen(true)}
        onLogout={auth.logout}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <main>
        {view === 'tasks' ? (
          <TasksView
            user={user}
            onNew={() => setTaskDlg({ open: true, task: null })}
            onEdit={(t) => setTaskDlg({ open: true, task: t })}
            onSplit={splitTask}
            onTimetable={() => setView('timetable')}
          />
        ) : (
          <TimetableView
            wk={wk}
            setWk={setWk}
            onNew={(preset) => setEventDlg({ open: true, event: null, preset })}
            onEdit={(event) => setEventDlg({ open: true, event, preset: null })}
          />
        )}
      </main>

      <button
        className="fab"
        aria-label="Add"
        onClick={() =>
          view === 'tasks'
            ? setTaskDlg({ open: true, task: null })
            : setEventDlg({ open: true, event: null, preset: { day: 0, start: '09:00', end: '10:00' } })
        }
      >
        +
      </button>

      <TaskDialog open={taskDlg.open} task={taskDlg.task} onClose={() => setTaskDlg((d) => ({ ...d, open: false }))} />
      <EventDialog open={eventDlg.open} event={eventDlg.event} preset={eventDlg.preset} wk={wk} onClose={() => setEventDlg((d) => ({ ...d, open: false }))} />
      <ProfileDialog open={needsProfile || profileOpen} forced={needsProfile} onClose={() => setProfileOpen(false)} />
      <AIDrawer open={ai.open} tab={ai.tab} setTab={(tab) => setAi((a) => ({ ...a, tab }))} onClose={() => setAi((a) => ({ ...a, open: false }))} user={user} seed={ai.seed} />
    </div>
  )
}

export default function App() {
  const auth = useAuth()
  if (auth.user === undefined) return <div className="splash"><div className="spinner" /></div>
  if (!auth.user) return <Login auth={auth} />
  return (
    <StoreProvider user={auth.user} key={auth.user.uid}>
      <Shell auth={auth} />
    </StoreProvider>
  )
}
