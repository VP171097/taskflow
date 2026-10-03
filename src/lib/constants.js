export const CATS = {
  Work: '#6366f1',
  Study: '#06b6d4',
  School: '#0ea5e9',
  Homework: '#3b82f6',
  Family: '#ec4899',
  Health: '#10b981',
  Personal: '#8b5cf6',
  Social: '#f59e0b',
  Chores: '#64748b',
  Commute: '#94a3b8',
  Meals: '#eab308',
  Rest: '#14b8a6',
  Play: '#f97316',
  Hobby: '#d946ef',
  Other: '#6b7280',
}

export const SWATCHES = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#8b5cf6', '#64748b']
export const PRIORITIES = ['low', 'med', 'high']
export const PRIORITY_LABEL = { low: 'Low', med: 'Medium', high: 'High' }

export function catColor(cat, seed = '') {
  if (cat && CATS[cat]) return CATS[cat]
  let h = 0
  for (const ch of (cat || seed) + '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return SWATCHES[h % SWATCHES.length]
}

export const PERSONAS = {
  professional: {
    label: 'Working professional',
    emoji: '💼',
    blurb: 'Job, commute, family, fitness & learning',
    cats: ['Work', 'Commute', 'Family', 'Health', 'Study', 'Meals', 'Personal', 'Social', 'Chores', 'Rest'],
    start: 5,
    end: 23,
  },
  college: {
    label: 'College / University',
    emoji: '🎓',
    blurb: 'Lectures, labs, self-study, part-time work',
    cats: ['Study', 'Work', 'Health', 'Social', 'Meals', 'Hobby', 'Personal', 'Chores', 'Rest'],
    start: 6,
    end: 24,
  },
  school: {
    label: 'School student (teen)',
    emoji: '📚',
    blurb: 'Classes, tuition, homework, sports',
    cats: ['School', 'Homework', 'Study', 'Play', 'Health', 'Family', 'Meals', 'Hobby', 'Rest'],
    start: 6,
    end: 23,
  },
  kid: {
    label: 'Kid (primary school)',
    emoji: '🧒',
    blurb: 'School, play, reading, bedtime routine',
    cats: ['School', 'Homework', 'Play', 'Family', 'Meals', 'Hobby', 'Health', 'Rest'],
    start: 6,
    end: 21,
  },
  parent: {
    label: 'Parent / Homemaker',
    emoji: '🏡',
    blurb: 'Kids, home, meals, errands & me-time',
    cats: ['Family', 'Chores', 'Meals', 'Work', 'Health', 'Personal', 'Social', 'Rest'],
    start: 5,
    end: 23,
  },
  freelancer: {
    label: 'Freelancer / Founder',
    emoji: '🚀',
    blurb: 'Clients, deep work, admin, flexible days',
    cats: ['Work', 'Study', 'Health', 'Family', 'Meals', 'Personal', 'Social', 'Rest'],
    start: 6,
    end: 23,
  },
  custom: {
    label: 'Custom',
    emoji: '✨',
    blurb: 'Start blank and shape it your way',
    cats: ['Work', 'Study', 'Family', 'Health', 'Personal', 'Social', 'Chores', 'Meals', 'Rest', 'Other'],
    start: 6,
    end: 22,
  },
}

const WK = [0, 1, 2, 3, 4]
const ALL = [0, 1, 2, 3, 4, 5, 6]

// [title, days, start, end, category]
export const TEMPLATES = {
  professional: [
    ['Morning routine', ALL, '06:30', '07:30', 'Personal'],
    ['Commute', WK, '08:00', '09:00', 'Commute'],
    ['Focus work', WK, '09:00', '12:30', 'Work'],
    ['Lunch', WK, '12:30', '13:30', 'Meals'],
    ['Meetings & tasks', WK, '13:30', '17:30', 'Work'],
    ['Commute home', WK, '17:30', '18:30', 'Commute'],
    ['Workout', [0, 2, 4], '19:00', '19:45', 'Health'],
    ['Family dinner', ALL, '20:00', '21:00', 'Family'],
    ['Learning / side project', [1, 3], '21:00', '22:00', 'Study'],
    ['Family outing & errands', [5], '10:00', '14:00', 'Family'],
    ['Chores & meal prep', [6], '10:00', '12:00', 'Chores'],
    ['Wind down', ALL, '22:00', '22:30', 'Rest'],
  ],
  college: [
    ['Morning routine', ALL, '07:00', '08:00', 'Personal'],
    ['Lectures', WK, '09:00', '12:00', 'Study'],
    ['Lunch', WK, '12:00', '13:00', 'Meals'],
    ['Labs / tutorials', [1, 3], '13:00', '15:00', 'Study'],
    ['Library & self-study', WK, '15:00', '17:00', 'Study'],
    ['Sports / gym', [0, 2, 4], '17:30', '18:30', 'Health'],
    ['Dinner', ALL, '19:30', '20:15', 'Meals'],
    ['Assignments & revision', [0, 1, 2, 3, 6], '20:30', '22:30', 'Study'],
    ['Part-time job', [5], '10:00', '15:00', 'Work'],
    ['Friends & hobbies', [4, 5], '18:00', '21:00', 'Social'],
    ['Laundry & chores', [6], '11:00', '12:30', 'Chores'],
  ],
  school: [
    ['Get ready & breakfast', WK, '06:30', '07:30', 'Meals'],
    ['School', WK, '08:00', '15:00', 'School'],
    ['Snack & rest', WK, '15:30', '16:15', 'Rest'],
    ['Homework', WK, '16:30', '18:00', 'Homework'],
    ['Tuition / extra class', [1, 3], '18:15', '19:15', 'Study'],
    ['Sports / activity', [0, 2, 4], '17:00', '18:00', 'Health'],
    ['Dinner & family time', ALL, '19:30', '20:30', 'Family'],
    ['Revision & reading', WK, '20:30', '21:30', 'Study'],
    ['Hobby / screen time', [5, 6], '16:00', '17:30', 'Hobby'],
    ['Weekend study block', [5, 6], '10:00', '12:00', 'Study'],
    ['Wind down & sleep prep', ALL, '21:45', '22:15', 'Rest'],
  ],
  kid: [
    ['Wake up & get ready', WK, '06:30', '07:30', 'Personal'],
    ['School', WK, '08:00', '14:30', 'School'],
    ['Snack & free play', WK, '15:00', '16:30', 'Play'],
    ['Homework', WK, '16:30', '17:15', 'Homework'],
    ['Outdoor play', ALL, '17:30', '18:30', 'Play'],
    ['Dinner', ALL, '19:00', '19:30', 'Meals'],
    ['Story / reading time', ALL, '19:45', '20:15', 'Hobby'],
    ['Bedtime routine', ALL, '20:15', '21:00', 'Rest'],
    ['Hobby class', [5], '10:00', '11:00', 'Hobby'],
    ['Family time', [6], '10:00', '13:00', 'Family'],
  ],
  parent: [
    ['Wake up & kids ready', ALL, '06:00', '07:30', 'Family'],
    ['School drop-off', WK, '07:30', '08:15', 'Family'],
    ['Housework & errands', WK, '08:30', '10:30', 'Chores'],
    ['Work / personal projects', WK, '10:30', '13:00', 'Work'],
    ['Lunch', ALL, '13:00', '13:45', 'Meals'],
    ['School pick-up', WK, '14:30', '15:15', 'Family'],
    ['Kids homework help', WK, '16:00', '17:30', 'Family'],
    ['Cook dinner', ALL, '18:00', '19:30', 'Meals'],
    ['Family time', ALL, '19:30', '21:00', 'Family'],
    ['Me-time / exercise', [1, 3, 5], '06:00', '06:45', 'Health'],
    ['Grocery & weekly planning', [5], '10:00', '12:00', 'Chores'],
  ],
  freelancer: [
    ['Morning routine & plan day', ALL, '07:00', '08:00', 'Personal'],
    ['Deep work', WK, '08:30', '12:00', 'Work'],
    ['Lunch break', WK, '12:00', '13:00', 'Meals'],
    ['Client calls & meetings', WK, '13:00', '15:00', 'Work'],
    ['Admin, invoices & email', WK, '15:00', '16:30', 'Work'],
    ['Skill building', [1, 3], '16:30', '17:30', 'Study'],
    ['Workout', [0, 2, 4], '18:00', '19:00', 'Health'],
    ['Dinner & family', ALL, '19:30', '21:00', 'Family'],
    ['Weekly review & planning', [6], '17:00', '18:00', 'Work'],
  ],
  custom: [],
}

export const QUOTES = [
  'Small steps every day beat big plans someday.',
  'Done is better than perfect.',
  'Plan the work, then work the plan.',
  'One task at a time. You’ve got this.',
  'Protect your focus — it’s your most valuable asset.',
  'Rest is part of the schedule too.',
  'Progress, not perfection.',
  'Start with the hardest task while your energy is fresh.',
]
