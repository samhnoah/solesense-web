import type { Directive } from 'vue'

let io: IntersectionObserver | null = null
function observer() {
  if (!io) {
    io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io!.unobserve(e.target) }
    }, { rootMargin: '0px 0px -12% 0px' })
  }
  return io
}

/** v-reveal: fade a section in the first time it scrolls into view. */
export const vReveal: Directive<HTMLElement> = {
  mounted(el) { el.classList.add('reveal'); observer().observe(el) },
  unmounted(el) { io?.unobserve(el) },
}
