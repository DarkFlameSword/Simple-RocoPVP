/**
 * Single + team scoring. Implements §5 of the design report.
 *
 *   S_atk(p)         single-mon attack score (display only)
 *   S_def(p)         single-mon defense score (display only)
 *   A(P)             team attack coverage (max-over-team per enemy combo)
 *   D_switch(P)      team safe-switch (max-over-team per enemy combo)
 *   D_weak(P)        common-weakness penalty (quadratic above redundancy r)
 *   S(P)             total team score = λ_A·A + λ_D·D_switch + λ_W·D_weak
 */
import type { ComboId, ComboInfo, Type } from "./types";
import type { ComboCacheEntry, Matrix } from "./matrix";
import { numericFromLevel } from "./matrix";

/**
 * Single-mon attacking score against the weighted environment.
 * P0: M_p = combo.types (STAB).
 */
export function singleAttack(
  matrix: Matrix,
  p: ComboInfo,
  weights: Map<ComboId, number>,
  cache: Map<ComboId, ComboCacheEntry>,
): number {
  let total = 0;
  for (const [k, w] of weights) {
    const entry = cache.get(k);
    if (!entry || w <= 0) continue;
    let best = 0;
    for (const move of p.moveTypeSet ?? p.types) {
      const idx = matrix.idx(move);
      const m = numericFromLevel(entry.vsByAttacker[idx]);
      if (m > best) best = m;
    }
    total += w * best;
  }
  return total;
}

/**
 * Single-mon defensive score: expected resistance against the
 * environment's attack-type distribution, where for each enemy combo k
 * we average over moves in M_k = combo.types (STAB assumption).
 */
export function singleDefense(
  matrix: Matrix,
  p: ComboInfo,
  weights: Map<ComboId, number>,
  cache: Map<ComboId, ComboCacheEntry>,
  pCache: Map<ComboId, ComboCacheEntry>,
): number {
  const pEntry = pCache.get(p.id);
  if (!pEntry) return 0;
  let total = 0;
  for (const [k, w] of weights) {
    const entry = cache.get(k);
    if (!entry || w <= 0) continue;
    let inv = 0;
    let n = 0;
    for (const atk of entry.combo.moveTypeSet ?? entry.combo.types) {
      const aIdx = matrix.idx(atk);
      const m = numericFromLevel(pEntry.vsByAttacker[aIdx]);
      inv += 1 / m;
      n += 1;
    }
    if (n > 0) total += w * (inv / n);
  }
  return total;
}

/**
 * A(P) = Σ_k w_k · max_{p∈P} max_{i∈M_p} M(i, k)
 */
export function teamAttack(
  matrix: Matrix,
  team: ComboInfo[],
  weights: Map<ComboId, number>,
  cache: Map<ComboId, ComboCacheEntry>,
): number {
  let total = 0;
  for (const [k, w] of weights) {
    const entry = cache.get(k);
    if (!entry || w <= 0) continue;
    let best = 0;
    for (const p of team) {
      for (const move of p.moveTypeSet ?? p.types) {
        const idx = matrix.idx(move);
        const m = numericFromLevel(entry.vsByAttacker[idx]);
        if (m > best) best = m;
      }
    }
    total += w * best;
  }
  return total;
}

/**
 * D_switch(P) = Σ_k w_k · max_{p∈P} R(p, k)
 * R(p, k) = average inverse multiplier over k's STAB attacks.
 */
export function teamSwitch(
  matrix: Matrix,
  team: ComboInfo[],
  weights: Map<ComboId, number>,
  cache: Map<ComboId, ComboCacheEntry>,
  pCache: Map<ComboId, ComboCacheEntry>,
): number {
  let total = 0;
  for (const [k, w] of weights) {
    const entry = cache.get(k);
    if (!entry || w <= 0) continue;
    let bestR = 0;
    for (const p of team) {
      const pEntry = pCache.get(p.id);
      if (!pEntry) continue;
      let inv = 0;
      let n = 0;
      for (const atk of entry.combo.moveTypeSet ?? entry.combo.types) {
        const aIdx = matrix.idx(atk);
        const m = numericFromLevel(pEntry.vsByAttacker[aIdx]);
        inv += 1 / m;
        n += 1;
      }
      const r = n > 0 ? inv / n : 1;
      if (r > bestR) bestR = r;
    }
    total += w * bestR;
  }
  return total;
}

/**
 * D_weak(P) = -Σ_i q_i · max(0, c_i(P) - r)^2
 * c_i(P) = number of team members weak to type i (M(i, p) ≥ 2).
 */
export function teamWeakness(
  matrix: Matrix,
  team: ComboInfo[],
  attackQ: Map<Type, number>,
  pCache: Map<ComboId, ComboCacheEntry>,
  redundancy: number,
): number {
  let penalty = 0;
  for (const [type, q] of attackQ) {
    if (q <= 0) continue;
    const tIdx = matrix.idx(type);
    let count = 0;
    for (const p of team) {
      const pEntry = pCache.get(p.id);
      if (!pEntry) continue;
      const m = numericFromLevel(pEntry.vsByAttacker[tIdx]);
      if (m >= 2) count += 1;
    }
    const over = Math.max(0, count - redundancy);
    penalty += q * over * over;
  }
  return -penalty;
}

export interface ScoreBreakdown {
  attack: number;
  switch_: number;
  weakness: number;
  total: number;
}

export function teamScore(
  matrix: Matrix,
  team: ComboInfo[],
  weights: Map<ComboId, number>,
  cache: Map<ComboId, ComboCacheEntry>,
  pCache: Map<ComboId, ComboCacheEntry>,
  attackQ: Map<Type, number>,
  lambdas: { A: number; D: number; W: number },
  redundancy: number,
): ScoreBreakdown {
  const attack = teamAttack(matrix, team, weights, cache);
  const switch_ = teamSwitch(matrix, team, weights, cache, pCache);
  const weakness = teamWeakness(matrix, team, attackQ, pCache, redundancy);
  const total =
    lambdas.A * attack + lambdas.D * switch_ + lambdas.W * weakness;
  return { attack, switch_, weakness, total };
}

/** Per-combo attack vector (multipliers) for UI heatmaps. */
export function teamCoverageVector(
  matrix: Matrix,
  team: ComboInfo[],
  comboIds: ComboId[],
  cache: Map<ComboId, ComboCacheEntry>,
): Array<{ id: ComboId; best: number; bestBy: ComboInfo | null }> {
  const out: Array<{ id: ComboId; best: number; bestBy: ComboInfo | null }> =
    [];
  for (const k of comboIds) {
    const entry = cache.get(k);
    if (!entry) {
      out.push({ id: k, best: 1, bestBy: null });
      continue;
    }
    let best = 0;
    let bestBy: ComboInfo | null = null;
    for (const p of team) {
      for (const move of p.moveTypeSet ?? p.types) {
        const idx = matrix.idx(move);
        const m = numericFromLevel(entry.vsByAttacker[idx]);
        if (m > best) {
          best = m;
          bestBy = p;
        }
      }
    }
    out.push({ id: k, best, bestBy });
  }
  return out;
}

/** Common weaknesses report: type i with c_i(P) ≥ threshold. */
export function commonWeaknesses(
  matrix: Matrix,
  team: ComboInfo[],
  pCache: Map<ComboId, ComboCacheEntry>,
  attackQ: Map<Type, number>,
  threshold: number,
): Array<{ type: Type; count: number; q: number; members: ComboInfo[] }> {
  const out: Array<{
    type: Type;
    count: number;
    q: number;
    members: ComboInfo[];
  }> = [];
  for (const type of matrix.types) {
    const tIdx = matrix.idx(type);
    const members: ComboInfo[] = [];
    for (const p of team) {
      const pEntry = pCache.get(p.id);
      if (!pEntry) continue;
      const m = numericFromLevel(pEntry.vsByAttacker[tIdx]);
      if (m >= 2) members.push(p);
    }
    if (members.length >= threshold) {
      out.push({
        type,
        count: members.length,
        q: attackQ.get(type) ?? 0,
        members,
      });
    }
  }
  out.sort((a, b) => b.count - a.count || b.q - a.q);
  return out;
}
