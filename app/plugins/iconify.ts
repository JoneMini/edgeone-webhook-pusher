/**
 * Iconify Vue Plugin
 * Feature: frontend-admin-ui
 * 
 * Registers the Iconify Icon component globally for consistent icon usage.
 */
import { Icon } from '@iconify/vue';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('Icon', Icon);
});
