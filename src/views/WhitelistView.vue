<script setup lang="ts">
import { computed, ref } from "vue";
import { useApp } from "../store/app";
import TypeBadge from "../components/TypeBadge.vue";
import ComboChip from "../components/ComboChip.vue";
import { comboSortKey, normalizeTypes } from "../core/matrix";
import type { ValidDual } from "../core/types";

const app = useApp();

const types = computed(() => app.matrix?.types ?? []);

const newA = ref<string>("");
const newB = ref<string>("");
const newNotes = ref("");
const addError = ref<string | null>(null);

async function addNewDual(): Promise<void> {
  if (!newA.value || !newB.value) {
    addError.value = "请选择两个属性";
    return;
  }
  const r = await app.addDual(newA.value, newB.value, newNotes.value || undefined);
  if (!r.ok) {
    addError.value = r.reason ?? "添加失败";
    return;
  }
  addError.value = null;
  newA.value = "";
  newB.value = "";
  newNotes.value = "";
}

const editingId = ref<string | null>(null);
const editNotes = ref("");

function startEdit(d: ValidDual): void {
  editingId.value = d.id;
  editNotes.value = d.notes ?? "";
}

async function commitEdit(d: ValidDual): Promise<void> {
  await app.updateDual(d.id, { notes: editNotes.value || undefined });
  editingId.value = null;
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
  await app.removeDual(id);
  confirmRemove.value = null;
}

const confirmReset = ref(false);
async function tryReset(): Promise<void> {
  if (!confirmReset.value) {
    confirmReset.value = true;
    setTimeout(() => (confirmReset.value = false), 4000);
    return;
  }
  await app.resetDualsToBundled();
  confirmReset.value = false;
}

const sortedDuals = computed(() => {
  if (!app.dualsSpec || !app.matrix) return [];
  const ti = app.matrix.typeIndex;
  const normalized = app.dualsSpec.valid_duals.map((d) => ({
    ...d,
    types: normalizeTypes(d.types, ti),
  }));
  normalized.sort(
    (a, b) => comboSortKey(a.types, ti) - comboSortKey(b.types, ti),
  );
  return normalized;
});
</script>

<template>
  <div class="layout">
    <section class="panel">
      <div class="row">
        <h3 style="margin: 0">双属性白名单</h3>
        <span class="muted">
          共 {{ sortedDuals.length }} 条 ·
          <span v-if="app.dualsOverridden" class="badge-override">用户覆盖中</span>
          <span v-else class="muted">使用打包内置</span>
        </span>
        <button
          style="margin-left: auto"
          :class="confirmReset ? 'primary' : ''"
          :disabled="!app.dualsOverridden"
          @click="tryReset"
        >
          {{ confirmReset ? "再次点击确认还原" : "还原为打包默认" }}
        </button>
      </div>
      <p class="muted" style="margin: 4px 0 0">
        单属性(18 个)始终可用,无需在此维护;此处仅记录游戏中实际存在的双属性精灵组合。
      </p>
    </section>

    <section class="panel">
      <h3 style="margin: 0 0 8px">新增组合</h3>
      <div class="row">
        <select v-model="newA">
          <option value="">属性 A</option>
          <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
        </select>
        <select v-model="newB">
          <option value="">属性 B</option>
          <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
        </select>
        <input
          v-model="newNotes"
          type="text"
          placeholder="备注(代表精灵 / 出现版本等)"
          style="flex: 1; min-width: 200px"
        />
        <button class="primary" @click="addNewDual">添加</button>
      </div>
      <div v-if="addError" class="error">{{ addError }}</div>
      <div v-if="newA && newB && newA !== newB" class="muted preview">
        预览:
        <TypeBadge :type="newA" />
        <TypeBadge :type="newB" />
        ID = d_<small>{{ [newA, newB].sort().join("_") }}</small>
      </div>
    </section>

    <section class="panel">
      <h3 style="margin: 0 0 8px">现有组合</h3>
      <div v-if="sortedDuals.length === 0" class="muted">列表为空。</div>
      <table v-else>
        <thead>
          <tr>
            <th>属性组合</th>
            <th>ID</th>
            <th>引入日期</th>
            <th>备注</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in sortedDuals" :key="d.id">
            <td class="combo-cell">
              <ComboChip
                :combo="{
                  id: d.id,
                  types: d.types,
                  introduced_at: d.introduced_at,
                  moveTypeSet: app.comboIndex?.combos[d.id]?.move_types,
                  petCount: app.comboIndex?.combos[d.id]?.member_ids.length,
                }"
              />
            </td>
            <td class="muted mono">{{ d.id }}</td>
            <td class="muted">{{ d.introduced_at ?? "—" }}</td>
            <td>
              <template v-if="editingId === d.id">
                <input v-model="editNotes" type="text" style="width: 100%" />
              </template>
              <span v-else class="muted">{{ d.notes || "—" }}</span>
            </td>
            <td>
              <template v-if="editingId === d.id">
                <button class="primary" @click="commitEdit(d)">保存</button>
                <button @click="editingId = null">取消</button>
              </template>
              <template v-else>
                <button @click="startEdit(d)">编辑</button>
                <button :class="confirmRemove === d.id ? 'danger' : ''" @click="tryRemove(d.id)">
                  {{ confirmRemove === d.id ? "确认删除" : "删除" }}
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.layout { display: flex; flex-direction: column; gap: 12px; max-width: 1080px; }
.combo-cell { display: flex; gap: 4px; align-items: center; }
.mono { font-family: ui-monospace, "Cascadia Code", monospace; font-size: 11px; }
.error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--bad);
  padding: 6px 10px;
  border-radius: 4px;
  margin-top: 8px;
  font-size: 12px;
}
.preview {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.badge-override {
  background: var(--accent);
  color: #fff;
  padding: 1px 8px;
  border-radius: 3px;
  font-size: 11px;
}
button.danger {
  background: var(--bad);
  color: #fff;
  border-color: var(--bad);
}
table { width: 100%; font-size: 12px; }
th { text-align: left; background: var(--panel-2); }
</style>
