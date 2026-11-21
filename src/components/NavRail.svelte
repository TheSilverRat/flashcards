<script lang="ts">
  // M3 navigation rail, shown on the left in the desktop layout.
  import { go, router } from '../lib/router.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  const dest: { label: string; icon: IconName; path: string; match: string[] }[] = [
    { label: 'Decks', icon: 'cards', path: '/', match: ['home', 'deck'] },
    { label: 'Settings', icon: 'settings', path: '/settings', match: ['settings'] },
  ];
</script>

<nav class="rail" aria-label="Main">
  <img class="logo" src="./favicon.svg" alt="" width="40" height="40" />
  {#each dest as d (d.path)}
    {@const active = d.match.includes(router.route.name)}
    <button
      class="dest"
      class:active
      aria-current={active ? 'page' : undefined}
      onclick={() => {
        if (router.path !== d.path) go(d.path);
      }}>
      <span class="pill"><Icon name={d.icon} /></span>
      <span class="label">{d.label}</span>
    </button>
  {/each}
</nav>

<style>
  .rail {
    position: fixed;
    inset: 0 auto 0 0;
    width: 88px;
    z-index: 25;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding-top: 16px;
    background: var(--md-surface);
  }
  .logo { margin-bottom: 28px; border-radius: 12px; }
  .dest {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 80px;
    color: var(--md-on-surface-variant);
  }
  /* State layer only on the pill, like the M3 rail. */
  .pill {
    position: relative;
    width: 56px;
    height: 32px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    overflow: hidden;
    transition: background-color 0.2s var(--md-standard);
  }
  .pill::before {
    content: '';
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity 0.15s linear;
  }
  .dest:hover .pill::before { opacity: 0.08; }
  .dest.active { color: var(--md-on-surface); }
  .dest.active .pill { background: var(--md-secondary-container); color: var(--md-on-secondary-container); }
  .label { font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0.04em; }
</style>
