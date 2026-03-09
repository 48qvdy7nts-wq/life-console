import {
  areaDefinitions,
  areaOrder,
  defaultAreaNotes,
  defaultDraft,
  defaultJournalEntry,
  defaultProfileWithAutomation,
  defaultPrinciples,
  defaultSyncConfig,
} from "../data/dashboardData";

const priorityRank = {
  high: 0,
  normal: 1,
  low: 2,
};

const recurrenceValues = ["none", "daily", "weekly", "monthly"];

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date, amount) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

export function formatDateTime(value, locale, includeYear = false) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDateOnly(value, locale, includeYear = false) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(new Date(value));
}

export function formatShortDate(value, locale) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatTimeOnly(value, locale) {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDuration(minutes) {
  const safeMinutes = toPositiveNumber(minutes, 0);
  if (safeMinutes < 60) {
    return `${safeMinutes}m`;
  }

  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function relativeWindow(value, now) {
  const diff = new Date(value).getTime() - now.getTime();
  const absMinutes = Math.round(Math.abs(diff) / 60000);
  const absHours = Math.round(Math.abs(diff) / 3600000);
  const absDays = Math.round(Math.abs(diff) / 86400000);

  if (absMinutes < 60) {
    return diff >= 0 ? `in ${absMinutes}m` : `${absMinutes}m ago`;
  }

  if (absHours < 48) {
    return diff >= 0 ? `in ${absHours}h` : `${absHours}h ago`;
  }

  return diff >= 0 ? `in ${absDays}d` : `${absDays}d ago`;
}

export function combineDateAndTime(baseDate, timeText) {
  const [hours, minutes] = String(timeText || "09:00")
    .split(":")
    .map((part) => Number(part));
  const next = new Date(baseDate);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
}

export function getUpcomingWake(now, wakeTime) {
  const wakeToday = combineDateAndTime(now, wakeTime);
  if (now.getTime() <= wakeToday.getTime()) {
    return wakeToday;
  }

  const next = new Date(wakeToday);
  next.setDate(next.getDate() + 1);
  return next;
}

export function getCutoffBoundary(now, cutoffTime) {
  const cutoff = combineDateAndTime(now, cutoffTime);
  const cutoffHour = Number(String(cutoffTime || "00:30").split(":")[0]);

  if (cutoffHour < 6 && now.getHours() >= 6 && cutoff.getTime() <= now.getTime()) {
    cutoff.setDate(cutoff.getDate() + 1);
  }

  return cutoff;
}

function buildWakeTiming(now, profile, items) {
  const baselineWake = getUpcomingWake(now, profile.wakeTime);
  const idealReadyMinutes = toPositiveNumber(
    profile.idealReadyMinutes,
    defaultProfileWithAutomation.idealReadyMinutes
  );
  const latestReadyMinutes = toPositiveNumber(
    profile.latestReadyMinutes,
    defaultProfileWithAutomation.latestReadyMinutes
  );
  const wakeDayStart = startOfDay(baselineWake);
  const wakeDayEnd = endOfDay(baselineWake);

  const wakeDrivenItem = (Array.isArray(items) ? items : [])
    .filter((item) => item?.viewDueAt || item?.dueAt)
    .map((item) => ({
      item,
      dueAt: new Date(item.viewDueAt || item.dueAt),
    }))
    .filter(
      ({ dueAt }) =>
        dueAt.getTime() >= wakeDayStart.getTime() &&
        dueAt.getTime() <= wakeDayEnd.getTime()
    )
    .map(({ item, dueAt }) => ({
      item,
      dueAt,
      idealWake: new Date(dueAt.getTime() - idealReadyMinutes * 60000),
      latestWake: new Date(dueAt.getTime() - latestReadyMinutes * 60000),
    }))
    .filter(({ idealWake }) => idealWake.getTime() < baselineWake.getTime())
    .sort((a, b) => a.idealWake.getTime() - b.idealWake.getTime())[0];

  if (!wakeDrivenItem) {
    return {
      wakeMode: "baseline",
      baselineWake,
      idealWake: baselineWake,
      latestWake: baselineWake,
      wakeSourceItem: null,
      wakeSourceDueAt: null,
    };
  }

  return {
    wakeMode: "event",
    baselineWake,
    idealWake: wakeDrivenItem.idealWake,
    latestWake: wakeDrivenItem.latestWake,
    wakeSourceItem: wakeDrivenItem.item,
    wakeSourceDueAt: wakeDrivenItem.dueAt.toISOString(),
  };
}

export function buildSleepModel(now, profile, items = []) {
  const wakeTiming = buildWakeTiming(now, profile, items);
  const upcomingWake = wakeTiming.idealWake;
  const recommendedSleepAt = new Date(
    upcomingWake.getTime() - toPositiveNumber(profile.sleepTargetHours, 8) * 3600000
  );
  const windDownAt = new Date(
    recommendedSleepAt.getTime() -
      toPositiveNumber(profile.windDownMinutes, 45) * 60000
  );
  const cutoffAt = getCutoffBoundary(now, profile.gamingCutoff);

  return {
    ...wakeTiming,
    upcomingWake,
    recommendedSleepAt,
    windDownAt,
    cutoffAt,
    hoursUntilWake: (upcomingWake.getTime() - now.getTime()) / 3600000,
    hoursUntilLatestWake: (wakeTiming.latestWake.getTime() - now.getTime()) / 3600000,
    hoursUntilSleep: (recommendedSleepAt.getTime() - now.getTime()) / 3600000,
    inWindDown: now.getTime() >= windDownAt.getTime(),
    pastRecommendedSleep: now.getTime() >= recommendedSleepAt.getTime(),
    pastCutoff: now.getTime() >= cutoffAt.getTime(),
  };
}

export function normalizeProfile(profile) {
  const next = profile && typeof profile === "object" ? profile : {};

  return {
    displayName:
      typeof next.displayName === "string" && next.displayName.trim()
        ? next.displayName
        : defaultProfileWithAutomation.displayName,
    wakeTime:
      typeof next.wakeTime === "string" && next.wakeTime.includes(":")
        ? next.wakeTime
        : defaultProfileWithAutomation.wakeTime,
    latestReadyMinutes: toPositiveNumber(
      next.latestReadyMinutes,
      defaultProfileWithAutomation.latestReadyMinutes
    ),
    idealReadyMinutes: toPositiveNumber(
      next.idealReadyMinutes,
      defaultProfileWithAutomation.idealReadyMinutes
    ),
    sleepTargetHours: toPositiveNumber(
      next.sleepTargetHours,
      defaultProfileWithAutomation.sleepTargetHours
    ),
    windDownMinutes: toPositiveNumber(
      next.windDownMinutes,
      defaultProfileWithAutomation.windDownMinutes
    ),
    gamingCutoff:
      typeof next.gamingCutoff === "string" && next.gamingCutoff.includes(":")
        ? next.gamingCutoff
        : defaultProfileWithAutomation.gamingCutoff,
    focusBlockMinutes: toPositiveNumber(
      next.focusBlockMinutes,
      defaultProfileWithAutomation.focusBlockMinutes
    ),
    notificationLeadMinutes: toPositiveNumber(
      next.notificationLeadMinutes,
      defaultProfileWithAutomation.notificationLeadMinutes
    ),
  };
}

export function normalizeItem(item) {
  const next = item && typeof item === "object" ? item : {};

  return {
    id: typeof next.id === "string" ? next.id : createId("item"),
    title: typeof next.title === "string" ? next.title.trim() : "",
    area: areaOrder.includes(next.area) ? next.area : "future",
    dueAt: typeof next.dueAt === "string" ? next.dueAt : "",
    note: typeof next.note === "string" ? next.note.trim() : "",
    hard: Boolean(next.hard),
    priority: Object.hasOwn(priorityRank, next.priority) ? next.priority : "normal",
    durationMinutes: toPositiveNumber(
      next.durationMinutes,
      defaultDraft.durationMinutes
    ),
    done: Boolean(next.done),
    createdAt:
      typeof next.createdAt === "string" ? next.createdAt : new Date().toISOString(),
    completedAt: typeof next.completedAt === "string" ? next.completedAt : "",
    recurrence: recurrenceValues.includes(next.recurrence)
      ? next.recurrence
      : "none",
    recurrenceInterval: toPositiveNumber(next.recurrenceInterval, 1),
    completedOccurrences: Array.isArray(next.completedOccurrences)
      ? next.completedOccurrences.filter((entry) => typeof entry === "string")
      : [],
  };
}

export function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(normalizeItem).filter((item) => item.title);
}

export function normalizeAreaNotes(areaNotes) {
  const next = areaNotes && typeof areaNotes === "object" ? areaNotes : {};
  return areaOrder.reduce((accumulator, area) => {
    accumulator[area] =
      typeof next[area] === "string" ? next[area] : defaultAreaNotes[area];
    return accumulator;
  }, {});
}

export function normalizePrinciples(principles) {
  if (!Array.isArray(principles)) {
    return defaultPrinciples;
  }

  const mapped = principles
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          id: createId("principle"),
          text: entry.trim(),
        };
      }

      if (entry && typeof entry === "object" && typeof entry.text === "string") {
        return {
          id: typeof entry.id === "string" ? entry.id : createId("principle"),
          text: entry.text.trim(),
        };
      }

      return null;
    })
    .filter(Boolean)
    .filter((entry) => entry.text);

  return mapped.length > 0 ? mapped : defaultPrinciples;
}

export function normalizeRoutineState(routines) {
  if (!routines || typeof routines !== "object") {
    return {};
  }

  return Object.entries(routines).reduce((accumulator, [key, value]) => {
    if (typeof value === "string") {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});
}

export function normalizeDismissedIds(ids) {
  return Array.isArray(ids)
    ? ids.filter((entry) => typeof entry === "string")
    : [];
}

export function normalizeSetupState(state) {
  const next = state && typeof state === "object" ? state : {};
  return {
    profileReviewed: Boolean(next.profileReviewed),
  };
}

export function normalizeJournalEntries(entries) {
  if (!entries || typeof entries !== "object") {
    return {};
  }

  return Object.entries(entries).reduce((accumulator, [key, value]) => {
    accumulator[key] = normalizeJournalEntry(value);
    return accumulator;
  }, {});
}

export function normalizeJournalEntry(entry) {
  const next = entry && typeof entry === "object" ? entry : {};
  return {
    mood: typeof next.mood === "string" ? next.mood : defaultJournalEntry.mood,
    wins: typeof next.wins === "string" ? next.wins : "",
    friction: typeof next.friction === "string" ? next.friction : "",
    note: typeof next.note === "string" ? next.note : "",
    updatedAt:
      typeof next.updatedAt === "string" ? next.updatedAt : new Date().toISOString(),
  };
}

export function normalizeSyncConfig(config) {
  const next = config && typeof config === "object" ? config : {};
  return {
    provider: "github-gist",
    gistId: typeof next.gistId === "string" ? next.gistId : defaultSyncConfig.gistId,
    token: typeof next.token === "string" ? next.token : defaultSyncConfig.token,
    filename:
      typeof next.filename === "string" && next.filename.trim()
        ? next.filename
        : defaultSyncConfig.filename,
  };
}

function advanceOccurrence(occurrence, recurrence, interval) {
  if (recurrence === "daily") {
    return addDays(occurrence, interval);
  }

  if (recurrence === "weekly") {
    return addDays(occurrence, interval * 7);
  }

  if (recurrence === "monthly") {
    return addMonths(occurrence, interval);
  }

  return null;
}

function buildOccurrenceKey(itemId, dueAt) {
  return `${itemId}:${dueAt}`;
}

export function getNextOpenOccurrence(item) {
  if (!item.dueAt) {
    return "";
  }

  if (item.recurrence === "none") {
    return item.dueAt;
  }

  let current = new Date(item.dueAt);
  const completed = new Set(item.completedOccurrences || []);

  for (let iteration = 0; iteration < 500; iteration += 1) {
    const key = current.toISOString();
    if (!completed.has(key)) {
      return key;
    }

    const next = advanceOccurrence(current, item.recurrence, item.recurrenceInterval);
    if (!next) {
      return key;
    }
    current = next;
  }

  return item.dueAt;
}

export function buildOpenItems(items, sourceType = "local") {
  return items
    .filter((item) => !(item.recurrence === "none" && item.done))
    .map((item) => {
      const viewDueAt = item.dueAt ? getNextOpenOccurrence(item) : "";
      return {
        ...item,
        sourceType,
        viewDueAt,
        occurrenceKey: buildOccurrenceKey(item.id, viewDueAt || item.id),
        isRecurring: item.recurrence !== "none",
      };
    })
    .sort(itemSort);
}

export function getOccurrencesInRange(item, rangeStart, rangeEnd) {
  if (!item.dueAt) {
    return [];
  }

  const occurrences = [];
  const completed = new Set(item.completedOccurrences || []);
  let current = new Date(item.dueAt);

  for (let iteration = 0; iteration < 500; iteration += 1) {
    const iso = current.toISOString();
    if (current.getTime() > rangeEnd.getTime()) {
      break;
    }

    if (current.getTime() >= rangeStart.getTime() && !completed.has(iso)) {
      occurrences.push({
        ...item,
        viewDueAt: iso,
        occurrenceKey: buildOccurrenceKey(item.id, iso),
        isRecurring: item.recurrence !== "none",
      });
    }

    if (item.recurrence === "none") {
      break;
    }

    const next = advanceOccurrence(current, item.recurrence, item.recurrenceInterval);
    if (!next) {
      break;
    }
    current = next;
  }

  return occurrences;
}

export function buildCalendarOccurrences(items, rangeStart, rangeEnd) {
  return items
    .flatMap((item) => getOccurrencesInRange(item, rangeStart, rangeEnd))
    .sort(itemSort);
}

export function itemSort(a, b) {
  const dueA = a.viewDueAt || a.dueAt;
  const dueB = b.viewDueAt || b.dueAt;

  if (dueA && dueB) {
    const dueDifference = new Date(dueA).getTime() - new Date(dueB).getTime();
    if (dueDifference !== 0) {
      return dueDifference;
    }
  } else if (dueA) {
    return -1;
  } else if (dueB) {
    return 1;
  }

  const priorityDifference = priorityRank[a.priority] - priorityRank[b.priority];
  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return a.title.localeCompare(b.title);
}

export function completedItemSort(a, b) {
  return new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt);
}

export function getUrgencyTone(item, now) {
  const dueAt = item.viewDueAt || item.dueAt;
  if (!dueAt) {
    return item.hard ? "warm" : "steady";
  }

  const diff = new Date(dueAt).getTime() - now.getTime();
  if (diff <= 0) {
    return "alert";
  }

  if (diff <= 12 * 3600000) {
    return "alert";
  }

  if (diff <= 36 * 3600000) {
    return "warm";
  }

  return areaDefinitions[item.area]?.tone || "steady";
}

export function toggleRecurringCompletion(item, occurrenceDueAt) {
  const completed = new Set(item.completedOccurrences || []);
  if (completed.has(occurrenceDueAt)) {
    completed.delete(occurrenceDueAt);
  } else {
    completed.add(occurrenceDueAt);
  }

  return {
    ...item,
    completedOccurrences: Array.from(completed).sort(),
  };
}

export function markItemDone(item, occurrenceDueAt, now) {
  if (item.recurrence !== "none") {
    return toggleRecurringCompletion(item, occurrenceDueAt);
  }

  return {
    ...item,
    done: !item.done,
    completedAt: item.done ? "" : now.toISOString(),
  };
}

export function buildMonthMatrix(cursor) {
  const start = startOfDay(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const startWeekday = (start.getDay() + 6) % 7;
  const gridStart = addDays(start, -startWeekday);
  const days = [];

  for (let index = 0; index < 42; index += 1) {
    days.push(addDays(gridStart, index));
  }

  return days;
}

export function buildWeekDays(cursor) {
  const weekday = (cursor.getDay() + 6) % 7;
  const start = addDays(startOfDay(cursor), -weekday);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function buildSearchResults({
  query,
  openItems,
  archivedItems,
  areaNotes,
  principles,
  journalEntries,
  projectTracks,
  sourceLedger,
}) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) {
    return [];
  }

  const results = [];

  openItems.forEach((item) => {
    const haystack = `${item.title} ${item.note} ${item.area}`.toLowerCase();
    if (haystack.includes(needle)) {
      results.push({
        id: `open-${item.id}`,
        type: "Open commitment",
        title: item.title,
        detail: item.note || item.area,
      });
    }
  });

  archivedItems.forEach((item) => {
    const haystack = `${item.title} ${item.note} ${item.area}`.toLowerCase();
    if (haystack.includes(needle)) {
      results.push({
        id: `archive-${item.id}`,
        type: "Archived commitment",
        title: item.title,
        detail: item.note || item.area,
      });
    }
  });

  Object.entries(areaNotes).forEach(([area, value]) => {
    if (value && value.toLowerCase().includes(needle)) {
      results.push({
        id: `note-${area}`,
        type: "Area note",
        title: areaDefinitions[area].label,
        detail: value,
      });
    }
  });

  principles.forEach((principle) => {
    if (principle.text.toLowerCase().includes(needle)) {
      results.push({
        id: principle.id,
        type: "Principle",
        title: principle.text,
        detail: "Saved rule",
      });
    }
  });

  Object.entries(journalEntries).forEach(([dateKey, entry]) => {
    const haystack = `${entry.wins} ${entry.friction} ${entry.note} ${entry.mood}`.toLowerCase();
    if (haystack.includes(needle)) {
      results.push({
        id: `journal-${dateKey}`,
        type: "Journal",
        title: dateKey,
        detail: `${entry.mood} - ${entry.note || entry.wins || entry.friction}`,
      });
    }
  });

  projectTracks.forEach((project) => {
    const haystack = `${project.name} ${project.summary} ${project.next}`.toLowerCase();
    if (haystack.includes(needle)) {
      results.push({
        id: `project-${project.name}`,
        type: "Project",
        title: project.name,
        detail: project.next,
      });
    }
  });

  sourceLedger.forEach((source) => {
    const haystack = `${source.title} ${source.path} ${source.usedFor}`.toLowerCase();
    if (haystack.includes(needle)) {
      results.push({
        id: `source-${source.path}`,
        type: "Source",
        title: source.title,
        detail: source.path,
      });
    }
  });

  return results.slice(0, 30);
}
