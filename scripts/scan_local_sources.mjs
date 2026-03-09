import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  extractCandidatesFromText,
  parseCsvItemsText,
  parseIcsItemsText,
} from "../src/lib/dataTools.js";

const HOME = os.homedir();
const ROOTS = [
  path.join(HOME, "Documents"),
  path.join(HOME, "Desktop"),
  path.join(HOME, "Downloads"),
  path.join(HOME, "Applications", "docs"),
];
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "public/generated/local-scan.json"
);
const MAX_DEPTH = 3;
const MAX_FILES = 300;
const MAX_BYTES = 400000;

async function collectFiles(rootPath, depth, files) {
  if (depth > MAX_DEPTH || files.length >= MAX_FILES) {
    return;
  }

  let entries = [];
  try {
    entries = await readdir(rootPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (files.length >= MAX_FILES) {
      return;
    }

    const nextPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      if (/node_modules|\.git|dist|build|Photo Booth Library|\.photoslibrary/i.test(nextPath)) {
        continue;
      }
      await collectFiles(nextPath, depth + 1, files);
      continue;
    }

    if (!/\.(md|txt|json|ics|csv|rtf|html?)$/i.test(entry.name)) {
      continue;
    }

    try {
      const fileStat = await stat(nextPath);
      if (fileStat.size > MAX_BYTES) {
        continue;
      }
      files.push(nextPath);
    } catch {
      continue;
    }
  }
}

function createStableId(item, sourcePath) {
  return `${item.title}-${item.dueAt}-${sourcePath}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const files = [];
for (const rootPath of ROOTS) {
  await collectFiles(rootPath, 0, files);
}

const items = [];
const warnings = [];

for (const filePath of files) {
  try {
    const text = await readFile(filePath, "utf8");
    const relativePath = path.relative(HOME, filePath);
    const extension = path.extname(filePath).toLowerCase();
    let parsedItems = [];

    if (extension === ".csv") {
      parsedItems = parseCsvItemsText(text);
    } else if (extension === ".ics") {
      parsedItems = parseIcsItemsText(text);
    } else {
      parsedItems = extractCandidatesFromText(text, relativePath, { limit: 8 });
    }

    parsedItems.forEach((item) => {
      items.push({
        id: createStableId(item, relativePath),
        title: item.title,
        area: item.area,
        dueAt: item.dueAt,
        note: item.note || `Inferred from ${relativePath}.`,
        hard: Boolean(item.hard),
        priority: item.priority || "normal",
        durationMinutes: item.durationMinutes || 30,
      });
    });
  } catch (error) {
    warnings.push(`Could not read ${filePath}: ${error.message}`);
  }
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

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      items: deduped.slice(0, 120),
      warnings,
      sourcesScanned: ROOTS.map((rootPath) => path.relative(HOME, rootPath)),
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${deduped.length} inferred items to ${OUTPUT_PATH}`);
