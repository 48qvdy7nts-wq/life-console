export const snapshotInfo = {
  lastVerifiedAt: "2026-03-09T02:00:42-07:00",
  timezone: "America/Vancouver",
  locale: "en-CA",
};

export const areaOrder = [
  "academic",
  "work",
  "social",
  "love",
  "hobbies",
  "future",
];

export const areaDefinitions = {
  academic: {
    label: "Academic",
    tone: "alert",
    sourceState: "Verified",
    headline: "PSYC 101 is the only hard academic signal I could prove from local files.",
    fallback:
      "No additional course calendars or reminder exports were readable, so this section stays scoped to PSYC 101 evidence.",
  },
  work: {
    label: "Work",
    tone: "steady",
    sourceState: "Verified",
    headline: "Your clearest active build track is Vordrak, with this dashboard now joining it.",
    fallback:
      "I did not find a separate work tracker, so project status comes from local repos and design docs.",
  },
  social: {
    label: "Social",
    tone: "missing",
    sourceState: "Unsynced",
    headline: "No readable calendar or reminder source surfaced for social plans.",
    fallback:
      "Use the local commitments board to log dinners, calls, or meetups so they become part of the decision engine.",
  },
  love: {
    label: "Love",
    tone: "warm",
    sourceState: "Unsynced",
    headline: "I did not find a trustworthy local source for relationship or dating plans.",
    fallback:
      "If this is the section you want at 2 AM, add the next plan manually and the dashboard will start using it.",
  },
  hobbies: {
    label: "Hobbies",
    tone: "play",
    sourceState: "Inferred",
    headline: "Your machine shows a pretty strong RPG, survival, and strategy leisure stack.",
    fallback:
      "This is inferred from installed apps and game folders, not from playtime telemetry.",
  },
  future: {
    label: "Future",
    tone: "future",
    sourceState: "Partly verified",
    headline: "The strongest future-facing signals are creative: Vordrak and your personal web presence.",
    fallback:
      "I did not find a broader life plan document that I could trust enough to summarize as fact.",
  },
};

export const builtInItems = [
  {
    id: "psyc-lab-data",
    area: "academic",
    title: "Submit PSYC 101 Lab Report 2 raw data",
    dueAt: "2026-03-09T11:30:00-07:00",
    note:
      "The Lab Report 2 sheet says raw data must be on Brightspace by the start of class. Your HVLT data file already exists from March 8.",
    source:
      "PSYC101-LabRep2-winter2026-Instructions.pdf plus hvlt-beckett-evans-2026-03-08.txt",
    hard: true,
    priority: "high",
    durationMinutes: 20,
  },
  {
    id: "psyc-lab-class",
    area: "academic",
    title: "Bring notes and HVLT data to class",
    dueAt: "2026-03-09T11:30:00-07:00",
    note:
      "You can use one sheet of notes, your data, and the textbook for the in-class lab report. Lab Report 2 is the heavier lab report of the semester at 12%.",
    source: "psyc101-winter2026-AB4-Syllabus.pdf and Lab Report 2 instructions",
    hard: true,
    priority: "high",
    durationMinutes: 10,
  },
  {
    id: "psyc-reading-language",
    area: "academic",
    title: "Read Chapter 9 pages 308-326 for Language",
    dueAt: "2026-03-09T11:30:00-07:00",
    note: "This is the reading attached to the March 9 lecture in the syllabus.",
    source: "psyc101-winter2026-AB4-Syllabus.pdf",
    hard: false,
    priority: "normal",
    durationMinutes: 45,
  },
  {
    id: "psyc-next-lecture",
    area: "academic",
    title: "PSYC 101 next lecture: sleep and circadian rhythms",
    dueAt: "2026-03-16T11:30:00-07:00",
    note:
      "March 16 covers language continuation plus consciousness focused on sleep and circadian rhythms.",
    source: "psyc101-winter2026-AB4-Syllabus.pdf",
    hard: false,
    priority: "low",
    durationMinutes: 30,
  },
];

export const courseTimeline = [
  {
    date: "2026-02-23T11:30:00-08:00",
    title: "Midterm exam",
    note: "Taken during class time on February 23, 2026.",
  },
  {
    date: "2026-03-09T11:30:00-07:00",
    title: "Language plus Lab Report 2",
    note: "Chapter 9 pages 308-326 only, plus in-class lab work.",
  },
  {
    date: "2026-03-16T11:30:00-07:00",
    title: "Language continued plus sleep and circadian rhythms",
    note: "Chapter 6, focused on pages 187-212.",
  },
  {
    date: "2026-03-23T11:30:00-07:00",
    title: "Altered states and drugs",
    note: "Chapter 6, focused on pages 212-230.",
  },
  {
    date: "2026-03-30T11:30:00-07:00",
    title: "Behaviour in a social context",
    note: "Chapter 13 pages 481-530.",
  },
];

export const projectTracks = [
  {
    name: "Vordrak",
    status: "Active build",
    path: "Desktop/Vordrak",
    summary:
      "Dark-fantasy Godot project with recent combat and economy work, plus a dirty working tree spread across interiors, dialogue, save flow, and NPC systems.",
    next:
      "Finish the remaining interior scenes and wire dialogue knowledge triggers into actual game events.",
    proof: [
      "Recent commits mention physical Vael residue drops and a combat overhaul.",
      "The working tree is still active across dialogue, scene, and systems files.",
      "The GDD explicitly calls out the interior scenes and knowledge triggers as the next priority.",
    ],
  },
  {
    name: "Life Console",
    status: "Shipping now",
    path: "Applications/portfolio-site",
    summary:
      "This app started as an empty Vite shell and is now your personal dashboard site.",
    next:
      "Feed it better sources over time so the unsynced parts become less manual.",
    proof: [
      "The repo only had a bare scaffold and no real app before this build.",
      "The project already has Vite, React, and a static build pipeline for quick local access.",
    ],
  },
  {
    name: "HVLT runner",
    status: "Academic support tool",
    path: "Desktop/hvlt-runner",
    summary:
      "Standalone local app for the Hopkins Verbal Learning Test workflow used in PSYC 101.",
    next:
      "Keep it as your backup path for exporting clean txt output if you ever need to repeat the experiment flow.",
    proof: [
      "The README says it autosaves progress and exports a clean txt summary.",
      "It is specifically scoped to the same PSYC 101 memory assignment.",
    ],
  },
];

export const hobbySignals = [
  {
    name: "Baldur's Gate 3",
    category: "RPG",
    note: "Likely part leisure, part design inspiration for dialogue and systems thinking.",
  },
  {
    name: "Project Zomboid",
    category: "Survival",
    note: "Slow-burn sim energy when you want tension instead of productivity.",
  },
  {
    name: "Stardew Valley",
    category: "Reset",
    note: "Good decompression lane when you need low-friction recovery instead of adrenaline.",
  },
  {
    name: "Terraria",
    category: "Sandbox",
    note: "Open loop tinkering and exploration energy.",
  },
  {
    name: "Victoria 3",
    category: "Strategy",
    note: "Long-session strategy sink. Great when you have time, dangerous when you do not.",
  },
];

export const fixedTruths = [
  {
    label: "Academic truth",
    body:
      "There is a verified PSYC 101 deadline on Monday, March 9, 2026 at 11:30 AM PDT.",
  },
  {
    label: "Readiness truth",
    body:
      "The HVLT raw data file already exists, so the work is not starting from zero.",
  },
  {
    label: "Coverage truth",
    body:
      "Social and love are not synced because I did not find a readable calendar or reminders source.",
  },
  {
    label: "Work truth",
    body:
      "Vordrak is the strongest active long-form project visible on this machine.",
  },
];

export const sourceLedger = [
  {
    title: "PSYC 101 syllabus",
    path: "Downloads/psyc101-winter2026-AB4-Syllabus.pdf",
    usedFor:
      "Lecture schedule, midterm timing, reading blocks, and the Lab Report 2 prep date.",
  },
  {
    title: "Lab Report 2 instructions",
    path: "Downloads/PSYC101-LabRep2-winter2026-Instructions.pdf",
    usedFor:
      "The March 9, 2026 11:30 AM raw data submission deadline and what you must bring to class.",
  },
  {
    title: "HVLT data export",
    path: "Downloads/hvlt-beckett-evans-2026-03-08.txt",
    usedFor:
      "Evidence that the raw data collection step was already completed on March 8, 2026.",
  },
  {
    title: "HVLT runner README",
    path: "Desktop/hvlt-runner/README.md",
    usedFor:
      "Backup workflow details for running the memory-test session and exporting clean txt output.",
  },
  {
    title: "Vordrak GDD and git state",
    path: "Desktop/Vordrak/GDD.md",
    usedFor:
      "Your main active project, its next priorities, and the current implementation gravity around interiors, dialogue, and world systems.",
  },
  {
    title: "Portfolio design plan",
    path: "Applications/docs/plans/2026-02-27-portfolio-website-design.md",
    usedFor:
      "Evidence of an existing personal web build track and the shell I reused for this dashboard.",
  },
];

export const decisionRules = [
  {
    title: "Hard deadlines beat drift",
    body:
      "When a hard commitment is inside the next 12 to 18 hours, treat tonight like setup, not entertainment.",
  },
  {
    title: "Protect morning-you",
    body:
      "If tomorrow matters, sleep is not optional infrastructure. The app assumes recovery is part of being ready.",
  },
  {
    title: "Unknown is not empty",
    body:
      "Social, love, and future stay unsynced until you write them down. The app should not lie just because the screen looks cleaner that way.",
  },
  {
    title: "Default to the strongest active lane",
    body:
      "If nothing is time-critical, move the needle on the clearest real project instead of grazing random obligations.",
  },
];

export const scenarioDefinitions = [
  {
    id: "late_night_gaming",
    title: "Late-night gaming",
    description:
      "You are drifting in leisure and want a blunt answer about whether to keep going.",
  },
  {
    id: "sleep_or_push",
    title: "Sleep or push",
    description:
      "You are considering another work block and need the app to tell you if that is actually smart.",
  },
  {
    id: "tomorrow_radar",
    title: "Tomorrow radar",
    description:
      "You want the shortest credible read on what tomorrow is going to demand.",
  },
  {
    id: "neglected_area",
    title: "Neglected area",
    description:
      "You are not sure which part of life has gone stale because it never screams loudly enough.",
  },
];

export const routineTemplates = [
  {
    id: "night-radar",
    scope: "daily",
    period: "Tonight",
    title: "Check the next 24 hours",
    note:
      "Look at due-soon items before disappearing into games, doomscrolling, or vibes.",
    area: "academic",
  },
  {
    id: "night-stage",
    scope: "daily",
    period: "Tonight",
    title: "Stage tomorrow materials",
    note:
      "Bag, charger, notes, and anything else morning-you will resent having to find half-awake.",
    area: "academic",
  },
  {
    id: "night-cutoff",
    scope: "daily",
    period: "Tonight",
    title: "Respect the gaming cutoff",
    note:
      "A closed loop beats accidental sunrise. Treat this like a hard stop, not a suggestion.",
    area: "hobbies",
  },
  {
    id: "morning-top-three",
    scope: "daily",
    period: "Morning",
    title: "Pick the day's top three",
    note:
      "One hard thing, one maintenance thing, one human thing. Anything else is extra.",
    area: "future",
  },
  {
    id: "morning-human",
    scope: "daily",
    period: "Morning",
    title: "Send the human message you already owe",
    note:
      "Reduce social debt early instead of making it emotionally expensive later.",
    area: "social",
  },
  {
    id: "weekly-reset",
    scope: "weekly",
    period: "Weekly",
    title: "Clean the board",
    note:
      "Archive done items, add new deadlines, and write one future note before the week becomes vague again.",
    area: "future",
  },
];

export const defaultProfile = {
  displayName: "Syeve",
  bankBalance: "",
  creditCardOwed: "",
  dinnerPreference: "",
  wakeTime: "09:00",
  latestReadyMinutes: 30,
  idealReadyMinutes: 60,
  sleepTargetHours: 8,
  windDownMinutes: 45,
  gamingCutoff: "00:30",
  focusBlockMinutes: 60,
};

export const defaultPrinciples = [
  {
    id: "principle-deadlines",
    text: "Hard deadlines beat drift.",
  },
  {
    id: "principle-sleep",
    text: "If tomorrow matters, protect tonight.",
  },
  {
    id: "principle-humans",
    text: "Human commitments count even when no professor is grading them.",
  },
  {
    id: "principle-default",
    text: "When nothing is urgent, move the real project forward.",
  },
];

export const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

export const recurrenceOptions = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const onboardingStepDefinitions = [
  {
    id: "profile_review",
    title: "Review your sleep and cutoff settings",
    detail:
      "Wake time, target sleep, focus length, and gaming cutoff drive the main decision engine.",
    pageId: "systems",
    anchor: "profile-panel",
    actionLabel: "Open profile",
    kind: "manual",
  },
  {
    id: "first_commitment",
    title: "Add your next real commitment",
    detail:
      "One manual commitment is enough to make the board stop pretending your life is only this machine's files.",
    pageId: "commitments",
    anchor: "capture-panel",
    actionLabel: "Add commitment",
    kind: "auto",
  },
  {
    id: "human_plan",
    title: "Log the next human plan",
    detail:
      "If a dinner, date, call, or meetup matters to your choices tonight, give it a place on the board.",
    pageId: "commitments",
    anchor: "capture-panel",
    actionLabel: "Log a plan",
    kind: "auto",
  },
  {
    id: "area_notes",
    title: "Write notes for at least three life areas",
    detail:
      "Use notes for truths, priorities, and emotional context that do not fit cleanly into deadlines.",
    pageId: "areas",
    anchor: "area-notes-panel",
    actionLabel: "Write notes",
    kind: "auto",
  },
  {
    id: "journal_entry",
    title: "Write one line in today's journal",
    detail:
      "A single win, friction point, or note is enough to give the board memory.",
    pageId: "today",
    anchor: "journal-panel",
    actionLabel: "Open journal",
    kind: "auto",
  },
  {
    id: "import_source",
    title: "Import or connect one real source",
    detail:
      "Use a Google Calendar CSV, Notion CSV, ICS file, Apple sync, folder scan, or Gist sync so this stops depending only on manual capture.",
    pageId: "systems",
    anchor: "sources-panel",
    actionLabel: "Open sources",
    kind: "auto",
  },
];

export const starterCommitmentTemplates = [
  {
    id: "human-plan",
    label: "Date / hangout",
    title: "Plan with someone",
    area: "love",
    note: "Who, when, where, and what you need to remember before it happens.",
    hard: true,
    priority: "high",
    durationMinutes: 120,
    recurrence: "none",
    recurrenceInterval: 1,
    duePreset: "tomorrow-evening",
  },
  {
    id: "assignment",
    label: "Assignment / prep",
    title: "Upcoming assignment or class prep",
    area: "academic",
    note: "Class, due date, exact deliverable, and the first small step.",
    hard: true,
    priority: "high",
    durationMinutes: 60,
    recurrence: "none",
    recurrenceInterval: 1,
    duePreset: "tomorrow-morning",
  },
  {
    id: "work-block",
    label: "Work block",
    title: "Focused work block",
    area: "work",
    note: "The one concrete thing this block should finish or unblock.",
    hard: false,
    priority: "normal",
    durationMinutes: 90,
    recurrence: "none",
    recurrenceInterval: 1,
    duePreset: "tomorrow-afternoon",
  },
  {
    id: "weekly-reset",
    label: "Weekly reset",
    title: "Weekly life review",
    area: "future",
    note: "Archive done items, log next week, and add one human plan before the week gets vague.",
    hard: false,
    priority: "normal",
    durationMinutes: 45,
    recurrence: "weekly",
    recurrenceInterval: 1,
    duePreset: "next-sunday-evening",
  },
];

export const areaNotePrompts = {
  academic: [
    "What class, assignment, or exam is next?",
    "What do you usually forget until it becomes stressful?",
  ],
  work: [
    "What is the one active project that actually matters right now?",
    "What should future-you do next when energy is low?",
  ],
  social: [
    "Who do you want to keep in touch with this week?",
    "What social plan matters enough that late-night drift should respect it?",
  ],
  love: [
    "What is the next thing you want to make real here?",
    "What plan, conversation, or intention should not stay vague?",
  ],
  hobbies: [
    "Which hobbies actually restore you and which ones silently eat the night?",
    "What boundaries keep leisure from replacing tomorrow?",
  ],
  future: [
    "What direction are you trying to move toward this month?",
    "What would make the next week feel intentional instead of reactive?",
  ],
};

export const intakeGuide = [
  {
    id: "manual",
    title: "Manual capture",
    detail:
      "Use this for dates, dinners, deadlines, reminders, or private plans that only live in your head right now.",
  },
  {
    id: "imports",
    title: "Imports",
    detail:
      "Bring in calendar/task exports with Google Calendar CSV, Notion CSV, ICS, or a full JSON snapshot.",
  },
  {
    id: "sync",
    title: "Local and cloud sync",
    detail:
      "Use Apple sync on this Mac, folder scan for notes/docs, and optional Gist sync when you want the same board across devices.",
  },
];

export const scanPresetDefinitions = [
  {
    id: "notes",
    label: "Notes and plans",
    actionLabel: "Scan notes/plans",
    detail:
      "Best for Documents, markdown notes, and planning folders where due dates are buried in text.",
    startIn: "documents",
    maxDepth: 4,
    maxFiles: 240,
    limitPerFile: 8,
  },
  {
    id: "exports",
    label: "Calendar exports",
    actionLabel: "Scan exports",
    detail:
      "Best for Downloads or export folders full of ICS and CSV files from calendars or task apps.",
    startIn: "downloads",
    maxDepth: 2,
    maxFiles: 140,
    limitPerFile: 12,
  },
  {
    id: "projects",
    label: "Project docs",
    actionLabel: "Scan project docs",
    detail:
      "Best for Desktop project folders, planning docs, and roadmaps that mention upcoming work.",
    startIn: "desktop",
    maxDepth: 4,
    maxFiles: 180,
    limitPerFile: 6,
  },
];

export const importTemplateDefinitions = [
  {
    id: "csv",
    label: "CSV template",
    href: "./templates/life-console-items-template.csv",
    detail: "Spreadsheet-friendly batch import with priority, hard-stop, and repeat fields.",
  },
  {
    id: "google-calendar",
    label: "Google Calendar CSV",
    href: "./templates/google-calendar-import-template.csv",
    detail: "Matches common Google Calendar export columns like Subject, Start Date, and Start Time.",
  },
  {
    id: "notion",
    label: "Notion CSV",
    href: "./templates/notion-deadlines-template.csv",
    detail: "Matches common Notion exports with Name, Due, Status, Tags, and Notes columns.",
  },
  {
    id: "ics",
    label: "ICS example",
    href: "./templates/life-console-calendar-template.ics",
    detail: "Calendar-style events and reminders in a format many apps can already export.",
  },
  {
    id: "json",
    label: "JSON snapshot",
    href: "./templates/life-console-snapshot-template.json",
    detail: "Full backup structure for scripted sync, manual editing, or clean restores.",
  },
];

export const journalMoodOptions = [
  { value: "rough", label: "Rough" },
  { value: "flat", label: "Flat" },
  { value: "steady", label: "Steady" },
  { value: "good", label: "Good" },
  { value: "sharp", label: "Sharp" },
];

export const defaultAreaNotes = {
  academic: "",
  work: "",
  social: "",
  love: "",
  hobbies: "",
  future: "",
};

export const defaultDraft = {
  title: "",
  area: "social",
  dueAt: "",
  note: "",
  hard: false,
  priority: "normal",
  durationMinutes: 30,
  recurrence: "none",
  recurrenceInterval: 1,
};

export const defaultProfileWithAutomation = {
  ...defaultProfile,
  notificationLeadMinutes: 30,
};

export const defaultJournalEntry = {
  mood: "steady",
  wins: "",
  friction: "",
  note: "",
};

export const defaultSyncConfig = {
  provider: "github-gist",
  gistId: "",
  token: "",
  filename: "life-console.json",
};
