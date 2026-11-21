<script lang="ts">
  import { onMount } from 'svelte';
  import { router } from './lib/router.svelte';
  import { toast, ui } from './lib/ui.svelte';
  import { getSettings, requestPersistence } from './lib/db';
  import { syncBundledDecks } from './lib/bundled';
  import { installRipple, updateScrolled } from './lib/ripple';
  import { device } from './lib/device.svelte';

  installRipple();
  import Dialogs from './components/Dialogs.svelte';
  import Home from './views/Home.svelte';
  import DeckView from './views/Deck.svelte';
  import Editor from './views/Editor.svelte';
  import Study from './views/Study.svelte';
  import Settings from './views/Settings.svelte';
  import NavRail from './components/NavRail.svelte';

  let ready = $state(false);

  onMount(async () => {
    let synced = { added: 0, updated: 0, removed: 0 };
    try {
      synced = await syncBundledDecks();
    } catch (e) {
      console.error('Deck sync failed', e);
    }
    ui.haptics = (await getSettings()).haptics;
    ready = true;
    const parts = [
      synced.added && `${synced.added} new`,
      synced.updated && `${synced.updated} updated`,
      synced.removed && `${synced.removed} removed`,
    ].filter(Boolean);
    if (parts.length) toast(`Decks synced: ${parts.join(', ')}`, 3000);
    requestPersistence();
  });

  const r = $derived(router.route);
  // Desktop: browse screens get the navigation rail; study and the editor stay full-screen.
  const rail = $derived(device.desktop && (r.name === 'home' || r.name === 'deck' || r.name === 'settings'));

  // New screen: start at the top, reset the app bar color.
  $effect(() => {
    router.path;
    window.scrollTo(0, 0);
    updateScrolled();
  });
</script>

{#if rail}<NavRail />{/if}

<div class="shell" class:rail>
{#if ready}
  {#key router.path}
    {#if r.name === 'home'}
      <Home />
    {:else if r.name === 'deck'}
      <DeckView deckId={r.deckId} />
    {:else if r.name === 'edit'}
      <Editor deckId={r.deckId} cardId={r.cardId} />
    {:else if r.name === 'study'}
      <Study deckId={r.deckId} mode={r.mode} />
    {:else if r.name === 'settings'}
      <Settings />
    {/if}
  {/key}
{/if}
</div>

<Dialogs />

<style>
  .shell.rail { padding-left: 88px; }
</style>
