import { createApp } from 'vue'
import '@fontsource-variable/newsreader/opsz.css'
import '@fontsource-variable/public-sans/wght.css'
import '@fontsource-variable/noto-naskh-arabic/wght.css'
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import './styles/base.css'
import App from './App.vue'
import { router } from './router'
import { initLocale } from './lib/i18n'
import { initTheme } from './lib/theme'

initLocale()
initTheme()
createApp(App).use(router).mount('#app')
