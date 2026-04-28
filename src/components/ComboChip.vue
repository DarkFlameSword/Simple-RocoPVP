<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useApp } from "../store/app";
import { activeChipPopoverId } from "./popover-bus";
import type { BattleEntry, ComboInfo } from "../core/types";
import TypeBadge from "./TypeBadge.vue";

const props = defineProps<{
  combo: ComboInfo;
  selected?: boolean;
  /** When true, popover pet rows are clickable; emits `pick-pet`. */
  pickPet?: boolean;
  /** When true, show small × button on chip; emits `remove`. */
  removable?: boolean;
  /** Render ": petName" suffix on the chip body. */
  petName?: string;
  count?: number;
  weight?: number;
  size?: "sm" | "md";
}>();

const emit = defineEmits<{
  (e: "pick-pet", entry: BattleEntry): void;
  (e: "remove"): void;
}>();

const app = useApp();
const root = ref<HTMLElement | null>(null);
const popoverOpen = ref(false);
const popoverPos = ref<{ left: number; top: number } | null>(null);

const HOVER_DELAY_MS = 2000;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let leaveTimer: ReturnType<typeof setTimeout> | null = null;

function computePos(): void {
  if (!root.value) return;
  const r = root.value.getBoundingClientRect();
  const POPOVER_H_ESTIMATE = 280;
  const fitsBelow = window.innerHeight - r.bottom > POPOVER_H_ESTIMATE;
  popoverPos.value = {
    left: Math.min(r.left, window.innerWidth - 300),
    top: fitsBelow ? r.bottom + 4 : Math.max(8, r.top - POPOVER_H_ESTIMATE - 4),
  };
}

function openPopover(): void {
  computePos();
  popoverOpen.value = true;
  activeChipPopoverId.value = `${props.combo.id}-${props.petName ?? ""}`;
}
function closePopover(): void {
  popoverOpen.value = false;
  const my = `${props.combo.id}-${props.petName ?? ""}`;
  if (activeChipPopoverId.value === my) activeChipPopoverId.value = null;
}

watch(activeChipPopoverId, (id) => {
  const my = `${props.combo.id}-${props.petName ?? ""}`;
  if (id !== null && id !== my && popoverOpen.value) {
    popoverOpen.value = false;
  }
});

function onMouseEnter(): void {
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }
  hoverTimer = setTimeout(openPopover, HOVER_DELAY_MS);
}
function onMouseLeave(): void {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  leaveTimer = setTimeout(() => {
    closePopover();
    leaveTimer = null;
  }, 250);
}

function onChipClick(): void {
  popoverOpen.value ? closePopover() : openPopover();
}

function onPickPet(petId: number, petName: string): void {
  emit("pick-pet", { comboId: props.combo.id, petId, petName });
  closePopover();
}
function onPickComboOnly(): void {
  emit("pick-pet", { comboId: props.combo.id });
  closePopover();
}
function onRemove(): void {
  emit("remove");
}

function onDocClick(e: MouseEvent): void {
  const target = e.target as Node;
  if (root.value && root.value.contains(target)) return;
  const my = `combo-popover-${props.combo.id}-${props.petName ?? ""}`;
  const pop = document.getElementById(my);
  if (pop && pop.contains(target)) return;
  closePopover();
}

document.addEventListener("click", onDocClick);
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  if (hoverTimer) clearTimeout(hoverTimer);
  if (leaveTimer) clearTimeout(leaveTimer);
});

const pets = computed(() => app.petsOfCombo(props.combo.id));
const popoverDomId = computed(
  () => `combo-popover-${props.combo.id}-${props.petName ?? ""}`,
);
</script>

<template>
  <div
    ref="root"
    class="chip-wrap"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div
      class="chip"
      :class="{ selected, sm: size === 'sm' }"
      @click.stop="onChipClick"
    >
      <TypeBadge :type="combo.types[0]" :size="size" />
      <TypeBadge v-if="combo.types[1]" :type="combo.types[1]" :size="size" />
      <span v-if="petName" class="pet-suffix">: {{ petName }}</span>
      <span v-if="count !== undefined" class="meta">×{{ count }}</span>
      <span v-else-if="weight !== undefined" class="meta">
        {{ (weight * 100).toFixed(1) }}%
      </span>
      <span
        v-if="combo.petCount && combo.petCount > 0 && count === undefined && weight === undefined && !petName"
        class="pet-count"
        :title="`${combo.petCount} 只精灵`"
      >
        {{ combo.petCount }}
      </span>
      <button
        v-if="removable"
        type="button"
        class="rm-btn"
        title="移除"
        @click.stop="onRemove"
      >
        ×
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="popoverOpen && popoverPos"
        :id="popoverDomId"
        class="combo-popover"
        :style="{ left: popoverPos.left + 'px', top: popoverPos.top + 'px' }"
        @click.stop
        @mouseenter="onMouseEnter"
        @mouseleave="onMouseLeave"
      >
        <div class="pop-header">
          <TypeBadge :type="combo.types[0]" />
          <TypeBadge v-if="combo.types[1]" :type="combo.types[1]" />
          <span class="pop-count">{{ pets.length }} 只</span>
        </div>
        <div v-if="pets.length === 0" class="pop-empty">
          该组合暂无精灵数据
          <button v-if="pickPet" class="pop-fallback" @click="onPickComboOnly">
            选择此组合(无精灵名)
          </button>
        </div>
        <ul v-else class="pop-list" :class="{ pickable: pickPet }">
          <li
            v-for="p in pets"
            :key="p.id"
            class="pop-row"
            @click="pickPet ? onPickPet(p.id, p.name) : null"
          >
            <span class="pop-name">{{ p.name }}</span>
            <span class="pop-stats">
              {{ Math.max(p.base_stats.phy_atk, p.base_stats.mag_atk) }}/{{
                p.base_stats.spd
              }}/{{ p.base_stats.hp }}
            </span>
          </li>
        </ul>
        <div v-if="pickPet" class="pop-hint muted">点击精灵名以录入</div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.chip-wrap { display: inline-flex; position: relative; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  transition: border-color 0.15s, background 0.15s;
}
.chip:hover { border-color: var(--accent); }
.chip.selected {
  border-color: var(--accent);
  background: rgba(79, 156, 245, 0.18);
  box-shadow: 0 0 0 1px var(--accent);
}
.chip.sm { padding: 2px 5px; font-size: 11px; }
.pet-suffix { color: var(--text); margin-left: 2px; font-weight: 500; }
.meta { color: var(--text-dim); margin-left: 2px; }
.pet-count {
  background: var(--border);
  color: var(--text-dim);
  font-size: 10px;
  padding: 0 4px;
  border-radius: 8px;
  margin-left: 4px;
}
.rm-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  width: 18px;
  height: 18px;
  border-radius: 4px;
  padding: 0;
  margin-left: 4px;
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.rm-btn:hover {
  background: var(--bad);
  color: #fff;
  border-color: var(--bad);
}
</style>

<style>
.combo-popover {
  position: fixed;
  z-index: 10000;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  padding: 10px 12px;
  min-width: 240px;
  max-width: 320px;
  max-height: 360px;
  overflow-y: auto;
  font-size: 12px;
  color: var(--text);
}
.combo-popover .pop-header {
  display: flex;
  gap: 6px;
  align-items: center;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 6px;
}
.combo-popover .pop-count {
  color: var(--text-dim);
  font-size: 11px;
  margin-left: auto;
}
.combo-popover .pop-fallback {
  display: block;
  margin-top: 6px;
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  padding: 4px 10px;
  font-size: 11px;
}
.combo-popover .pop-empty {
  color: var(--text-dim);
  padding: 4px 0;
}
.combo-popover .pop-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.combo-popover .pop-list.pickable .pop-row {
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
}
.combo-popover .pop-list.pickable .pop-row:hover {
  background: rgba(79, 156, 245, 0.18);
}
.combo-popover .pop-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 0;
}
.combo-popover .pop-name { color: var(--text); }
.combo-popover .pop-stats {
  color: var(--text-dim);
  font-family: ui-monospace, "Cascadia Code", monospace;
  font-size: 10px;
}
.combo-popover .pop-hint {
  margin-top: 6px;
  font-size: 10px;
  text-align: center;
  border-top: 1px solid var(--border);
  padding-top: 4px;
}
</style>
