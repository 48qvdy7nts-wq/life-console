import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);
const HOME = os.homedir();
const OUTPUT_PATH = path.resolve(process.cwd(), "public/generated/project-sync.json");

const PROJECTS = [
  {
    name: "Vordrak",
    path: path.join(HOME, "Desktop", "Vordrak"),
    type: "git",
    note: "Primary active game project.",
  },
  {
    name: "Life Console",
    path: process.cwd(),
    type: "git",
    note: "This dashboard project.",
  },
  {
    name: "HVLT runner",
    path: path.join(HOME, "Desktop", "hvlt-runner"),
    type: "folder",
    note: "Academic support app for PSYC 101 memory workflow.",
  },
];

function rel(targetPath) {
  return path.relative(HOME, targetPath) || ".";
}

function countStatusLines(stdout) {
  const lines = String(stdout || "")
    .split(/\r?\n/)
    .filter(Boolean);

  let tracked = 0;
  let untracked = 0;

  lines.forEach((line) => {
    if (line.startsWith("??")) {
      untracked += 1;
    } else {
      tracked += 1;
    }
  });

  return {
    tracked,
    untracked,
    total: tracked + untracked,
  };
}

async function safeExecFile(file, args, options = {}) {
  try {
    return await execFileAsync(file, args, options);
  } catch (error) {
    return {
      stdout: "",
      stderr: error.stderr || error.message || "",
      failed: true,
    };
  }
}

async function detectGithubAuth() {
  const result = await safeExecFile("gh", ["auth", "status"]);
  return {
    loggedIn: !result.failed,
    detail: result.failed
      ? "GitHub CLI is not authenticated on this machine."
      : "GitHub CLI is authenticated on this machine.",
  };
}

async function readGddGoal() {
  const gddPath = path.join(HOME, "Downloads", "GDD.md");

  try {
    const text = await readFile(gddPath, "utf8");
    const match = text.match(/\*\*Next session goal:\*\*\s*(.+)/i);
    if (!match) {
      return null;
    }

    return {
      sourcePath: rel(gddPath),
      goal: match[1].trim(),
    };
  } catch {
    return null;
  }
}

async function inspectProject(project) {
  try {
    await access(project.path);
  } catch {
    return {
      name: project.name,
      path: rel(project.path),
      exists: false,
      type: project.type,
      note: project.note,
    };
  }

  if (project.type !== "git") {
    return {
      name: project.name,
      path: rel(project.path),
      exists: true,
      type: project.type,
      note: project.note,
      git: false,
    };
  }

  const branchResult = await safeExecFile("git", ["-C", project.path, "rev-parse", "--abbrev-ref", "HEAD"]);
  const remoteResult = await safeExecFile("git", ["-C", project.path, "remote", "get-url", "origin"]);
  const statusResult = await safeExecFile("git", ["-C", project.path, "status", "--porcelain"]);
  const lastCommitResult = await safeExecFile("git", [
    "-C",
    project.path,
    "log",
    "-1",
    "--date=iso-strict",
    "--pretty=format:%ad%n%s",
  ]);

  const [lastCommitAt = "", lastCommitMessage = ""] = String(lastCommitResult.stdout || "")
    .split(/\r?\n/);
  const workingTree = countStatusLines(statusResult.stdout);

  return {
    name: project.name,
    path: rel(project.path),
    exists: true,
    type: project.type,
    note: project.note,
    git: true,
    branch: String(branchResult.stdout || "").trim(),
    remote: String(remoteResult.stdout || "").trim(),
    hasRemote: Boolean(String(remoteResult.stdout || "").trim()),
    workingTree,
    lastCommitAt,
    lastCommitMessage,
  };
}

const githubAuth = await detectGithubAuth();
const legacyGoal = await readGddGoal();
const projects = [];

for (const project of PROJECTS) {
  projects.push(await inspectProject(project));
}

const warnings = [];
const currentProject = projects.find((project) => project.path === rel(process.cwd()));

if (!githubAuth.loggedIn) {
  warnings.push(githubAuth.detail);
}

if (currentProject?.git && !currentProject.hasRemote) {
  warnings.push("Life Console has no git remote configured, so free Pages deploy cannot be pushed from here.");
}

if (legacyGoal?.goal) {
  const vordrak = projects.find((project) => project.name === "Vordrak");
  if (vordrak) {
    vordrak.referenceGoal = legacyGoal.goal;
    vordrak.referenceGoalSource = legacyGoal.sourcePath;
  }
}

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      githubAuth,
      projects,
      warnings,
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${projects.length} project records to ${OUTPUT_PATH}`);
if (warnings.length) {
  console.log(warnings.join("\n"));
}
