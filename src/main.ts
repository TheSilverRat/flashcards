import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import './app.css';
import './lib/theme.svelte'; // applies the saved color theme before the first render
import App from './App.svelte';

// Auto-update: when a new version is deployed (e.g. you pushed new cards), the service worker
// downloads it and the page reloads into it. Also check whenever the app comes back to the foreground.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    });
  },
});

export default mount(App, { target: document.getElementById('app')! });
