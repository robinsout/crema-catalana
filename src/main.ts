// fonts are served with the site (no requests to Google Fonts)
import '@fontsource/unbounded/500.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/literata/400.css';
import '@fontsource/literata/400-italic.css';
import '@fontsource/literata/600.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles/main.css';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { createAppRouter, legacyHashToPath } from './router.ts';
import { useUpdateStore } from './stores/update.ts';
import { reloadOnMissingCode } from './services/offline.ts';

// links from before the router (#b1-04) → #/b1-04, resolved by the router's catch-all route
const legacy = legacyHashToPath(location.hash);
if (legacy) history.replaceState(history.state, '', `#${legacy}`);

const pinia = createPinia();
createApp(App).use(pinia).use(createAppRouter()).mount('#app');
// the service worker (BACKLOG I-6) only in the built site: in development it would serve stale code
if (import.meta.env.PROD) { reloadOnMissingCode(); useUpdateStore(pinia).start(); }
