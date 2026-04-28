<script setup lang="ts">
import { onMounted, computed } from "vue";
import { RouterLink, RouterView, useRouter, useRoute } from "vue-router";
import { useApp } from "./store/app";

const app = useApp();
const router = useRouter();
const route = useRoute();
onMounted(() => app.init());

const status = computed(() => {
  if (app.error) return `初始化失败: ${app.error}`;
  if (!app.ready) return "正在加载...";
  const v = app.manifest?.configVersion ?? "?";
  return `配置 ${v} · 当前周期 ${app.eventCount} 场`;
});

function gotoSettings(): void {
  if (route.path === "/settings") {
    router.back();
  } else {
    router.push("/settings");
  }
}

const onSettings = computed(() => route.path === "/settings");
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">洛克王国 PVP 配队辅助器</div>
      <nav class="nav">
        <RouterLink to="/input">实时权重录入</RouterLink>
        <RouterLink to="/teams">主流配队录入</RouterLink>
        <RouterLink to="/recommend">当前属性推荐</RouterLink>
      </nav>
      <div class="status">{{ status }}</div>
    </header>
    <main class="main">
      <div v-if="!app.ready" class="loading">
        {{ app.error ? app.error : "正在加载配置..." }}
      </div>
      <RouterView v-else />
    </main>
    <footer class="footer">
      <span class="muted">
        💡 本工具基于属性层推荐,实战还需考虑种族值、技能、操作等因素。
      </span>
    </footer>
    <button
      class="gear-btn"
      :class="{ active: onSettings }"
      :title="onSettings ? '关闭设置' : '设置'"
      @click="gotoSettings"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-rows: 56px 1fr 32px;
  height: 100vh;
  position: relative;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 18px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}
.brand { font-weight: 600; font-size: 15px; }
.nav { display: flex; gap: 4px; margin-left: 24px; }
.nav :deep(a) {
  text-decoration: none;
  color: var(--text-dim);
  padding: 6px 12px;
  border-radius: 6px;
}
.nav :deep(a.router-link-active) {
  color: var(--text);
  background: var(--panel-2);
}
.status {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-dim);
}
.main { padding: 16px; overflow: auto; }
.loading {
  color: var(--text-dim);
  padding: 40px;
  text-align: center;
}
.footer {
  border-top: 1px solid var(--border);
  background: var(--panel);
  display: flex;
  align-items: center;
  padding: 0 16px;
}
.gear-btn {
  position: fixed;
  bottom: 48px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--panel);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-dim);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
  transition: all 0.2s;
}
.gear-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  transform: rotate(30deg);
}
.gear-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  transform: rotate(180deg);
}
</style>
