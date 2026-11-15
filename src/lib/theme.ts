import { ref } from 'vue'

export type Theme = 'light' | 'dark'
const KEY = 'solesense.theme'
export const theme = ref<Theme>('light')

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
function apply(t: Theme) {
  theme.value = t
  document.documentElement.dataset.theme = t
}

export function initTheme() {
  let saved: string | null = null
  try { saved = localStorage.getItem(KEY) } catch { /* storage unavailable */ }
  apply(saved === 'light' || saved === 'dark' ? saved : systemTheme())
  // Follow the system until the visitor chooses for themselves.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    let chosen: string | null = null
    try { chosen = localStorage.getItem(KEY) } catch { /* ignore */ }
    if (!chosen) apply(systemTheme())
  })
}

export function toggleTheme() {
  const next: Theme = theme.value === 'dark' ? 'light' : 'dark'
  apply(next)
  try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
}
