<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db, deckOptions, resetDeckProgress, setDeckOptions, type DeckOptions, type StudyMode } from '../lib/db';
  import { back } from '../lib/router.svelte';
  import { confirm, toast } from '../lib/ui.svelte';
  import Icon from '../components/Icon.svelte';

  let { deckId }: { deckId: string } = $props();

  const deck = liveQuery(() => db.decks.get(deckId));
  const o = $derived(deckOptions($deck));

  const MODES: { id: StudyMode; title: string; text: string }[] = [
    {
      id: 'basic',
      title: 'Basic',
      text: 'Study all cards whenever you like. Mark the ones you miss and go over just those later. No schedule.',
    },
    {
      id: 'spaced',
      title: 'Spaced repetition',
      text: 'Cards come back days apart based on how well you knew them, with daily limits. Best for big decks.',
    },
  ];

  const SESSION_SIZES = [0, 10, 20, 30, 50];

  function set(opts: Partial<DeckOptions>) {
    setDeckOptions(deckId, opts);
  }

  /** Number field: whole number in [0, 999]; empty or invalid falls back to `fallback`. */
  function num(e: Event, fallback: number) {
    const el = e.currentTarget as HTMLInputElement;
    const v = el.value.trim() === '' ? fallback : Math.max(0, Math.min(999, Math.round(Number(el.value) || 0)));
    el.value = String(v);
    return v;
  }

  async function reset() {
    const ok = await confirm('Reset progress?', {
      message:
        'Every card in this deck goes back to new: spaced-repetition schedules, "missed" marks and review history are cleared. The cards themselves stay.',
      confirmLabel: 'Reset',
      danger: true,
    });
    if (!ok) return;
    await resetDeckProgress(deckId);
    toast('Progress reset');
  }
</script>

<main class="page">
  <header class="topbar">
    <button class="icon-btn on-surface" onclick={() => back(`/deck/${deckId}`)} aria-label="Back"><Icon name="back" /></button>
    <h1>
      Study options
      <span class="sub">{$deck?.name ?? ''}</span>
    </h1>
  </header>

  {#if $deck}
    <div class="section-label">Study mode</div>
    <div class="list" role="radiogroup" aria-label="Study mode">
      {#each MODES as m (m.id)}
        <button class="list-item" role="radio" aria-checked={o.mode === m.id} onclick={() => set({ mode: m.id })}>
          <span class="lead"><span class="radio" class:on={o.mode === m.id}></span></span>
          <span class="content">
            <span class="headline">{m.title}</span>
            <span class="supporting">{m.text}</span>
          </span>
        </button>
      {/each}
    </div>

    {#if o.mode === 'basic'}
      <div class="section-label">Basic</div>
      <div class="list">
        <label class="list-item">
          <span class="content">
            <span class="headline">Card order</span>
            <span class="supporting">Shuffled each time, or the order they're written in</span>
          </span>
          <select
            class="input sel"
            value={o.order}
            onchange={(e) => set({ order: (e.currentTarget as HTMLSelectElement).value as DeckOptions['order'] })}>
            <option value="shuffled">Shuffled</option>
            <option value="ordered">In order</option>
          </select>
        </label>
        <label class="list-item">
          <span class="content">
            <span class="headline">Cards per session</span>
            <span class="supporting">How many cards one study session goes through</span>
          </span>
          <select
            class="input sel"
            value={o.sessionSize}
            onchange={(e) => set({ sessionSize: Number((e.currentTarget as HTMLSelectElement).value) })}>
            {#each SESSION_SIZES as n (n)}
              <option value={n}>{n === 0 ? 'All' : n}</option>
            {/each}
          </select>
        </label>
      </div>
    {:else}
      <div class="section-label">Spaced repetition</div>
      <div class="list">
        <label class="list-item">
          <span class="content">
            <span class="headline">New cards per day</span>
            <span class="supporting">Cards you haven't seen yet, introduced each day</span>
          </span>
          <input
            class="input num"
            type="number"
            min="0"
            max="999"
            inputmode="numeric"
            value={o.newPerDay}
            onchange={(e) => set({ newPerDay: num(e, 20) })} />
        </label>
        <label class="list-item">
          <span class="content">
            <span class="headline">Reviews per day</span>
            <span class="supporting">Most cards to review in a day. 0 = no limit</span>
          </span>
          <input
            class="input num"
            type="number"
            min="0"
            max="999"
            inputmode="numeric"
            value={o.reviewsPerDay}
            onchange={(e) => set({ reviewsPerDay: num(e, 0) })} />
        </label>
      </div>
      <p class="hint">Target recall (how often cards come back) is in the app's Settings and applies to all spaced decks.</p>
    {/if}

    <div class="section-label">Progress</div>
    <div class="list">
      <button class="list-item" onclick={reset}>
        <span class="lead icon"><Icon name="refresh" /></span>
        <span class="content">
          <span class="headline">Reset progress</span>
          <span class="supporting">Start this deck over as if you'd never studied it</span>
        </span>
      </button>
    </div>
  {/if}
</main>

<style>
  h1 { display: flex; flex-direction: column; line-height: 1.2; }
  .sub { font-size: 12px; line-height: 16px; color: var(--md-on-surface-variant); overflow: hidden; text-overflow: ellipsis; }
  .list-item :global(.supporting) { white-space: normal; }
  label.list-item { cursor: pointer; }
  .list-item .lead.icon { width: 24px; color: var(--md-on-surface-variant); }
  .hint { margin: 12px 16px 0; font-size: 12px; line-height: 16px; color: var(--md-on-surface-variant); }

  /* M3 radio button */
  .radio {
    width: 20px;
    height: 20px;
    margin: 0 2px;
    border-radius: 50%;
    border: 2px solid var(--md-on-surface-variant);
    display: grid;
    place-items: center;
    transition: border-color 0.2s var(--md-standard);
  }
  .radio::after {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--md-primary);
    transform: scale(0);
    transition: transform 0.2s var(--md-emphasized);
  }
  .radio.on { border-color: var(--md-primary); }
  .radio.on::after { transform: scale(1); }

  .num, .sel {
    width: 96px;
    flex-shrink: 0;
    padding: 10px 12px;
    text-align: center;
    border-radius: var(--md-shape-xs) var(--md-shape-xs) 0 0;
  }
  .sel { width: 120px; }

  :global(html.desktop) .page { max-width: 760px; }
</style>
