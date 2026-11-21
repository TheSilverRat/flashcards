<script lang="ts">
  import { onMount } from 'svelte';
  import { getSettings, saveSettings, defaultSettings, requestPersistence, db } from '../lib/db';
  import { exportBackup, importBackup, lastBackup } from '../lib/backup';
  import { back } from '../lib/router.svelte';
  import { choose, toast, ui } from '../lib/ui.svelte';
  import Icon from '../components/Icon.svelte';
  import { device, setLayout, type LayoutPref } from '../lib/device.svelte';

  let s = $state({ ...defaultSettings });
  let last = $state<number | null>(null);
  let persisted = $state<boolean | null>(null);
  let usage = $state('');
  let counts = $state({ decks: 0, cards: 0, images: 0 });
  let fileEl: HTMLInputElement | undefined = $state();
  let working = $state(false);

  onMount(async () => {
    s = await getSettings();
    await refresh();
  });

  async function refresh() {
    last = await lastBackup();
    persisted = await requestPersistence();
    counts = { decks: await db.decks.count(), cards: await db.cards.count(), images: await db.images.count() };
    try {
      const est = await navigator.storage?.estimate?.();
      if (est?.usage !== undefined) usage = `${(est.usage / 1024 / 1024).toFixed(1)} MB used`;
    } catch {
      /* not supported */
    }
  }

  async function update() {
    s.newPerDay = Math.max(0, Math.min(999, Math.round(Number(s.newPerDay) || 0)));
    await saveSettings($state.snapshot(s));
    ui.haptics = s.haptics;
  }

  async function doExport() {
    working = true;
    try {
      const r = await exportBackup();
      if (r !== 'cancelled') toast(r === 'shared' ? 'Backup shared' : 'Backup downloaded');
      await refresh();
    } catch (e) {
      toast('Backup failed');
      console.error(e);
    } finally {
      working = false;
    }
  }

  async function doImport(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    const mode = await choose(
      'Restore backup',
      'Merge keeps your current cards and adds the ones from the backup. Replace deletes everything in the app first.',
      [
        { label: 'Merge with current cards', value: 'merge' },
        { label: 'Replace everything', value: 'replace', danger: true },
      ],
    );
    if (!mode) return;
    working = true;
    try {
      const r = await importBackup(file, mode as 'merge' | 'replace');
      toast(`Restored ${r.decks} decks, ${r.cards} cards`);
      s = await getSettings();
      await refresh();
    } catch (err) {
      toast((err as Error).message || 'Import failed', 3500);
    } finally {
      working = false;
    }
  }

  function ago(t: number) {
    const d = Math.floor((Date.now() - t) / 86_400_000);
    return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
  }

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
</script>

<main class="page">
  <header class="topbar">
    <button class="icon-btn on-surface" onclick={() => back('/')} aria-label="Back"><Icon name="back" /></button>
    <h1>Settings</h1>
  </header>

  <div class="section-label">Backup</div>
  <div class="list">
    <button class="list-item" disabled={working} onclick={doExport}>
      <span class="lead icon"><Icon name="download" /></span>
      <span class="content">
        <span class="headline">Export backup</span>
        <span class="supporting">Last backup: {last ? ago(last) : 'never'}</span>
      </span>
    </button>
    <button class="list-item" disabled={working} onclick={() => fileEl?.click()}>
      <span class="lead icon"><Icon name="upload" /></span>
      <span class="content">
        <span class="headline">Restore from file</span>
        <span class="supporting">Load a backup you exported earlier</span>
      </span>
    </button>
  </div>
  <p class="hint">Cards live only on this device. On Android, Export opens the share menu so you can save to Google Drive.</p>
  <input type="file" accept=".json,application/json" bind:this={fileEl} onchange={doImport} hidden />

  <div class="section-label">Studying</div>
  <div class="list">
    <label class="list-item">
      <span class="content">
        <span class="headline">New cards per day</span>
        <span class="supporting">Per deck. Lower this if reviews pile up.</span>
      </span>
      <input class="input num" type="number" min="0" max="999" inputmode="numeric" bind:value={s.newPerDay} onchange={update} />
    </label>
    <label class="list-item">
      <span class="content">
        <span class="headline">Target recall</span>
        <span class="supporting">Higher means more frequent reviews</span>
      </span>
      <select class="input sel" bind:value={s.retention} onchange={update}>
        <option value={0.8}>80%</option>
        <option value={0.85}>85%</option>
        <option value={0.9}>90%</option>
        <option value={0.95}>95%</option>
      </select>
    </label>
    <label class="list-item">
      <span class="content">
        <span class="headline">Vibration feedback</span>
        <span class="supporting">Short buzz on swipes and flips</span>
      </span>
      <span class="switch">
        <input type="checkbox" role="switch" bind:checked={s.haptics} onchange={update} />
        <span class="track"><span class="thumb"><Icon name="check" size={16} /></span></span>
      </span>
    </label>
  </div>

  <div class="section-label">Display</div>
  <div class="list">
    <label class="list-item">
      <span class="content">
        <span class="headline">Layout</span>
        <span class="supporting">
          {device.pref === 'auto' ? `Automatic: using ${device.desktop ? 'desktop' : 'phone'} layout` : 'Saved for this browser only'}
        </span>
      </span>
      <select
        class="input sel wide"
        value={device.pref}
        onchange={(e) => setLayout((e.currentTarget as HTMLSelectElement).value as LayoutPref)}>
        <option value="auto">Automatic</option>
        <option value="phone">Phone</option>
        <option value="desktop">Desktop</option>
      </select>
    </label>
  </div>

  <div class="section-label">Storage</div>
  <div class="list">
    <div class="list-item static">
      <span class="lead icon"><Icon name="storage" /></span>
      <span class="content">
        <span class="headline">{plural(counts.decks, 'deck')} · {plural(counts.cards, 'card')}</span>
        <span class="supporting">{plural(counts.images, 'image')}{usage ? ` · ${usage}` : ''}</span>
      </span>
    </div>
    <div class="list-item static">
      <span class="lead icon"><Icon name="info" /></span>
      <span class="content">
        <span class="headline">Protected from cleanup</span>
        <span class="supporting">
          {persisted === null ? 'Checking…' : persisted ? 'Yes, the browser keeps this data' : 'Not yet. Install the app to your home screen.'}
        </span>
      </span>
      <span class="trail">
        {#if persisted}<span class="ok"><Icon name="check" /></span>{/if}
      </span>
    </div>
  </div>

  <p class="footer">Flashcards · spaced repetition by FSRS</p>
</main>

<style>
  .list-item .lead.icon { width: 24px; color: var(--md-on-surface-variant); }
  .list-item :global(.supporting) { white-space: normal; }
  .list-item:disabled { opacity: 0.38; }
  .list-item.static::before { display: none; }
  label.list-item { cursor: pointer; }
  .hint { margin: 12px 16px 0; font-size: 12px; line-height: 16px; color: var(--md-on-surface-variant); }
  .ok { color: var(--ok); display: grid; }

  .num, .sel {
    width: 88px;
    flex-shrink: 0;
    padding: 10px 12px;
    text-align: center;
    border-radius: var(--md-shape-xs) var(--md-shape-xs) 0 0;
  }
  .sel.wide { width: 128px; }

  :global(html.desktop) .page { max-width: 760px; }

  /* M3 switch */
  .switch { position: relative; flex-shrink: 0; width: 52px; height: 32px; }
  .switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; z-index: 1; }
  .track {
    position: absolute;
    inset: 0;
    border-radius: 16px;
    background: var(--md-surface-container-highest);
    border: 2px solid var(--md-outline);
    transition: background 0.2s var(--md-standard), border-color 0.2s;
  }
  .thumb {
    position: absolute;
    top: 50%;
    left: 6px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--md-outline);
    transform: translateY(-50%);
    display: grid;
    place-items: center;
    color: transparent;
    transition: all 0.25s var(--md-emphasized);
  }
  .switch input:checked + .track { background: var(--md-primary); border-color: var(--md-primary); }
  .switch input:checked + .track .thumb {
    left: 22px;
    width: 24px;
    height: 24px;
    background: var(--md-on-primary);
    color: var(--md-primary);
  }
  .switch input:focus-visible + .track { outline: 2px solid var(--md-primary); outline-offset: 2px; }

  .footer { text-align: center; color: var(--md-outline); font-size: 12px; margin-top: 32px; }
</style>
