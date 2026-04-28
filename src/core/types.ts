/**
 * Shared type definitions for the PVP team helper.
 *
 * Design ref §2 (math), §3 (data), §5 (scoring), §6 (interfaces).
 */

export type Type = string;

export type EffectLevel = -2 | -1 | 0 | 1 | 2;

export interface TypeMatrix {
  version: string;
  schema_version: number;
  types: Type[];
  matrix: number[][];
}

export interface ValidDual {
  id: string;
  types: [Type] | [Type, Type];
  introduced_at: string | null;
  deprecated_at: string | null;
  notes?: string;
}

export interface ValidDuals {
  version: string;
  schema_version: number;
  valid_duals: ValidDual[];
}

export interface ConfigManifest {
  configVersion: string;
  schemaVersion: number;
  buildAt: string;
  compatibleAppVersions: string;
  checksum: string | null;
}

export type ComboId = string;

/**
 * A single entry inside a battle event or community team. Each
 * recorded enemy/teammate is a (combo, optional pet) pair so the
 * UI can render "属性: 精灵名" instead of just the combo.
 */
export interface BattleEntry {
  comboId: ComboId;
  petId?: number;
  petName?: string;
}

export interface ComboInfo {
  id: ComboId;
  types: [Type] | [Type, Type];
  introduced_at: string | null;
  /** Union of move types learnable by pets of this combo (§5.1 L1). */
  moveTypeSet?: Type[];
  /** How many pets in the official roster have this combo. */
  petCount?: number;
}

export interface PetBaseStats {
  hp: number;
  phy_atk: number;
  mag_atk: number;
  phy_def: number;
  mag_def: number;
  spd: number;
}

export interface Pet {
  id: number;
  name: string;
  types: Type[];
  base_stats: PetBaseStats;
  move_types: Type[];
  preferred_attack_style: string;
}

export interface PetsBundle {
  version: string;
  pets: Pet[];
}

export interface ComboIndexEntry {
  id: ComboId;
  types: Type[];
  member_ids: number[];
  move_types: Type[];
}

export interface ComboIndexBundle {
  version: string;
  combos: Record<string, ComboIndexEntry>;
}

export interface BattleEvent {
  timestamp: string;
  configVersion: string;
  enemies: BattleEntry[];
  notes?: string;
  partial: boolean;
}

export interface CommunityTeam {
  id: string;
  name: string;
  popularity: number;
  configVersion: string;
  members: BattleEntry[];
  sourceDate: string;
  reviewedAt: string;
}

export interface AppSettings {
  epochStart: string;
  epochThresholdDays: number;
  alpha0: number;
  N0: number;
  lambdaA: number;
  lambdaD: number;
  lambdaW: number;
  redundancyThreshold: number;
  expireDays: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  epochStart: new Date().toISOString(),
  epochThresholdDays: 90,
  alpha0: 0.5,
  N0: 30,
  lambdaA: 1.0,
  lambdaD: 1.0,
  lambdaW: 0.5,
  redundancyThreshold: 1,
  expireDays: 60,
};
