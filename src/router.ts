import { createRouter, createWebHashHistory } from "vue-router";
import InputView from "./views/InputView.vue";
import RecommendView from "./views/RecommendView.vue";
import SettingsView from "./views/SettingsView.vue";
import WhitelistView from "./views/WhitelistView.vue";
import TeamsView from "./views/TeamsView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/input" },
    { path: "/input", name: "input", component: InputView },
    { path: "/recommend", name: "recommend", component: RecommendView },
    { path: "/whitelist", name: "whitelist", component: WhitelistView },
    { path: "/teams", name: "teams", component: TeamsView },
    { path: "/settings", name: "settings", component: SettingsView },
  ],
});
