/**
 * Single Pinia store holding everything reactive: bundled config,
 * battle events, community teams, settings, and derived weights.
 *
 * On first access the store loads from disk; subsequent calls
 * read from in-memory state.
 */
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  loadTypeMatrix,
  loadValidDuals,
  loadManifest,
  loadPets,
  loadComboIndex,
  buildAllCombos,
} from "../core/config";
import {
  loadEvents,
  loadSettings,
  loadTeams,
  appendEvent,
  saveSettings,
  saveTeams,
  rewriteEvents,
  saveValidDualsOverride,
  clearValidDualsOverride,
  hasValidDualsOverride,
} from "../core/persistence";
import type {
  AppSettings,
  BattleEntry,
  BattleEvent,
  CommunityTeam,
  ComboId,
  ComboIndexBundle,
  ComboInfo,
  ConfigManifest,
  Pet,
  PetsBundle,
  Type,
  TypeMatrix,
  ValidDual,
  ValidDuals,
} from "../core/types";
import { DEFAULT_SETTINGS } from "../core/types";
import {
  Matrix,
  buildComboCache,
  comboSortKey,
  normalizeTypes,
} from "../core/matrix";
import {
  attackTypeMarginals,
  countModeA,
  fuseWeights,
  fusionTheta,
  modeAWeights,
  modeBWeights,
  totalEvents,
} from "../core/stats";

export const useApp = defineStore("app", () => {
  const ready = ref(false);
  const error = ref<string | null>(null);

  const matrixSpec = ref<TypeMatrix | null>(null);
  const dualsSpec = ref<ValidDuals | null>(null);
  const dualsOverridden = ref(false);
  const manifest = ref<ConfigManifest | null>(null);
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS });
  const events = ref<BattleEvent[]>([]);
  const teams = ref<CommunityTeam[]>([]);
  const petsBundle = ref<PetsBundle | null>(null);
  const comboIndex = ref<ComboIndexBundle | null>(null);

  const pets = computed<Pet[]>(() => petsBundle.value?.pets ?? []);
  const petsById = computed(() => {
    const m = new Map<number, Pet>();
    for (const p of pets.value) m.set(p.id, p);
    return m;
  });

  const matrix = computed(() =>
    matrixSpec.value ? new Matrix(matrixSpec.value) : null,
  );

  const allCombos = computed<ComboInfo[]>(() => {
    if (!matrixSpec.value || !dualsSpec.value || !matrix.value) return [];
    const raw = buildAllCombos(
      matrixSpec.value,
      dualsSpec.value,
      comboIndex.value,
    );
    const ti = matrix.value.typeIndex;
    const normalized = raw.map((c) => ({
      ...c,
      types: normalizeTypes(c.types, ti),
    }));
    normalized.sort(
      (a, b) => comboSortKey(a.types, ti) - comboSortKey(b.types, ti),
    );
    return normalized;
  });

  const comboCache = computed(() =>
    matrix.value ? buildComboCache(matrix.value, allCombos.value) : new Map(),
  );

  const dualIds = computed(() => allCombos.value.map((c) => c.id));

  const eventCount = computed(() =>
    totalEvents(events.value, settings.value.epochStart),
  );

  const wA = computed(() => {
    const counts = countModeA(
      events.value,
      dualIds.value,
      settings.value.epochStart,
    );
    return modeAWeights(counts, settings.value.alpha0);
  });

  const wB = computed(() => modeBWeights(teams.value, dualIds.value));

  const theta = computed(() => fusionTheta(eventCount.value, settings.value.N0));

  const weights = computed(() =>
    fuseWeights(wA.value, wB.value, theta.value, dualIds.value),
  );

  const attackQ = computed(() => {
    if (!matrix.value) return new Map<string, number>();
    return attackTypeMarginals(
      weights.value,
      comboCache.value,
      matrix.value.types,
    );
  });

  const lambdas = computed(() => ({
    A: settings.value.lambdaA,
    D: settings.value.lambdaD,
    W: settings.value.lambdaW,
  }));

  async function init(): Promise<void> {
    if (ready.value) return;
    try {
      const [m, d, mf, s, ev, tm, ov, pb, ci] = await Promise.all([
        loadTypeMatrix(),
        loadValidDuals(),
        loadManifest(),
        loadSettings(),
        loadEvents(),
        loadTeams(),
        hasValidDualsOverride(),
        loadPets(),
        loadComboIndex(),
      ]);
      matrixSpec.value = m;
      dualsSpec.value = d;
      dualsOverridden.value = ov;
      manifest.value = mf;
      settings.value = s;
      events.value = ev;
      teams.value = tm;
      petsBundle.value = pb;
      comboIndex.value = ci;
      ready.value = true;
    } catch (e: any) {
      error.value = e?.message ?? String(e);
    }
  }

  function petsOfCombo(comboId: ComboId): Pet[] {
    const entry = comboIndex.value?.combos[comboId];
    if (!entry) return [];
    return entry.member_ids
      .map((id) => petsById.value.get(id))
      .filter((p): p is Pet => !!p);
  }

  function dualId(a: Type, b: Type): string {
    const [x, y] = [a, b].sort();
    return `d_${x}_${y}`;
  }

  async function persistDuals(): Promise<void> {
    if (!dualsSpec.value) return;
    const next: ValidDuals = {
      ...dualsSpec.value,
      version: `${new Date().toISOString().slice(0, 10)}-user`,
    };
    dualsSpec.value = next;
    await saveValidDualsOverride(next);
    dualsOverridden.value = true;
  }

  async function addDual(
    a: Type,
    b: Type,
    notes?: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!dualsSpec.value) return { ok: false, reason: "未加载" };
    if (a === b) return { ok: false, reason: "两个属性必须不同" };
    const id = dualId(a, b);
    if (dualsSpec.value.valid_duals.some((d) => d.id === id)) {
      return { ok: false, reason: "已存在" };
    }
    const today = new Date().toISOString().slice(0, 10);
    const newDual: ValidDual = {
      id,
      types: [a, b],
      introduced_at: today,
      deprecated_at: null,
      notes,
    };
    dualsSpec.value = {
      ...dualsSpec.value,
      valid_duals: [...dualsSpec.value.valid_duals, newDual],
    };
    await persistDuals();
    return { ok: true };
  }

  async function updateDual(
    id: string,
    patch: Partial<ValidDual>,
  ): Promise<void> {
    if (!dualsSpec.value) return;
    const idx = dualsSpec.value.valid_duals.findIndex((d) => d.id === id);
    if (idx < 0) return;
    const next = [...dualsSpec.value.valid_duals];
    next[idx] = { ...next[idx], ...patch };
    dualsSpec.value = { ...dualsSpec.value, valid_duals: next };
    await persistDuals();
  }

  async function removeDual(id: string): Promise<void> {
    if (!dualsSpec.value) return;
    dualsSpec.value = {
      ...dualsSpec.value,
      valid_duals: dualsSpec.value.valid_duals.filter((d) => d.id !== id),
    };
    await persistDuals();
  }

  async function resetDualsToBundled(): Promise<void> {
    await clearValidDualsOverride();
    dualsOverridden.value = false;
    dualsSpec.value = await loadValidDuals();
  }

  async function logBattle(
    enemies: BattleEntry[],
    notes?: string,
  ): Promise<void> {
    const evt: BattleEvent = {
      timestamp: new Date().toISOString(),
      configVersion: manifest.value?.configVersion ?? "unknown",
      enemies,
      notes,
      partial: false,
    };
    await appendEvent(evt);
    events.value = [...events.value, evt];
  }

  async function deleteEvent(timestamp: string): Promise<void> {
    events.value = events.value.filter((e) => e.timestamp !== timestamp);
    await rewriteEvents(events.value);
  }

  async function resetEpoch(): Promise<void> {
    settings.value = {
      ...settings.value,
      epochStart: new Date().toISOString(),
    };
    await saveSettings(settings.value);
  }

  async function patchSettings(patch: Partial<AppSettings>): Promise<void> {
    settings.value = { ...settings.value, ...patch };
    await saveSettings(settings.value);
  }

  async function upsertTeam(team: CommunityTeam): Promise<void> {
    const idx = teams.value.findIndex((t) => t.id === team.id);
    if (idx >= 0) teams.value[idx] = team;
    else teams.value = [...teams.value, team];
    await saveTeams(teams.value);
  }

  async function removeTeam(id: string): Promise<void> {
    teams.value = teams.value.filter((t) => t.id !== id);
    await saveTeams(teams.value);
  }

  return {
    ready,
    error,
    matrixSpec,
    dualsSpec,
    dualsOverridden,
    manifest,
    settings,
    events,
    teams,
    matrix,
    allCombos,
    comboCache,
    dualIds,
    eventCount,
    wA,
    wB,
    theta,
    weights,
    attackQ,
    lambdas,
    init,
    logBattle,
    deleteEvent,
    resetEpoch,
    patchSettings,
    upsertTeam,
    removeTeam,
    addDual,
    updateDual,
    removeDual,
    resetDualsToBundled,
    pets,
    petsById,
    petsOfCombo,
    comboIndex,
  };
});
