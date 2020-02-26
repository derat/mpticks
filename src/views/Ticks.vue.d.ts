// src/shims-vue.d.ts provides a default TypeScript definition for .vue files.
// Ticks.vue exports an additional method for unit tests, so it needs its own
// definition.
import Vue from 'vue';
export default Vue;
export function compareNames(a: string, b: string): number;
