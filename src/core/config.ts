/**
 * Loads bundled configuration (type matrix + valid duals + manifest)
 * from Tauri's resource directory. The user-imported override (in
 * AppData) takes precedence when present (§4.4 upgrade flow).
 */
import { readTextFile, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import { resolveResource } from "@tauri-apps/api/path";
import type {
  ComboIndexBundle,
  ComboInfo,
  ConfigManifest,
  PetsBundle,
  TypeMatrix,
  ValidDuals,
} from "./types";

const APPDATA_CONFIG_DIR = "user-data/config";
const TYPE_MATRIX_FILE = "type_matrix.json";
const VALID_DUALS_FILE = "valid_duals.json";
const MANIFEST_FILE = "manifest.json";
const PETS_FILE = "pets.json";
const COMBO_INDEX_FILE = "combo_index.json";

async function readBundled(rel: string): Promise<string> {
  const abs = await resolveResource(`resources/config/${rel}`);
  return await readTextFile(abs);
}

async function readOverrideOrBundled(rel: string): Promise<string> {
  const overridePath = `${APPDATA_CONFIG_DIR}/${rel}`;
  if (await exists(overridePath, { baseDir: BaseDirectory.AppData })) {
    return await readTextFile(overridePath, {
      baseDir: BaseDirectory.AppData,
    });
  }
  return await readBundled(rel);
}

export async function loadTypeMatrix(): Promise<TypeMatrix> {
  return JSON.parse(await readOverrideOrBundled(TYPE_MATRIX_FILE)) as TypeMatrix;
}

/**
 * Map of renamed type tokens. Migrates user override created before
 * the 通用→普通 / 恶魔→恶 rename so legacy entries keep working.
 */
const TYPE_RENAME: Record<string, string> = {
  通用: "普通",
  恶魔: "恶",
};

function migrateDuals(raw: ValidDuals): ValidDuals {
  const out = raw.valid_duals.map((d) => {
    const types = d.types.map((t) => TYPE_RENAME[t] ?? t) as
      | [string]
      | [string, string];
    let id = d.id;
    if (id.startsWith("d_")) {
      const parts = id.slice(2).split("_").map((p) => TYPE_RENAME[p] ?? p);
      parts.sort();
      id = `d_${parts.join("_")}`;
    } else if (id.startsWith("s_")) {
      const t = id.slice(2);
      id = `s_${TYPE_RENAME[t] ?? t}`;
    }
    return { ...d, id, types };
  });
  return { ...raw, valid_duals: out };
}

export async function loadValidDuals(): Promise<ValidDuals> {
  const raw = JSON.parse(await readOverrideOrBundled(VALID_DUALS_FILE)) as ValidDuals;
  return migrateDuals(raw);
}

export async function loadManifest(): Promise<ConfigManifest> {
  return JSON.parse(await readOverrideOrBundled(MANIFEST_FILE)) as ConfigManifest;
}

export async function loadPets(): Promise<PetsBundle | null> {
  try {
    return JSON.parse(await readBundled(PETS_FILE)) as PetsBundle;
  } catch {
    return null;
  }
}

export async function loadComboIndex(): Promise<ComboIndexBundle | null> {
  try {
    return JSON.parse(await readBundled(COMBO_INDEX_FILE)) as ComboIndexBundle;
  } catch {
    return null;
  }
}

/**
 * Convert valid_duals.json into the engine's ComboInfo[] including all
 * 18 single-type entries (single-type Pokemon are valid PVP options too).
 *
 * If a combo_index is provided, populates each ComboInfo with its
 * `moveTypeSet` (union of move types across all pets of that combo)
 * and `petCount`. Otherwise falls back to STAB-only.
 */
export function buildAllCombos(
  matrix: TypeMatrix,
  duals: ValidDuals,
  index?: ComboIndexBundle | null,
): ComboInfo[] {
  const lookup = index?.combos ?? {};
  const out: ComboInfo[] = [];
  for (const t of matrix.types) {
    const id = `s_${t}`;
    const ix = lookup[id];
    out.push({
      id,
      types: [t],
      introduced_at: null,
      moveTypeSet: ix?.move_types,
      petCount: ix?.member_ids.length,
    });
  }
  for (const d of duals.valid_duals) {
    if (d.deprecated_at) continue;
    const ix = lookup[d.id];
    out.push({
      id: d.id,
      types: d.types,
      introduced_at: d.introduced_at,
      moveTypeSet: ix?.move_types,
      petCount: ix?.member_ids.length,
    });
  }
  return out;
}
