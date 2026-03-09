import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { guessAreaFromText } from "../src/lib/dataTools.js";

const execFileAsync = promisify(execFile);
const outputPath = path.resolve(
  process.cwd(),
  "public/generated/apple-sync.json"
);

function buildId(prefix, title, dueAt, scope) {
  return `${prefix}-${scope}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + `-${dueAt.slice(0, 10)}`;
}

async function fetchAppleData() {
  const start = new Date();
  const end = new Date(start.getTime() + 45 * 86400000);
  const script = `
    const output = {
      generatedAt: new Date().toISOString(),
      calendarEvents: [],
      reminders: [],
      warnings: []
    };
    const start = new Date(${JSON.stringify(start.toISOString())});
    const end = new Date(${JSON.stringify(end.toISOString())});

    function safeText(value) {
      return value ? String(value) : "";
    }

    try {
      const Calendar = Application("Calendar");
      Calendar.includeStandardAdditions = true;
      Calendar.calendars().forEach((calendar) => {
        try {
          calendar.events().forEach((event) => {
            try {
              const eventStart = event.startDate();
              if (!eventStart || eventStart < start || eventStart > end) {
                return;
              }
              const eventEnd = event.endDate();
              output.calendarEvents.push({
                calendar: safeText(calendar.name()),
                title: safeText(event.summary()) || "Untitled event",
                note: safeText(event.description()),
                dueAt: eventStart.toISOString(),
                durationMinutes: eventEnd
                  ? Math.max(15, Math.round((eventEnd - eventStart) / 60000))
                  : 60
              });
            } catch (innerError) {}
          });
        } catch (calendarError) {
          output.warnings.push("Calendar read failed for " + safeText(calendar.name()));
        }
      });
    } catch (error) {
      output.warnings.push("Calendar access failed. macOS may need Automation permission.");
    }

    try {
      const Reminders = Application("Reminders");
      Reminders.includeStandardAdditions = true;
      Reminders.lists().forEach((list) => {
        try {
          list.reminders().forEach((reminder) => {
            try {
              const completed = reminder.completed ? reminder.completed() : false;
              if (completed) {
                return;
              }
              const due = reminder.dueDate();
              if (!due || due < start || due > end) {
                return;
              }
              output.reminders.push({
                list: safeText(list.name()),
                title: safeText(reminder.name()) || safeText(reminder.body()) || "Untitled reminder",
                note: safeText(reminder.body()),
                dueAt: due.toISOString(),
                durationMinutes: 15
              });
            } catch (innerError) {}
          });
        } catch (listError) {
          output.warnings.push("Reminder list read failed for " + safeText(list.name()));
        }
      });
    } catch (error) {
      output.warnings.push("Reminders access failed. macOS may need Automation permission.");
    }

    JSON.stringify(output);
  `;

  try {
    const { stdout } = await execFileAsync(
      "osascript",
      ["-l", "JavaScript", "-e", script],
      { timeout: 10000 }
    );
    return JSON.parse(stdout || "{}");
  } catch (error) {
    const detail =
      error?.killed || error?.signal === "SIGTERM"
        ? "The Apple script timed out after 10 seconds."
        : error?.stderr?.trim()
          ? `Apple script stderr: ${error.stderr.trim().slice(0, 220)}`
          : typeof error?.code !== "undefined"
            ? `Apple script exited with code ${error.code}.`
            : "Apple script failed before it could return data.";

    return {
      generatedAt: new Date().toISOString(),
      calendarEvents: [],
      reminders: [],
      warnings: [
        "Apple sync failed to execute. Calendar and Reminders may be blocked by permissions or timed out.",
        detail,
      ],
    };
  }
}

const raw = await fetchAppleData();
const items = [
  ...(raw.calendarEvents || []).map((entry) => ({
    id: buildId("apple-calendar", entry.title, entry.dueAt, entry.calendar || "calendar"),
    title: entry.title,
    area: guessAreaFromText(`${entry.title} ${entry.note} ${entry.calendar}`),
    dueAt: entry.dueAt,
    note: entry.note
      ? `${entry.note} Calendar: ${entry.calendar}.`
      : `Calendar: ${entry.calendar}.`,
    hard: false,
    priority: "normal",
    durationMinutes: entry.durationMinutes || 60,
  })),
  ...(raw.reminders || []).map((entry) => ({
    id: buildId("apple-reminder", entry.title, entry.dueAt, entry.list || "reminders"),
    title: entry.title,
    area: guessAreaFromText(`${entry.title} ${entry.note} ${entry.list}`),
    dueAt: entry.dueAt,
    note: entry.note
      ? `${entry.note} Reminder list: ${entry.list}.`
      : `Reminder list: ${entry.list}.`,
    hard: true,
    priority: "high",
    durationMinutes: entry.durationMinutes || 15,
  })),
].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      generatedAt: raw.generatedAt || new Date().toISOString(),
      items,
      warnings: raw.warnings || [],
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${items.length} Apple items to ${outputPath}`);
if (raw.warnings?.length) {
  console.log(raw.warnings.join("\n"));
}
