<script setup lang="ts">
import { computed, ref } from "vue";
import { useApp } from "../store/app";
import ComboChip from "../components/ComboChip.vue";
import type { BattleEntry, CommunityTeam, ComboInfo } from "../core/types";

const app = useApp();

interface DraftTeam {
  id: string | null;
  name: string;
  popularity: number;
  sourceDate: string;
  members: BattleEntry[];
}

function newDraft(): DraftTeam {
  return {
    id: null,
    name: "",
    popularity: 0.5,
    sourceDate: new Date().toISOString().slice(0, 10),
    members: [],
  };
}

const draft = ref<DraftTeam>(newDraft());
const search = ref("");
const error = ref<string | null>(null);

const filteredCombos = computed(() => {
  const q = search.value.trim();
  if (!q) return app.allCombos;
  return app.allCombos.filter((c) => c.types.some((t) => t.includes(q)));
});

function isSelected(c: ComboInfo): boolean {
  return draft.value.members.some((m) => m.comboId === c.id);
}

function addMember(entry: BattleEntry): void {
  if (draft.value.members.length >= 6) return;
  draft.value.members.push(entry);
}

function removeMember(i: number): void {
  draft.value.members.splice(i, 1);
}

function startEdit(t: CommunityTeam): void {
  draft.value = {
    id: t.id,
    name: t.name,
    popularity: t.popularity,
    sourceDate: t.sourceDate,
    members: t.members.map((m) => ({ ...m })),
  };
}

function cancelEdit(): void {
  draft.value = newDraft();
  error.value = null;
}

async function commit(): Promise<void> {
  if (!draft.value.name.trim()) {
    error.value = "请填写队伍名称";
    return;
  }
  if (draft.value.members.length !== 6) {
    error.value = `需要正好 6 个成员(当前 ${draft.value.members.length})`;
    return;
  }
  const id = draft.value.id ?? `team_${Date.now()}`;
  const team: CommunityTeam = {
    id,
    name: draft.value.name.trim(),
    popularity: draft.value.popularity,
    configVersion: app.manifest?.configVersion ?? "unknown",
    members: draft.value.members.map((m) => ({ ...m })),
    sourceDate: draft.value.sourceDate,
    reviewedAt: new Date().toISOString().slice(0, 10),
  };
  await app.upsertTeam(team);
  draft.value = newDraft();
  error.value = null;
}

const confirmRemove = ref<string | null>(null);
async function tryRemove(id: string): Promise<void> {
  if (confirmRemove.value !== id) {
    confirmRemove.value = id;
    setTimeout(() => {
      if (confirmRemove.value === id) confirmRemove.value = null;
    }, 4000);
    return;
  }
  await app.removeTeam(id);
  confirmRemove.value = null;
}

async function markReviewed(t: CommunityTeam): Promise<void> {
  await app.upsertTeam({
    ...t,
    reviewedAt: new Date().toISOString().slice(0, 10),
  });
}

function isOverdue(t: CommunityTeam): boolean {
  const reviewed = new Date(t.reviewedAt).getTime();
  const days = (Date.now() - reviewed) / (1000 * 60 * 60 * 24);
  return days > app.settings.expireDays;
}

function comboById(id: string): ComboInfo | undefined {
  return app.allCombos.find((c) => c.id === id);
}
</script>

<template>
  <div class="layout">
    <section class="panel">
      <div class="row">
        <h3 style="margin: 0">{{ draft.id ? "编辑队伍" : "新建强队" }}</h3>
        <span class="muted">
          来自社交媒体收集的强队;权重将与模式 A 通过 θ 自适应融合
        </span>
      </div>
      <div class="row" style="margin-top: 8px; gap: 12px">
        <label class="field">
          <span class="muted">名称</span>
          <input
            v-model="draft.name"
            type="text"
            placeholder="如:B 站某主播配队"
          />
        </label>
        <label class="field">
          <span class="muted">流行度 ρ ({{ draft.popularity.toFixed(2) }})</span>
          <input
            v-model.number="draft.popularity"
            type="range"
            min="0"
            max="1"
            step="0.05"
          />
        </label>
        <label class="field">
          <span class="muted">发布日期</span>
          <input v-model="draft.sourceDate" type="date" />
        </label>
      </div>

      <div class="row" style="margin-top: 12px">
        <span class="muted">成员 {{ draft.members.length }}/6:</span>
        <ComboChip
          v-for="(entry, i) in draft.members"
          :key="i + '_' + entry.comboId"
          :combo="comboById(entry.comboId) || { id: entry.comboId, types: ['通用'], introduced_at: null }"
          :pet-name="entry.petName"
          selected
          removable
          size="sm"
          @remove="removeMember(i)"
        />
      </div>

      <div class="row" style="margin-top: 8px">
        <span class="muted">候选(点击属性 → 选择精灵):</span>
        <input
          v-model="search"
          type="text"
          placeholder="搜索属性..."
          style="margin-left: auto; width: 140px"
        />
      </div>
      <div class="grid">
        <ComboChip
          v-for="c in filteredCombos"
          :key="c.id"
          :combo="c"
          :selected="isSelected(c)"
          pick-pet
          size="sm"
          @pick-pet="addMember"
        />
      </div>

      <div class="row" style="margin-top: 12px">
        <button class="primary" @click="commit">
          {{ draft.id ? "保存编辑" : "添加队伍" }}
        </button>
        <button v-if="draft.id" @click="cancelEdit">取消编辑</button>
        <span v-if="error" class="error">{{ error }}</span>
      </div>
    </section>

    <section class="panel">
      <h3 style="margin: 0 0 8px">已收录队伍</h3>
      <div v-if="app.teams.length === 0" class="muted">列表为空。</div>
      <div v-else class="team-list">
        <div v-for="t in app.teams" :key="t.id" class="team-card">
          <div class="row">
            <strong>{{ t.name }}</strong>
            <span class="muted">ρ={{ t.popularity.toFixed(2) }}</span>
            <span class="muted">来源 {{ t.sourceDate }}</span>
            <span :class="isOverdue(t) ? 'overdue' : 'muted'">
              复核 {{ t.reviewedAt }}
              <template v-if="isOverdue(t)">⚠️</template>
            </span>
            <button
              style="margin-left: auto"
              :class="confirmRemove === t.id ? 'danger' : ''"
              @click="tryRemove(t.id)"
            >
              {{ confirmRemove === t.id ? "确认删除" : "删除" }}
            </button>
            <button @click="startEdit(t)">编辑</button>
            <button @click="markReviewed(t)">标记已复核</button>
          </div>
          <div class="row" style="margin-top: 6px; gap: 4px">
            <ComboChip
              v-for="(entry, i) in t.members"
              :key="i + '_' + entry.comboId"
              :combo="comboById(entry.comboId) || { id: entry.comboId, types: ['通用'], introduced_at: null }"
              :pet-name="entry.petName"
              size="sm"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.layout { display: flex; flex-direction: column; gap: 12px; }
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.field input[type=text],
.field input[type=date] { min-width: 160px; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
  margin-top: 6px;
}
.team-list { display: flex; flex-direction: column; gap: 8px; }
.team-card {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
}
.error { color: var(--bad); font-size: 12px; }
.overdue { color: var(--warn); font-size: 12px; }
button.danger {
  background: var(--bad);
  color: #fff;
  border-color: var(--bad);
}
</style>
