<script setup lang="ts">
import { useRoute } from 'vue-router'
import Wordmark from './Wordmark.vue'
import { locale, setLocale, t } from '../lib/i18n'
import { theme, toggleTheme } from '../lib/theme'

const route = useRoute()
</script>

<template>
  <header class="site-header wrap">
    <RouterLink to="/" class="brand" :aria-label="'SoleSense, ' + t('nav.home')">
      <Wordmark />
    </RouterLink>
    <span class="tag">{{ t('nav.prototype') }}</span>
    <nav>
      <RouterLink v-if="route.path !== '/app'" to="/app" class="link">{{ t('nav.demo') }}</RouterLink>
      <button class="link" :lang="locale === 'ar' ? 'en' : 'ar'" :aria-label="t('nav.switchLangLabel')"
        @click="setLocale(locale === 'ar' ? 'en' : 'ar')">{{ t('nav.switchLang') }}</button>
      <button class="icon" :aria-label="theme === 'dark' ? t('nav.themeToLight') : t('nav.themeToDark')" @click="toggleTheme">
        <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" /></svg>
      </button>
    </nav>
  </header>
</template>

<style scoped>
.site-header { display: flex; align-items: center; gap: 0.75rem; padding-block: 1.1rem; }
.brand { text-decoration: none; color: var(--ink); }
.tag { font-size: var(--step--1); color: var(--ink-2); border: 1px solid var(--line); border-radius: 999px; padding: 0.1em 0.7em; white-space: nowrap; }
nav { margin-inline-start: auto; display: flex; align-items: center; gap: clamp(0.25rem, 2vw, 1.25rem); }
.link { font: inherit; font-weight: 500; color: var(--ink); background: none; border: 0; padding: 0.6em 0.5em; min-height: 44px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; white-space: nowrap; }
.link:hover { color: var(--blue); }
.link:lang(ar) { font-family: 'IBM Plex Sans Arabic', sans-serif; }
.icon { width: 44px; height: 44px; display: grid; place-items: center; background: none; border: 0; color: var(--ink); cursor: pointer; border-radius: 50%; }
.icon:hover { background: var(--sunken); }
.icon svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
@media (max-width: 480px) { .tag { display: none; } }
</style>
