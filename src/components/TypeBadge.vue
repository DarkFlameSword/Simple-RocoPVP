<script setup lang="ts">
defineProps<{ type: string; size?: "sm" | "md" }>();

const palette: Record<string, string> = {
  普通: "#008fff",
  草: "#7cc26b",
  水: "#6498f3",
  火: "#ff0000",
  电: "#f5c84e",
  翼: "#9bc0e0",
  冰: "#7adfff",
  机械: "#b9b9c8",
  地面: "#c19a5a",
  恶: "#ff00ae",
  龙: "#c5790d",
  幽: "#b06fcf",
  武: "#c44848",
  光: "#f0e15a",
  毒: "#a86bd6",
  萌: "#f6a7c8",
  虫: "#a4c83d",
  幻: "#e96aa8",
};
</script>

<template>
  <span
    class="badge"
    :class="size === 'sm' ? 'sm' : 'md'"
    :style="{ background: palette[type] || '#888' }"
    >{{ type }}</span
  >
</template>

<style scoped>
.badge {
  display: inline-block;
  color: #1a1d23;
  font-weight: 600;
  border-radius: 4px;
  text-align: center;
  white-space: nowrap;
}
.md {
  padding: 3px 8px;
  font-size: 12px;
  min-width: 28px;
}
.sm {
  padding: 1px 5px;
  font-size: 10px;
  min-width: 22px;
}
</style>
