/**
 * Greedy team recommender. Implements §5.4.1 of the design report.
 *
 *   Start with empty team P=[].
 *   For n = 0..5:
 *     pick p ∈ candidates \ P that maximizes ΔS(P) = S(P+[p]) - S(P)
 *
 * Marginal-gain greedy lets each addition be driven by the FULL team
 * score, not single-mon ranking — D_weak's quadratic penalty + A(P)'s
 * outer max naturally diversify choices.
 */
import type { ComboId, ComboInfo, Type } from "./types";
import type { ComboCacheEntry, Matrix } from "./matrix";
import { teamScore, type ScoreBreakdown } from "./scoring";

export interface Recommendation {
  team: ComboInfo[];
  score: ScoreBreakdown;
  /** Per-step picks with ΔS for inspection. */
  trace: Array<{ pick: ComboInfo; delta: number; afterScore: number }>;
}

export function greedyTeam(
  matrix: Matrix,
  candidates: ComboInfo[],
  weights: Map<ComboId, number>,
  cache: Map<ComboId, ComboCacheEntry>,
  pCache: Map<ComboId, ComboCacheEntry>,
  attackQ: Map<Type, number>,
  lambdas: { A: number; D: number; W: number },
  redundancy: number,
  size = 6,
): Recommendation {
  const team: ComboInfo[] = [];
  const trace: Recommendation["trace"] = [];
  let curr = teamScore(
    matrix,
    team,
    weights,
    cache,
    pCache,
    attackQ,
    lambdas,
    redundancy,
  );

  const used = new Set<ComboId>();

  for (let step = 0; step < size; step++) {
    let best: { p: ComboInfo; sc: ScoreBreakdown; delta: number } | null = null;
    for (const cand of candidates) {
      if (used.has(cand.id)) continue;
      const sc = teamScore(
        matrix,
        [...team, cand],
        weights,
        cache,
        pCache,
        attackQ,
        lambdas,
        redundancy,
      );
      const delta = sc.total - curr.total;
      if (best === null || delta > best.delta) {
        best = { p: cand, sc, delta };
      }
    }
    if (best === null) break;
    team.push(best.p);
    used.add(best.p.id);
    trace.push({ pick: best.p, delta: best.delta, afterScore: best.sc.total });
    curr = best.sc;
  }

  return { team, score: curr, trace };
}
