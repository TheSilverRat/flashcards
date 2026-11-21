<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db, createDeck, getSettings, type Deck } from '../lib/db';
  import { countDue, dayStart, streak, State, type Counts } from '../lib/srs';
  import { lastBackup } from '../lib/backup';
  import { go } from '../lib/router.svelte';
  import { prompt } from '../lib/ui.svelte';
  import { device } from '../lib/device.svelte';
  import Icon from '../components/Icon.svelte';

  const DAY = 86_400_000;

  const summary = liveQuery(async () => {
    const [decks, cards, settings, last] = await Promise.all([
      db.decks.orderBy('createdAt').toArray(),
      db.cards.toArray(),
      getSettings(),
      lastBackup(),
    ]);
    const today = dayStart();
    const todays = await db.reviews.where('reviewedAt').aboveOrEqual(today).toArray();
    const times = (await db.reviews.orderBy('reviewedAt').keys()) as number[];

    const rows: { deck: Deck; total: number; counts: Counts }[] = decks.map((deck) => {
      const deckCards = cards.filter((c) => c.deckId === deck.id);
      const newToday = todays.filter((r) => r.deckId === deck.id && r.prevState === State.New).length;
      return { deck, total: deckCards.length, counts: countDue(deckCards, newToday, settings.newPerDay) };
    });

    const needsBackup = cards.length >= 10 && (last === null || Date.now() - last > 14 * DAY);
    return {
      rows,
      dueTotal: rows.reduce((s, r) => s + r.counts.total, 0),
      reviewedToday: todays.length,
      streak: streak(times),
      needsBackup,
      lastBackup: last,
    };
  });

  async function newDeck() {
    const name = await prompt('New deck', { placeholder: 'e.g. Linear Algebra', confirmLabel: 'Create' });
    if (name === null) return;
    const id = await createDeck(name);
    go(`/deck/${id}`);
  }

  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? 'Late night study' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();
</script>

<main class="page">
  <header class="topbar">
    <h1>Flashcards</h1>
    {#if !device.desktop}
      <button class="icon-btn" onclick={() => go('/settings')} aria-label="Settings"><Icon name="settings" /></button>
    {/if}
  </header>

  {#if $summary}
    {@const s = $summary}
    <section class="hero">
      <p class="greet">{greeting()}</p>
      {#if s.dueTotal > 0}
        <p class="due"><span class="num">{s.dueTotal}</span> card{s.dueTotal === 1 ? '' : 's'} to review today</p>
      {:else if s.rows.length}
        <p class="due">You're all caught up</p>
      {:else}
        <p class="due">Create your first deck to begin</p>
      {/if}
      <div class="chips">
        <span class="chip-static"><Icon name="flame" size={18} /> {s.streak} day{s.streak === 1 ? '' : 's'} streak</span>
        <span class="chip-static"><Icon name="check" size={18} /> {s.reviewedToday} reviewed today</span>
      </div>
    </section>

    {#if s.needsBackup}
      <button class="backup" data-ripple onclick={() => go('/settings')}>
        <Icon name="download" />
        <span>
          <b>Back up your cards</b>
          <small>{s.lastBackup ? `Last backup ${Math.floor((Date.now() - s.lastBackup) / DAY)} days ago` : 'No backup yet'}</small>
        </span>
      </button>
    {/if}

    {#if s.rows.length}
      <div class="section-label">Decks</div>
      <ul class="list decks">
        {#each s.rows as { deck, total, counts } (deck.id)}
          <li>
            <button class="list-item" onclick={() => go(`/deck/${deck.id}`)}>
              <span class="lead"><span class="avatar">{initial(deck.name)}</span></span>
              <span class="content">
                <span class="headline">{deck.name}</span>
                <span class="supporting">
                  {total} card{total === 1 ? '' : 's'}{deck.source === 'bundled' ? ' · from your PC' : ''}
                </span>
              </span>
              <span class="trail">
                {#if counts.newCount}<span class="badge blue" title="New">{counts.newCount}</span>{/if}
                {#if counts.learnCount + counts.reviewCount}
                  <span class="badge accent" title="Due">{counts.learnCount + counts.reviewCount}</span>
                {/if}
                {#if !counts.total}<span class="done"><Icon name="check" size={20} /></span>{/if}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="empty">
        <Icon name="cards" size={48} />
        <h2>No decks yet</h2>
        <p>Create one, or add a file to the decks folder on your PC.</p>
      </div>
    {/if}
  {/if}

  <button class="fab extended" onclick={newDeck}><Icon name="plus" /> New deck</button>
</main>

<style>
  .hero { padding: 8px 4px 8px; }
  .greet { margin: 0; color: var(--md-on-surface-variant); font-size: 16px; }
  .due { margin: 4px 0 16px; font-size: 32px; line-height: 40px; font-weight: 400; }
  .num { color: var(--md-primary); font-weight: 500; }
  .chips { display: flex; gap: 8px; flex-wrap: wrap; }
  .chip-static {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 16px 0 8px;
    border-radius: var(--md-shape-sm);
    border: 1px solid var(--md-outline-variant);
    color: var(--md-on-surface-variant);
    font-size: 14px;
    font-weight: 500;
  }
  .chip-static :global(svg) { color: var(--md-primary); }

  .backup {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    margin-top: 20px;
    padding: 16px 20px;
    border-radius: var(--md-shape-lg);
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
    text-align: left;
  }
  .backup span { display: flex; flex-direction: column; }
  .backup b { font-weight: 500; }
  .backup small { font-size: 14px; opacity: 0.85; }

  .done { color: var(--ok); display: grid; }

  /* Desktop: decks become a grid of tiles. */
  :global(html.desktop) .hero { padding: 16px 4px 8px; }
  :global(html.desktop) .due { font-size: 44px; line-height: 52px; margin: 8px 0 20px; }
  :global(html.desktop) .backup { width: auto; max-width: 520px; }
  :global(html.desktop) .decks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
    border-radius: 0;
    overflow: visible;
  }
  :global(html.desktop) .decks .list-item {
    min-height: 96px;
    padding: 16px 20px;
    border-radius: var(--md-shape-xl);
  }
  :global(html.desktop) .decks .avatar { width: 48px; height: 48px; font-size: 20px; }
</style>
