import { ref } from "vue";

/** Singleton: ID of the chip whose popover is currently open. */
export const activeChipPopoverId = ref<string | null>(null);
