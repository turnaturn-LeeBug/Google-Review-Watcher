import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { BusinessState, SeenState } from "./types.js";

export const emptyBusinessState = (businessId: string): BusinessState => ({
  version: 2, businessId, fingerprints: [], identities: [], lastSuccessfulRun: null, updatedAt: null
});

export async function readBusinessState(path: string, businessId: string, legacyPath?: string): Promise<BusinessState> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<BusinessState>;
    if (parsed.version !== 2 || parsed.businessId !== businessId || !Array.isArray(parsed.fingerprints) ||
        !Array.isArray(parsed.identities)) throw new Error(`Invalid business state file: ${path}`);
    return { version: 2, businessId, fingerprints: [...new Set(parsed.fingerprints)].sort(),
      identities: [...new Set(parsed.identities)].sort(), lastSuccessfulRun: parsed.lastSuccessfulRun ?? null,
      updatedAt: parsed.updatedAt ?? null };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (legacyPath) {
    try {
      const legacy = JSON.parse(await readFile(legacyPath, "utf8")) as SeenState;
      if (legacy.version === 1 && Array.isArray(legacy.fingerprints)) return {
        version: 2, businessId, fingerprints: [...new Set(legacy.fingerprints)].sort(),
        identities: [...new Set(legacy.fingerprints.map((item) => `sha256:${item}`))].sort(),
        lastSuccessfulRun: legacy.updatedAt ?? null, updatedAt: legacy.updatedAt ?? null
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return emptyBusinessState(businessId);
}

export async function writeBusinessStateAtomic(path: string, state: BusinessState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  const stable: BusinessState = { ...state, fingerprints: [...new Set(state.fingerprints)].sort(),
    identities: [...new Set(state.identities)].sort() };
  await writeFile(temporary, `${JSON.stringify(stable, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, path);
}
