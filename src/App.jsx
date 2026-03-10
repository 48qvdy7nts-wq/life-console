import { useEffect, useMemo, useState } from "react";
import {
  areaDefinitions,
  areaOrder,
  builtInItems,
  courseTimeline,
  decisionRules,
  defaultAreaNotes,
  defaultDraft,
  defaultJournalEntry,
  defaultPrinciples,
  defaultProfileWithAutomation,
  defaultSyncConfig,
  fixedTruths,
  hobbySignals,
  importTemplateDefinitions,
  intakeGuide,
  journalMoodOptions,
  onboardingStepDefinitions,
  priorityOptions,
  projectTracks,
  recurrenceOptions,
  routineTemplates,
  scanPresetDefinitions,
  scenarioDefinitions,
  snapshotInfo,
  sourceLedger,
  starterCommitmentTemplates,
  areaNotePrompts,
} from "./data/dashboardData";
import { pushSnapshotToGithubGist, pullSnapshotFromGithubGist } from "./lib/cloudSync";
import {
  importItemsFromFile,
  scanSelectedDirectory,
} from "./lib/dataTools";
import {
  addDays,
  buildCalendarOccurrences,
  buildMonthMatrix,
  buildOpenItems,
  buildSearchResults,
  buildSleepModel,
  buildWeekDays,
  completedItemSort,
  createId,
  endOfDay,
  formatDateOnly,
  formatDateTime,
  formatDuration,
  formatShortDate,
  formatTimeOnly,
  getLocalDateKey,
  getUrgencyTone,
  itemSort,
  markItemDone,
  normalizeAreaNotes,
  normalizeDismissedIds,
  normalizeItem,
  normalizeItems,
  normalizeJournalEntry,
  normalizeJournalEntries,
  normalizePrinciples,
  normalizeProfile,
  normalizeRoutineState,
  normalizeSetupState,
  normalizeSyncConfig,
  relativeWindow,
  startOfDay,
  toPositiveNumber,
} from "./lib/logic";

const STORAGE_KEYS = {
  items: "life-console-items-v3",
  notes: "life-console-area-notes-v3",
  profile: "life-console-profile-v3",
  principles: "life-console-principles-v3",
  routines: "life-console-routines-v3",
  dismissed: "life-console-dismissed-v3",
  journal: "life-console-journal-v1",
  syncConfig: "life-console-sync-config-v1",
  notified: "life-console-notified-occurrences-v1",
  setup: "life-console-setup-v1",
};

const PAGE_DEFINITIONS = [
  {
    id: "dashboard",
    segment: "",
    label: "Dashboard",
    eyebrow: "Overview",
    title: "Main dashboard",
    copy: "The top-level answer before you decide whether to dive deeper.",
  },
  {
    id: "setup",
    segment: "setup",
    label: "Setup",
    eyebrow: "Onboarding",
    title: "Set up your account",
    copy: "Add the minimum this site should know before you use it.",
    nav: false,
  },
  {
    id: "account",
    segment: "account",
    label: "Account",
    eyebrow: "Profile",
    title: "Account",
    copy: "Your personal data, defaults, and first saved commitment.",
  },
  {
    id: "today",
    segment: "today",
    label: "Today",
    eyebrow: "Tonight and tomorrow",
    title: "What matters right now",
    copy: "Deadlines, sleep pressure, routines, and your daily log in one place.",
  },
  {
    id: "calendar",
    segment: "calendar",
    label: "Calendar",
    eyebrow: "Time view",
    title: "Pattern and schedule",
    copy: "Week and month views for hard dates, recurring commitments, and course timing.",
  },
  {
    id: "commitments",
    segment: "commitments",
    label: "Commitments",
    eyebrow: "Open loops",
    title: "Board and capture",
    copy: "See what is open, close what is done, and add the next thing before it disappears from memory.",
  },
  {
    id: "search",
    segment: "search",
    label: "Search",
    eyebrow: "Lookup",
    title: "Find anything fast",
    copy: "Search commitments, notes, journal entries, rules, and project/source references.",
  },
  {
    id: "areas",
    segment: "areas",
    label: "Areas",
    eyebrow: "Life map",
    title: "Area notes and summaries",
    copy: "Keep the six major lanes visible even when they do not have loud deadlines attached to them.",
  },
  {
    id: "systems",
    segment: "systems",
    label: "Systems",
    eyebrow: "Sources and backup",
    title: "Systems",
    copy: "Imports, sources, and backups.",
  },
  {
    id: "projects",
    segment: "projects",
    label: "Projects",
    eyebrow: "Work gravity",
    title: "Projects and support context",
    copy: "Project momentum, repo state, hobby context, and the facts underneath your planning decisions.",
  },
];

const SETUP_AREA_OPTIONS = [
  { value: "academic", label: "School" },
  { value: "work", label: "Work" },
  { value: "social", label: "Social" },
  { value: "love", label: "Love" },
  { value: "hobbies", label: "Hobby" },
  { value: "future", label: "Future" },
];

const SYSTEMS_PANE_DEFINITIONS = [
  { id: "sources", label: "Sources", sectionId: "sources-panel" },
  { id: "backup", label: "Backup", sectionId: "backup-panel" },
];

function normalizePathSegments(pathname) {
  const segments = String(pathname || "/")
    .split("/")
    .filter(Boolean);

  if (segments[segments.length - 1] === "index.html") {
    segments.pop();
  }

  return segments;
}

function getPageContextFromLocation() {
  if (typeof window === "undefined") {
    return {
      pageId: "dashboard",
      currentDefinition: PAGE_DEFINITIONS[0],
      basePath: "/",
    };
  }

  const segments = normalizePathSegments(window.location.pathname);
  const matched = PAGE_DEFINITIONS.find(
    (definition) => definition.segment && segments[segments.length - 1] === definition.segment
  );
  const pageId = matched?.id || "dashboard";
  const baseSegments = matched ? segments.slice(0, -1) : segments;
  const basePath = baseSegments.length ? `/${baseSegments.join("/")}/` : "/";

  return {
    pageId,
    currentDefinition: PAGE_DEFINITIONS.find((definition) => definition.id === pageId) || PAGE_DEFINITIONS[0],
    basePath,
  };
}

function buildPageHref(basePath, pageId) {
  const definition = PAGE_DEFINITIONS.find((entry) => entry.id === pageId) || PAGE_DEFINITIONS[0];
  return definition.segment ? `${basePath}${definition.segment}/` : basePath;
}

function buildAssetHref(basePath, assetPath) {
  if (!assetPath) {
    return basePath;
  }

  if (/^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith("data:")) {
    return assetPath;
  }

  const normalized = String(assetPath)
    .replace(/^(\.\/)+/, "")
    .replace(/^\/+/, "");

  return `${basePath}${normalized}`;
}

function buildPageSectionHref(basePath, pageId, sectionId) {
  const href = buildPageHref(basePath, pageId);
  return sectionId ? `${href}#${sectionId}` : href;
}

function getSystemsPaneFromHash(hash) {
  const sectionId = String(hash || "").replace(/^#/, "");
  return (
    SYSTEMS_PANE_DEFINITIONS.find((pane) => pane.sectionId === sectionId)?.id ||
    SYSTEMS_PANE_DEFINITIONS[0].id
  );
}

function toDateTimeLocalValue(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildWakePlanCopy(sleepModel, locale) {
  if (sleepModel.wakeMode === "event" && sleepModel.wakeSourceItem) {
    return {
      label: `${formatTimeOnly(sleepModel.upcomingWake, locale)} ideal`,
      detail: `${formatTimeOnly(
        sleepModel.latestWake,
        locale
      )} latest for ${sleepModel.wakeSourceItem.title}.`,
    };
  }

  return {
    label: formatTimeOnly(sleepModel.upcomingWake, locale),
    detail: "Using your default wake time because nothing earlier on that day forces it.",
  };
}

function deriveLatestReadyMinutes(morningBufferMinutes) {
  const buffer = Math.max(0, Number(morningBufferMinutes) || 0);

  if (buffer <= 30) {
    return buffer;
  }

  return Math.max(15, buffer - 30);
}

function formatMoneyValue(value, locale = snapshotInfo.locale) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  const amount = Number(raw.replace(/[^0-9.-]/g, ""));

  if (!Number.isFinite(amount)) {
    return raw;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function buildSetupDraft(profile) {
  return {
    displayName: profile?.displayName || "",
    bankBalance: profile?.bankBalance || "",
    creditCardOwed: profile?.creditCardOwed || "",
    dinnerPreference: profile?.dinnerPreference || "",
    wakeTime: profile?.wakeTime || defaultProfileWithAutomation.wakeTime,
    morningBufferMinutes:
      profile?.idealReadyMinutes || defaultProfileWithAutomation.idealReadyMinutes,
    sleepTargetHours:
      profile?.sleepTargetHours || defaultProfileWithAutomation.sleepTargetHours,
    firstCommitmentTitle: "",
    firstCommitmentArea: "academic",
    firstCommitmentDueAt: "",
    firstCommitmentNote: "",
    firstCommitmentHard: true,
  };
}

function readStorage(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function buildSnapshotPayload({
  profile,
  customItems,
  areaNotes,
  principles,
  routineState,
  dismissedIds,
  journalEntries,
}) {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    profile,
    customItems,
    areaNotes,
    principles,
    routineState,
    dismissedVerifiedIds: dismissedIds,
    journalEntries,
  };
}

function mergeImportedItems(existingItems, importedItems) {
  const existingKeys = new Set(
    existingItems.map((item) => `${item.title}|${item.dueAt}|${item.recurrence}`)
  );
  const merged = [...existingItems];

  importedItems.forEach((item) => {
    const normalized = normalizeItem({
      ...item,
      id: item.id || createId("item"),
      createdAt: item.createdAt || new Date().toISOString(),
    });
    const key = `${normalized.title}|${normalized.dueAt}|${normalized.recurrence}`;
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      merged.push(normalized);
    }
  });

  return merged;
}

function getRoutineScopeKey(template, now) {
  return template.scope === "weekly"
    ? `${now.getFullYear()}-${Math.floor(now.getTime() / 604800000)}`
    : getLocalDateKey(now);
}

function getRoutineStateKey(template, now) {
  return `${template.id}:${getRoutineScopeKey(template, now)}`;
}

function isRoutineDone(template, routineState, now) {
  return Boolean(routineState[getRoutineStateKey(template, now)]);
}

function buildAreaSummary(area, items, notes, now, locale) {
  const timedItems = items.filter((item) => item.viewDueAt || item.dueAt).sort(itemSort);
  const nextItem = timedItems[0];
  const manualCount = items.filter((item) => item.sourceType === "local").length;

  if (area === "academic") {
    return {
      detail:
        "Academic is the only fully grounded lane right now, and it has a real class-time deadline attached to it.",
      footer: nextItem
        ? `Nearest academic item: ${formatDateTime(nextItem.viewDueAt || nextItem.dueAt, locale)}`
        : areaDefinitions[area].fallback,
    };
  }

  if (area === "work") {
    return {
      detail:
        manualCount > 0
          ? `${manualCount} custom work item${manualCount === 1 ? "" : "s"} logged, on top of the visible Vordrak lane.`
          : "Vordrak remains the default work lane when nothing else is stronger or sooner.",
      footer:
        notes[area]
          ? "There is also saved work context here."
          : areaDefinitions[area].fallback,
    };
  }

  if (area === "hobbies") {
    return {
      detail:
        "Hobbies look healthy, but they are still the easiest lane to over-expand when tomorrow has friction.",
      footer: nextItem
        ? `Nearest logged leisure item lands ${relativeWindow(nextItem.viewDueAt || nextItem.dueAt, now)}.`
        : "Treat leisure as bounded recovery, not a silent schedule replacement.",
    };
  }

  if (manualCount > 0) {
    return {
      detail: `${manualCount} local commitment${manualCount === 1 ? "" : "s"} logged here.`,
      footer: nextItem
        ? `Nearest one lands ${relativeWindow(nextItem.viewDueAt || nextItem.dueAt, now)}.`
        : "Nothing here has a time attached yet.",
    };
  }

  if (notes[area]) {
    return {
      detail: "You have saved context here even though there is no timed commitment yet.",
      footer: "Useful when the real problem is uncertainty, not scheduling.",
    };
  }

  return {
    detail: areaDefinitions[area].fallback,
    footer: "Unknown stays unknown until you add it.",
  };
}

function buildScenarioDecision({
  scenarioId,
  now,
  openItems,
  profile,
  areaNotes,
  principles,
  sleepModel,
  locale,
}) {
  const timedItems = openItems.filter((item) => item.viewDueAt || item.dueAt).sort(itemSort);
  const upcoming12h = timedItems.filter((item) => {
    const diff = new Date(item.viewDueAt || item.dueAt).getTime() - now.getTime();
    return diff >= 0 && diff <= 12 * 3600000;
  });
  const upcoming24h = timedItems.filter((item) => {
    const diff = new Date(item.viewDueAt || item.dueAt).getTime() - now.getTime();
    return diff >= 0 && diff <= 24 * 3600000;
  });
  const nextPersonal = timedItems.find((item) => ["social", "love"].includes(item.area));
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const tomorrowItems = timedItems.filter((item) => {
    const dueAt = new Date(item.viewDueAt || item.dueAt).getTime();
    return dueAt >= tomorrowStart.getTime() && dueAt <= tomorrowEnd.getTime();
  });

  if (scenarioId === "late_night_gaming") {
    if (
      upcoming12h.some((item) => item.hard) ||
      sleepModel.pastRecommendedSleep ||
      sleepModel.hoursUntilWake < profile.sleepTargetHours
    ) {
      return {
        tone: "alert",
        title: "Stop the session and go to sleep.",
        summary:
          "The app sees a real morning consequence and not enough margin to pretend otherwise.",
        bullets: [
          upcoming12h.some((item) => item.hard)
            ? `There is a hard item inside the next 12 hours: ${upcoming12h[0].title}.`
            : sleepModel.wakeMode === "event" && sleepModel.wakeSourceItem
              ? `You are already inside or past the target sleep window for a ${formatTimeOnly(
                  sleepModel.upcomingWake,
                  locale
                )} ideal wake (${formatTimeOnly(sleepModel.latestWake, locale)} latest) for ${
                  sleepModel.wakeSourceItem.title
                }.`
              : `You are already inside or past the target sleep window for a ${formatTimeOnly(
                  sleepModel.upcomingWake,
                  locale
                )} wake-up.`,
          `Recommended asleep time is ${formatTimeOnly(
            sleepModel.recommendedSleepAt,
            locale
          )}, with wind-down starting at ${formatTimeOnly(sleepModel.windDownAt, locale)}.`,
          "A clean morning is worth more than one more fuzzy leisure block.",
        ],
        move: "Close the game, stage tomorrow, and sleep.",
      };
    }

    if (upcoming24h.length > 0 || sleepModel.inWindDown || sleepModel.pastCutoff) {
      return {
        tone: "warm",
        title: "One bounded block is fine. An open-ended night is not.",
        summary:
          "Nothing catastrophic is screaming, but tomorrow still has structure and your sleep window is approaching.",
        bullets: [
          upcoming24h.length > 0
            ? `${upcoming24h.length} item${upcoming24h.length === 1 ? "" : "s"} land inside the next 24 hours.`
            : "The hard deadline pressure is low, but the sleep pressure is climbing.",
          `Gaming cutoff is set to ${profile.gamingCutoff}.`,
          "Recovery only helps if it stays finite.",
        ],
        move: `Play one block, then stop by ${profile.gamingCutoff}.`,
      };
    }

    return {
      tone: "play",
      title: "The board is quiet enough for a deliberate leisure block.",
      summary:
        "Nothing urgent is forcing you out right now, but it still pays to set a stop point before you drift.",
      bullets: [
        "No hard commitment is inside the next 12 hours.",
        `You still have about ${Math.max(
          0,
          Math.round(sleepModel.hoursUntilSleep * 10) / 10
        )} hours before the target sleep time.`,
        "Leisure is healthiest when it is chosen, not leaked into sunrise.",
      ],
      move: "Set the stop time before you tab back in.",
    };
  }

  if (scenarioId === "sleep_or_push") {
    if (sleepModel.pastRecommendedSleep || sleepModel.hoursUntilWake < profile.sleepTargetHours) {
      return {
        tone: "alert",
        title: "Sleep wins over another push.",
        summary:
          "A tired extra block usually creates worse work and a weaker tomorrow.",
        bullets: [
          sleepModel.wakeMode === "event" && sleepModel.wakeSourceItem
            ? `Wake plan: ${formatTimeOnly(
                sleepModel.upcomingWake,
                locale
              )} ideal, ${formatTimeOnly(sleepModel.latestWake, locale)} latest for ${
                sleepModel.wakeSourceItem.title
              }.`
            : `Upcoming wake time: ${formatTimeOnly(sleepModel.upcomingWake, locale)}.`,
          `Target sleep budget: ${profile.sleepTargetHours} hours.`,
          "You are already trading tomorrow's sharpness for marginal progress.",
        ],
        move: "Write down the next step and stop.",
      };
    }

    if (upcoming12h.length > 0) {
      return {
        tone: "warm",
        title: "Do one prep block, then stop.",
        summary:
          "The smartest extra effort is a small, concrete setup block for the thing that lands next.",
        bullets: [
          `Nearest item: ${upcoming12h[0].title}.`,
          `Use one ${profile.focusBlockMinutes}-minute block at most.`,
          "Prep beats expansion when the clock is already narrowing.",
        ],
        move: "Handle one crisp step, then sleep.",
      };
    }

    return {
      tone: "steady",
      title: "A single work block is still reasonable.",
      summary:
        "There is enough margin for focused effort if you keep the scope narrow and concrete.",
      bullets: [
        `Wind-down begins at ${formatTimeOnly(sleepModel.windDownAt, locale)}.`,
        `Default focus block length is ${profile.focusBlockMinutes} minutes.`,
        "Pick one move, not a productivity mood.",
      ],
      move: "Set a timer, do one block, stop when it ends.",
    };
  }

  if (scenarioId === "tomorrow_radar") {
    if (tomorrowItems.length > 0 || upcoming24h.length > 0) {
      const radarItems = tomorrowItems.length > 0 ? tomorrowItems : upcoming24h;
      return {
        tone: getUrgencyTone(radarItems[0], now),
        title: "Tomorrow already has shape.",
        summary:
          "The next day is not blank. It contains commitments you should design around tonight.",
        bullets: radarItems.slice(0, 3).map((item) => {
          const dueAt = item.viewDueAt || item.dueAt;
          return `${item.title} (${formatDateTime(dueAt, locale)})`;
        }),
        move: "Prep for the first real thing before you trust future-you with it.",
      };
    }

    return {
      tone: "steady",
      title: "Tomorrow is mostly open.",
      summary:
        "There is no hard-dated item in the next 24 hours, so default to recovery plus deliberate project work.",
      bullets: [
        "No timed commitment is currently visible for tomorrow.",
        "That usually means you should either recover properly or move the clearest project forward.",
        "If something is missing, log it now so the board stops lying by omission.",
      ],
      move: "Use the spare margin on purpose.",
    };
  }

  const neglectedArea = ["social", "love", "future"].find(
    (area) =>
      !areaNotes[area]?.trim() &&
      !openItems.some((item) => item.area === area)
  );

  return {
    tone: neglectedArea ? areaDefinitions[neglectedArea].tone : "steady",
    title: neglectedArea
      ? `${areaDefinitions[neglectedArea].label} is the least represented lane.`
      : "The board is missing context more than deadlines.",
    summary:
      "The loudest area is not always the most neglected one. Missing data is a signal.",
    bullets: [
      neglectedArea
        ? `${areaDefinitions[neglectedArea].label} has neither a note nor a logged commitment right now.`
        : "Social, love, and future all have at least some context.",
      nextPersonal
        ? `Nearest personal plan: ${nextPersonal.title} (${relativeWindow(
            nextPersonal.viewDueAt || nextPersonal.dueAt,
            now
          )}).`
        : "No personal commitment is timed yet.",
      `Current first principle: ${principles[0]?.text || "Write one."}`,
    ],
    move: neglectedArea
      ? `Write one note or one dated item for ${areaDefinitions[
          neglectedArea
        ].label.toLowerCase()}.`
      : "Improve the parts of the board that still feel vague.",
  };
}

function buildHeroVerdict({ now, openItems, sleepModel, profile, locale }) {
  const timedItems = openItems.filter((item) => item.viewDueAt || item.dueAt).sort(itemSort);
  const nextHard = timedItems.find((item) => item.hard);
  const lateHours = now.getHours() >= 22 || now.getHours() < 5;

  if (lateHours) {
    return buildScenarioDecision({
      scenarioId: "late_night_gaming",
      now,
      openItems,
      profile,
      areaNotes: defaultAreaNotes,
      principles: defaultPrinciples,
      sleepModel,
      locale,
    });
  }

  if (nextHard) {
    const dueAt = nextHard.viewDueAt || nextHard.dueAt;
    return {
      tone: getUrgencyTone(nextHard, now),
      title: nextHard.title,
      summary:
        "The clearest hard commitment should own the top slot until it is prepared or done.",
      bullets: [
        nextHard.note,
        `Due ${formatDateTime(dueAt, locale)}.`,
        nextHard.sourceType === "local"
          ? "This exists because you logged it locally."
          : "This is grounded in a local or synced source, not a guess.",
      ],
      move: "Handle the prep work around this first.",
    };
  }

  return {
    tone: "steady",
    title: "Nothing hard-dated is on top of you.",
    summary:
      "That means the right default is deliberate project work or recovery, not low-grade drift.",
    bullets: [
      "No hard commitment is currently visible in the next day.",
      sleepModel.wakeMode === "event" && sleepModel.wakeSourceItem
        ? `Wake ${formatTimeOnly(
            sleepModel.upcomingWake,
            locale
          )} ideal, ${formatTimeOnly(sleepModel.latestWake, locale)} latest for ${
            sleepModel.wakeSourceItem.title
          }.`
        : `Default wake is ${formatTimeOnly(sleepModel.upcomingWake, locale)}.`,
      "When the board is quiet, move the clearest real project forward.",
    ],
    move: "Use the open space on purpose.",
  };
}

function buildActionStack({ now, openItems, routineState, sleepModel }) {
  const actions = [];
  const timedItems = openItems.filter((item) => item.viewDueAt || item.dueAt).sort(itemSort);
  const nextHard = timedItems.find((item) => item.hard);
  const period = now.getHours() >= 15 || now.getHours() < 4 ? "Tonight" : "Morning";
  const nextRoutine = routineTemplates.find(
    (template) =>
      template.period === period && !isRoutineDone(template, routineState, now)
  );
  const nextPersonal = timedItems.find((item) => ["social", "love"].includes(item.area));

  if (nextHard) {
    actions.push({
      label: "First move",
      tone: getUrgencyTone(nextHard, now),
      title: nextHard.title,
      body: `${nextHard.note}`,
    });
  }

  if (nextRoutine) {
    actions.push({
      label: `${period} routine`,
      tone: areaDefinitions[nextRoutine.area].tone,
      title: nextRoutine.title,
      body: nextRoutine.note,
    });
  }

  if (nextPersonal) {
    actions.push({
      label: "Human lane",
      tone: areaDefinitions[nextPersonal.area].tone,
      title: nextPersonal.title,
      body: nextPersonal.note || `Landing ${relativeWindow(nextPersonal.viewDueAt || nextPersonal.dueAt, now)}.`,
    });
  }

  if (actions.length < 3) {
    actions.push({
      label: "Default lane",
      tone: "steady",
      title: "Move Vordrak or tighten this system",
      body:
        "Nothing nearer looks stronger than your main active project and the system that supports it.",
    });
  }

  if (actions.length < 3) {
    actions.push({
      label: "Recovery",
      tone: sleepModel.inWindDown ? "warm" : "play",
      title: sleepModel.inWindDown ? "Start winding down" : "Keep leisure bounded",
      body: sleepModel.inWindDown
        ? `Target sleep time is ${formatTimeOnly(
            sleepModel.recommendedSleepAt,
            snapshotInfo.locale
          )}.`
        : "Recovery helps when it stays intentional and finite.",
    });
  }

  return actions.slice(0, 3);
}

function MetricCard({ label, value, detail, tone }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function SectionHeading({ eyebrow, title, copy }) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {copy ? <p className="section-copy">{copy}</p> : null}
    </div>
  );
}

function CalendarDay({ day, items, cursorMonth, locale, onToday }) {
  const inMonth = day.getMonth() === cursorMonth;
  const isToday = getLocalDateKey(day) === getLocalDateKey(new Date());

  return (
    <article className={`calendar-day ${inMonth ? "" : "is-muted"} ${isToday ? "is-today" : ""}`}>
      <div className="calendar-day-head">
        <span>{formatShortDate(day, locale)}</span>
        {isToday ? (
          <button type="button" className="mini-text-button" onClick={onToday}>
            Today
          </button>
        ) : null}
      </div>
      <div className="calendar-day-items">
        {items.slice(0, 4).map((item) => (
          <article key={item.occurrenceKey} className={`calendar-chip tone-${getUrgencyTone(item, new Date())}`}>
            <span className={`area-pill area-${item.area}`}>
              {areaDefinitions[item.area].label}
            </span>
            <strong>{item.title}</strong>
            <small>{formatTimeOnly(item.viewDueAt || item.dueAt, locale)}</small>
          </article>
        ))}
        {items.length > 4 ? <p className="calendar-overflow">+{items.length - 4} more</p> : null}
      </div>
    </article>
  );
}

function ReviewPanel({ eyebrow, title, summary, stats, bullets, action, footer, tone = "steady" }) {
  return (
    <article className="panel reveal">
      <SectionHeading eyebrow={eyebrow} title={title} copy={summary} />
      <div className="panel-pad review-panel">
        <div className="review-stats">
          {stats.map((stat) => (
            <article key={stat.label} className="review-stat">
              <span className="meta-label">{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </div>
        <ul className="bullet-list">
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <p className={`review-move tone-${tone}`}>
          <strong>Move:</strong> {action}
        </p>
        {footer ? <p className="small-copy">{footer}</p> : null}
      </div>
    </article>
  );
}

function countRoutineProgress(period, routineState, now) {
  const templates = routineTemplates.filter((template) => template.period === period);
  return {
    total: templates.length,
    done: templates.filter((template) => isRoutineDone(template, routineState, now)).length,
  };
}

function SiteNav({ links, currentPageId, basePath, dashboardAction }) {
  const navLinks = links.filter((link) => link.nav !== false);

  if (currentPageId === "setup") {
    return (
      <header className="site-nav reveal is-setup">
        <div className="nav-brand">
          <h1>Life Console</h1>
        </div>
        <a className="mini-text-button" href={buildPageHref(basePath, "dashboard")}>
          Skip for now
        </a>
      </header>
    );
  }

  if (currentPageId === "dashboard") {
    return (
      <header className="site-nav reveal is-dashboard">
        <div className="nav-brand">
          <h1>Life Console</h1>
        </div>
        {dashboardAction ? (
          <a className="mini-text-button" href={dashboardAction.href}>
            {dashboardAction.label}
          </a>
        ) : null}
      </header>
    );
  }

  return (
    <header className="site-nav reveal">
      <div className="nav-brand">
        <h1>Life Console</h1>
      </div>
      <nav className="nav-links" aria-label="Primary">
        {navLinks.map((link) => (
          <a
            key={link.id}
            href={link.href}
            className={`nav-link ${currentPageId === link.id ? "is-active" : ""}`}
            aria-current={currentPageId === link.id ? "page" : undefined}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function PageIntro({ eyebrow, title, copy, actions }) {
  return (
    <section className="page-intro reveal">
      <div className="page-intro-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="section-copy">{copy}</p>
      </div>
      {actions?.length ? <div className="page-intro-actions">{actions}</div> : null}
    </section>
  );
}

function DashboardBubbleButton({ bubble, active, onToggle }) {
  return (
    <button
      type="button"
      className={`dashboard-bubble ${active ? "is-active" : ""} tone-${bubble.tone}`}
      onClick={() => onToggle(bubble.id)}
      aria-pressed={active}
      aria-expanded={active}
    >
      <span className="dashboard-bubble-label">{bubble.label}</span>
      <strong className="dashboard-bubble-value">{bubble.value}</strong>
      <span className="dashboard-bubble-meta">{bubble.meta}</span>
    </button>
  );
}

function DashboardBubbleDetail({ bubble, basePath }) {
  if (!bubble) {
    return null;
  }

  return (
    <article className={`bubble-detail panel reveal tone-${bubble.tone}`}>
      <div className="bubble-detail-head">
        <span className="meta-label">{bubble.label}</span>
        <h2>{bubble.detailTitle}</h2>
        <p>{bubble.detailBody}</p>
      </div>
      <div className="bubble-detail-facts">
        {bubble.facts.map((fact) => (
          <article key={`${bubble.id}-${fact.label}`} className="bubble-fact">
            <span className="meta-label">{fact.label}</span>
            <strong>{fact.value}</strong>
          </article>
        ))}
      </div>
      <div className="tool-row bubble-detail-actions">
        {bubble.actions.map((action) => (
          <a
            key={`${bubble.id}-${action.href || action.pageId}`}
            className={action.className || "button-like"}
            href={action.href || buildPageHref(basePath, action.pageId)}
          >
            {action.label}
          </a>
        ))}
      </div>
    </article>
  );
}

function SetupStepCard({ step, onToggleManual }) {
  return (
    <article className={`setup-step ${step.done ? "is-done" : ""}`}>
      <div className="setup-step-head">
        <span className="source-pill">{step.done ? "Done" : "Next"}</span>
        <span className="meta-label">{step.kind === "manual" ? "Confirm" : "Auto"}</span>
      </div>
      <h3>{step.title}</h3>
      <p>{step.detail}</p>
      {step.status ? <p className="small-copy">{step.status}</p> : null}
      <div className="tool-row">
        <a className="button-like ghost" href={step.href}>
          {step.actionLabel}
        </a>
        {step.kind === "manual" ? (
          <button type="button" onClick={() => onToggleManual(step.id)}>
            {step.done ? "Mark unreviewed" : "Mark reviewed"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function App() {
  const pageContext = useMemo(() => getPageContextFromLocation(), []);
  const pageLinks = useMemo(
    () =>
      PAGE_DEFINITIONS.map((definition) => ({
        ...definition,
        href: buildPageHref(pageContext.basePath, definition.id),
      })),
    [pageContext.basePath]
  );
  const templateLinks = useMemo(
    () =>
      importTemplateDefinitions.map((template) => ({
        ...template,
        href: buildAssetHref(pageContext.basePath, template.href),
      })),
    [pageContext.basePath]
  );
  const [now, setNow] = useState(() => new Date());
  const [customItems, setCustomItems] = useState(() =>
    normalizeItems(readStorage(STORAGE_KEYS.items, []))
  );
  const [areaNotes, setAreaNotes] = useState(() =>
    normalizeAreaNotes(readStorage(STORAGE_KEYS.notes, defaultAreaNotes))
  );
  const [profile, setProfile] = useState(() =>
    normalizeProfile(readStorage(STORAGE_KEYS.profile, defaultProfileWithAutomation))
  );
  const [principles, setPrinciples] = useState(() =>
    normalizePrinciples(readStorage(STORAGE_KEYS.principles, defaultPrinciples))
  );
  const [routineState, setRoutineState] = useState(() =>
    normalizeRoutineState(readStorage(STORAGE_KEYS.routines, {}))
  );
  const [dismissedIds, setDismissedIds] = useState(() =>
    normalizeDismissedIds(readStorage(STORAGE_KEYS.dismissed, []))
  );
  const [journalEntries, setJournalEntries] = useState(() =>
    normalizeJournalEntries(readStorage(STORAGE_KEYS.journal, {}))
  );
  const [syncConfig, setSyncConfig] = useState(() =>
    normalizeSyncConfig(readStorage(STORAGE_KEYS.syncConfig, defaultSyncConfig))
  );
  const [notifiedKeys, setNotifiedKeys] = useState(() =>
    normalizeDismissedIds(readStorage(STORAGE_KEYS.notified, []))
  );
  const [setupState, setSetupState] = useState(() =>
    normalizeSetupState(readStorage(STORAGE_KEYS.setup, {}))
  );
  const [setupDraft, setSetupDraft] = useState(() => buildSetupDraft(profile));
  const [activeDashboardBubbleId, setActiveDashboardBubbleId] = useState(null);
  const [systemsPane, setSystemsPane] = useState(() =>
    getSystemsPaneFromHash(typeof window === "undefined" ? "" : window.location.hash)
  );

  const [draft, setDraft] = useState(defaultDraft);
  const [scenarioId, setScenarioId] = useState(scenarioDefinitions[0].id);
  const [filterArea, setFilterArea] = useState("all");
  const [flashMessage, setFlashMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [calendarView, setCalendarView] = useState("week");
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [generatedSources, setGeneratedSources] = useState({
    apple: { generatedAt: null, items: [], warnings: [] },
    localScan: { generatedAt: null, items: [], warnings: [], sourcesScanned: [] },
    projectSync: { generatedAt: null, projects: [], warnings: [], githubAuth: { loggedIn: false } },
  });
  const [scanPresetId, setScanPresetId] = useState(scanPresetDefinitions[0].id);
  const [folderScan, setFolderScan] = useState(null);
  const [cloudStatus, setCloudStatus] = useState(null);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title =
        pageContext.pageId === "dashboard"
          ? "Life Console"
          : `Life Console | ${pageContext.currentDefinition.label}`;
    }
  }, [pageContext.currentDefinition.label, pageContext.pageId]);

  useEffect(() => {
    if (pageContext.pageId !== "systems") {
      return undefined;
    }

    const syncPane = () => setSystemsPane(getSystemsPaneFromHash(window.location.hash));

    syncPane();
    window.addEventListener("hashchange", syncPane);
    return () => window.removeEventListener("hashchange", syncPane);
  }, [pageContext.pageId]);

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    async function loadGeneratedSources() {
      async function loadJson(url) {
        try {
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok) {
            return null;
          }
          return response.json();
        } catch {
          return null;
        }
      }

      const [apple, localScan, projectSync] = await Promise.all([
        loadJson(buildAssetHref(pageContext.basePath, "generated/apple-sync.json")),
        loadJson(buildAssetHref(pageContext.basePath, "generated/local-scan.json")),
        loadJson(buildAssetHref(pageContext.basePath, "generated/project-sync.json")),
      ]);

      setGeneratedSources({
        apple: apple || { generatedAt: null, items: [], warnings: [] },
        localScan:
          localScan || { generatedAt: null, items: [], warnings: [], sourcesScanned: [] },
        projectSync:
          projectSync ||
          { generatedAt: null, projects: [], warnings: [], githubAuth: { loggedIn: false } },
      });
    }

    loadGeneratedSources();
  }, [pageContext.basePath]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(customItems));
  }, [customItems]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(areaNotes));
  }, [areaNotes]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.principles, JSON.stringify(principles));
  }, [principles]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.routines, JSON.stringify(routineState));
  }, [routineState]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.dismissed, JSON.stringify(dismissedIds));
  }, [dismissedIds]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify(journalEntries));
  }, [journalEntries]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.syncConfig, JSON.stringify(syncConfig));
  }, [syncConfig]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.notified, JSON.stringify(notifiedKeys));
  }, [notifiedKeys]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.setup, JSON.stringify(setupState));
  }, [setupState]);

  const verifiedOpenItems = useMemo(() => {
    const items = normalizeItems(
      builtInItems.filter((item) => !dismissedIds.includes(item.id))
    );
    return buildOpenItems(items, "verified");
  }, [dismissedIds]);

  const appleOpenItems = useMemo(() => {
    const items = normalizeItems(
      (generatedSources.apple.items || []).filter((item) => !dismissedIds.includes(item.id))
    );
    return buildOpenItems(items, "apple");
  }, [generatedSources.apple.items, dismissedIds]);

  const scannedOpenItems = useMemo(() => {
    const items = normalizeItems(
      (generatedSources.localScan.items || []).filter((item) => !dismissedIds.includes(item.id))
    );
    return buildOpenItems(items, "scan");
  }, [generatedSources.localScan.items, dismissedIds]);

  const localOpenItems = useMemo(() => buildOpenItems(customItems, "local"), [customItems]);
  const archivedLocalItems = useMemo(
    () =>
      customItems
        .filter((item) => item.recurrence === "none" && item.done)
        .sort(completedItemSort),
    [customItems]
  );
  const recurringHistory = useMemo(() => {
    return customItems
      .filter((item) => item.recurrence !== "none")
      .flatMap((item) =>
        (item.completedOccurrences || []).map((occurrence) => ({
          id: `${item.id}:${occurrence}`,
          title: item.title,
          dueAt: occurrence,
          area: item.area,
        }))
      )
      .sort((a, b) => new Date(b.dueAt) - new Date(a.dueAt))
      .slice(0, 8);
  }, [customItems]);

  const openItems = useMemo(
    () =>
      [...verifiedOpenItems, ...appleOpenItems, ...scannedOpenItems, ...localOpenItems].sort(
        itemSort
      ),
    [verifiedOpenItems, appleOpenItems, scannedOpenItems, localOpenItems]
  );

  const visibleItems = useMemo(
    () =>
      filterArea === "all"
        ? openItems
        : openItems.filter((item) => item.area === filterArea),
    [openItems, filterArea]
  );

  const timedOpenItems = useMemo(
    () =>
      openItems
        .filter((item) => item.viewDueAt || item.dueAt)
        .sort(itemSort),
    [openItems]
  );

  const sleepModel = useMemo(
    () => buildSleepModel(now, profile, timedOpenItems),
    [now, profile, timedOpenItems]
  );
  const heroVerdict = useMemo(
    () =>
      buildHeroVerdict({
        now,
        openItems,
        sleepModel,
        profile,
        locale: snapshotInfo.locale,
      }),
    [now, openItems, sleepModel, profile]
  );

  const scenarioDecision = useMemo(
    () =>
      buildScenarioDecision({
        scenarioId,
        now,
        openItems,
        profile,
        areaNotes,
        principles,
        sleepModel,
        locale: snapshotInfo.locale,
      }),
    [scenarioId, now, openItems, profile, areaNotes, principles, sleepModel]
  );

  const actionStack = useMemo(
    () => buildActionStack({ now, openItems, routineState, sleepModel }),
    [now, openItems, routineState, sleepModel]
  );

  const pastDueItems = timedOpenItems.filter(
    (item) => new Date(item.viewDueAt || item.dueAt).getTime() < now.getTime()
  );
  const next24Items = timedOpenItems.filter((item) => {
    const diff = new Date(item.viewDueAt || item.dueAt).getTime() - now.getTime();
    return diff >= 0 && diff <= 24 * 3600000;
  });
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const tomorrowItems = timedOpenItems.filter((item) => {
    const dueAt = new Date(item.viewDueAt || item.dueAt).getTime();
    return dueAt >= tomorrowStart.getTime() && dueAt <= tomorrowEnd.getTime();
  });

  const manualCoverageCount = areaOrder.filter(
    (area) =>
      areaNotes[area]?.trim() ||
      customItems.some((item) => item.area === area) ||
      folderScan?.items?.some((item) => item.area === area)
  ).length;

  const openSourceItemsCount = appleOpenItems.length + scannedOpenItems.length;
  const projectSyncMap = useMemo(() => {
    return new Map(
      (generatedSources.projectSync.projects || []).map((project) => [project.path, project])
    );
  }, [generatedSources.projectSync.projects]);
  const currentProjectSync = projectSyncMap.get("Applications/portfolio-site");
  const leadProjectTrack = projectTracks[0] || null;
  const upcomingTimeline = courseTimeline
    .filter((item) => new Date(item.date).getTime() > now.getTime() - 7 * 86400000)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const searchResults = useMemo(
    () =>
      buildSearchResults({
        query: searchQuery,
        openItems,
        archivedItems: archivedLocalItems,
        areaNotes,
        principles,
        journalEntries,
        projectTracks,
        sourceLedger,
      }),
    [searchQuery, openItems, archivedLocalItems, areaNotes, principles, journalEntries]
  );

  const calendarDays = useMemo(() => {
    return calendarView === "week"
      ? buildWeekDays(calendarCursor)
      : buildMonthMatrix(calendarCursor);
  }, [calendarCursor, calendarView]);

  const calendarRangeStart = startOfDay(calendarDays[0]);
  const calendarRangeEnd = endOfDay(calendarDays[calendarDays.length - 1]);
  const calendarSourceItems = useMemo(() => {
    return normalizeItems([
      ...builtInItems.filter((item) => !dismissedIds.includes(item.id)),
      ...(generatedSources.apple.items || []).filter((item) => !dismissedIds.includes(item.id)),
      ...(generatedSources.localScan.items || []).filter((item) => !dismissedIds.includes(item.id)),
      ...customItems.filter((item) => item.recurrence !== "none" || !item.done),
    ]);
  }, [dismissedIds, generatedSources.apple.items, generatedSources.localScan.items, customItems]);

  const calendarOccurrences = useMemo(
    () => buildCalendarOccurrences(calendarSourceItems, calendarRangeStart, calendarRangeEnd),
    [calendarSourceItems, calendarRangeStart, calendarRangeEnd]
  );

  const calendarItemMap = useMemo(() => {
    return calendarDays.reduce((accumulator, day) => {
      const key = getLocalDateKey(day);
      accumulator[key] = calendarOccurrences.filter(
        (item) => getLocalDateKey(new Date(item.viewDueAt || item.dueAt)) === key
      );
      return accumulator;
    }, {});
  }, [calendarDays, calendarOccurrences]);

  const todayKey = getLocalDateKey(now);
  const todayJournal = journalEntries[todayKey] || defaultJournalEntry;
  const selectedScanPreset = useMemo(
    () =>
      scanPresetDefinitions.find((preset) => preset.id === scanPresetId) ||
      scanPresetDefinitions[0],
    [scanPresetId]
  );
  const next72HumanItems = timedOpenItems.filter((item) => {
    const diff = new Date(item.viewDueAt || item.dueAt).getTime() - now.getTime();
    return diff >= 0 && diff <= 72 * 3600000 && ["social", "love"].includes(item.area);
  });
  const hardNext24Items = next24Items.filter((item) => item.hard);
  const weekStart = startOfDay(addDays(now, -((now.getDay() + 6) % 7)));
  const weekEnd = endOfDay(addDays(weekStart, 6));
  const next7Items = timedOpenItems.filter((item) => {
    const diff = new Date(item.viewDueAt || item.dueAt).getTime() - now.getTime();
    return diff >= 0 && diff <= 7 * 86400000;
  });
  const completedThisWeek =
    archivedLocalItems.filter((item) => {
      const completedAt = new Date(item.completedAt || item.createdAt).getTime();
      return completedAt >= weekStart.getTime() && completedAt <= weekEnd.getTime();
    }).length +
    recurringHistory.filter((entry) => {
      const completedAt = new Date(entry.dueAt).getTime();
      return completedAt >= weekStart.getTime() && completedAt <= weekEnd.getTime();
    }).length;
  const areaPressure = areaOrder
    .map((area) => ({
      area,
      count: openItems.filter((item) => item.area === area).length,
    }))
    .sort((a, b) => b.count - a.count);
  const coverageGaps = areaOrder.filter(
    (area) => !areaNotes[area]?.trim() && !openItems.some((item) => item.area === area)
  );
  const tonightProgress = countRoutineProgress("Tonight", routineState, now);
  const morningProgress = countRoutineProgress("Morning", routineState, now);
  const weeklyProgress = countRoutineProgress("Weekly", routineState, now);
  const dailyLeadItem = tomorrowItems[0] || next24Items[0] || next72HumanItems[0] || null;
  const dailyReview = {
    summary: dailyLeadItem
      ? `${next24Items.length} timed item${next24Items.length === 1 ? "" : "s"} already shape the next day, led by ${dailyLeadItem.title}.`
      : "Nothing timed in the next 24 hours. Treat that as clean space to use intentionally, not empty permission to drift.",
    stats: [
      { label: "Hard in 24h", value: String(hardNext24Items.length) },
      {
        label: "Tonight routine",
        value: `${tonightProgress.done}/${tonightProgress.total}`,
      },
      { label: "Human plans 72h", value: String(next72HumanItems.length) },
    ],
    bullets: [
      hardNext24Items.length > 0
        ? `Hard stop in the next 24 hours: ${hardNext24Items[0].title}.`
        : "No hard stop is currently due in the next 24 hours.",
      next72HumanItems.length > 0
        ? `The nearest logged human plan is ${next72HumanItems[0].title} ${relativeWindow(
            next72HumanItems[0].viewDueAt || next72HumanItems[0].dueAt,
            now
          )}.`
        : "No social or love plan is logged in the next 72 hours.",
      `Morning routine readiness is ${morningProgress.done}/${morningProgress.total}.`,
      todayJournal.note || todayJournal.wins || todayJournal.friction
        ? `Journal signal today is ${todayJournal.mood}: ${todayJournal.note || todayJournal.wins || todayJournal.friction}.`
        : `Journal signal today is ${todayJournal.mood}, with no extra note yet.`,
    ],
    action:
      hardNext24Items.length > 0
        ? "Close loops, stage tomorrow, and protect sleep before leisure expands."
        : next72HumanItems.length > 0
          ? `Protect energy for ${next72HumanItems[0].title} instead of inventing fake free time.`
          : "Use one clean focus block on the strongest real project, then stop on purpose.",
  };
  const weeklyReview = {
    summary: `${openItems.length} open loop${openItems.length === 1 ? "" : "s"} are visible, ${completedThisWeek} completion${completedThisWeek === 1 ? "" : "s"} landed this week, and ${coverageGaps.length} lane${coverageGaps.length === 1 ? "" : "s"} are still blank.`,
    stats: [
      { label: "Next 7 days", value: String(next7Items.length) },
      { label: "Done this week", value: String(completedThisWeek) },
      { label: "Coverage", value: `${manualCoverageCount}/${areaOrder.length}` },
    ],
    bullets: [
      areaPressure[0]?.count > 0
        ? `Heaviest lane right now is ${areaDefinitions[areaPressure[0].area].label} with ${areaPressure[0].count} open item${areaPressure[0].count === 1 ? "" : "s"}.`
        : "No lane is carrying visible pressure right now.",
      coverageGaps.length > 0
        ? `Still blank: ${coverageGaps.map((area) => areaDefinitions[area].label).join(", ")}.`
        : "Every major lane has at least one note or commitment attached to it.",
      `Weekly reset progress is ${weeklyProgress.done}/${weeklyProgress.total}.`,
      generatedSources.apple.items.length + generatedSources.localScan.items.length > 0
        ? `Live sources are feeding ${openSourceItemsCount} imported item${openSourceItemsCount === 1 ? "" : "s"} into the board.`
        : "No live import source is feeding the board yet, so weekly reality still depends on manual capture.",
    ],
    action:
      coverageGaps.length > 0
        ? `Write one note for ${areaDefinitions[coverageGaps[0]].label}, archive what is done, and import one real source before next week gets vague.`
        : "Archive what is done, review next week, and keep the board lean enough to trust at 2 AM.",
  };
  const setupReview = {
    summary:
      "This app is already a static PWA with free sync paths. The remaining setup work is account access, not architecture.",
    stats: [
      { label: "PWA", value: "Ready" },
      {
        label: "Pages",
        value: currentProjectSync?.hasRemote ? "Repo linked" : "Workflow ready",
      },
      {
        label: "Gist sync",
        value: syncConfig.gistId?.trim() ? "Connected" : "Optional",
      },
    ],
    bullets: [
      "GitHub Pages deployment is wired through .github/workflows/deploy-pages.yml.",
      "Import templates are available for CSV, ICS, and JSON snapshots in public/templates.",
      currentProjectSync?.hasRemote
        ? "This repo has a git remote, so free Pages publishing is now a repo-side step."
        : "This repo still has no git remote, so free Pages deploy cannot be pushed from this machine yet.",
      generatedSources.projectSync.githubAuth?.loggedIn
        ? "GitHub CLI is authenticated on this machine."
        : "GitHub CLI is not authenticated on this machine.",
      generatedSources.apple.warnings?.length
        ? "Apple sync is built but this Mac still needs Calendar/Reminders Automation permission."
        : "Apple sync is ready to surface local Calendar and Reminders data when this Mac allows it.",
    ],
    action: currentProjectSync?.hasRemote
      ? syncConfig.gistId?.trim()
        ? "Publish through the repo workflow, and keep Gist sync only for cross-device continuity."
        : "Publish through the repo workflow, then add Gist sync only if you actually need cross-device continuity."
      : "Add a remote repository, then the included Pages workflow can publish this for free.",
    footer:
      "Cloudflare Pages can also host the same dist/ build for free, but it is not configured here because this repo has no linked account.",
  };
  const noteCoverageCount = areaOrder.filter((area) => areaNotes[area]?.trim()).length;
  const hasJournalSignal = Boolean(
    todayJournal.note?.trim() || todayJournal.wins?.trim() || todayJournal.friction?.trim()
  );
  const hasManualCommitment = customItems.length > 0;
  const hasHumanPlan = customItems.some(
    (item) => ["social", "love"].includes(item.area) && !(item.recurrence === "none" && item.done)
  );
  const hasImportedSource = Boolean(
    generatedSources.apple.items.length ||
      generatedSources.localScan.items.length ||
      folderScan?.items?.length ||
      syncConfig.gistId?.trim()
  );

  function countLabel(count, noun) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
  }

  const setupSteps = onboardingStepDefinitions.map((definition) => {
    let done = false;
    let status = "";

    if (definition.id === "profile_review") {
      done = setupState.profileReviewed;
      status = done
        ? "You marked the profile settings as reviewed."
        : "Review wake time, sleep target, gaming cutoff, and reminder lead.";
    } else if (definition.id === "first_commitment") {
      done = hasManualCommitment;
      status = done
        ? `${countLabel(customItems.length, "manual commitment")} already logged.`
        : "No manual commitments yet.";
    } else if (definition.id === "human_plan") {
      done = hasHumanPlan;
      status = done
        ? "At least one social or love commitment is already on the board."
        : "No social or love commitment is logged yet.";
    } else if (definition.id === "area_notes") {
      done = noteCoverageCount >= 3;
      status = done
        ? `${noteCoverageCount}/${areaOrder.length} area notes written.`
        : `${noteCoverageCount}/${areaOrder.length} area notes written. Aim for at least 3.`;
    } else if (definition.id === "journal_entry") {
      done = hasJournalSignal;
      status = done
        ? "Today's journal already has text."
        : "Today's journal is still blank.";
    } else if (definition.id === "import_source") {
      done = hasImportedSource;
      status = done
        ? "At least one import or sync path is already feeding this system."
        : "No import or sync source is connected yet.";
    }

    return {
      ...definition,
      done,
      status,
      href: buildPageSectionHref(pageContext.basePath, definition.pageId, definition.anchor),
    };
  });
  const completedSetupSteps = setupSteps.filter((step) => step.done).length;
  const remainingSetupSteps = setupSteps.length - completedSetupSteps;

  useEffect(() => {
    if (notificationPermission !== "granted") {
      return;
    }

    const dueSoon = timedOpenItems.filter((item) => {
      const dueAt = new Date(item.viewDueAt || item.dueAt).getTime();
      const diff = dueAt - now.getTime();
      return diff >= 0 && diff <= profile.notificationLeadMinutes * 60000;
    });

    if (dueSoon.length === 0) {
      return;
    }

    async function notify() {
      const registration =
        "serviceWorker" in navigator
          ? await navigator.serviceWorker.getRegistration()
          : null;

      for (const item of dueSoon) {
        const key = `${item.id}:${item.viewDueAt || item.dueAt}`;
        if (notifiedKeys.includes(key)) {
          continue;
        }

        const body = `${item.title} is due ${relativeWindow(item.viewDueAt || item.dueAt, now)}.`;
        if (registration?.showNotification) {
          await registration.showNotification("Life Console", {
            body,
            tag: key,
          });
        } else if (typeof Notification !== "undefined") {
          new Notification("Life Console", { body, tag: key });
        }

        setNotifiedKeys((current) => [...current, key]);
      }
    }

    notify();
  }, [notificationPermission, timedOpenItems, now, profile.notificationLeadMinutes, notifiedKeys]);

  function setFlash(tone, text) {
    setFlashMessage({ tone, text });
  }

  function toggleSetupStep(stepId) {
    if (stepId !== "profile_review") {
      return;
    }

    setSetupState((current) => ({
      ...current,
      profileReviewed: !current.profileReviewed,
    }));
  }

  function buildStarterDueAt(preset) {
    const base = new Date(now);

    if (preset === "tomorrow-morning") {
      const target = addDays(base, 1);
      target.setHours(10, 0, 0, 0);
      return target;
    }

    if (preset === "tomorrow-afternoon") {
      const target = addDays(base, 1);
      target.setHours(14, 0, 0, 0);
      return target;
    }

    if (preset === "tomorrow-evening") {
      const target = addDays(base, 1);
      target.setHours(19, 0, 0, 0);
      return target;
    }

    if (preset === "next-sunday-evening") {
      const target = new Date(base);
      const daysUntilSunday = (7 - target.getDay()) % 7 || 7;
      target.setDate(target.getDate() + daysUntilSunday);
      target.setHours(18, 0, 0, 0);
      return target;
    }

    return null;
  }

  function loadStarterTemplate(template) {
    const suggestedDueAt = buildStarterDueAt(template.duePreset);
    setDraft({
      title: template.title,
      area: template.area,
      dueAt: suggestedDueAt ? toDateTimeLocalValue(suggestedDueAt) : "",
      note: template.note,
      hard: template.hard,
      priority: template.priority,
      durationMinutes: template.durationMinutes,
      recurrence: template.recurrence,
      recurrenceInterval: template.recurrenceInterval,
    });

    document.getElementById("capture-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setFlash(areaDefinitions[template.area].tone, `Loaded ${template.label} into the capture form.`);
  }

  function handleDraftChange(event) {
    const { name, value, type, checked } = event.target;
    setDraft((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : name === "durationMinutes" || name === "recurrenceInterval"
            ? toPositiveNumber(value, current[name])
            : value,
    }));
  }

  function handleAddItem(event) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setFlash("alert", "Give the commitment a title before adding it.");
      return;
    }

    const nextItem = normalizeItem({
      id: createId("item"),
      title: draft.title.trim(),
      area: draft.area,
      dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : "",
      note: draft.note.trim(),
      hard: draft.hard,
      priority: draft.priority,
      durationMinutes: draft.durationMinutes,
      recurrence: draft.recurrence,
      recurrenceInterval: draft.recurrenceInterval,
      done: false,
      createdAt: new Date().toISOString(),
    });

    setCustomItems((current) => [nextItem, ...current]);
    setDraft({ ...defaultDraft, area: draft.area });
    setFlash(areaDefinitions[nextItem.area].tone, `Added ${nextItem.title}.`);
  }

  function handleItemDone(item) {
    setCustomItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? markItemDone(entry, item.viewDueAt || item.dueAt, now)
          : entry
      )
    );
  }

  function deleteItem(id) {
    setCustomItems((current) => current.filter((item) => item.id !== id));
  }

  function dismissItem(id) {
    setDismissedIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function restoreDismissed() {
    setDismissedIds([]);
  }

  function updateAreaNote(area, value) {
    setAreaNotes((current) => ({
      ...current,
      [area]: value,
    }));
  }

  function handleProfileChange(event) {
    const { name, value } = event.target;
    setProfile((current) =>
      normalizeProfile({
        ...current,
        [name]:
          [
            "latestReadyMinutes",
            "idealReadyMinutes",
            "sleepTargetHours",
            "windDownMinutes",
            "focusBlockMinutes",
            "notificationLeadMinutes",
          ].includes(name)
            ? toPositiveNumber(value, current[name])
            : value,
      })
    );
  }

  function handleEssentialsChange(event) {
    const { name, value } = event.target;

    if (name === "morningBufferMinutes") {
      const nextBuffer = toPositiveNumber(value, profile.idealReadyMinutes);
      setProfile((current) =>
        normalizeProfile({
          ...current,
          idealReadyMinutes: nextBuffer,
          latestReadyMinutes: deriveLatestReadyMinutes(nextBuffer),
        })
      );
      return;
    }

    setProfile((current) =>
      normalizeProfile({
        ...current,
        [name]:
          name === "sleepTargetHours" ? toPositiveNumber(value, current[name]) : value,
      })
    );
  }

  function handleSetupDraftChange(event) {
    const { name, value, type, checked } = event.target;
    setSetupDraft((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : ["morningBufferMinutes", "sleepTargetHours"].includes(name)
            ? toPositiveNumber(value, current[name])
            : value,
    }));
  }

  function selectSystemsPane(nextPaneId) {
    setSystemsPane(nextPaneId);

    if (typeof window === "undefined" || pageContext.pageId !== "systems") {
      return;
    }

    const pane = SYSTEMS_PANE_DEFINITIONS.find((entry) => entry.id === nextPaneId);

    if (!pane) {
      return;
    }

    window.history.replaceState(
      null,
      "",
      buildPageSectionHref(pageContext.basePath, "systems", pane.sectionId)
    );

    window.requestAnimationFrame(() => {
      document.getElementById(pane.sectionId)?.scrollIntoView({ block: "start" });
    });
  }

  function handleSetupSubmit(event) {
    event.preventDefault();
    const shouldRedirect = pageContext.pageId === "setup";

    const morningBufferMinutes = toPositiveNumber(
      setupDraft.morningBufferMinutes,
      profile.idealReadyMinutes
    );

    const nextProfile = normalizeProfile({
      ...profile,
      displayName: setupDraft.displayName,
      bankBalance: setupDraft.bankBalance,
      creditCardOwed: setupDraft.creditCardOwed,
      dinnerPreference: setupDraft.dinnerPreference,
      wakeTime: setupDraft.wakeTime,
      latestReadyMinutes: deriveLatestReadyMinutes(morningBufferMinutes),
      idealReadyMinutes: morningBufferMinutes,
      sleepTargetHours: setupDraft.sleepTargetHours,
    });

    let nextCustomItems = customItems;
    const firstTitle = setupDraft.firstCommitmentTitle.trim();
    const firstDueAt = setupDraft.firstCommitmentDueAt
      ? new Date(setupDraft.firstCommitmentDueAt).toISOString()
      : "";

    if (firstTitle) {
      const duplicate = customItems.some(
        (item) =>
          item.title.toLowerCase() === firstTitle.toLowerCase() &&
          item.area === setupDraft.firstCommitmentArea &&
          (item.dueAt || "") === firstDueAt
      );

      if (!duplicate) {
        const nextItem = normalizeItem({
          id: createId("setup"),
          title: firstTitle,
          area: setupDraft.firstCommitmentArea,
          dueAt: firstDueAt,
          note: setupDraft.firstCommitmentNote.trim(),
          hard: setupDraft.firstCommitmentHard,
          priority: "high",
          done: false,
          createdAt: new Date().toISOString(),
        });
        nextCustomItems = [nextItem, ...customItems];
      }
    }

    const nextSetupState = normalizeSetupState({
      ...setupState,
      profileReviewed: true,
    });

    setProfile(nextProfile);
    setCustomItems(nextCustomItems);
    setSetupState(nextSetupState);
    setSetupDraft(buildSetupDraft(nextProfile));
    setFlash("steady", shouldRedirect ? "Setup saved." : "Account saved.");

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(nextProfile));
      window.localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(nextCustomItems));
      window.localStorage.setItem(STORAGE_KEYS.setup, JSON.stringify(nextSetupState));
      if (shouldRedirect) {
        window.location.assign(buildPageHref(pageContext.basePath, "dashboard"));
      }
    }
  }

  function toggleRoutine(template) {
    const key = getRoutineStateKey(template, now);
    setRoutineState((current) => {
      if (current[key]) {
        const next = { ...current };
        delete next[key];
        return next;
      }

      return {
        ...current,
        [key]: new Date().toISOString(),
      };
    });
  }

  function updateJournalField(name, value) {
    setJournalEntries((current) => ({
      ...current,
      [todayKey]: {
        ...normalizeJournalEntry(current[todayKey]),
        [name]: value,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  async function requestNotifications() {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }

    const result = await Notification.requestPermission();
    setNotificationPermission(result);
    setFlash(
      result === "granted" ? "steady" : "warm",
      result === "granted"
        ? "Notifications enabled for due-soon items while this app is installed or open."
        : "Notification permission not granted."
    );
  }

  async function promptInstall() {
    if (!installPromptEvent) {
      setFlash("warm", "Install prompt is not currently available in this browser.");
      return;
    }

    await installPromptEvent.prompt();
    setInstallPromptEvent(null);
  }

  function exportSnapshot() {
    const payload = buildSnapshotPayload({
      profile,
      customItems,
      areaNotes,
      principles,
      routineState,
      dismissedIds,
      journalEntries,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `life-console-${getLocalDateKey(new Date())}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    setFlash("steady", "Exported a local snapshot.");
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const result = await importItemsFromFile(file);
      if (result.kind === "snapshot") {
        const snapshot = result.snapshot;
        setProfile(normalizeProfile(snapshot.profile));
        setCustomItems(normalizeItems(snapshot.customItems || []));
        setAreaNotes(normalizeAreaNotes(snapshot.areaNotes || {}));
        setPrinciples(normalizePrinciples(snapshot.principles));
        setRoutineState(normalizeRoutineState(snapshot.routineState || {}));
        setDismissedIds(
          normalizeDismissedIds(snapshot.dismissedVerifiedIds || snapshot.dismissedIds)
        );
        setJournalEntries(normalizeJournalEntries(snapshot.journalEntries || {}));
        setFlash("steady", `Imported snapshot from ${file.name}.`);
      } else {
        const imported = normalizeItems(result.items || []);
        setCustomItems((current) => mergeImportedItems(current, imported));
        setFlash("steady", `Imported ${imported.length} item(s) from ${file.name}.`);
      }
    } catch (error) {
      setFlash("alert", `Import failed: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  async function runFolderScan() {
    try {
      const result = await scanSelectedDirectory({
        pickerId: `life-console-${selectedScanPreset.id}`,
        label: selectedScanPreset.label,
        startIn: selectedScanPreset.startIn,
        maxDepth: selectedScanPreset.maxDepth,
        maxFiles: selectedScanPreset.maxFiles,
        limitPerFile: selectedScanPreset.limitPerFile,
      });
      setFolderScan(result);
      setFlash(
        "steady",
        `Scanned ${result.filesScanned} file(s) in ${result.directoryName} using ${selectedScanPreset.label}.`
      );
    } catch (error) {
      setFlash("alert", error.message);
    }
  }

  function importScannedItems() {
    if (!folderScan?.items?.length) {
      return;
    }

    setCustomItems((current) => mergeImportedItems(current, folderScan.items));
    setFlash("steady", `Imported ${folderScan.items.length} candidate item(s) from the scanned folder.`);
    setFolderScan(null);
  }

  async function pushCloudSync() {
    setIsCloudLoading(true);
    setCloudStatus(null);
    try {
      const payload = buildSnapshotPayload({
        profile,
        customItems,
        areaNotes,
        principles,
        routineState,
        dismissedIds,
        journalEntries,
      });
      const result = await pushSnapshotToGithubGist(syncConfig, payload);
      setSyncConfig((current) =>
        normalizeSyncConfig({
          ...current,
          gistId: result.gistId,
        })
      );
      setCloudStatus({
        tone: "steady",
        text: `Pushed snapshot to Gist ${result.gistId}.`,
      });
    } catch (error) {
      setCloudStatus({
        tone: "alert",
        text: `Cloud push failed: ${error.message}`,
      });
    } finally {
      setIsCloudLoading(false);
    }
  }

  async function pullCloudSync() {
    setIsCloudLoading(true);
    setCloudStatus(null);
    try {
      const snapshot = await pullSnapshotFromGithubGist(syncConfig);
      setProfile(normalizeProfile(snapshot.profile));
      setCustomItems(normalizeItems(snapshot.customItems || []));
      setAreaNotes(normalizeAreaNotes(snapshot.areaNotes || {}));
      setPrinciples(normalizePrinciples(snapshot.principles));
      setRoutineState(normalizeRoutineState(snapshot.routineState || {}));
      setDismissedIds(
        normalizeDismissedIds(snapshot.dismissedVerifiedIds || snapshot.dismissedIds)
      );
      setJournalEntries(normalizeJournalEntries(snapshot.journalEntries || {}));
      setCloudStatus({
        tone: "steady",
        text: `Pulled snapshot from Gist ${syncConfig.gistId}.`,
      });
    } catch (error) {
      setCloudStatus({
        tone: "alert",
        text: `Cloud pull failed: ${error.message}`,
      });
    } finally {
      setIsCloudLoading(false);
    }
  }

  function resetLocalData() {
    const confirmed = window.confirm(
      "Reset local dashboard data? This clears custom items, notes, journal entries, routines, sync config, and imported state."
    );

    if (!confirmed) {
      return;
    }

    setCustomItems([]);
    setAreaNotes(defaultAreaNotes);
    setProfile(defaultProfileWithAutomation);
    setPrinciples(defaultPrinciples);
    setRoutineState({});
    setDismissedIds([]);
    setJournalEntries({});
    setSyncConfig(defaultSyncConfig);
    setSetupState(normalizeSetupState({}));
    setFolderScan(null);
    setFlash("warm", "Local dashboard data reset.");
  }

  const appleStatusTone =
    generatedSources.apple.items?.length > 0 ? "steady" : generatedSources.apple.warnings?.length ? "warm" : "missing";
  const localScanStatusTone =
    generatedSources.localScan.items?.length > 0 ? "future" : generatedSources.localScan.warnings?.length ? "warm" : "missing";
  const projectSyncStatusTone =
    generatedSources.projectSync.projects?.length > 0
      ? "steady"
      : generatedSources.projectSync.warnings?.length
        ? "warm"
        : "missing";
  const nextTimedItem = timedOpenItems[0] || null;
  const wakePlanCopy = buildWakePlanCopy(sleepModel, snapshotInfo.locale);
  const academicOpenItems = openItems.filter((item) => item.area === "academic");
  const workOpenItems = openItems.filter((item) => item.area === "work");
  const socialOpenItems = openItems.filter((item) => ["social", "love"].includes(item.area));
  const nextAcademicItem = academicOpenItems[0] || null;
  const nextWorkItem = workOpenItems[0] || null;
  const nextSocialItem = socialOpenItems[0] || null;
  const savedBalance = profile.bankBalance?.trim() || "";
  const savedCardDebt = profile.creditCardOwed?.trim() || "";
  const savedDinnerPreference = profile.dinnerPreference?.trim() || "";
  const formattedBalance = formatMoneyValue(savedBalance, snapshotInfo.locale);
  const formattedCardDebt = formatMoneyValue(savedCardDebt, snapshotInfo.locale);

  function buildBubbleTimeLabel(item) {
    if (!item) {
      return "Clear";
    }

    const value = item.viewDueAt || item.dueAt;
    const diff = new Date(value).getTime() - now.getTime();
    return diff >= 0 && diff <= 72 * 3600000
      ? relativeWindow(value, now)
      : formatShortDate(value, snapshotInfo.locale);
  }

  function truncateLabel(value, fallback) {
    const text = String(value || "").trim();
    if (!text) {
      return fallback;
    }

    return text.length > 26 ? `${text.slice(0, 25)}…` : text;
  }

  const dashboardBubbles = [
    {
      id: "balance",
      label: "Balance",
      value: formattedBalance || "Set",
      meta: formattedCardDebt
        ? `Card ${formattedCardDebt}`
        : formattedBalance
          ? "Manual"
          : "Add in Account",
      tone: savedBalance ? "steady" : "missing",
      detailTitle: formattedBalance || "Balance not set",
      detailBody: savedBalance ? "Tracked in Hub." : "Add it in Hub.",
      facts: [
        { label: "Bank", value: formattedBalance || "Missing" },
        { label: "Card owed", value: formattedCardDebt || "Missing" },
      ],
      actions: [
        {
          pageId: "account",
          href: buildPageHref(pageContext.basePath, "account"),
          label: "Account",
        },
      ],
    },
    {
      id: "academic",
      label: "Academic",
      value: nextAcademicItem ? buildBubbleTimeLabel(nextAcademicItem) : "Clear",
      meta: nextAcademicItem ? truncateLabel(nextAcademicItem.title, "Open") : "No open item",
      tone: nextAcademicItem?.hard ? "alert" : "steady",
      detailTitle: nextAcademicItem ? nextAcademicItem.title : "Academic clear",
      detailBody: nextAcademicItem
        ? formatDateTime(nextAcademicItem.viewDueAt || nextAcademicItem.dueAt, snapshotInfo.locale)
        : "No open academic item.",
      facts: [
        { label: "Open", value: String(academicOpenItems.length) },
        { label: "Next", value: nextAcademicItem ? buildBubbleTimeLabel(nextAcademicItem) : "None" },
      ],
      actions: [
        { pageId: "today", label: "Today" },
        { pageId: "commitments", label: "Board", className: "button-like ghost" },
      ],
    },
    {
      id: "work",
      label: "Work",
      value: truncateLabel(nextWorkItem?.title || leadProjectTrack?.name, "Quiet"),
      meta: nextWorkItem
        ? buildBubbleTimeLabel(nextWorkItem)
        : leadProjectTrack?.status || "No open item",
      tone: nextWorkItem ? "steady" : "warm",
      detailTitle: nextWorkItem?.title || leadProjectTrack?.name || "Work quiet",
      detailBody: nextWorkItem
        ? formatDateTime(nextWorkItem.viewDueAt || nextWorkItem.dueAt, snapshotInfo.locale)
        : leadProjectTrack?.next || "No open work item.",
      facts: [
        { label: "Open", value: String(workOpenItems.length) },
        { label: "Project", value: leadProjectTrack?.name || "None" },
      ],
      actions: [
        { pageId: "projects", label: "Projects" },
        { pageId: "commitments", label: "Board", className: "button-like ghost" },
      ],
    },
    {
      id: "social",
      label: "Social",
      value: nextSocialItem ? buildBubbleTimeLabel(nextSocialItem) : "Quiet",
      meta: nextSocialItem
        ? truncateLabel(nextSocialItem.title, "Plan")
        : truncateLabel(savedDinnerPreference || areaNotes.social || areaNotes.love, "No plan logged"),
      tone: nextSocialItem ? "future" : "warm",
      detailTitle: nextSocialItem
        ? nextSocialItem.title
        : truncateLabel(savedDinnerPreference || areaNotes.social || areaNotes.love, "No social plan"),
      detailBody: nextSocialItem
        ? formatDateTime(nextSocialItem.viewDueAt || nextSocialItem.dueAt, snapshotInfo.locale)
        : savedDinnerPreference ||
          areaNotes.social ||
          areaNotes.love ||
          "No social or love plan is logged right now.",
      facts: [
        { label: "Plans", value: String(socialOpenItems.length) },
        { label: "Dinner", value: savedDinnerPreference || "Missing" },
      ],
      actions: [
        { pageId: "areas", label: "Areas" },
        {
          pageId: "account",
          href: buildPageHref(pageContext.basePath, "account"),
          label: "Account",
          className: "button-like ghost",
        },
      ],
    },
    {
      id: "sleep",
      label: "Sleep",
      value: formatTimeOnly(sleepModel.recommendedSleepAt, snapshotInfo.locale),
      meta: wakePlanCopy.label,
      tone: sleepModel.pastRecommendedSleep ? "alert" : "steady",
      detailTitle: formatTimeOnly(sleepModel.recommendedSleepAt, snapshotInfo.locale),
      detailBody: `Wake ${wakePlanCopy.label}. Wind down ${formatTimeOnly(
        sleepModel.windDownAt,
        snapshotInfo.locale
      )}.`,
      facts: [
        { label: "Wake", value: wakePlanCopy.label },
        { label: "Wind down", value: formatTimeOnly(sleepModel.windDownAt, snapshotInfo.locale) },
      ],
      actions: [
        { pageId: "today", label: "Today" },
        {
          pageId: "account",
          href: buildPageHref(pageContext.basePath, "account"),
          label: "Account",
          className: "button-like ghost",
        },
      ],
    },
  ];
  const activeDashboardBubble =
    dashboardBubbles.find((bubble) => bubble.id === activeDashboardBubbleId) || null;
  const activeSystemsPane =
    SYSTEMS_PANE_DEFINITIONS.find((pane) => pane.id === systemsPane) ||
    SYSTEMS_PANE_DEFINITIONS[0];

  function buildNavAction(pageId, label, className = "button-like") {
    return (
      <a
        key={`${pageId}-${label}`}
        className={className}
        href={buildPageHref(pageContext.basePath, pageId)}
      >
        {label}
      </a>
    );
  }

  const dashboardBubbleSection = (
    <section className="dashboard-stage reveal">
      <div className="bubble-board" aria-label="Dashboard bubbles">
        {dashboardBubbles.map((bubble) => (
          <DashboardBubbleButton
            key={bubble.id}
            bubble={bubble}
            active={activeDashboardBubble?.id === bubble.id}
            onToggle={(id) =>
              setActiveDashboardBubbleId((current) => (current === id ? null : id))
            }
          />
        ))}
      </div>
      <DashboardBubbleDetail bubble={activeDashboardBubble} basePath={pageContext.basePath} />
    </section>
  );

  const todaySummarySection = (
    <section className="hero panel reveal focus-hero">
      <div className="hero-copy">
        <p className="eyebrow">Today</p>
        <h1>{heroVerdict.title}</h1>
        <p className="hero-text">{heroVerdict.summary}</p>
        <ul className="bullet-list">
          {heroVerdict.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <p className="move-line">
          <strong>Move:</strong> {heroVerdict.move}
        </p>
      </div>

      <div className="hero-status">
        <p className={`review-move tone-${heroVerdict.tone}`}>
          <strong>Daily move:</strong> {dailyReview.action}
        </p>
        <div className="hero-meta-grid">
          <div className="meta-card">
            <span className="meta-label">Wake plan</span>
            <strong>{wakePlanCopy.label}</strong>
            <p>{wakePlanCopy.detail}</p>
          </div>
          <div className="meta-card">
            <span className="meta-label">Next timed item</span>
            <strong>{nextTimedItem ? nextTimedItem.title : "Nothing timed yet"}</strong>
            <p>
              {nextTimedItem
                ? formatDateTime(nextTimedItem.viewDueAt || nextTimedItem.dueAt, snapshotInfo.locale)
                : "Add or import the next real commitment."}
            </p>
          </div>
          <div className="meta-card">
            <span className="meta-label">Target sleep</span>
            <strong>{formatTimeOnly(sleepModel.recommendedSleepAt, snapshotInfo.locale)}</strong>
            <p>Wind down by {formatTimeOnly(sleepModel.windDownAt, snapshotInfo.locale)}</p>
          </div>
          <div className="meta-card">
            <span className="meta-label">Human plans 72h</span>
            <strong>{next72HumanItems.length}</strong>
            <p>{next72HumanItems.length > 0 ? next72HumanItems[0].title : "No personal plan logged yet."}</p>
          </div>
        </div>
      </div>
    </section>
  );

  const isSetupPage = pageContext.pageId === "setup";
  const accountHeadline = isSetupPage
    ? "Set up your account."
    : setupDraft.displayName?.trim() || "Account";
  const accountSupport = isSetupPage
    ? "Add the basics. Change the rest later."
    : "Your personal defaults and quick-reference data.";
  const accountPrimaryLabel = isSetupPage ? "Continue" : "Save changes";
  const accountSecondaryLabel = isSetupPage ? "Skip for now" : "Open dashboard";
  const accountSecondaryHref = isSetupPage
    ? buildPageHref(pageContext.basePath, "dashboard")
    : buildPageHref(pageContext.basePath, "dashboard");

  const accountFormPanel = (
    <form className="panel setup-form-card account-form-card" onSubmit={handleSetupSubmit}>
      <div className="panel-pad setup-form-stack">
        <section className="account-hero">
          <div className="setup-copy account-copy">
            <p className="eyebrow">{isSetupPage ? "Setup" : "Account"}</p>
            <h1>{accountHeadline}</h1>
            <p className="setup-support">{accountSupport}</p>
          </div>
          <div className="account-status-row">
            <span className="source-pill">
              {setupState.profileReviewed ? "Saved" : "New"}
            </span>
            <span className="source-pill">Local</span>
            <span className="source-pill">Editable</span>
          </div>
        </section>

        <section className="setup-section-block">
          <p className="setup-section-label">Profile</p>
          <div className="form-row">
            <label className="field-label">
              Name
              <input
                type="text"
                name="displayName"
                value={setupDraft.displayName}
                onChange={handleSetupDraftChange}
                placeholder="Name"
              />
            </label>
            <label className="field-label">
              Wake time
              <input
                type="time"
                name="wakeTime"
                value={setupDraft.wakeTime}
                onChange={handleSetupDraftChange}
              />
            </label>
          </div>
          <div className="form-row">
            <label className="field-label">
              Buffer before plans
              <input
                type="number"
                min="0"
                name="morningBufferMinutes"
                value={setupDraft.morningBufferMinutes}
                onChange={handleSetupDraftChange}
              />
            </label>
            <label className="field-label">
              Sleep hours
              <input
                type="number"
                min="1"
                name="sleepTargetHours"
                value={setupDraft.sleepTargetHours}
                onChange={handleSetupDraftChange}
              />
            </label>
          </div>
        </section>

        <section className="setup-section-block">
          <p className="setup-section-label">Money</p>
          <div className="form-row">
            <label className="field-label">
              Bank balance
              <input
                type="text"
                name="bankBalance"
                value={setupDraft.bankBalance}
                onChange={handleSetupDraftChange}
                placeholder="$0"
              />
            </label>
            <label className="field-label">
              Credit card owed
              <input
                type="text"
                name="creditCardOwed"
                value={setupDraft.creditCardOwed}
                onChange={handleSetupDraftChange}
                placeholder="$0"
              />
            </label>
          </div>
        </section>

        <section className="setup-section-block">
          <p className="setup-section-label">Social</p>
          <label className="field-label">
            Dinner she likes
            <input
              type="text"
              name="dinnerPreference"
              value={setupDraft.dinnerPreference}
              onChange={handleSetupDraftChange}
              placeholder="Sushi, ramen, pasta"
            />
          </label>
        </section>

        <section className="setup-section-block">
          <p className="setup-section-label">Next thing</p>
          <label className="field-label">
            Title
            <input
              type="text"
              name="firstCommitmentTitle"
              value={setupDraft.firstCommitmentTitle}
              onChange={handleSetupDraftChange}
              placeholder="Class, date, assignment"
            />
          </label>
          <div className="form-row">
            <label className="field-label">
              When
              <input
                type="datetime-local"
                name="firstCommitmentDueAt"
                value={setupDraft.firstCommitmentDueAt}
                onChange={handleSetupDraftChange}
              />
            </label>
            <label className="field-label">
              Kind
              <select
                name="firstCommitmentArea"
                value={setupDraft.firstCommitmentArea}
                onChange={handleSetupDraftChange}
              >
                {SETUP_AREA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <div className="tool-row setup-actions">
          <button type="submit">{accountPrimaryLabel}</button>
          <a className="mini-text-button" href={accountSecondaryHref}>
            {accountSecondaryLabel}
          </a>
        </div>
      </div>
    </form>
  );

  const setupPageSection = (
    <section className="setup-shell reveal">
      {accountFormPanel}
    </section>
  );

  const accountPageSection = (
    <section className="setup-shell reveal">
      {accountFormPanel}
    </section>
  );

  const setupGuidePanel = (
    <article className="panel reveal" id="setup-guide-panel">
      <SectionHeading
        eyebrow="Start here"
        title="Put your real life into the board"
        copy="This checklist is the shortest path from a cool shell to something you can trust when you are tired, confused, or deciding what to do next."
      />
      <div className="panel-pad">
        <div className="setup-banner">
          <div>
            <span className="meta-label">Setup progress</span>
            <strong>
              {completedSetupSteps}/{setupSteps.length}
            </strong>
            <p>
              {remainingSetupSteps === 0
                ? "The board has enough personal context to be genuinely useful."
                : `${countLabel(remainingSetupSteps, "step")} still matter most.`}
            </p>
          </div>
          <a className="button-like ghost" href={buildPageHref(pageContext.basePath, "systems")}>
            Open systems
          </a>
        </div>
        <div className="setup-grid">
          {setupSteps.map((step) => (
            <SetupStepCard key={step.id} step={step} onToggleManual={toggleSetupStep} />
          ))}
        </div>
      </div>
    </article>
  );

  const intakeGuidePanel = (
    <article className="panel reveal" id="intake-guide-panel">
      <SectionHeading
        eyebrow="How to fill this"
        title="Three ways to get your information in"
        copy="Manual capture is for private or fuzzy things. Imports and sync are for anything that already exists somewhere else."
      />
      <div className="panel-pad guide-grid">
        {intakeGuide.map((entry) => (
          <article key={entry.id} className="guide-card">
            <span className="source-pill">{entry.title}</span>
            <p>{entry.detail}</p>
          </article>
        ))}
      </div>
    </article>
  );

  const scenarioPanel = (
    <article className="panel reveal">
      <SectionHeading
        eyebrow="Scenario mode"
        title="Ask the board a specific question"
        copy="Pick the kind of doubt you are having. The engine answers from deadlines, sleep settings, and logged human plans."
      />
      <div className="panel-pad">
        <label className="field-label">
          Scenario
          <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
            {scenarioDefinitions.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.title}
              </option>
            ))}
          </select>
        </label>
        <p className="scenario-description">
          {scenarioDefinitions.find((scenario) => scenario.id === scenarioId)?.description}
        </p>
        <div className={`scenario-result tone-${scenarioDecision.tone}`}>
          <h3>{scenarioDecision.title}</h3>
          <p>{scenarioDecision.summary}</p>
          <ul className="bullet-list">
            {scenarioDecision.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <p className="move-line">
            <strong>Move:</strong> {scenarioDecision.move}
          </p>
        </div>
      </div>
    </article>
  );

  const actionStackPanel = (
    <article className="panel reveal">
      <SectionHeading
        eyebrow="Action stack"
        title="Three moves that matter"
        copy="The compressed answer when you do not want to read the whole board."
      />
      <div className="stack-list">
        {actionStack.map((action) => (
          <article key={`${action.label}-${action.title}`} className={`stack-card tone-${action.tone}`}>
            <span className="source-pill">{action.label}</span>
            <h3>{action.title}</h3>
            <p>{action.body}</p>
          </article>
        ))}
      </div>
    </article>
  );

  const tomorrowPanel = (
    <article className="panel reveal">
      <SectionHeading
        eyebrow="Tomorrow radar"
        title="What the next day already contains"
        copy="A fast read on tomorrow plus anything already overdue."
      />
      <div className="panel-pad">
        <div className="radar-meta">
          <div>
            <span className="meta-label">Ideal wake</span>
            <strong>{formatTimeOnly(sleepModel.upcomingWake, snapshotInfo.locale)}</strong>
          </div>
          <div>
            <span className="meta-label">Overdue</span>
            <strong>{pastDueItems.length}</strong>
          </div>
          <div>
            <span className="meta-label">Notify lead</span>
            <strong>{profile.notificationLeadMinutes}m</strong>
          </div>
        </div>
        <div className="item-list compact">
          {(tomorrowItems.length > 0 ? tomorrowItems : next24Items).slice(0, 4).map((item) => (
            <article key={item.occurrenceKey} className={`item-card tone-${getUrgencyTone(item, now)}`}>
              <div className="item-header">
                <span className={`area-pill area-${item.area}`}>
                  {areaDefinitions[item.area].label}
                </span>
                <span className="source-pill">{item.sourceType}</span>
              </div>
              <h3>{item.title}</h3>
              <p className="item-time">
                {formatDateTime(item.viewDueAt || item.dueAt, snapshotInfo.locale)}
              </p>
            </article>
          ))}
          {tomorrowItems.length === 0 && next24Items.length === 0 ? (
            <p className="empty-state">
              Nothing timed in the next 24 hours. That is either breathing room or missing data.
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );

  const calendarPanel = (
    <article className="panel reveal">
      <SectionHeading
        eyebrow="Calendar"
        title="Week and month views"
        copy="Recurring items render here too, so the board can finally show pattern, not just the next reminder."
      />
      <div className="panel-pad">
        <div className="calendar-toolbar">
          <div className="filter-chips">
            <button
              type="button"
              className={`filter-chip ${calendarView === "week" ? "is-active" : ""}`}
              onClick={() => setCalendarView("week")}
            >
              Week
            </button>
            <button
              type="button"
              className={`filter-chip ${calendarView === "month" ? "is-active" : ""}`}
              onClick={() => setCalendarView("month")}
            >
              Month
            </button>
          </div>
          <div className="calendar-nav">
            <button
              type="button"
              className="ghost"
              onClick={() =>
                setCalendarCursor((current) =>
                  calendarView === "week" ? addDays(current, -7) : addDays(current, -30)
                )
              }
            >
              Back
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setCalendarCursor(new Date())}
            >
              Today
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                setCalendarCursor((current) =>
                  calendarView === "week" ? addDays(current, 7) : addDays(current, 30)
                )
              }
            >
              Next
            </button>
          </div>
        </div>
        <div className="calendar-scroll">
          <div className={`calendar-grid ${calendarView}`}>
            {calendarDays.map((day) => (
              <CalendarDay
                key={day.toISOString()}
                day={day}
                items={calendarItemMap[getLocalDateKey(day)] || []}
                cursorMonth={calendarCursor.getMonth()}
                locale={snapshotInfo.locale}
                onToday={() => setCalendarCursor(new Date())}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  );

  const searchPanel = (
    <article className="panel reveal">
      <SectionHeading
        eyebrow="Search"
        title="Find notes, rules, commitments, and journal fragments"
        copy="The board gets more useful as the text inside it becomes searchable."
      />
      <div className="panel-pad">
        <label className="field-label">
          Search everything
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="assignment, dinner, future, Vordrak, sleep"
          />
        </label>
        <div className="search-results">
          {searchQuery.trim() ? (
            searchResults.length > 0 ? (
              searchResults.map((result) => (
                <article key={result.id} className="search-card">
                  <span className="source-pill">{result.type}</span>
                  <h3>{result.title}</h3>
                  <p>{result.detail}</p>
                </article>
              ))
            ) : (
              <p className="empty-state">No results for that query yet.</p>
            )
          ) : (
            <p className="empty-state">Search stays empty until you ask for something.</p>
          )}
        </div>
      </div>
    </article>
  );

  const commitmentsPanel = (
    <article className="panel reveal">
      <SectionHeading
        eyebrow="Commitments"
        title="Open board"
        copy="One-off items, recurring commitments, Apple imports, local scan candidates, and verified course data all meet here."
      />
      <div className="toolbar">
        <div className="filter-chips">
          <button
            type="button"
            className={`filter-chip ${filterArea === "all" ? "is-active" : ""}`}
            onClick={() => setFilterArea("all")}
          >
            All
          </button>
          {areaOrder.map((area) => (
            <button
              key={area}
              type="button"
              className={`filter-chip ${filterArea === area ? "is-active" : ""}`}
              onClick={() => setFilterArea(area)}
            >
              {areaDefinitions[area].label}
            </button>
          ))}
        </div>
        {dismissedIds.length > 0 ? (
          <button type="button" className="text-button" onClick={restoreDismissed}>
            Restore hidden items ({dismissedIds.length})
          </button>
        ) : null}
      </div>
      <div className="item-list">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <article key={item.occurrenceKey} className={`item-card tone-${getUrgencyTone(item, now)}`}>
              <div className="item-header">
                <div className="pill-row">
                  <span className={`area-pill area-${item.area}`}>
                    {areaDefinitions[item.area].label}
                  </span>
                  <span className="source-pill">{item.sourceType}</span>
                  {item.hard ? <span className="source-pill hard-pill">Hard</span> : null}
                  {item.isRecurring ? (
                    <span className="source-pill recurring-pill">
                      {item.recurrence} x{item.recurrenceInterval}
                    </span>
                  ) : null}
                </div>
                <span className="priority-badge">{item.priority}</span>
              </div>
              <h3>{item.title}</h3>
              <div className="item-meta-row">
                <span className="item-time">
                  {item.viewDueAt || item.dueAt
                    ? formatDateTime(item.viewDueAt || item.dueAt, snapshotInfo.locale)
                    : "No date"}
                </span>
                <span className="item-time">{formatDuration(item.durationMinutes)}</span>
              </div>
              <p>{item.note || "No note saved."}</p>
              <div className="card-actions">
                {item.sourceType === "local" ? (
                  <>
                    <button type="button" onClick={() => handleItemDone(item)}>
                      {item.isRecurring ? "Log done" : "Done"}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => deleteItem(item.id)}
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <button type="button" className="ghost" onClick={() => dismissItem(item.id)}>
                    Hide
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">
            Nothing visible in this filter. Either the board is light or you already hid the synced items.
          </p>
        )}
      </div>

      <div className="archive-block">
        <div className="inline-heading">
          <h3>Recent completions</h3>
          <span>{archivedLocalItems.length + recurringHistory.length}</span>
        </div>
        <div className="archive-list">
          {archivedLocalItems.slice(0, 5).map((item) => (
            <article key={item.id} className="archive-card">
              <div>
                <strong>{item.title}</strong>
                <p>
                  {areaDefinitions[item.area].label} -{" "}
                  {formatDateTime(item.completedAt || item.createdAt, snapshotInfo.locale)}
                </p>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  setCustomItems((current) =>
                    current.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, done: false, completedAt: "" }
                        : entry
                    )
                  )
                }
              >
                Restore
              </button>
            </article>
          ))}
          {recurringHistory.map((entry) => (
            <article key={entry.id} className="archive-card recurring-history">
              <div>
                <strong>{entry.title}</strong>
                <p>
                  {areaDefinitions[entry.area].label} repeat -{" "}
                  {formatDateTime(entry.dueAt, snapshotInfo.locale)}
                </p>
              </div>
            </article>
          ))}
          {archivedLocalItems.length === 0 && recurringHistory.length === 0 ? (
            <p className="empty-state">No completion history yet.</p>
          ) : null}
        </div>
      </div>
    </article>
  );

  const capturePanel = (
    <article className="panel reveal" id="capture-panel">
      <SectionHeading
        eyebrow="Capture"
        title="Add a new commitment"
        copy="This is how unsynced parts of life become visible to the engine."
      />
      <form className="commitment-form" onSubmit={handleAddItem}>
        <label className="field-label">
          Title
          <input
            name="title"
            type="text"
            value={draft.title}
            onChange={handleDraftChange}
            placeholder="Dinner tomorrow, pay fee, text back, ship feature"
          />
        </label>
        <div className="form-row">
          <label className="field-label">
            Area
            <select name="area" value={draft.area} onChange={handleDraftChange}>
              {areaOrder.map((area) => (
                <option key={area} value={area}>
                  {areaDefinitions[area].label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Due
            <input
              name="dueAt"
              type="datetime-local"
              value={draft.dueAt}
              onChange={handleDraftChange}
            />
          </label>
        </div>
        <div className="form-row quad">
          <label className="field-label">
            Priority
            <select name="priority" value={draft.priority} onChange={handleDraftChange}>
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Minutes
            <input
              name="durationMinutes"
              type="number"
              min="5"
              step="5"
              value={draft.durationMinutes}
              onChange={handleDraftChange}
            />
          </label>
          <label className="field-label">
            Repeat
            <select name="recurrence" value={draft.recurrence} onChange={handleDraftChange}>
              {recurrenceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Every
            <input
              name="recurrenceInterval"
              type="number"
              min="1"
              step="1"
              value={draft.recurrenceInterval}
              onChange={handleDraftChange}
            />
          </label>
        </div>
        <label className="field-label checkbox-field">
          <span>Hard stop</span>
          <input
            name="hard"
            type="checkbox"
            checked={draft.hard}
            onChange={handleDraftChange}
          />
        </label>
        <label className="field-label">
          Note
          <textarea
            name="note"
            rows="4"
            value={draft.note}
            onChange={handleDraftChange}
            placeholder="Anything future-you should remember when this resurfaces."
          />
        </label>
        <button type="submit">Add commitment</button>
      </form>
    </article>
  );

  const starterTemplatesPanel = (
    <article className="panel reveal">
      <SectionHeading
        eyebrow="Starter templates"
        title="Load a real-life pattern, then edit it"
        copy="These do not guess your private information. They just prefill the structure so you can type less."
      />
      <div className="panel-pad starter-grid">
        {starterCommitmentTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="starter-card"
            onClick={() => loadStarterTemplate(template)}
          >
            <span className={`area-pill area-${template.area}`}>
              {areaDefinitions[template.area].label}
            </span>
            <strong>{template.label}</strong>
            <p>{template.note}</p>
          </button>
        ))}
      </div>
    </article>
  );

  const routinesPanel = (
    <article className="panel reveal">
      <SectionHeading
        eyebrow="Routines"
        title="Checklists that reset themselves"
        copy="Daily items reset by date. Weekly items reset by week."
      />
      <div className="routine-groups">
        {["Tonight", "Morning", "Weekly"].map((period) => {
          const templates = routineTemplates.filter((template) => template.period === period);
          const doneCount = templates.filter((template) =>
            isRoutineDone(template, routineState, now)
          ).length;

          return (
            <div key={period} className="routine-group">
              <div className="inline-heading">
                <h3>{period}</h3>
                <span>
                  {doneCount}/{templates.length}
                </span>
              </div>
              <div className="routine-list">
                {templates.map((template) => {
                  const done = isRoutineDone(template, routineState, now);
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={`routine-card ${done ? "is-done" : ""}`}
                      onClick={() => toggleRoutine(template)}
                    >
                      <span className={`area-pill area-${template.area}`}>
                        {areaDefinitions[template.area].label}
                      </span>
                      <strong>{template.title}</strong>
                      <p>{template.note}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );

  const sourcesPanel = (
    <article className="panel reveal" id="sources-panel">
      <SectionHeading
        eyebrow="Sources"
        title="Free local and cloud sync"
        copy="Apple sync and notes scans are local companion scripts. Cross-device sync uses a free private GitHub Gist."
      />
      <div className="source-list">
        <article className={`source-card tone-${appleStatusTone}`}>
          <div className="inline-heading">
            <h3>Apple sync</h3>
            <span>{generatedSources.apple.items.length} items</span>
          </div>
          <p>
            {generatedSources.apple.generatedAt
              ? `Last generated ${formatDateTime(
                  generatedSources.apple.generatedAt,
                  snapshotInfo.locale,
                  true
                )}.`
              : "No Apple sync file yet."}
          </p>
          <p className="small-copy">Run `npm run sync:apple` on this Mac.</p>
          {generatedSources.apple.warnings?.length ? (
            <p className="small-copy">
              If this Mac should allow it, check System Settings - Privacy & Security -
              Automation for Calendar and Reminders access.
            </p>
          ) : null}
          {generatedSources.apple.warnings?.slice(0, 2).map((warning) => (
            <p key={warning} className="warning-line">
              {warning}
            </p>
          ))}
        </article>

        <article className={`source-card tone-${localScanStatusTone}`}>
          <div className="inline-heading">
            <h3>Local scan</h3>
            <span>{generatedSources.localScan.items.length} items</span>
          </div>
          <p>
            {generatedSources.localScan.generatedAt
              ? `Last generated ${formatDateTime(
                  generatedSources.localScan.generatedAt,
                  snapshotInfo.locale,
                  true
                )}.`
              : "No generated local scan file yet."}
          </p>
          <p className="small-copy">Run `npm run sync:local` or scan a folder in the browser.</p>
          {generatedSources.localScan.sourcesScanned?.length ? (
            <p className="small-copy">
              Roots scanned: {generatedSources.localScan.sourcesScanned.join(", ")}
            </p>
          ) : null}
        </article>

        <article className={`source-card tone-${projectSyncStatusTone}`}>
          <div className="inline-heading">
            <h3>Project sync</h3>
            <span>{generatedSources.projectSync.projects.length} repos</span>
          </div>
          <p>
            {generatedSources.projectSync.generatedAt
              ? `Last generated ${formatDateTime(
                  generatedSources.projectSync.generatedAt,
                  snapshotInfo.locale,
                  true
                )}.`
              : "No project sync file yet."}
          </p>
          <p className="small-copy">Run `npm run sync:projects` to refresh local repo state.</p>
          {generatedSources.projectSync.githubAuth ? (
            <p className="small-copy">
              GitHub CLI:{" "}
              {generatedSources.projectSync.githubAuth.loggedIn
                ? "authenticated"
                : "not authenticated"}
            </p>
          ) : null}
          {generatedSources.projectSync.warnings?.slice(0, 2).map((warning) => (
            <p key={warning} className="warning-line">
              {warning}
            </p>
          ))}
        </article>
      </div>

      <div className="section-break source-controls">
        <div className="inline-heading">
          <h3>Folder scan preset</h3>
          <span>{selectedScanPreset.label}</span>
        </div>
        <label className="field-label">
          Pick a scan mode
          <select
            value={scanPresetId}
            onChange={(event) => setScanPresetId(event.target.value)}
          >
            {scanPresetDefinitions.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <p className="small-copy">{selectedScanPreset.detail}</p>
        <div className="tool-row">
          <button type="button" onClick={runFolderScan}>
            {selectedScanPreset.actionLabel}
          </button>
        </div>
      </div>

      <div className="section-break">
        <div className="inline-heading">
          <h3>Import templates</h3>
          <span>CSV / ICS / JSON</span>
        </div>
        <div className="template-grid">
          {templateLinks.map((template) => (
            <a key={template.id} className="template-card" href={template.href} download>
              <span className="source-pill">{template.label}</span>
              <h3>{template.label}</h3>
              <p>{template.detail}</p>
            </a>
          ))}
        </div>
      </div>

      {folderScan ? (
        <div className="folder-scan-panel">
          <div className="inline-heading">
            <h3>Scanned folder</h3>
            <span>{folderScan.items.length} candidates</span>
          </div>
          <p>
            {folderScan.directoryName} - {folderScan.filesScanned} files scanned
          </p>
          {folderScan.presetLabel ? (
            <p className="small-copy">Preset: {folderScan.presetLabel}</p>
          ) : null}
          <div className="search-results small">
            {folderScan.items.slice(0, 8).map((item) => (
              <article key={`${item.title}-${item.dueAt}`} className="search-card">
                <span className={`area-pill area-${item.area}`}>
                  {areaDefinitions[item.area].label}
                </span>
                <h3>{item.title}</h3>
                <p>{formatDateTime(item.dueAt, snapshotInfo.locale)}</p>
              </article>
            ))}
          </div>
          <div className="tool-row">
            <button type="button" onClick={importScannedItems}>
              Add scanned items
            </button>
            <button type="button" className="ghost" onClick={() => setFolderScan(null)}>
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );

  const journalPanel = (
    <article className="panel reveal" id="journal-panel">
      <SectionHeading
        eyebrow="Journal"
        title="Track what actually happened"
        copy="A daily log gives the board memory, not just tasks."
      />
      <div className="panel-pad journal-panel">
        <div className="inline-heading">
          <h3>{formatDateOnly(now, snapshotInfo.locale, true)}</h3>
          <span>{todayJournal.mood}</span>
        </div>
        <div className="journal-grid">
          <label className="field-label">
            Mood
            <select
              value={todayJournal.mood}
              onChange={(event) => updateJournalField("mood", event.target.value)}
            >
              {journalMoodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Wins
            <textarea
              rows="4"
              value={todayJournal.wins}
              onChange={(event) => updateJournalField("wins", event.target.value)}
              placeholder="What actually went well?"
            />
          </label>
          <label className="field-label">
            Friction
            <textarea
              rows="4"
              value={todayJournal.friction}
              onChange={(event) => updateJournalField("friction", event.target.value)}
              placeholder="What got in the way?"
            />
          </label>
          <label className="field-label">
            Note
            <textarea
              rows="5"
              value={todayJournal.note}
              onChange={(event) => updateJournalField("note", event.target.value)}
              placeholder="Anything future-you should remember about today?"
            />
          </label>
        </div>
        <div className="recent-journal">
          <div className="inline-heading">
            <h3>Recent entries</h3>
            <span>{Object.keys(journalEntries).length}</span>
          </div>
          <div className="search-results small">
            {Object.entries(journalEntries)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .slice(0, 6)
              .map(([dateKey, entry]) => (
                <article key={dateKey} className="search-card">
                  <span className="source-pill">{entry.mood}</span>
                  <h3>{dateKey}</h3>
                  <p>{entry.note || entry.wins || entry.friction || "No text yet."}</p>
                </article>
              ))}
          </div>
        </div>
      </div>
    </article>
  );

  const areaNotesPanel = (
    <article className="panel reveal" id="area-notes-panel">
      <SectionHeading
        eyebrow="Context"
        title="Area notes"
        copy="Use these when the real thing you forget is meaning, not timing."
      />
      <div className="notes-grid">
        {areaOrder.map((area) => (
          <label key={area} className="note-card">
            <span>{areaDefinitions[area].label}</span>
            <div className="note-prompts">
              {areaNotePrompts[area].map((prompt) => (
                <p key={prompt} className="small-copy">
                  {prompt}
                </p>
              ))}
            </div>
            <textarea
              rows="4"
              value={areaNotes[area]}
              onChange={(event) => updateAreaNote(area, event.target.value)}
              placeholder={`What matters in ${areaDefinitions[area].label.toLowerCase()} that is easy to lose sight of?`}
            />
          </label>
        ))}
      </div>
    </article>
  );

  const profilePanel = (
    <article className="panel reveal" id="profile-panel">
      <SectionHeading
        eyebrow="Profile"
        title="Tune the decision engine"
        copy="Wake can now be driven by tomorrow's earliest real commitment. Your default wake still matters when nothing earlier forces it."
      />
      <div className="profile-grid">
        <label className="field-label">
          Name
          <input
            name="displayName"
            value={profile.displayName}
            onChange={handleProfileChange}
          />
        </label>
        <label className="field-label">
          Total bank balance
          <input
            name="bankBalance"
            value={profile.bankBalance}
            onChange={handleProfileChange}
            placeholder="$0"
          />
        </label>
        <label className="field-label">
          Default wake time
          <input
            name="wakeTime"
            type="time"
            value={profile.wakeTime}
            onChange={handleProfileChange}
          />
        </label>
        <label className="field-label">
          Latest-ready minutes
          <input
            name="latestReadyMinutes"
            type="number"
            min="0"
            step="5"
            value={profile.latestReadyMinutes}
            onChange={handleProfileChange}
          />
        </label>
        <label className="field-label">
          Ideal-ready minutes
          <input
            name="idealReadyMinutes"
            type="number"
            min="0"
            step="5"
            value={profile.idealReadyMinutes}
            onChange={handleProfileChange}
          />
        </label>
        <label className="field-label">
          Sleep target
          <input
            name="sleepTargetHours"
            type="number"
            min="5"
            max="12"
            step="0.5"
            value={profile.sleepTargetHours}
            onChange={handleProfileChange}
          />
        </label>
        <label className="field-label">
          Wind-down minutes
          <input
            name="windDownMinutes"
            type="number"
            min="0"
            step="5"
            value={profile.windDownMinutes}
            onChange={handleProfileChange}
          />
        </label>
        <label className="field-label">
          Gaming cutoff
          <input
            name="gamingCutoff"
            type="time"
            value={profile.gamingCutoff}
            onChange={handleProfileChange}
          />
        </label>
        <label className="field-label">
          Focus block minutes
          <input
            name="focusBlockMinutes"
            type="number"
            min="15"
            step="5"
            value={profile.focusBlockMinutes}
            onChange={handleProfileChange}
          />
        </label>
        <label className="field-label">
          Reminder lead minutes
          <input
            name="notificationLeadMinutes"
            type="number"
            min="5"
            step="5"
            value={profile.notificationLeadMinutes}
            onChange={handleProfileChange}
          />
        </label>
      </div>
      <div className="panel-pad">
        <p className="small-copy">
          Example: if class starts at 9:30 AM, setting `Latest-ready` to 30 and `Ideal-ready`
          to 60 makes the wake plan aim for 8:30 AM ideal and 9:00 AM latest.
        </p>
      </div>
    </article>
  );

  const syncPanel = (
    <article className="panel reveal">
      <SectionHeading
        eyebrow="Backups and sync"
        title="Import, export, and keep it portable"
        copy="This is the practical layer for restoring, moving, and syncing your board across devices."
      />
      <div className="panel-pad">
        <div className="section-break">
          <div className="inline-heading">
            <h3>Import and free cloud sync</h3>
            <span>GitHub Gist</span>
          </div>
          <div className="tool-row">
            <label className="button-like ghost">
              Import snapshot or items
              <input
                type="file"
                accept=".json,.csv,.ics,.txt,.md"
                onChange={handleImportFile}
              />
            </label>
            <button type="button" className="ghost" onClick={resetLocalData}>
              Reset local data
            </button>
          </div>

          <div className="profile-grid cloud-grid">
            <label className="field-label">
              Gist ID
              <input
                value={syncConfig.gistId}
                onChange={(event) =>
                  setSyncConfig((current) =>
                    normalizeSyncConfig({ ...current, gistId: event.target.value })
                  )
                }
                placeholder="Filled automatically after first push"
              />
            </label>
            <label className="field-label">
              Gist file name
              <input
                value={syncConfig.filename}
                onChange={(event) =>
                  setSyncConfig((current) =>
                    normalizeSyncConfig({ ...current, filename: event.target.value })
                  )
                }
              />
            </label>
            <label className="field-label full-span">
              GitHub token
              <input
                type="password"
                value={syncConfig.token}
                onChange={(event) =>
                  setSyncConfig((current) =>
                    normalizeSyncConfig({ ...current, token: event.target.value })
                  )
                }
                placeholder="A GitHub personal access token with gist scope"
              />
            </label>
          </div>

          <div className="tool-row">
            <button type="button" onClick={pushCloudSync} disabled={isCloudLoading}>
              Push to Gist
            </button>
            <button type="button" className="ghost" onClick={pullCloudSync} disabled={isCloudLoading}>
              Pull from Gist
            </button>
          </div>
          <p className="small-copy">
            The token stays in this browser's local storage. GitHub accounts and private gists are free.
          </p>
          {cloudStatus ? (
            <p className={`flash tone-${cloudStatus.tone}`}>{cloudStatus.text}</p>
          ) : null}
        </div>
      </div>
    </article>
  );

  const systemsEssentialsPanel = (
    <article className="panel reveal systems-panel" id="profile-panel">
      <SectionHeading eyebrow="Hub" title="Homepage data" />
      <div className="systems-essentials-grid">
        <section className="system-card">
          <div className="system-card-head">
            <span className="meta-label">Money</span>
            <strong>{formattedBalance || "Missing"}</strong>
          </div>
          <div className="system-card-fields">
            <label className="field-label">
              Bank balance
              <input
                name="bankBalance"
                value={profile.bankBalance}
                onChange={handleEssentialsChange}
                placeholder="$0"
              />
            </label>
            <label className="field-label">
              Credit card owed
              <input
                name="creditCardOwed"
                value={profile.creditCardOwed}
                onChange={handleEssentialsChange}
                placeholder="$0"
              />
            </label>
          </div>
        </section>

        <section className="system-card">
          <div className="system-card-head">
            <span className="meta-label">Social</span>
            <strong>{profile.dinnerPreference?.trim() ? "Saved" : "Missing"}</strong>
          </div>
          <div className="system-card-fields">
            <label className="field-label">
              Dinner she likes
              <input
                name="dinnerPreference"
                value={profile.dinnerPreference}
                onChange={handleEssentialsChange}
                placeholder="Sushi, pasta, poke, burgers"
              />
            </label>
            <a className="mini-text-button" href={buildPageHref(pageContext.basePath, "areas")}>
              Open notes
            </a>
          </div>
        </section>

        <section className="system-card">
          <div className="system-card-head">
            <span className="meta-label">Timing</span>
            <strong>{wakePlanCopy.label}</strong>
          </div>
          <div className="system-card-fields">
            <label className="field-label">
              Wake time
              <input
                name="wakeTime"
                type="time"
                value={profile.wakeTime}
                onChange={handleEssentialsChange}
              />
            </label>
            <label className="field-label">
              Buffer before plans
              <input
                name="morningBufferMinutes"
                type="number"
                min="0"
                step="5"
                value={profile.idealReadyMinutes}
                onChange={handleEssentialsChange}
              />
            </label>
            <label className="field-label">
              Sleep hours
              <input
                name="sleepTargetHours"
                type="number"
                min="5"
                max="12"
                step="0.5"
                value={profile.sleepTargetHours}
                onChange={handleEssentialsChange}
              />
            </label>
          </div>
        </section>
      </div>

      <details className="systems-details">
        <summary>Advanced</summary>
        <div className="systems-details-body">
          <div className="profile-grid compact-profile-grid">
            <label className="field-label">
              Name
              <input
                name="displayName"
                value={profile.displayName}
                onChange={handleProfileChange}
              />
            </label>
            <label className="field-label">
              Latest-ready minutes
              <input
                name="latestReadyMinutes"
                type="number"
                min="0"
                step="5"
                value={profile.latestReadyMinutes}
                onChange={handleProfileChange}
              />
            </label>
            <label className="field-label">
              Wind-down minutes
              <input
                name="windDownMinutes"
                type="number"
                min="0"
                step="5"
                value={profile.windDownMinutes}
                onChange={handleProfileChange}
              />
            </label>
            <label className="field-label">
              Gaming cutoff
              <input
                name="gamingCutoff"
                type="time"
                value={profile.gamingCutoff}
                onChange={handleProfileChange}
              />
            </label>
            <label className="field-label">
              Focus block minutes
              <input
                name="focusBlockMinutes"
                type="number"
                min="15"
                step="5"
                value={profile.focusBlockMinutes}
                onChange={handleProfileChange}
              />
            </label>
            <label className="field-label">
              Reminder lead minutes
              <input
                name="notificationLeadMinutes"
                type="number"
                min="5"
                step="5"
                value={profile.notificationLeadMinutes}
                onChange={handleProfileChange}
              />
            </label>
          </div>
        </div>
      </details>
    </article>
  );

  const systemsSourcesPanel = (
    <article className="panel reveal systems-panel" id="sources-panel">
      <SectionHeading eyebrow="Sources" title="Imports and sync" />
      <div className="systems-source-strip">
        <article className={`source-card compact tone-${appleStatusTone}`}>
          <span className="meta-label">Apple</span>
          <strong>{generatedSources.apple.items.length}</strong>
          <p>{generatedSources.apple.generatedAt ? "Ready" : "Missing"}</p>
        </article>
        <article className={`source-card compact tone-${localScanStatusTone}`}>
          <span className="meta-label">Local scan</span>
          <strong>{generatedSources.localScan.items.length}</strong>
          <p>{generatedSources.localScan.generatedAt ? "Ready" : "Missing"}</p>
        </article>
        <article className={`source-card compact tone-${projectSyncStatusTone}`}>
          <span className="meta-label">Projects</span>
          <strong>{generatedSources.projectSync.projects.length}</strong>
          <p>{generatedSources.projectSync.generatedAt ? "Ready" : "Missing"}</p>
        </article>
      </div>

      <div className="tool-row systems-primary-actions">
        <label className="button-like ghost">
          Import
          <input
            type="file"
            accept=".json,.csv,.ics,.txt,.md"
            onChange={handleImportFile}
          />
        </label>
        <button type="button" className="ghost" onClick={runFolderScan}>
          Scan
        </button>
        <button type="button" className="ghost" onClick={exportSnapshot}>
          Export
        </button>
      </div>

      {folderScan ? (
        <div className="systems-inline-result">
          <div className="inline-heading">
            <h3>{folderScan.directoryName}</h3>
            <span>{folderScan.items.length} candidates</span>
          </div>
          <div className="search-results small">
            {folderScan.items.slice(0, 6).map((item) => (
              <article key={`${item.title}-${item.dueAt}`} className="search-card">
                <span className={`area-pill area-${item.area}`}>
                  {areaDefinitions[item.area].label}
                </span>
                <h3>{item.title}</h3>
                <p>{formatDateTime(item.dueAt, snapshotInfo.locale)}</p>
              </article>
            ))}
          </div>
          <div className="tool-row">
            <button type="button" onClick={importScannedItems}>
              Add scanned items
            </button>
            <button type="button" className="ghost" onClick={() => setFolderScan(null)}>
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <details className="systems-details">
        <summary>Templates</summary>
        <div className="systems-details-body">
          <div className="template-grid compact-template-grid">
            {templateLinks.map((template) => (
              <a key={template.id} className="template-card" href={template.href} download>
                <span className="source-pill">{template.label}</span>
                <h3>{template.label}</h3>
                <p>{template.detail}</p>
              </a>
            ))}
          </div>
          <div className="systems-script-notes">
            <p>Apple: `npm run sync:apple`</p>
            <p>Local: `npm run sync:local`</p>
            <p>Projects: `npm run sync:projects`</p>
          </div>
        </div>
      </details>
    </article>
  );

  const systemsBackupPanel = (
    <article className="panel reveal systems-panel" id="backup-panel">
      <SectionHeading eyebrow="Backup" title="Snapshot and Gist" />
      <div className="tool-row systems-primary-actions">
        <button type="button" onClick={exportSnapshot}>
          Export snapshot
        </button>
        <button type="button" className="ghost" onClick={resetLocalData}>
          Reset local data
        </button>
      </div>

      <details className="systems-details">
        <summary>Gist sync</summary>
        <div className="systems-details-body">
          <div className="profile-grid compact-profile-grid cloud-grid">
            <label className="field-label">
              Gist ID
              <input
                value={syncConfig.gistId}
                onChange={(event) =>
                  setSyncConfig((current) =>
                    normalizeSyncConfig({ ...current, gistId: event.target.value })
                  )
                }
                placeholder="Filled after first push"
              />
            </label>
            <label className="field-label">
              File name
              <input
                value={syncConfig.filename}
                onChange={(event) =>
                  setSyncConfig((current) =>
                    normalizeSyncConfig({ ...current, filename: event.target.value })
                  )
                }
              />
            </label>
            <label className="field-label full-span">
              GitHub token
              <input
                type="password"
                value={syncConfig.token}
                onChange={(event) =>
                  setSyncConfig((current) =>
                    normalizeSyncConfig({ ...current, token: event.target.value })
                  )
                }
                placeholder="Personal access token with gist scope"
              />
            </label>
          </div>
          <div className="tool-row">
            <button type="button" onClick={pushCloudSync} disabled={isCloudLoading}>
              Push to Gist
            </button>
            <button type="button" className="ghost" onClick={pullCloudSync} disabled={isCloudLoading}>
              Pull from Gist
            </button>
          </div>
          {cloudStatus ? (
            <p className={`flash tone-${cloudStatus.tone}`}>{cloudStatus.text}</p>
          ) : (
            <p className="small-copy">Token stays local.</p>
          )}
        </div>
      </details>
    </article>
  );

  const areaSummarySection = (
    <section className="area-grid">
      {areaOrder.map((area) => {
        const areaItems = openItems.filter((item) => item.area === area);
        const summary = buildAreaSummary(area, areaItems, areaNotes, now, snapshotInfo.locale);

        return (
          <article key={area} className={`panel area-card tone-${areaDefinitions[area].tone} reveal`}>
            <div className="area-card-header">
              <div>
                <p className="eyebrow">{areaDefinitions[area].sourceState}</p>
                <h2>{areaDefinitions[area].label}</h2>
              </div>
              <span className={`area-pill area-${area}`}>{areaItems.length} open</span>
            </div>
            <p className="area-headline">{areaDefinitions[area].headline}</p>
            <p>{summary.detail}</p>
            <p className="area-footer">{summary.footer}</p>
          </article>
        );
      })}
    </section>
  );

  const timelinePanel = (
    <article className="panel reveal">
      <SectionHeading
        eyebrow="Timeline"
        title="Academic timing"
        copy="The grounded course dates that currently have real proof on this machine."
      />
      <div className="timeline-list">
        {upcomingTimeline.map((entry) => {
          const state = new Date(entry.date).getTime() < now.getTime() ? "timeline-past" : "timeline-upcoming";
          return (
            <article key={entry.date} className={`timeline-card ${state}`}>
              <div className="timeline-date">{formatShortDate(entry.date, snapshotInfo.locale)}</div>
              <div>
                <h3>{entry.title}</h3>
                <p>{entry.note}</p>
              </div>
            </article>
          );
        })}
      </div>
    </article>
  );

  const projectsPanel = (
    <article className="panel reveal">
      <SectionHeading
        eyebrow="Projects"
        title="Where work already wants to go"
        copy="The main project gravity wells visible on this machine."
      />
      <div className="project-list">
        {projectTracks.map((project) => {
          const synced = projectSyncMap.get(project.path);

          return (
            <article key={project.name} className="project-card">
              <div className="project-top">
                <div>
                  <h3>{project.name}</h3>
                  <p className="project-path">{project.path}</p>
                </div>
                <span className="source-pill">{project.status}</span>
              </div>
              <p>{project.summary}</p>
              <p className="project-next">
                <strong>Next:</strong> {project.next}
              </p>
              {synced ? (
                <div className="project-sync-meta">
                  {synced.branch ? (
                    <p className="small-copy">
                      Branch: {synced.branch}
                      {synced.hasRemote ? "" : " - no remote configured"}
                    </p>
                  ) : null}
                  {synced.git ? (
                    <p className="small-copy">
                      Working tree: {synced.workingTree?.tracked || 0} tracked,{" "}
                      {synced.workingTree?.untracked || 0} untracked
                    </p>
                  ) : (
                    <p className="small-copy">Local folder present, but no git repo detected.</p>
                  )}
                  {synced.lastCommitAt ? (
                    <p className="small-copy">
                      Last commit: {formatDateTime(synced.lastCommitAt, snapshotInfo.locale, true)}
                      {synced.lastCommitMessage ? ` - ${synced.lastCommitMessage}` : ""}
                    </p>
                  ) : null}
                  {synced.referenceGoal ? (
                    <p className="small-copy">
                      Reference goal from {synced.referenceGoalSource}: {synced.referenceGoal}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <ul className="bullet-list tight">
                {project.proof.map((proof) => (
                  <li key={proof}>{proof}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </article>
  );

  const supportPanel = (
    <article className="panel reveal">
      <SectionHeading
        eyebrow="Support layer"
        title="Hobbies, truths, rules, sources"
        copy="The context underneath the recommendations."
      />
      <div className="support-block">
        <div className="inline-heading">
          <h3>Hobbies</h3>
          <span>{hobbySignals.length}</span>
        </div>
        <div className="hobby-grid">
          {hobbySignals.map((hobby) => (
            <article key={hobby.name} className="hobby-card">
              <span className="source-pill">{hobby.category}</span>
              <h3>{hobby.name}</h3>
              <p>{hobby.note}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="support-block">
        <div className="inline-heading">
          <h3>Verified truths</h3>
          <span>{fixedTruths.length}</span>
        </div>
        <div className="truth-list">
          {fixedTruths.map((truth) => (
            <article key={truth.label} className="truth-card">
              <h3>{truth.label}</h3>
              <p>{truth.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="support-block">
        <div className="inline-heading">
          <h3>Decision rules</h3>
          <span>{decisionRules.length}</span>
        </div>
        <div className="truth-list">
          {decisionRules.map((rule) => (
            <article key={rule.title} className="truth-card">
              <h3>{rule.title}</h3>
              <p>{rule.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="support-block">
        <div className="inline-heading">
          <h3>Source ledger</h3>
          <span>{sourceLedger.length}</span>
        </div>
        <div className="ledger-list">
          {sourceLedger.map((source) => (
            <article key={source.path} className="ledger-card">
              <h3>{source.title}</h3>
              <p className="project-path">{source.path}</p>
              <p>{source.usedFor}</p>
            </article>
          ))}
        </div>
      </div>
    </article>
  );

  const pageIntroActions = {
    today: [
      buildNavAction("commitments", "Open commitments"),
      buildNavAction("calendar", "See calendar", "button-like ghost"),
    ],
    calendar: [
      buildNavAction("today", "Back to today"),
      buildNavAction("commitments", "Open commitments", "button-like ghost"),
    ],
    commitments: [
      buildNavAction("today", "Back to today"),
      buildNavAction("systems", "Manage sources", "button-like ghost"),
    ],
    search: [
      buildNavAction("today", "Back to today"),
      buildNavAction("areas", "Open areas", "button-like ghost"),
    ],
    areas: [
      buildNavAction("commitments", "Open commitments"),
      buildNavAction("search", "Search all", "button-like ghost"),
    ],
    account: [],
    systems: [],
    projects: [
      buildNavAction("today", "Back to today"),
      buildNavAction("systems", "Open systems", "button-like ghost"),
    ],
  }[pageContext.pageId];

  const pageIntroSection =
    ["dashboard", "systems", "account"].includes(pageContext.pageId) ? null : (
      <PageIntro
        eyebrow={pageContext.currentDefinition.eyebrow}
        title={pageContext.currentDefinition.title}
        copy={pageContext.currentDefinition.copy}
        actions={pageIntroActions}
      />
    );

  const systemsSection = (
    <section className="systems-surface">
      <div className="systems-switcher reveal" role="tablist" aria-label="Systems sections">
        {SYSTEMS_PANE_DEFINITIONS.map((pane) => (
          <button
            key={pane.id}
            type="button"
            role="tab"
            aria-selected={activeSystemsPane.id === pane.id}
            aria-controls={pane.sectionId}
            className={`systems-switcher-button ${activeSystemsPane.id === pane.id ? "is-active" : ""}`}
            onClick={() => selectSystemsPane(pane.id)}
          >
            {pane.label}
          </button>
        ))}
      </div>
      {{
        sources: systemsSourcesPanel,
        backup: systemsBackupPanel,
      }[activeSystemsPane.id]}
    </section>
  );

  let pageContent;

  switch (pageContext.pageId) {
    case "setup":
      pageContent = setupPageSection;
      break;
    case "account":
      pageContent = accountPageSection;
      break;
    case "today":
      pageContent = (
        <>
          {pageIntroSection}
          {todaySummarySection}
          <section className="decision-grid">
            {scenarioPanel}
            {actionStackPanel}
            {tomorrowPanel}
          </section>
          <section className="systems-grid">
            {routinesPanel}
            {journalPanel}
          </section>
        </>
      );
      break;
    case "calendar":
      pageContent = (
        <>
          {pageIntroSection}
          <div className="page-stack">
            {calendarPanel}
            {timelinePanel}
          </div>
        </>
      );
      break;
    case "commitments":
      pageContent = (
        <>
          {pageIntroSection}
          <section className="main-grid">
            {commitmentsPanel}
            <div className="sidebar-stack">
              {starterTemplatesPanel}
              {capturePanel}
              {routinesPanel}
            </div>
          </section>
        </>
      );
      break;
    case "search":
      pageContent = (
        <>
          {pageIntroSection}
          <section className="systems-grid">
            {searchPanel}
            {journalPanel}
          </section>
        </>
      );
      break;
    case "areas":
      pageContent = (
        <>
          {pageIntroSection}
          {areaSummarySection}
          {areaNotesPanel}
        </>
      );
      break;
    case "systems":
      pageContent = (
        <>
          {systemsSection}
        </>
      );
      break;
    case "projects":
      pageContent = (
        <>
          {pageIntroSection}
          <section className="deep-grid">
            <div className="sidebar-stack">
              {timelinePanel}
              {projectsPanel}
            </div>
            {supportPanel}
          </section>
        </>
      );
      break;
    default:
      pageContent = (
        <>
          {dashboardBubbleSection}
        </>
      );
      break;
  }

  const dashboardAction =
    pageContext.pageId === "dashboard"
      ? {
          href: buildPageHref(
            pageContext.basePath,
            setupState.profileReviewed ? "account" : "setup"
          ),
          label: setupState.profileReviewed ? "Account" : "Setup",
        }
      : null;

  return (
    <div className="app-shell">
      <div className="background-grid" />
      <main
        className={`page ${
          ["setup", "account"].includes(pageContext.pageId) ? "page-setup" : ""
        }`}
      >
        <SiteNav
          links={pageLinks}
          currentPageId={pageContext.pageId}
          basePath={pageContext.basePath}
          dashboardAction={dashboardAction}
        />
        {flashMessage ? <p className={`flash global-flash tone-${flashMessage.tone}`}>{flashMessage.text}</p> : null}
        {pageContent}
      </main>
    </div>
  );
}

export default App;
