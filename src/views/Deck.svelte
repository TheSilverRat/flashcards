<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db, deleteDeck, getSettings, renameDeck } from '../lib/db';
  import { countDue, dayStart, formatInterval, State } from '../lib/srs';
  import { plainPreview } from '../lib/render';
  import { back, go } from '../lib/router.svelte';
  import { confirm, prompt, toast } from '../lib/ui.svelte';
  import Icon from '../components/Icon.svelte';
  import { device } from '../lib/device.svelte';

  let { deckId }: { deckId: string } = $props();
  let query = $state('');
  let searchEl: HTMLInputElement | undefined = $state();

  // "/" jumps to the search box (desktop habit); Escape clears it.
  function onKey(e: KeyboardEvent) {
    if (e.key === '/' && searchEl && document.activeElement !== searchEl && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      searchEl.focus();
    } else if (e.key === 'Escape' && document.activeElement === searchEl) {
      query = '';
      searchEl?.blur();
    }
  }

  const data = liveQuery(async () => {
    const [deck, cards, settings] = await Promise.all([
      db.decks.get(deckId),
      db.cards.where('deckId').equals(deckId).toArray(),
      getSettings(),
    ]);
    const newToday = await db.reviews
      .where('reviewedAt')
      .aboveOrEqual(dayStart())
      .filter((r) => r.deckId === deckId && r.prevState === State.New)
      .count();
    cards.sort((a, b) => b.createdAt - a.createdAt);
    return { deck, cards, counts: countDue(cards, newToday, settings.newPerDay) };
  });

  const filtered = $derived.by(() => {
    const cards = $data?.cards ?? [];
    const q = query.trim().toLowerCase();
    return q ? cards.filter((c) => (c.front + '\n' + c.back).toLowerCase().includes(q)) : cards;
  });

  function status(c: { srs: { state: number }; due: number }) {
    if (c.srs.state === State.New) return { text: 'New', cls: 'blue' };
    const ms = c.due - Date.now();
    if (ms <= 0) return { text: 'Due', cls: 'accent' };
    return { text: formatInterval(ms), cls: 'muted' };
  }

  async function rename() {
    if ($data?.deck?.source === 'bundled') return toast('Rename it with the "# " line in the deck file');
    const name = await prompt('Rename deck', { value: $data?.deck?.name });
    if (name !== null) await renameDeck(deckId, name);
  }

  async function remove() {
    const n = $data?.cards.length ?? 0;
    const ok = await confirm('Delete this deck?', {
      message: `"${$data?.deck?.name}" and its ${n} card${n === 1 ? '' : 's'} will be deleted permanently.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteDeck(deckId);
    toast('Deck deleted');
    back('/');
  }
</script>

<svelte:window onkeydown={onKey} />

<main class="page">
  <header class="topbar">
    <button class="icon-btn on-surface" onclick={() => back('/')} aria-label="Back"><Icon name="back" /></button>
    <h1><button class="title" onclick={rename} title="Rename">{$data?.deck?.name ?? ''}</button></h1>
    {#if $data?.deck && $data.deck.source !== 'bundled'}
      <button class="icon-btn" onclick={remove} aria-label="Delete deck"><Icon name="trash" /></button>
    {/if}
  </header>

  {#if $data && !$data.deck}
    <div class="empty"><h2>Deck not found</h2></div>
  {:else if $data}
    {@const c = $data.counts}
    <div class="cols">
      <aside class="side">
        {#if $data.deck?.source === 'bundled'}
          <p class="source"><Icon name="file" size={18} /> From <code>decks/{$data.deck.file}</code> on your PC</p>
        {/if}

        <section class="panel study">
          <div class="counts">
            <div><span class="n new">{c.newCount}</span><span class="l">New</span></div>
            <div><span class="n learn">{c.learnCount}</span><span class="l">Learning</span></div>
            <div><span class="n">{c.reviewCount}</span><span class="l">Review</span></div>
          </div>
          {#if c.total > 0}
            <button class="btn primary lg block" onclick={() => go(`/deck/${deckId}/study`)}>
              <Icon name="play" /> Study now
            </button>
          {:else}
            <p class="caught-up">
              {$data.cards.length ? 'All caught up for today. Nice work.' : 'Add some cards to start studying.'}
            </p>
          {/if}
          {#if $data.cards.length}
            <button class="btn block lg tonal" onclick={() => go(`/deck/${deckId}/practice`)}>
              <Icon name="shuffle" /> Practice all
            </button>
          {/if}
        </section>
      </aside>

      <div class="cards">
        <div class="section-label">Cards · {$data.cards.length}</div>
        {#if $data.cards.length > 5}
          <label class="search">
            <Icon name="search" />
            <input placeholder="Search cards" bind:value={query} bind:this={searchEl} />
            {#if device.desktop}<span class="kbd">/</span>{/if}
          </label>
        {/if}

        {#if filtered.length}
          <ul class="list">
            {#each filtered as card (card.id)}
              {@const st = status(card)}
              <li>
                <button class="list-item" onclick={() => go(`/deck/${deckId}/edit/${card.id}`)}>
                  <span class="content">
                    <span class="headline">{plainPreview(card.front)}</span>
                    <span class="supporting">{plainPreview(card.back, 70)}</span>
                  </span>
                  <span class="trail"><span class="badge {st.cls}">{st.text}</span></span>
                </button>
              </li>
            {/each}
          </ul>
        {:else if $data.cards.length}
          <p class="none">No cards match “{query}”.</p>
        {/if}
      </div>
    </div>
  {/if}

  <button class="fab extended" onclick={() => go(`/deck/${deckId}/edit/new`)}><Icon name="plus" /> Add card</button>
</main>

<style>
  .title {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: inherit;
    font-weight: inherit;
    line-height: inherit;
    text-align: left;
  }
  .source {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 4px 16px;
    color: var(--md-on-surface-variant);
    font-size: 14px;
  }
  .source code { font-family: var(--font-mono); font-size: 13px; color: var(--md-on-surface); }

  .study { padding: 20px 16px 16px; display: flex; flex-direction: column; gap: 8px; }
  .counts { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; margin-bottom: 12px; }
  .counts div { display: flex; flex-direction: column; }
  .n { font-size: 32px; line-height: 40px; }
  .n.new { color: var(--md-tertiary); }
  .n.learn { color: var(--md-primary); }
  .l { color: var(--md-on-surface-variant); font-size: 12px; font-weight: 500; letter-spacing: 0.04em; }
  .caught-up { text-align: center; color: var(--md-on-surface-variant); margin: 4px 0 8px; }

  .search {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 56px;
    padding: 0 20px 0 16px;
    margin-bottom: 12px;
    background: var(--md-surface-container-high);
    border-radius: var(--md-shape-full);
    color: var(--md-on-surface-variant);
  }
  .search input { flex: 1; background: none; border: none; outline: none; font-size: 16px; color: var(--md-on-surface); }
  .search input::placeholder { color: var(--md-on-surface-variant); }
  .none { color: var(--md-on-surface-variant); text-align: center; padding: 24px; }

  /* Desktop: study panel on the left (stays in view), card list on the right. */
  :global(html.desktop) .cols {
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    gap: 32px;
    align-items: start;
    margin-top: 8px;
  }
  :global(html.desktop) .side { position: sticky; top: 88px; }
  :global(html.desktop) .cards .section-label { margin-top: 0; }
</style>
