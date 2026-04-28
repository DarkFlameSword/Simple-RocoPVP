<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useApp } from "../store/app";

const app = useApp();
const router = useRouter();

function gotoWhitelist(): void {
  router.push("/whitelist");
}

const lambdaA = computed({
  get: () => app.settings.lambdaA,
  set: (v) => app.patchSettings({ lambdaA: Number(v) }),
});
const lambdaD = computed({
  get: () => app.settings.lambdaD,
  set: (v) => app.patchSettings({ lambdaD: Number(v) }),
});
const lambdaW = computed({
  get: () => app.settings.lambdaW,
  set: (v) => app.patchSettings({ lambdaW: Number(v) }),
});
const alpha0 = computed({
  get: () => app.settings.alpha0,
  set: (v) => app.patchSettings({ alpha0: Number(v) }),
});
const N0 = computed({
  get: () => app.settings.N0,
  set: (v) => app.patchSettings({ N0: Number(v) }),
});
const r = computed({
  get: () => app.settings.redundancyThreshold,
  set: (v) => app.patchSettings({ redundancyThreshold: Number(v) }),
});

const confirming = ref(false);
async function resetEpoch(): Promise<void> {
  if (!confirming.value) {
    confirming.value = true;
    setTimeout(() => (confirming.value = false), 4000);
    return;
  }
  await app.resetEpoch();
  confirming.value = false;
}
</script>

<template>
  <div class="layout">
    <section class="panel">
      <h3 style="margin: 0 0 8px">团队评分权重 (λ)</h3>
      <p class="muted" style="margin: 0 0 8px">
        S(P) = λ_A · A(P) + λ_D · D_switch(P) + λ_W · D_weak(P)
      </p>
      <div class="slider-row">
        <label>λ_A 进攻</label>
        <input v-model.number="lambdaA" type="range" min="0" max="3" step="0.1" />
        <span>{{ lambdaA.toFixed(1) }}</span>
      </div>
      <div class="slider-row">
        <label>λ_D 安全换入</label>
        <input v-model.number="lambdaD" type="range" min="0" max="3" step="0.1" />
        <span>{{ lambdaD.toFixed(1) }}</span>
      </div>
      <div class="slider-row">
        <label>λ_W 弱点惩罚</label>
        <input v-model.number="lambdaW" type="range" min="0" max="3" step="0.1" />
        <span>{{ lambdaW.toFixed(1) }}</span>
      </div>
      <div class="slider-row">
        <label>r 冗余阈值</label>
        <input v-model.number="r" type="range" min="0" max="3" step="1" />
        <span>{{ r }}</span>
      </div>
    </section>

    <section class="panel">
      <h3 style="margin: 0 0 8px">数据平滑参数</h3>
      <div class="slider-row">
        <label>α₀ Dirichlet 先验</label>
        <input v-model.number="alpha0" type="range" min="0" max="2" step="0.1" />
        <span>{{ alpha0.toFixed(1) }}</span>
      </div>
      <div class="slider-row">
        <label>N₀ 双模融合阈值</label>
        <input v-model.number="N0" type="range" min="5" max="100" step="1" />
        <span>{{ N0 }}</span>
      </div>
    </section>

    <section class="panel">
      <h3 style="margin: 0 0 8px">统计周期</h3>
      <p class="muted" style="margin: 0 0 8px">
        当前周期开始于 {{ new Date(app.settings.epochStart).toLocaleString() }} ·
        共录入 {{ app.eventCount }} 场
      </p>
      <button :class="confirming ? 'primary' : ''" @click="resetEpoch">
        {{ confirming ? "再次点击确认重置" : "重置统计周期" }}
      </button>
    </section>

    <section class="panel">
      <h3 style="margin: 0 0 8px">数据维护</h3>
      <p class="muted" style="margin: 0 0 8px">
        游戏更新时维护双属性白名单(默认 70 条来自精灵图鉴自动派生)。
      </p>
      <button class="primary" @click="gotoWhitelist">双属性名单录入</button>
    </section>

    <section class="panel">
      <h3 style="margin: 0 0 8px">配置信息</h3>
      <div class="muted">
        配置版本: {{ app.manifest?.configVersion ?? "?" }} ·
        类型矩阵版本: {{ app.matrixSpec?.version ?? "?" }} ·
        双属性白名单版本: {{ app.dualsSpec?.version ?? "?" }}
      </div>
      <div class="muted" style="margin-top: 4px">
        矩阵规模: {{ app.matrixSpec?.types.length ?? 0 }} 个属性 ·
        候选组合数: {{ app.allCombos.length }}
      </div>
    </section>
  </div>
</template>

<style scoped>
.layout { display: flex; flex-direction: column; gap: 12px; max-width: 720px; }
.slider-row {
  display: grid;
  grid-template-columns: 140px 1fr 60px;
  gap: 12px;
  align-items: center;
  margin: 6px 0;
}
.slider-row label { font-size: 13px; }
</style>
