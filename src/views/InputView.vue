<script setup lang="ts">
import { computed, ref } from "vue";
import { useApp } from "../store/app";
import ComboChip from "../components/ComboChip.vue";
import type { BattleEntry, ComboInfo } from "../core/types";

const app = useApp();
const search = ref("");
const buffer = ref<BattleEntry[]>([]);
const notes = ref("");

const filtered = computed(() => {
  const q = search.value.trim();
  if (!q) return app.allCombos;
  return app.allCombos.filter((c) => c.types.some((t) => t.includes(q)));
});

function isSelected(c: ComboInfo): boolean {
  return buffer.value.some((e) => e.comboId === c.id);
}

function addEntry(entry: BattleEntry): void {
  if (buffer.value.length >= 6) return;
  buffer.value = [...buffer.value, entry];
}

function removeAt(i: number): void {
  buffer.value = buffer.value.filter((_, j) => j !== i);
}

async function commit(): Promise<void> {
  if (buffer.value.length === 0) return;
  await app.logBattle(buffer.value, notes.value.trim() || undefined);
  buffer.value = [];
  notes.value = "";
}

const recentEvents = computed(() =>
  [...app.events]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 12),
);

function comboById(id: string): ComboInfo | undefined {
  return app.allCombos.find((c) => c.id === id);
}

function relTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
</script>

<template>
  <div class="layout">
    <section class="panel">
      <div class="row" style="margin-bottom: 8px">
        <h3 style="margin: 0">录入本场敌方队伍</h3>
        <span class="muted">点击属性组合 → 在弹出框中点击精灵名,完成一次录入</span>
        <input
          v-model="search"
          type="text"
          placeholder="搜索属性..."
          style="margin-left: auto; width: 140px"
        />
      </div>
      <div class="grid">
        <ComboChip
          v-for="c in filtered"
          :key="c.id"
          :combo="c"
          :selected="isSelected(c)"
          pick-pet
          size="sm"
          @pick-pet="addEntry"
        />
      </div>
      <div class="commit-bar">
        <div class="buffer">
          <span class="muted">已选 ({{ buffer.length }}/6):</span>
          <ComboChip
            v-for="(entry, i) in buffer"
            :key="i + '_' + entry.comboId"
            :combo="comboById(entry.comboId) || { id: entry.comboId, types: ['通用'], introduced_at: null }"
            :pet-name="entry.petName"
            selected
            removable
            size="sm"
            @remove="removeAt(i)"
          />
        </div>
        <input
          v-model="notes"
          type="text"
          placeholder="备注(可选)"
          style="flex: 1; min-width: 180px"
        />
        <button class="primary" :disabled="buffer.length === 0" @click="commit">
          录入此场
        </button>
        <button :disabled="buffer.length === 0" @click="buffer = []">
          清空
        </button>
      </div>
    </section>

    <section class="panel">
      <h3 style="margin: 0 0 8px">最近录入</h3>
      <div v-if="recentEvents.length === 0" class="muted">还没有录入。</div>
      <div v-else class="recent-list">
        <div v-for="e in recentEvents" :key="e.timestamp" class="recent-row">
          <span class="muted ts">{{ relTime(e.timestamp) }}</span>
          <div class="recent-combos">
            <ComboChip
              v-for="(entry, i) in e.enemies"
              :key="i + '_' + entry.comboId"
              :combo="comboById(entry.comboId) || { id: entry.comboId, types: ['通用'], introduced_at: null }"
              :pet-name="entry.petName"
              size="sm"
            />
          </div>
          <span v-if="e.notes" class="notes muted">{{ e.notes }}</span>
          <button class="del" @click="app.deleteEvent(e.timestamp)">删</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.layout { display: grid; gap: 12px; grid-template-rows: auto auto; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 6px;
  max-height: 360px;
  overflow-y: auto;
  padding: 4px;
}
.commit-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}
.buffer {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.recent-list { display: flex; flex-direction: column; gap: 4px; }
.recent-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.ts { min-width: 140px; font-size: 11px; }
.recent-combos { display: flex; gap: 4px; flex-wrap: wrap; flex: 1; }
.notes {
  font-size: 11px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.del { font-size: 11px; padding: 2px 8px; }
</style>
