/**
 * Statistical aggregation. Implements §3 of the design report:
 *   - Dirichlet-smoothed mode-A weights (no time decay)
 *   - Mode-B aggregation
 *   - Adaptive dual-mode fusion θ(N_A) = N_A / (N_A + N_0)
 *   - Attack-type marginal q_i over weights
 */
import type { BattleEvent, CommunityTeam, ComboId, Type } from "./types";
import type { ComboCacheEntry } from "./matrix";

/** Count how many times each combo appears, summed over events. */
export function countModeA(
  events: BattleEvent[],
  duals: ComboId[],
  epochStart: string,
): Map<ComboId, number> {
  const counts = new Map<ComboId, number>();
  for (const id of duals) counts.set(id, 0);
  const epochMs = new Date(epochStart).getTime();
  for (const e of events) {
    if (new Date(e.timestamp).getTime() < epochMs) continue;
    for (const entry of e.enemies) {
      counts.set(entry.comboId, (counts.get(entry.comboId) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Dirichlet-smoothed mode-A weights:
 *   w_k^A = (n_k + α_k) / Σ_j (n_j + α_j)
 *
 * P0: uniform prior α_k = α0.
 */
export function modeAWeights(
  counts: Map<ComboId, number>,
  alpha0: number,
): Map<ComboId, number> {
  let total = 0;
  for (const n of counts.values()) total += n + alpha0;
  if (total === 0) return new Map();
  const out = new Map<ComboId, number>();
  for (const [k, n] of counts) {
    out.set(k, (n + alpha0) / total);
  }
  return out;
}

/**
 * Mode-B: each team contributes ρ_j · (count of k in members / 6).
 * Result is normalized so Σ_k w_k^B = 1.
 */
export function modeBWeights(
  teams: CommunityTeam[],
  duals: ComboId[],
): Map<ComboId, number> {
  const out = new Map<ComboId, number>();
  for (const id of duals) out.set(id, 0);
  if (teams.length === 0) return out;
  let totalRho = 0;
  for (const team of teams) totalRho += team.popularity;
  if (totalRho === 0) totalRho = teams.length;
  for (const team of teams) {
    const rho = team.popularity / totalRho;
    for (const m of team.members) {
      out.set(m.comboId, (out.get(m.comboId) ?? 0) + rho / 6);
    }
  }
  // renormalize so sum is 1 (coverage-normalized)
  let sum = 0;
  for (const v of out.values()) sum += v;
  if (sum > 0) {
    for (const [k, v] of out) out.set(k, v / sum);
  }
  return out;
}

/** θ(N_A) = N_A / (N_A + N_0) */
export function fusionTheta(nA: number, n0: number): number {
  return nA / Math.max(nA + n0, 1e-9);
}

/** w_k^base = θ · w_k^A + (1-θ) · w_k^B */
export function fuseWeights(
  wA: Map<ComboId, number>,
  wB: Map<ComboId, number>,
  theta: number,
  duals: ComboId[],
): Map<ComboId, number> {
  const out = new Map<ComboId, number>();
  for (const id of duals) {
    const a = wA.get(id) ?? 0;
    const b = wB.get(id) ?? 0;
    out.set(id, theta * a + (1 - theta) * b);
  }
  return out;
}

/**
 * Marginalize: probability of seeing attacking type i in the environment
 *   q_i = Σ_k w_k · 1[i ∈ M_k]
 * For P0 we use M_k = combo.types (STAB-only).
 */
export function attackTypeMarginals(
  weights: Map<ComboId, number>,
  cache: Map<ComboId, ComboCacheEntry>,
  attackerTypes: Type[],
): Map<Type, number> {
  const out = new Map<Type, number>();
  for (const t of attackerTypes) out.set(t, 0);
  for (const [k, w] of weights) {
    const entry = cache.get(k);
    if (!entry) continue;
    const moves = entry.combo.moveTypeSet ?? entry.combo.types;
    for (const t of moves) {
      out.set(t, (out.get(t) ?? 0) + w);
    }
  }
  return out;
}

export function totalEvents(
  events: BattleEvent[],
  epochStart: string,
): number {
  const ms = new Date(epochStart).getTime();
  let n = 0;
  for (const e of events) {
    if (new Date(e.timestamp).getTime() >= ms) n++;
  }
  return n;
}

/** Sum of values in a Map<ComboId, number>. */
export function sumWeights(w: Map<ComboId, number>): number {
  let s = 0;
  for (const v of w.values()) s += v;
  return s;
}

/** Discard zero-weight combos. */
export function compactWeights(
  w: Map<ComboId, number>,
): Map<ComboId, number> {
  const out = new Map<ComboId, number>();
  for (const [k, v] of w) if (v > 1e-9) out.set(k, v);
  return out;
}

