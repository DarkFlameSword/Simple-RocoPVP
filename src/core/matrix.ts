/**
 * Type matrix arithmetic. Implements §2 of the design report.
 *
 *   level(x):   {0.5, 1, 2} → {-1, 0, +1}
 *   M(i, a, b): attacking type i against defending types (a, b?) → EffectLevel
 *   numericFromLevel: EffectLevel → multiplier (e.g. +1 → 2, -2 → 1/3)
 */
import type { ComboInfo, EffectLevel, Type, TypeMatrix } from "./types";

export function level(mult: number): -1 | 0 | 1 {
  if (mult >= 1.99) return 1;
  if (mult <= 0.51) return -1;
  return 0;
}

export function clampLevel(s: number): EffectLevel {
  if (s > 2) return 2;
  if (s < -2) return -2;
  return s as EffectLevel;
}

export function numericFromLevel(l: EffectLevel): number {
  switch (l) {
    case 2:
      return 3;
    case 1:
      return 2;
    case 0:
      return 1;
    case -1:
      return 1 / 2;
    case -2:
      return 1 / 3;
  }
}

export function displayFromLevel(l: EffectLevel): string {
  switch (l) {
    case 2:
      return "×3";
    case 1:
      return "×2";
    case 0:
      return "×1";
    case -1:
      return "×½";
    case -2:
      return "×⅓";
  }
}

/**
 * Canonical sort key for combos:
 *   singles 0..17 (by type position in matrix.types)
 *   duals 1000 + lo*100 + hi (lo/hi = type indices, lo <= hi)
 *
 * Singles always sort before duals; duals follow lex order over
 * (smaller-index type, larger-index type) → e.g. "通用-草",
 * "通用-水", "通用-火", ..., "草-水", "草-火", ...
 */
export function comboSortKey(
  types: Type[],
  typeIndex: Map<Type, number>,
): number {
  if (types.length === 1) {
    return typeIndex.get(types[0]) ?? 999;
  }
  const ia = typeIndex.get(types[0]) ?? 999;
  const ib = typeIndex.get(types[1]) ?? 999;
  const lo = Math.min(ia, ib);
  const hi = Math.max(ia, ib);
  return 1000 + lo * 100 + hi;
}

/**
 * Returns dual-type pair with the lower-index type first, so display
 * is consistent regardless of how the source data ordered them.
 */
export function normalizeTypes(
  types: [Type] | [Type, Type],
  typeIndex: Map<Type, number>,
): [Type] | [Type, Type] {
  if (types.length === 1) return types;
  const [a, b] = types;
  const ia = typeIndex.get(a) ?? 999;
  const ib = typeIndex.get(b) ?? 999;
  return ia <= ib ? [a, b] : [b, a];
}

export class Matrix {
  readonly types: Type[];
  readonly typeIndex: Map<Type, number>;
  /** T[i][j] basic multiplier, attacking type i against single defender j. */
  readonly T: number[][];

  constructor(spec: TypeMatrix) {
    this.types = spec.types;
    this.T = spec.matrix;
    this.typeIndex = new Map(spec.types.map((t, i) => [t, i]));
  }

  idx(t: Type): number {
    const i = this.typeIndex.get(t);
    if (i === undefined) {
      throw new Error(`Unknown type: ${t}`);
    }
    return i;
  }

  /** Compute attacking-vs-(a, b?) combined effect level. */
  computeM(attacker: Type, a: Type, b: Type | null): EffectLevel {
    const ai = this.idx(attacker);
    const la = level(this.T[ai][this.idx(a)]);
    const lb = b !== null ? level(this.T[ai][this.idx(b)]) : 0;
    return clampLevel(la + lb);
  }

  /** numeric multiplier for attacker vs combo (a, b?). */
  multiplier(attacker: Type, a: Type, b: Type | null): number {
    return numericFromLevel(this.computeM(attacker, a, b));
  }
}

export interface ComboCacheEntry {
  combo: ComboInfo;
  /** For each attacking type, the EffectLevel against this combo. */
  vsByAttacker: EffectLevel[];
  /** Numeric multipliers, parallel to vsByAttacker. */
  multByAttacker: number[];
}

/**
 * Precomputes for each combo k, the 18-vector of EffectLevels for each
 * attacking type i. Design ref §2.5: O(18·K) memory, O(1) per lookup.
 */
export function buildComboCache(
  matrix: Matrix,
  combos: ComboInfo[],
): Map<string, ComboCacheEntry> {
  const cache = new Map<string, ComboCacheEntry>();
  for (const combo of combos) {
    const a = combo.types[0];
    const b = combo.types[1] ?? null;
    const vs: EffectLevel[] = [];
    const mult: number[] = [];
    for (const attacker of matrix.types) {
      const lvl = matrix.computeM(attacker, a, b);
      vs.push(lvl);
      mult.push(numericFromLevel(lvl));
    }
    cache.set(combo.id, { combo, vsByAttacker: vs, multByAttacker: mult });
  }
  return cache;
}
