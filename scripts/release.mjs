// Litma release: one version number for the web app, the desktop app and (later) the mobile app.
//
//   node scripts/release.mjs patch|minor|major|<x.y.z> [--notes "text"] [--min-desktop x.y.z] [--dry-run]
//
// 1. bumps "version" in package.json, apps/web, apps/desktop and packages/* (semver)
// 2. adds a section to CHANGELOG.md from the commit summaries since the last v* tag
// 3. writes release/notes.md (used for the GitHub release and the in-app "What's new")
// 4. prints the new version (CI reads it from release/version.txt)
// Committing and tagging is left to the caller (the Release workflow, or you: see README → Releases).
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const VALUED = new Set(["--notes", "--min-desktop"]);
const bump = args.find((a, i) => !a.startsWith("--") && !VALUED.has(args[i - 1])) ?? "patch";
const dry = args.includes("--dry-run");

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const writeJson = (p, d) => !dry && writeFileSync(join(root, p), JSON.stringify(d, null, 2) + "\n");

const current = readJson("package.json").version;
const m = current.match(SEMVER);
if (!m) throw new Error(`package.json version "${current}" is not semver`);
let next;
if (SEMVER.test(bump)) next = bump;
else {
  const [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
  next = bump === "major" ? `${maj + 1}.0.0` : bump === "minor" ? `${maj}.${min + 1}.0` : bump === "patch" ? `${maj}.${min}.${pat + 1}` : null;
  if (!next) throw new Error(`Unknown bump "${bump}". Use patch, minor, major or an exact x.y.z`);
}
const cmp = (a, b) => {
  const x = a.match(SEMVER).slice(1, 4).map(Number);
  const y = b.match(SEMVER).slice(1, 4).map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};
if (cmp(next, current) <= 0) throw new Error(`New version ${next} must be higher than ${current}`);

// every workspace that ships carries the same version
const manifests = ["package.json", "apps/web/package.json", "apps/desktop/package.json", ...["shared", "i18n", "keyboards", "tokens"].map((p) => `packages/${p}/package.json`)];
for (const p of manifests) {
  if (!existsSync(join(root, p))) continue;
  const d = readJson(p);
  d.version = next;
  writeJson(p, d);
}
// the Flutter app: pubspec version X.Y.Z+N (stores need a growing build number: CI run number, else +1)
const pubspec = "apps/mobile/pubspec.yaml";
if (existsSync(join(root, pubspec))) {
  const text = readFileSync(join(root, pubspec), "utf8");
  const build = Number(process.env.GITHUB_RUN_NUMBER) || Number(text.match(/^version: [^+\n]+\+(\d+)/m)?.[1] ?? 0) + 1;
  if (!dry) writeFileSync(join(root, pubspec), text.replace(/^version: .*$/m, `version: ${next}+${build}`));
}
// keep the lockfile's workspace versions in step without a full npm install
if (existsSync(join(root, "package-lock.json"))) {
  const lock = readJson("package-lock.json");
  lock.version = next;
  for (const [k, v] of Object.entries(lock.packages ?? {})) {
    if (k === "" || /^(apps|packages)\/[^/]+$/.test(k)) v.version = next;
  }
  writeJson("package-lock.json", lock);
}

// release notes: shown to writers in the update card and on the download page.
// Only the owner's own text from the Release workflow's "notes" box (--notes) is used. Commit messages
// are never used. Without notes, writers see no list at all (CHANGELOG.md says "Small fixes and improvements.").
const commits = [];
const extra = opt("--notes");
const date = new Date().toISOString().slice(0, 10);
const bullets = [...(extra ? [extra] : []), ...commits].map((s) => `- ${s}`).join("\n") || "- Small fixes and improvements.";
const section = `## ${next} · ${date}\n\n${bullets}\n`;

const clPath = join(root, "CHANGELOG.md");
const header = "# Changelog\n\nOne version number covers the website, the desktop app and the mobile app. Newest first.\n\n";
const old = existsSync(clPath) ? readFileSync(clPath, "utf8").replace(header, "") : "";
if (!dry) writeFileSync(clPath, header + section + (old ? `\n${old}` : ""));

if (!dry) {
  mkdirSync(join(root, "release"), { recursive: true });
  writeFileSync(join(root, "release/notes.md"), bullets + "\n");
  writeFileSync(join(root, "release/version.txt"), next + "\n");
  const minDesktop = opt("--min-desktop");
  writeFileSync(join(root, "release/meta.json"), JSON.stringify({ version: next, date, minDesktop: minDesktop ?? null, notes: [...(extra ? [extra] : []), ...commits].slice(0, 12) }, null, 2) + "\n");
}
console.log(`${current} → ${next}${dry ? " (dry run)" : ""}`);
console.log(section);
