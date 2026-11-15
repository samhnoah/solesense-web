import { ref } from 'vue'
import { en } from './messages.en'
import { ar } from './messages.ar'

export type Locale = 'en' | 'ar'
const KEY = 'solesense.locale'
const messages = { en, ar } as const

export const locale = ref<Locale>('en')

function apply(l: Locale) {
  locale.value = l
  const html = document.documentElement
  html.lang = l
  html.dir = l === 'ar' ? 'rtl' : 'ltr'
}

export function initLocale() {
  let saved: string | null = null
  try { saved = localStorage.getItem(KEY) } catch { /* storage unavailable */ }
  if (saved === 'en' || saved === 'ar') return apply(saved)
  apply(navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en')
}

export function setLocale(l: Locale) {
  apply(l)
  try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
}

function lookup(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
    obj,
  )
}

/** Translate a key. `{name}` placeholders are filled from `vars`. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let v = lookup(messages[locale.value], key) ?? lookup(messages.en, key)
  if (typeof v !== 'string') return key
  if (vars) for (const [k, val] of Object.entries(vars)) v = (v as string).replaceAll(`{${k}}`, String(val))
  return v as string
}

/** Translate a key whose value is a list or object. */
export function tm<T = unknown>(key: string): T {
  return (lookup(messages[locale.value], key) ?? lookup(messages.en, key)) as T
}
