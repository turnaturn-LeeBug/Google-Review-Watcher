import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

export const PUBLIC_REPOSITORY = "https://github.com/turnaturn-LeeBug/Google-Review-Watcher.git";

export interface CommandResult { exitCode: number; stdout: string; stderr: string }
export interface CommandRunner { run(command: string, args: string[], cwd: string): Promise<CommandResult> }
export interface InstallationInfo {
  path: string;
  version: string;
  branch: string | null;
  tag: string | null;
  commit: string;
  remote: string;
  dirty: boolean;
}
export interface VersionCheck { installed: string; latestStable: string; status: "UP_TO_DATE" | "UPDATE_AVAILABLE" | "INSTALLED_NEWER" }
export interface UpdateResult {
  status: "ALREADY_UP_TO_DATE" | "CONFIRMATION_REQUIRED" | "UPDATED";
  previousVersion: string;
  currentVersion: string;
  targetVersion: string;
  stages: string[];
}

export class ProcessCommandRunner implements CommandRunner {
  async run(command: string, args: string[], cwd: string): Promise<CommandResult> {
    return new Promise((resolveResult, reject) => {
      const child = spawn(command, args, { cwd, shell: false, windowsHide: true, env: process.env });
      let stdout = ""; let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      child.on("error", reject);
      child.on("close", (code) => resolveResult({ exitCode: code ?? 1, stdout, stderr }));
    });
  }
}

const stablePattern = /^v?(\d+)\.(\d+)\.(\d+)$/;
export function compareStableVersions(left: string, right: string): number {
  const a = left.match(stablePattern); const b = right.match(stablePattern);
  if (!a || !b) throw new Error("Stable versions must use vMAJOR.MINOR.PATCH.");
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(a[index]) - Number(b[index]); if (difference) return difference;
  }
  return 0;
}

export function latestStableFromTags(output: string): string {
  const tags = output.split(/\r?\n/).map((line) => line.trim().split("refs/tags/").pop() ?? "")
    .filter((tag) => stablePattern.test(tag)).map((tag) => tag.startsWith("v") ? tag : `v${tag}`);
  if (!tags.length) throw new Error("No stable Review Watcher release tags were found.");
  return [...new Set(tags)].sort(compareStableVersions).at(-1)!;
}

async function installedVersion(path: string): Promise<string> {
  const packageVersion = (JSON.parse(await readFile(resolve(path, "package.json"), "utf8")) as { version?: string }).version;
  const pluginVersion = (JSON.parse(await readFile(resolve(path, ".codex-plugin/plugin.json"), "utf8")) as { version?: string }).version;
  if (!packageVersion || packageVersion !== pluginVersion) throw new Error("Package and plugin manifest versions do not match.");
  return packageVersion;
}

async function required(runner: CommandRunner, command: string, args: string[], cwd: string, stage: string): Promise<CommandResult> {
  const result = await runner.run(command, args, cwd);
  if (result.exitCode !== 0) throw new Error(`${stage} failed: ${(result.stderr || result.stdout).trim() || `exit ${result.exitCode}`}`);
  return result;
}

function safeRemote(value: string): string {
  try { const url = new URL(value.trim()); url.username = ""; url.password = ""; return url.toString(); }
  catch { return value.trim().replace(/\/\/[^/@]+@/, "//<redacted>@"); }
}

export async function inspectInstallation(path: string, runner: CommandRunner = new ProcessCommandRunner()): Promise<InstallationInfo> {
  const cwd = resolve(path); const root = (await required(runner, "git", ["rev-parse", "--show-toplevel"], cwd, "Git repository check")).stdout.trim();
  if (resolve(root).toLowerCase() !== cwd.toLowerCase()) throw new Error(`Review Watcher must be updated from its repository root: ${root}`);
  const status = await required(runner, "git", ["status", "--porcelain", "--untracked-files=all", "--ignored=no"], cwd, "Git status");
  const branch = (await required(runner, "git", ["branch", "--show-current"], cwd, "Git branch check")).stdout.trim() || null;
  const commit = (await required(runner, "git", ["rev-parse", "HEAD"], cwd, "Git commit check")).stdout.trim();
  const remote = safeRemote((await required(runner, "git", ["remote", "get-url", "origin"], cwd, "Git remote check")).stdout);
  const tagResult = await runner.run("git", ["describe", "--tags", "--exact-match"], cwd);
  return { path: cwd, version: await installedVersion(cwd), branch, tag: tagResult.exitCode === 0 ? tagResult.stdout.trim() : null,
    commit, remote, dirty: Boolean(status.stdout.trim()) };
}

export async function checkVersion(path: string, runner: CommandRunner = new ProcessCommandRunner()): Promise<VersionCheck> {
  const installation = await inspectInstallation(path, runner);
  const tags = await required(runner, "git", ["ls-remote", "--tags", "--refs", PUBLIC_REPOSITORY], installation.path, "Stable release check");
  const installedBase = installation.version.match(/^v?(\d+\.\d+\.\d+)/)?.[1];
  if (!installedBase) throw new Error(`Installed version is invalid: ${installation.version}`);
  const latestStable = latestStableFromTags(tags.stdout); const comparison = compareStableVersions(`v${installedBase}`, latestStable);
  return { installed: `v${installation.version.replace(/^v/, "")}`, latestStable,
    status: comparison === 0 ? "UP_TO_DATE" : comparison < 0 ? "UPDATE_AVAILABLE" : "INSTALLED_NEWER" };
}

function validatorStages(): Array<{ name: string; command: string; args: string[] }> {
  const python = process.platform === "win32" ? "python" : "python3";
  const plugin = resolve(homedir(), ".codex/skills/.system/plugin-creator/scripts/validate_plugin.py");
  const skill = resolve(homedir(), ".codex/skills/.system/skill-creator/scripts/quick_validate.py");
  const stages: Array<{ name: string; command: string; args: string[] }> = [];
  if (existsSync(plugin)) stages.push({ name: "plugin validation", command: python, args: [plugin, "."] });
  if (existsSync(skill)) stages.push({ name: "skill validation", command: python, args: [skill, "skills/review-watcher"] });
  return stages;
}

export async function updateReviewWatcher(path: string, confirmed: boolean, runner: CommandRunner = new ProcessCommandRunner()): Promise<UpdateResult> {
  const installation = await inspectInstallation(path, runner);
  if (installation.dirty) throw new Error("Tracked or unignored local source modifications exist. Review them before updating; no changes were made.");
  const version = await checkVersion(path, runner);
  if (version.status === "UP_TO_DATE") return { status: "ALREADY_UP_TO_DATE", previousVersion: version.installed,
    currentVersion: version.installed, targetVersion: version.latestStable, stages: [] };
  if (version.status === "INSTALLED_NEWER") return { status: "ALREADY_UP_TO_DATE", previousVersion: version.installed,
    currentVersion: version.installed, targetVersion: version.latestStable, stages: [] };
  if (!confirmed) return { status: "CONFIRMATION_REQUIRED", previousVersion: version.installed,
    currentVersion: version.installed, targetVersion: version.latestStable, stages: [] };
  const stages: string[] = [];
  await required(runner, "git", ["fetch", "--tags", PUBLIC_REPOSITORY], installation.path, "tag fetch"); stages.push("tag fetch");
  await required(runner, "git", ["rev-parse", "--verify", `refs/tags/${version.latestStable}^{commit}`], installation.path, "target tag verification"); stages.push("target tag verification");
  await required(runner, "git", ["checkout", "--detach", version.latestStable], installation.path, "release checkout"); stages.push("release checkout");
  for (const stage of [
    { name: "dependency installation", command: "pnpm", args: ["install", "--frozen-lockfile"] },
    { name: "build", command: "pnpm", args: ["build"] },
    { name: "tests", command: "pnpm", args: ["test"] },
    { name: "dependency audit", command: "pnpm", args: ["audit", "--audit-level", "moderate"] },
    ...validatorStages()
  ]) { await required(runner, stage.command, stage.args, installation.path, stage.name); stages.push(stage.name); }
  const current = `v${(await installedVersion(installation.path)).replace(/^v/, "")}`;
  if (current !== version.latestStable) throw new Error(`Updated files report ${current}, expected ${version.latestStable}.`);
  return { status: "UPDATED", previousVersion: version.installed, currentVersion: current,
    targetVersion: version.latestStable, stages };
}
