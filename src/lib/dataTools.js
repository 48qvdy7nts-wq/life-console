const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const AREA_KEYWORDS = {
  academic: [
    "assignment",
    "exam",
    "quiz",
    "midterm",
    "final",
    "syllabus",
    "lecture",
    "lab",
    "report",
    "office hours",
    "course",
    "class",
    "study",
    "chapter",
    "brightspace",
    "homework",
  ],
  work: [
    "project",
    "deploy",
    "ship",
    "feature",
    "build",
    "commit",
    "release",
    "code",
    "repo",
    "client",
    "meeting",
  ],
  social: [
    "friend",
    "friends",
    "hang",
    "dinner",
    "meet",
    "meeting",
    "party",
    "birthday",
    "call",
    "text",
    "coffee",
  ],
  love: [
    "date",
    "girlfriend",
    "boyfriend",
    "anniversary",
    "flowers",
    "romantic",
    "love",
  ],
  hobbies: [
    "game",
    "gaming",
    "bg3",
    "stardew",
    "zomboid",
    "terraria",
    "victoria 3",
    "hobby",
    "playthrough",
  ],
  future: [
    "goal",
    "future",
    "plan",
    "roadmap",
    "vision",
    "later",
    "someday",
    "career",
    "next priority",
    "next priorities",
  ],
};

function clampYear(year, referenceDate) {
  if (year) {
    return year;
  }

  return referenceDate.getFullYear();
}

function parseTimePart(timePart, meridiem) {
  if (!timePart) {
    return { hours: 9, minutes: 0 };
  }

  const [rawHours, rawMinutes = "0"] = timePart.split(":");
  let hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  const normalizedMeridiem = meridiem ? meridiem.toLowerCase() : "";

  if (normalizedMeridiem === "pm" && hours < 12) {
    hours += 12;
  }

  if (normalizedMeridiem === "am" && hours === 12) {
    hours = 0;
  }

  return {
    hours,
    minutes,
  };
}

function safeDate(year, monthIndex, day, time) {
  const next = new Date(year, monthIndex, day, time.hours, time.minutes, 0, 0);
  return Number.isNaN(next.getTime()) ? null : next;
}

export function guessAreaFromText(text) {
  const haystack = String(text || "").toLowerCase();
  let bestArea = "future";
  let bestScore = 0;

  Object.entries(AREA_KEYWORDS).forEach(([area, keywords]) => {
    const score = keywords.reduce((total, keyword) => {
      return total + (haystack.includes(keyword) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestArea = area;
      bestScore = score;
    }
  });

  return bestArea;
}

export function parseLooseDate(rawValue, referenceDate = new Date()) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return null;
  }

  const isoMatch = value.match(
    /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}:\d{2})(?:\s*(am|pm))?)?/i
  );
  if (isoMatch) {
    const [, year, month, day, timePart, meridiem] = isoMatch;
    const time = parseTimePart(timePart, meridiem);
    return safeDate(Number(year), Number(month) - 1, Number(day), time);
  }

  const slashMatch = value.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}(?::\d{2})?)(?:\s*(am|pm))?)?/i
  );
  if (slashMatch) {
    const [, month, day, year, timePart, meridiem] = slashMatch;
    const normalizedYear = Number(year.length === 2 ? `20${year}` : year);
    const time = parseTimePart(timePart, meridiem);
    return safeDate(normalizedYear, Number(month) - 1, Number(day), time);
  }

  const monthMatch = value.match(
    /\b([A-Za-z]{3,9})\s+(\d{1,2})(?:,)?\s*(\d{4})?(?:\s+(\d{1,2}(?::\d{2})?)(?:\s*(am|pm)))?/i
  );
  if (monthMatch) {
    const [, monthLabel, day, year, timePart, meridiem] = monthMatch;
    const monthIndex = MONTHS[monthLabel.toLowerCase()];
    if (monthIndex === undefined) {
      return null;
    }

    const next = safeDate(
      clampYear(year ? Number(year) : null, referenceDate),
      monthIndex,
      Number(day),
      parseTimePart(timePart, meridiem)
    );

    if (!next) {
      return null;
    }

    if (!year) {
      const halfYear = 180 * 86400000;
      if (next.getTime() < referenceDate.getTime() - halfYear) {
        next.setFullYear(next.getFullYear() + 1);
      }
    }

    return next;
  }

  return null;
}

function cleanupLine(line) {
  return line
    .replace(/\s+/g, " ")
    .replace(/^(due|deadline|date|important|reminder)\s*[:\-]\s*/i, "")
    .trim();
}

function inferPriority(text) {
  return /(deadline|due|midterm|final|exam|urgent|asap|lab report)/i.test(text)
    ? "high"
    : "normal";
}

function inferHard(text) {
  return /(deadline|due|midterm|final|exam|appointment|meeting|class time|start of class)/i.test(
    text
  );
}

export function extractCandidatesFromText(
  text,
  sourcePath = "",
  options = {}
) {
  const referenceDate = options.referenceDate || new Date();
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(cleanupLine)
    .filter(Boolean)
    .slice(0, options.maxLines || 800);
  const candidates = [];
  const seen = new Set();

  lines.forEach((line, index) => {
    const parsedDate = parseLooseDate(line, referenceDate);
    const nearby = [line, lines[index + 1], lines[index - 1]].filter(Boolean).join(" ");
    const areaContext = `${nearby} ${sourcePath}`.trim();
    const codeLike =
      /[{};]|class=|opacity:|padding:|margin:|port:|version|MinimumApiVersion|rawGameVersion|meta charset|<div|<\/|function|const /i.test(
        line
      );

    if (!parsedDate) {
      return;
    }

    const year = parsedDate.getFullYear();
    if (year < referenceDate.getFullYear() - 1 || year > referenceDate.getFullYear() + 5) {
      return;
    }

    if (
      !/(due|deadline|meeting|class|assignment|exam|quiz|call|dinner|tomorrow|submit|appointment|report|lecture|reminder|midterm|final)/i.test(
        nearby
      )
    ) {
      return;
    }

    if (codeLike) {
      return;
    }

    const titleSource = cleanupLine(
      line
        .replace(/\b([A-Za-z]{3,9}\s+\d{1,2}(?:,)?\s*\d{0,4}(?:\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)/i, "")
        .replace(/\b\d{4}-\d{2}-\d{2}(?:[ T]\d{1,2}:\d{2}(?:\s*(?:am|pm))?)?/i, "")
        .replace(/\b(?:at|on)\b\s*$/i, "")
    );

    const title = titleSource || cleanupLine(lines[index + 1] || line);
    const key = `${title}|${parsedDate.toISOString()}`;
    if (!title || seen.has(key)) {
      return;
    }

    seen.add(key);
    candidates.push({
      title,
      area: guessAreaFromText(areaContext),
      dueAt: parsedDate.toISOString(),
      note: `Inferred from ${sourcePath || "selected text source"}.`,
      priority: inferPriority(nearby),
      hard: inferHard(nearby),
      durationMinutes: 30,
      recurrence: "none",
      recurrenceInterval: 1,
      sourcePath,
    });
  });

  return candidates.slice(0, options.limit || 40);
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function pickRecordValue(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function parseBooleanish(value) {
  return /^(true|yes|1|y)$/i.test(String(value || "").trim());
}

function normalizePriority(value, fallback = "normal") {
  const normalized = String(value || "").trim().toLowerCase();
  return ["low", "normal", "high"].includes(normalized) ? normalized : fallback;
}

function parseDateCandidate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const candidates = raw
    .split(/\s*(?:→|->|\|)\s*/)
    .flatMap((entry) => entry.split(/\r?\n/))
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const parsed = parseLooseDate(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function parseCsvDateRecord(record) {
  const googleStartDate = pickRecordValue(record, ["start date"]);
  const googleStartTime = pickRecordValue(record, ["start time"]);
  if (googleStartDate) {
    const parsed = parseDateCandidate(
      `${googleStartDate}${googleStartTime ? ` ${googleStartTime}` : ""}`
    );
    if (parsed) {
      return parsed;
    }
  }

  return parseDateCandidate(
    pickRecordValue(record, [
      "dueat",
      "due",
      "date",
      "datetime",
      "deadline",
      "start",
      "start date/time",
      "scheduled",
    ])
  );
}

function inferDurationFromRecord(record) {
  const explicitDuration = Number(
    pickRecordValue(record, ["durationminutes", "minutes", "duration"])
  );
  if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
    return explicitDuration;
  }

  const googleStartDate = pickRecordValue(record, ["start date"]);
  const googleStartTime = pickRecordValue(record, ["start time"]);
  const googleEndDate = pickRecordValue(record, ["end date"]);
  const googleEndTime = pickRecordValue(record, ["end time"]);

  if (googleStartDate && googleEndDate) {
    const start = parseDateCandidate(
      `${googleStartDate}${googleStartTime ? ` ${googleStartTime}` : ""}`
    );
    const end = parseDateCandidate(
      `${googleEndDate}${googleEndTime ? ` ${googleEndTime}` : ""}`
    );

    if (start && end) {
      return Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
    }
  }

  return 30;
}

export function parseCsvItemsText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const items = [];

  lines.slice(1).forEach((line) => {
    const values = splitCsvLine(line);
    const record = Object.fromEntries(
      headers.map((header, index) => [header, values[index] || ""])
    );

    if (/^(done|complete|completed|cancelled|canceled|archived)$/i.test(record.status || "")) {
      return;
    }

    const title = pickRecordValue(record, ["title", "summary", "name", "subject"]);
    if (!title) {
      return;
    }

    const note = pickRecordValue(record, [
      "note",
      "description",
      "details",
      "location",
      "notes",
    ]);
    const areaContext = [
      title,
      pickRecordValue(record, ["area", "tags", "type", "calendar name", "status"]),
      note,
    ]
      .filter(Boolean)
      .join(" ");
    const dueAt = parseCsvDateRecord(record);
    const isGoogleCalendarRow =
      headers.includes("subject") && headers.includes("start date") && headers.includes("start time");
    const hard =
      parseBooleanish(record.hard) ||
      isGoogleCalendarRow ||
      /event|meeting|appointment|class|call/i.test(areaContext);
    const priority = normalizePriority(
      record.priority,
      inferPriority(`${title} ${note} ${record.status || ""}`)
    );

    items.push({
      title,
      area: guessAreaFromText(areaContext),
      dueAt: dueAt?.toISOString() || "",
      note,
      hard,
      priority,
      durationMinutes: inferDurationFromRecord(record),
      recurrence:
        ["none", "daily", "weekly", "monthly"].includes(record.recurrence)
          ? record.recurrence
          : "none",
      recurrenceInterval: Number(record.recurrenceinterval || 1) || 1,
    });
  });

  return items;
}

function unfoldIcsLines(text) {
  return String(text || "").replace(/\r?\n[ \t]/g, "");
}

function parseIcsDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  if (/^\d{8}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    return new Date(year, month, day, 9, 0, 0, 0);
  }

  if (/^\d{8}T\d{6}Z$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    const hour = Number(raw.slice(9, 11));
    const minute = Number(raw.slice(11, 13));
    const second = Number(raw.slice(13, 15));
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  if (/^\d{8}T\d{4,6}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    const hour = Number(raw.slice(9, 11));
    const minute = Number(raw.slice(11, 13));
    const second = raw.length >= 15 ? Number(raw.slice(13, 15)) : 0;
    return new Date(year, month, day, hour, minute, second, 0);
  }

  return parseLooseDate(raw);
}

function unescapeIcsValue(value) {
  return String(value || "")
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";");
}

export function parseIcsItemsText(text) {
  const unfolded = unfoldIcsLines(text);
  const lines = unfolded.split(/\r?\n/);
  const items = [];
  let current = null;

  lines.forEach((line) => {
    if (line === "BEGIN:VEVENT" || line === "BEGIN:VTODO") {
      current = { kind: line.slice(6) };
      return;
    }

    if (line === "END:VEVENT" || line === "END:VTODO") {
      if (current?.summary) {
        const dueDate = parseIcsDate(current.dtstart || current.due);
        items.push({
          title: current.summary,
          area: guessAreaFromText(
            `${current.summary} ${current.description || ""} ${current.category || ""}`
          ),
          dueAt: dueDate ? dueDate.toISOString() : "",
          note: current.description || "",
          hard: current.kind === "VTODO" || Boolean(current.due),
          priority: current.kind === "VTODO" ? "high" : "normal",
          durationMinutes: 30,
          recurrence: "none",
          recurrenceInterval: 1,
        });
      }
      current = null;
      return;
    }

    if (!current || !line.includes(":")) {
      return;
    }

    const [rawKey, ...rawValueParts] = line.split(":");
    const key = rawKey.split(";")[0].toLowerCase();
    const value = unescapeIcsValue(rawValueParts.join(":"));

    if (key === "summary") {
      current.summary = value;
    } else if (key === "description") {
      current.description = value;
    } else if (key === "dtstart") {
      current.dtstart = value;
    } else if (key === "due") {
      current.due = value;
    } else if (key === "categories") {
      current.category = value;
    }
  });

  return items;
}

export function parseJsonImportText(text) {
  const parsed = JSON.parse(text);

  if (Array.isArray(parsed)) {
    return {
      kind: "items",
      items: parsed,
    };
  }

  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.customItems) || parsed.profile || parsed.areaNotes) {
      return {
        kind: "snapshot",
        snapshot: parsed,
      };
    }

    if (Array.isArray(parsed.items)) {
      return {
        kind: "items",
        items: parsed.items,
      };
    }
  }

  return {
    kind: "unknown",
    snapshot: parsed,
  };
}

export async function importItemsFromFile(file) {
  const name = file.name.toLowerCase();
  const text = await file.text();

  if (name.endsWith(".csv")) {
    return {
      kind: "items",
      items: parseCsvItemsText(text),
    };
  }

  if (name.endsWith(".ics")) {
    return {
      kind: "items",
      items: parseIcsItemsText(text),
    };
  }

  if (name.endsWith(".json")) {
    return parseJsonImportText(text);
  }

  return {
    kind: "items",
    items: extractCandidatesFromText(text, file.name),
  };
}

function parseScannedFileItems(fileName, text, sourcePath, limitPerFile) {
  const name = String(fileName || "").toLowerCase();

  if (name.endsWith(".csv")) {
    return parseCsvItemsText(text);
  }

  if (name.endsWith(".ics")) {
    return parseIcsItemsText(text);
  }

  if (name.endsWith(".json")) {
    const parsed = parseJsonImportText(text);
    return parsed.kind === "items" ? parsed.items : [];
  }

  return extractCandidatesFromText(text, sourcePath, { limit: limitPerFile });
}

async function scanDirectoryHandleRecursive(handle, files, depth, options, parentPath = "") {
  if (depth > options.maxDepth) {
    return;
  }

  for await (const entry of handle.values()) {
    if (files.length >= options.maxFiles) {
      return;
    }

    const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    if (entry.kind === "directory") {
      if (/node_modules|\.git|dist|build|coverage|\.next/i.test(entry.name)) {
        continue;
      }

      await scanDirectoryHandleRecursive(entry, files, depth + 1, options, relativePath);
      continue;
    }

    if (!/\.(md|txt|json|ics|csv|rtf|html?)$/i.test(entry.name)) {
      continue;
    }

    const file = await entry.getFile();
    if (file.size > options.maxBytesPerFile) {
      continue;
    }

    files.push({
      path: relativePath,
      file,
    });
  }
}

export async function scanSelectedDirectory(options = {}) {
  if (typeof window === "undefined" || !window.showDirectoryPicker) {
    throw new Error("Directory scanning is not supported in this browser.");
  }

  const pickerOptions = {
    id: options.pickerId || "life-console-scan",
    mode: "read",
  };

  if (options.startIn) {
    pickerOptions.startIn = options.startIn;
  }

  const directoryHandle = await window.showDirectoryPicker(pickerOptions);
  const files = [];
  const settings = {
    maxDepth: options.maxDepth ?? 3,
    maxFiles: options.maxFiles ?? 200,
    maxBytesPerFile: options.maxBytesPerFile ?? 400000,
    limitPerFile: options.limitPerFile ?? 6,
  };

  await scanDirectoryHandleRecursive(directoryHandle, files, 0, settings);
  const items = [];

  for (const entry of files) {
    const text = await entry.file.text();
    const parsedItems = parseScannedFileItems(
      entry.file.name,
      text,
      entry.path,
      settings.limitPerFile
    );
    items.push(...parsedItems);
  }

  const deduped = [];
  const seen = new Set();

  items
    .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0))
    .forEach((item) => {
      const key = `${item.title}|${item.dueAt}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    });

  return {
    directoryName: directoryHandle.name,
    filesScanned: files.length,
    presetId: options.pickerId || "life-console-scan",
    presetLabel: options.label || "Custom scan",
    items: deduped.slice(0, 80),
  };
}
