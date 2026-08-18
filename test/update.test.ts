import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { checkVersion, inspectInstallation, latestStableFromTags, updateReviewWatcher,
  type CommandResult, type CommandRunner } from "../src/update.js";

async function writeVersions(root: string, version: string): Promise<void> {
  await mkdir(join(root, ".codex-plugin"), { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ version }));
  await writeFile(join(root, ".codex-plugin", "plugin.json"), JSON.stringify({ version }));
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "review-watcher-update-"));
  await writeVersions(root, "0.2.0"); return root;
}

class FakeRunner implements CommandRunner {
  calls: string[] = [];
  dirty = false;
  tags = "a refs/tags/v0.2.0\nb refs/tags/v0.2.1\nc refs/tags/v0.3.0-rc.1\n";
  targetExists = true;
  failStage: string | null = null;
  constructor(private readonly root: string) {}

  async run(command: string, args: string[]): Promise<CommandResult> {
    const key = `${command} ${args.join(" ")}`; this.calls.push(key);
    const ok = (stdout = ""): CommandResult => ({ exitCode: 0, stdout, stderr: "" });
    const failed = (message: string): CommandResult => ({ exitCode: 1, stdout: "", stderr: message });
    if (key === "git rev-parse --show-toplevel") return ok(this.root);
    if (key === "git status --porcelain --untracked-files=all --ignored=no") return ok(this.dirty ? " M src/local.ts\n" : "");
    if (key === "git branch --show-current") return ok("main\n");
    if (key === "git rev-parse HEAD") return ok("abc123\n");
    if (key === "git remote get-url origin") return ok("https://placeholder-user:placeholder-value@example.test/review-watcher.git\n");
    if (key === "git describe --tags --exact-match") return ok("v0.2.0\n");
    if (key.startsWith("git ls-remote --tags --refs")) return ok(this.tags);
    if (key.startsWith("git fetch --tags")) return this.failStage === "fetch" ? failed("fetch failed") : ok();
    if (key.startsWith("git rev-parse --verify refs/tags/")) return this.targetExists ? ok("def456\n") : failed("unknown revision");
    if (key.startsWith("git checkout --detach")) { await writeVersions(this.root, args.at(-1)!.replace(/^v/, "")); return ok(); }
    if (command === "pnpm") {
      const stage = args[0] === "install" ? "install" : args[0];
      return this.failStage === stage ? failed(`${stage} failed`) : ok();
    }
    if (command === "python" || command === "python3") return ok();
    return failed(`unexpected command: ${key}`);
  }
}

describe("stable release detection", () => {
  test("current version equals latest stable", async () => {
    const root = await fixture(); const runner = new FakeRunner(root); runner.tags = "a refs/tags/v0.2.0\nb refs/tags/v0.3.0-rc.1\n";
    expect(await checkVersion(root, runner)).toMatchObject({ installed: "v0.2.0", latestStable: "v0.2.0", status: "UP_TO_DATE" });
  });

  test("newer stable release is available", async () => {
    const root = await fixture(); expect((await checkVersion(root, new FakeRunner(root))).status).toBe("UPDATE_AVAILABLE");
  });

  test("prereleases are ignored by default", () => {
    expect(latestStableFromTags("a refs/tags/v0.2.0\nb refs/tags/v0.3.0-rc.1\nc refs/tags/v0.2.1-beta.2\n")).toBe("v0.2.0");
  });
});

describe("safe update flow", () => {
  test("dirty tracked working tree blocks update", async () => {
    const root = await fixture(); const runner = new FakeRunner(root); runner.dirty = true;
    await expect(updateReviewWatcher(root, true, runner)).rejects.toThrow(/source modifications/);
    expect(runner.calls.some((item) => item.includes("checkout"))).toBe(false);
  });

  test("ignored user files do not block update", async () => {
    const root = await fixture(); const runner = new FakeRunner(root);
    await mkdir(join(root, "reports")); await writeFile(join(root, "reports", "private.xlsx"), "private report");
    expect((await updateReviewWatcher(root, true, runner)).status).toBe("UPDATED");
    expect(await readFile(join(root, "reports", "private.xlsx"), "utf8")).toBe("private report");
  });

  test("confirmation is required before checkout", async () => {
    const root = await fixture(); const runner = new FakeRunner(root);
    expect((await updateReviewWatcher(root, false, runner)).status).toBe("CONFIRMATION_REQUIRED");
    expect(runner.calls.some((item) => item.includes("checkout"))).toBe(false);
  });

  test("user configuration remains untouched", async () => {
    const root = await fixture(); const runner = new FakeRunner(root); await mkdir(join(root, "config"));
    await writeFile(join(root, "config", "business.json"), "private config"); await updateReviewWatcher(root, true, runner);
    expect(await readFile(join(root, "config", "business.json"), "utf8")).toBe("private config");
  });

  test("review state remains untouched", async () => {
    const root = await fixture(); const runner = new FakeRunner(root); await mkdir(join(root, "data"));
    await writeFile(join(root, "data", "state.json"), "private state"); await updateReviewWatcher(root, true, runner);
    expect(await readFile(join(root, "data", "state.json"), "utf8")).toBe("private state");
  });

  test("target stable tag must verify", async () => {
    const root = await fixture(); const runner = new FakeRunner(root); runner.targetExists = false;
    await expect(updateReviewWatcher(root, true, runner)).rejects.toThrow(/target tag verification failed/);
  });

  test("failed build cannot report success", async () => {
    const root = await fixture(); const runner = new FakeRunner(root); runner.failStage = "build";
    await expect(updateReviewWatcher(root, true, runner)).rejects.toThrow(/build failed/);
  });

  test("failed tests cannot report success", async () => {
    const root = await fixture(); const runner = new FakeRunner(root); runner.failStage = "test";
    await expect(updateReviewWatcher(root, true, runner)).rejects.toThrow(/tests failed/);
  });

  test("successful update reports old and new versions", async () => {
    const root = await fixture(); const result = await updateReviewWatcher(root, true, new FakeRunner(root));
    expect(result).toMatchObject({ status: "UPDATED", previousVersion: "v0.2.0", currentVersion: "v0.2.1", targetVersion: "v0.2.1" });
  });

  test("remote credentials are redacted during inspection", async () => {
    const root = await fixture(); expect((await inspectInstallation(root, new FakeRunner(root))).remote).not.toContain("placeholder-value");
  });
});
