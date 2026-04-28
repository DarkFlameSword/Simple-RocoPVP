<script setup lang="ts">
import { computed, ref } from "vue";
import { useApp } from "../store/app";
import ComboChip from "../components/ComboChip.vue";
import TypeBadge from "../components/TypeBadge.vue";
import { greedyTeam } from "../core/recommend";
import {
  commonWeaknesses,
  singleAttack,
  singleDefense,
  teamCoverageVector,
} from "../core/scoring";
import type { ComboInfo, Pet } from "../core/types";

const app = useApp();

function topPets(combo: ComboInfo, n = 3): Pet[] {
  const pets = app.petsOfCombo(combo.id);
  return pets
    .map((p) => ({
      pet: p,
      score: Math.max(p.base_stats.phy_atk, p.base_stats.mag_atk) + p.base_stats.spd / 2,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.pet);
}

function statSummary(p: Pet): string {
  const s = p.base_stats;
  const atk = Math.max(s.phy_atk, s.mag_atk);
  return `攻 ${atk} · 速 ${s.spd} · HP ${s.hp}`;
}

const lastTeam = ref<ComboInfo[]>([]);
const lastTrace = ref<
  Array<{ pick: ComboInfo; delta: number; afterScore: number }>
>([]);
const lastBreakdown = ref<{
  attack: number;
  switch_: number;
  weakness: number;
  total: number;
} | null>(null);

function compute(): void {
  if (!app.matrix) return;
  const rec = greedyTeam(
    app.matrix,
    app.allCombos,
    app.weights,
    app.comboCache,
    app.comboCache,
    app.attackQ,
    app.lambdas,
    app.settings.redundancyThreshold,
  );
  lastTeam.value = rec.team;
  lastTrace.value = rec.trace;
  lastBreakdown.value = rec.score;
}

const sortedWeights = computed(() => {
  const arr: Array<{ id: string; w: number }> = [];
  for (const [id, w] of app.weights) arr.push({ id, w });
  arr.sort((a, b) => b.w - a.w);
  return arr.slice(0, 12);
});

const coverage = computed(() => {
  if (!app.matrix || lastTeam.value.length === 0) return [];
  const sortedIds = sortedWeights.value.map((x) => x.id);
  return teamCoverageVector(
    app.matrix,
    lastTeam.value,
    sortedIds,
    app.comboCache,
  );
});

const weaknesses = computed(() => {
  if (!app.matrix || lastTeam.value.length === 0) return [];
  return commonWeaknesses(
    app.matrix,
    lastTeam.value,
    app.comboCache,
    app.attackQ,
    Math.max(2, app.settings.redundancyThreshold + 1),
  );
});

const attackQTop = computed(() => {
  const arr: Array<{ type: string; q: number }> = [];
  for (const [t, q] of app.attackQ) arr.push({ type: t, q });
  arr.sort((a, b) => b.q - a.q);
  return arr.slice(0, 8);
});

function comboById(id: string): ComboInfo | undefined {
  return app.allCombos.find((c) => c.id === id);
}

function multBg(m: number): string {
  if (m >= 2.5) return "#1a8b3a";
  if (m >= 1.9) return "#2e9d4d";
  if (m <= 0.4) return "#c14444";
  if (m <= 0.6) return "#a55";
  return "#3a3f48";
}

function multLabel(m: number): string {
  if (m >= 2.9) return "×3";
  if (m >= 1.9) return "×2";
  if (m <= 0.4) return "×⅓";
  if (m <= 0.6) return "×½";
  return "×1";
}

function singleAtkScore(c: ComboInfo): number {
  if (!app.matrix) return 0;
  return singleAttack(app.matrix, c, app.weights, app.comboCache);
}
function singleDefScore(c: ComboInfo): number {
  if (!app.matrix) return 0;
  return singleDefense(
    app.matrix,
    c,
    app.weights,
    app.comboCache,
    app.comboCache,
  );
}
</script>

<template>
  <div class="layout">
    <section class="panel">
      <div class="row">
        <h3 style="margin: 0">环境与权重</h3>
        <span class="muted">
          录入数 N_A={{ app.eventCount }} · θ={{ app.theta.toFixed(2) }} · α={{ app.settings.alpha0 }}
        </span>
        <button class="primary" style="margin-left: auto" @click="compute">
          生成推荐配队
        </button>
      </div>
      <div class="row" style="margin-top: 8px">
        <div>
          <div class="muted">环境前 12 名(融合权重):</div>
          <div class="row" style="gap: 4px">
            <ComboChip
              v-for="x in sortedWeights"
              :key="x.id"
              :combo="comboById(x.id) || { id: x.id, types: ['通用'], introduced_at: null }"
              :weight="x.w"
              size="sm"
            />
          </div>
        </div>
      </div>
    </section>

    <section v-if="lastTeam.length > 0" class="panel">
      <div class="row">
        <h3 style="margin: 0">推荐队伍</h3>
        <span v-if="lastBreakdown" class="muted">
          S={{ lastBreakdown.total.toFixed(3) }} (A={{ lastBreakdown.attack.toFixed(2) }} D={{
            lastBreakdown.switch_.toFixed(2)
          }} W={{ lastBreakdown.weakness.toFixed(2) }})
        </span>
      </div>
      <div class="team-grid">
        <div v-for="(p, i) in lastTeam" :key="p.id" class="team-card">
          <div class="row">
            <span class="muted">#{{ i + 1 }}</span>
            <ComboChip :combo="p" />
            <span class="muted">ΔS={{ lastTrace[i]?.delta.toFixed(3) }}</span>
          </div>
          <div class="muted" style="margin-top: 4px">
            进攻 {{ singleAtkScore(p).toFixed(2) }} · 抗性 {{ singleDefScore(p).toFixed(2) }}
          </div>
          <div v-if="topPets(p).length" class="pet-list muted">
            <div v-for="pet in topPets(p)" :key="pet.id" class="pet-row">
              <span class="pet-name">{{ pet.name }}</span>
              <span class="pet-stats">{{ statSummary(pet) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="coverage.length > 0" class="panel">
      <h3 style="margin: 0 0 8px">团队进攻覆盖(前 12 个常见对手)</h3>
      <div class="cov-grid">
        <div v-for="row in coverage" :key="row.id" class="cov-cell">
          <ComboChip
            :combo="comboById(row.id) || { id: row.id, types: ['通用'], introduced_at: null }"
            size="sm"
          />
          <span class="cov-mult" :style="{ background: multBg(row.best) }">
            {{ multLabel(row.best) }}
          </span>
          <span v-if="row.bestBy" class="muted">
            by
            <TypeBadge :type="row.bestBy.types[0]" size="sm" />
            <TypeBadge v-if="row.bestBy.types[1]" :type="row.bestBy.types[1]" size="sm" />
          </span>
        </div>
      </div>
    </section>

    <section v-if="weaknesses.length > 0" class="panel">
      <h3 style="margin: 0 0 8px">⚠️ 共同弱点警告</h3>
      <div v-for="w in weaknesses" :key="w.type" class="weakness-row">
        <TypeBadge :type="w.type" />
        <span class="muted">环境出现率 q={{ (w.q * 100).toFixed(1) }}% · 队中 {{ w.count }} 人受克制</span>
        <ComboChip
          v-for="m in w.members"
          :key="m.id"
          :combo="m"
          size="sm"
        />
      </div>
    </section>

    <section class="panel">
      <h3 style="margin: 0 0 8px">环境攻击属性分布(前 8)</h3>
      <div class="row">
        <div v-for="x in attackQTop" :key="x.type" class="row">
          <TypeBadge :type="x.type" />
          <span class="muted">{{ (x.q * 100).toFixed(1) }}%</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.layout { display: flex; flex-direction: column; gap: 12px; }
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.team-card {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
}
.pet-list {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  border-top: 1px dashed var(--border);
  padding-top: 6px;
}
.pet-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.pet-name { color: var(--text); }
.pet-stats { color: var(--text-dim); font-size: 10px; }
.cov-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 6px;
}
.cov-cell {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 8px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 4px;
}
.cov-mult {
  color: #fff;
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: 600;
  font-size: 12px;
  min-width: 36px;
  text-align: center;
}
.weakness-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px;
  flex-wrap: wrap;
}
</style>
