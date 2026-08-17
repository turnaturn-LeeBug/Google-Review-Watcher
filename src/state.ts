import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SeenState } from "./types.js";

export const emptyState = (): SeenState => ({ version: 1, fingerprints: [], updatedAt: null });

export async function readState(path: string): Promise<SeenState> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<SeenState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.fingerprints) ||
        !parsed.fingerprints.every((item) => typeof item === "string")) throw new Error(`Invalid state file: ${path}`);
    return { version: 1, fingerprints: [...new Set(parsed.fingerprints)].sort(), updatedAt: parsed.updatedAt ?? null };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
    throw error;
  }
}

export async function writeStateAtomic(path: string, state: SeenState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  const stable: SeenState = { version: 1, fingerprints: [...new Set(state.fingerprints)].sort(), updatedAt: state.updatedAt };
  await writeFile(temporary, `${JSON.stringify(stable, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, path);
}
