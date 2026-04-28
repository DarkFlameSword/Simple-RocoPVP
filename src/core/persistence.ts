/**
 * Persistence layer using Tauri's fs plugin.
 *
 * Layout under %APPDATA%/com.simplerocopvp.helper/:
 *   user-data/
 *     battle_events.jsonl   append-only log, mode A
 *     community_teams.json  mode B
 *     settings.json         user preferences + lambdas
 *     config/               optional override of bundled config
 */
import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
  remove,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import type {
  AppSettings,
  BattleEntry,
  BattleEvent,
  CommunityTeam,
  ValidDuals,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

/**
 * Map of renamed type tokens. Migrates user data created before
 * the 通用→普通 / 恶魔→恶 rename so existing comboIds still resolve.
 */
const TYPE_RENAME: Record<string, string> = {
  通用: "普通",
  恶魔: "恶",
};

/** Rewrite a legacy comboId to use the current type names. */
export function migrateComboId(id: string): string {
  if (id.startsWith("s_")) {
    const t = id.slice(2);
    return `s_${TYPE_RENAME[t] ?? t}`;
  }
  if (id.startsWith("d_")) {
    const parts = id.slice(2).split("_");
    const renamed = parts.map((p) => TYPE_RENAME[p] ?? p);
    renamed.sort();
    return `d_${renamed.join("_")}`;
  }
  return id;
}

/**
 * Migrate legacy `string[]` enemy/member arrays to `BattleEntry[]`,
 * and rewrite any renamed type tokens in comboIds.
 */
function normalizeEntries(raw: unknown): BattleEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x): BattleEntry => {
      if (typeof x === "string") return { comboId: migrateComboId(x) };
      if (x && typeof x === "object" && typeof (x as any).comboId === "string") {
        const e = x as BattleEntry;
        return {
          comboId: migrateComboId(e.comboId),
          petId: e.petId,
          petName: e.petName,
        };
      }
      return { comboId: "" };
    })
    .filter((e) => e.comboId);
}

const USER_DIR = "user-data";
const CONFIG_DIR = `${USER_DIR}/config`;
const EVENTS_FILE = `${USER_DIR}/battle_events.jsonl`;
const TEAMS_FILE = `${USER_DIR}/community_teams.json`;
const SETTINGS_FILE = `${USER_DIR}/settings.json`;
const VALID_DUALS_OVERRIDE = `${CONFIG_DIR}/valid_duals.json`;

async function ensureUserDir(): Promise<void> {
  if (!(await exists(USER_DIR, { baseDir: BaseDirectory.AppData }))) {
    await mkdir(USER_DIR, {
      baseDir: BaseDirectory.AppData,
      recursive: true,
    });
  }
}

async function ensureConfigDir(): Promise<void> {
  await ensureUserDir();
  if (!(await exists(CONFIG_DIR, { baseDir: BaseDirectory.AppData }))) {
    await mkdir(CONFIG_DIR, {
      baseDir: BaseDirectory.AppData,
      recursive: true,
    });
  }
}

export async function saveValidDualsOverride(
  duals: ValidDuals,
): Promise<void> {
  await ensureConfigDir();
  await writeTextFile(VALID_DUALS_OVERRIDE, JSON.stringify(duals, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
}

export async function clearValidDualsOverride(): Promise<void> {
  if (await exists(VALID_DUALS_OVERRIDE, { baseDir: BaseDirectory.AppData })) {
    await remove(VALID_DUALS_OVERRIDE, { baseDir: BaseDirectory.AppData });
  }
}

export async function hasValidDualsOverride(): Promise<boolean> {
  return await exists(VALID_DUALS_OVERRIDE, {
    baseDir: BaseDirectory.AppData,
  });
}

export async function loadEvents(): Promise<BattleEvent[]> {
  await ensureUserDir();
  if (!(await exists(EVENTS_FILE, { baseDir: BaseDirectory.AppData }))) {
    return [];
  }
  const text = await readTextFile(EVENTS_FILE, {
    baseDir: BaseDirectory.AppData,
  });
  const out: BattleEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const raw = JSON.parse(trimmed) as Partial<BattleEvent> & {
        enemies: unknown;
      };
      out.push({
        timestamp: raw.timestamp ?? "",
        configVersion: raw.configVersion ?? "unknown",
        enemies: normalizeEntries(raw.enemies),
        notes: raw.notes,
        partial: raw.partial ?? false,
      });
    } catch {
      // skip malformed
    }
  }
  return out;
}

export async function appendEvent(event: BattleEvent): Promise<void> {
  await ensureUserDir();
  let prior = "";
  if (await exists(EVENTS_FILE, { baseDir: BaseDirectory.AppData })) {
    prior = await readTextFile(EVENTS_FILE, {
      baseDir: BaseDirectory.AppData,
    });
    if (prior.length > 0 && !prior.endsWith("\n")) prior += "\n";
  }
  await writeTextFile(EVENTS_FILE, prior + JSON.stringify(event) + "\n", {
    baseDir: BaseDirectory.AppData,
  });
}

export async function rewriteEvents(events: BattleEvent[]): Promise<void> {
  await ensureUserDir();
  const text = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await writeTextFile(EVENTS_FILE, text, { baseDir: BaseDirectory.AppData });
}

export async function loadTeams(): Promise<CommunityTeam[]> {
  await ensureUserDir();
  if (!(await exists(TEAMS_FILE, { baseDir: BaseDirectory.AppData }))) {
    return [];
  }
  const text = await readTextFile(TEAMS_FILE, {
    baseDir: BaseDirectory.AppData,
  });
  try {
    const raw = JSON.parse(text);
    if (!Array.isArray(raw)) return [];
    return raw.map(
      (t: any): CommunityTeam => ({
        id: t.id,
        name: t.name,
        popularity: t.popularity ?? 0.5,
        configVersion: t.configVersion ?? "unknown",
        members: normalizeEntries(t.members),
        sourceDate: t.sourceDate ?? "",
        reviewedAt: t.reviewedAt ?? "",
      }),
    );
  } catch {
    return [];
  }
}

export async function saveTeams(teams: CommunityTeam[]): Promise<void> {
  await ensureUserDir();
  await writeTextFile(TEAMS_FILE, JSON.stringify(teams, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
}

export async function loadSettings(): Promise<AppSettings> {
  await ensureUserDir();
  if (!(await exists(SETTINGS_FILE, { baseDir: BaseDirectory.AppData }))) {
    return { ...DEFAULT_SETTINGS };
  }
  const text = await readTextFile(SETTINGS_FILE, {
    baseDir: BaseDirectory.AppData,
  });
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(text) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await ensureUserDir();
  await writeTextFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
}
