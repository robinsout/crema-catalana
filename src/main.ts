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

// links from before the router (#b1-04) → #/b1-04, resolved by the router's catch-all route
const legacy = legacyHashToPath(location.hash);
if (legacy) history.replaceState(history.state, '', `#${legacy}`);

createApp(App).use(createPinia()).use(createAppRouter()).mount('#app');
