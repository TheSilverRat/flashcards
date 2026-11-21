<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { db, getSettings, defaultSettings, type Card } from '../lib/db';
  import {
    buildQueue,
    dayStart,
    GRADES,
    LEARN_AHEAD,
    previewIntervals,
    rate,
    Rating,
    State,
    undoRating,
    type Grade,
  } from '../lib/srs';
  import { back, go } from '../lib/router.svelte';
  import { buzz, toast } from '../lib/ui.svelte';
  import Icon from '../components/Icon.svelte';
  import CardContent from '../components/CardContent.svelte';
  import { device } from '../lib/device.svelte';

  let { deckId, mode }: { deckId: string; mode: 'review' | 'practice' } = $props();
  const practice = $derived(mode === 'practice');

  type Hist =
    | { kind: 'skip'; queue: Card[] }
    | { kind: 'rate'; queue: Card[]; previous: Card; reviewId: string; grade: Grade };

  // ---------- Session state ----------
  let settings = $state(defaultSettings);
  let deckName = $state('');
  let loaded = $state(false);
  let queue = $state.raw<Card[]>([]);
  let history = $state.raw<Hist[]>([]);
  let pIndex = $state(0); // practice mode position
  let reviewed = $state(0);
  let againCount = $state(0);
  let revealed = $state(false);
  let shownAt = Date.now();
  const sessionStart = Date.now();

  const current = $derived(practice ? queue[pIndex] : queue[0]);
  const finished = $derived(loaded && !current);
  const remaining = $derived(practice ? queue.length - pIndex : queue.length);
  const progress = $derived(
    practice ? (queue.length ? pIndex / queue.length : 1) : reviewed + queue.length ? reviewed / (reviewed + queue.length) : 1,
  );
  const intervals = $derived(!practice && current ? previewIntervals(current, settings.retention) : {});

  onMount(async () => {
    settings = await getSettings();
    deckName = (await db.decks.get(deckId))?.name ?? '';
    const cards = await db.cards.where('deckId').equals(deckId).toArray();
    if (practice) {
      queue = shuffle(cards);
    } else {
      const newToday = await db.reviews
        .where('reviewedAt')
        .aboveOrEqual(dayStart())
        .filter((r) => r.deckId === deckId && r.prevState === State.New)
        .count();
      queue = buildQueue(cards, settings.newPerDay - newToday);
    }
    loaded = true;
    shownAt = Date.now();
  });

  function shuffle<T>(a: T[]): T[] {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }

  // ---------- Card motion ----------
  let dx = $state(0);
  let dy = $state(0);
  let scale = $state(1);
  let opacity = $state(1);
  let animate = $state(true);
  let flipAnimate = $state(true);
  let busy = false;

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // Wait for the "entering" styles to paint; the timeout covers throttled rAF (background tabs, previews).
  const frame = () =>
    Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), wait(50)]);

  /** Fly the card off-screen in `dir` (-1 left, 1 right), run `change`, then bring the new card in. */
  async function transition(dir: -1 | 1, change: () => void | Promise<void>) {
    if (busy) return;
    busy = true;
    buzz();
    animate = true;
    dx = dir * window.innerWidth * 1.1;
    dy = 0;
    opacity = 0;
    await wait(200);
    await change();
    animate = false;
    flipAnimate = false;
    revealed = false;
    flips = 0;
    dx = 0;
    dy = 0;
    scale = 0.92;
    await tick();
    await frame();
    animate = true;
    flipAnimate = true;
    scale = 1;
    opacity = 1;
    shownAt = Date.now();
    busy = false;
  }

  function settle() {
    animate = true;
    dx = 0;
    dy = 0;
  }

  function nudge(msg: string) {
    settle();
    toast(msg, 1500);
  }

  // Restarts the lift animation on every flip (it alternates between two identical keyframes).
  let flips = $state(0);

  function flip() {
    if (!current || busy) return;
    revealed = !revealed;
    flips++;
    buzz(5);
  }

  // ---------- Actions ----------
  function next() {
    if (!current) return;
    if (practice) return transition(-1, () => void pIndex++);
    if (queue.length <= 1) return nudge('Last card, rate it to finish');
    transition(-1, () => {
      history = [...history, { kind: 'skip', queue }];
      queue = [...queue.slice(1), queue[0]];
    });
  }

  function prev() {
    if (practice) {
      if (pIndex === 0) return nudge('This is the first card');
      return transition(1, () => void pIndex--);
    }
    const h = history.at(-1);
    if (!h) return nudge('No previous card');
    transition(1, async () => {
      history = history.slice(0, -1);
      if (h.kind === 'rate') {
        await undoRating(h.previous, h.reviewId);
        reviewed--;
        if (h.grade === Rating.Again) againCount--;
      }
      queue = h.queue;
    });
  }

  function grade(g: Grade) {
    const card = current;
    if (!card || !revealed || busy) return;
    transition(-1, async () => {
      const before = queue;
      const { updated, previous, reviewId } = await rate(card, g, settings.retention, Date.now() - shownAt);
      let rest = queue.slice(1);
      // Cards still in (re)learning come back later in this same session.
      if (updated.srs.state !== State.Review && updated.due <= Date.now() + LEARN_AHEAD) rest = [...rest, updated];
      history = [...history, { kind: 'rate', queue: before, previous, reviewId, grade: g }];
      queue = rest;
      reviewed++;
      if (g === Rating.Again) againCount++;
    });
  }

  function practiceAgain() {
    const card = current;
    if (!card) return;
    transition(-1, () => {
      queue = [...queue, card];
      pIndex++;
    });
  }

  function restartPractice() {
    queue = shuffle(queue.filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i));
    pIndex = 0;
    revealed = false;
  }

  // ---------- Gestures ----------
  let startX = 0, startY = 0, startT = 0;
  let dragging = false, moved = false;

  function down(e: PointerEvent) {
    if (busy || !current || e.button > 0) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startT = performance.now();
    animate = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (!dragging) return;
    const ddx = e.clientX - startX;
    const ddy = e.clientY - startY;
    if (Math.abs(ddx) > 6 || Math.abs(ddy) > 6) moved = true;
    dx = ddx;
    dy = ddy < 0 ? ddy * 0.45 : ddy * 0.15; // a little give upwards, resist downwards
  }

  function up(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    const ddx = e.clientX - startX;
    const ddy = e.clientY - startY;
    const dt = Math.max(1, performance.now() - startT);
    const vx = ddx / dt;
    if (!moved) {
      settle();
      if (!(e.target as HTMLElement).closest('a')) flip();
      return;
    }
    const horizontal = Math.abs(ddx) > Math.abs(ddy);
    if (horizontal && (Math.abs(ddx) > 90 || (Math.abs(vx) > 0.5 && Math.abs(ddx) > 30))) {
      ddx < 0 ? next() : prev();
    } else if (!horizontal && ddy < -50) {
      settle();
      flip();
    } else {
      settle();
    }
  }

  function cancel() {
    dragging = false;
    settle();
  }

  // Hint label that fades in while dragging.
  const hint = $derived.by(() => {
    if (Math.abs(dx) > Math.abs(dy * 2)) {
      if (dx < -30) return { text: practice ? 'Next' : 'Skip', o: Math.min(1, (-dx - 30) / 60) };
      if (dx > 30) return { text: practice ? 'Previous' : 'Back', o: Math.min(1, (dx - 30) / 60) };
    } else if (dy < -15) {
      return { text: revealed ? 'Question' : 'Answer', o: Math.min(1, (-dy - 15) / 25) };
    }
    return null;
  });

  // Long content: let the visible face scroll vertically (swipe-up-to-flip is then replaced by tap).
  let frontEl: HTMLElement | undefined = $state();
  let backEl: HTMLElement | undefined = $state();
  let overflow = $state({ front: false, back: false });
  function measure() {
    overflow = {
      front: !!frontEl && frontEl.scrollHeight > frontEl.clientHeight + 2,
      back: !!backEl && backEl.scrollHeight > backEl.clientHeight + 2,
    };
  }
  const scrollable = $derived(revealed ? overflow.back : overflow.front);

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      prev();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp') {
      e.preventDefault();
      flip();
    } else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Escape') back(`/deck/${deckId}`);
    else if (revealed && !practice) {
      const g = GRADES.find((x) => x.key === e.key);
      if (g) grade(g.grade);
    } else if (revealed && practice) {
      if (e.key === '1') practiceAgain();
      else if (e.key === '2') next();
    }
  }

  function fmtDuration(ms: number) {
    const m = Math.round(ms / 60_000);
    return m < 1 ? '<1 min' : `${m} min`;
  }
</script>

<svelte:window onkeydown={onKey} />

<main class="page study">
  <header class="topbar">
    <button class="icon-btn on-surface" onclick={() => back(`/deck/${deckId}`)} aria-label="Close"><Icon name="close" /></button>
    <div class="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div class="bar" style:width="{progress * 100}%"></div>
      <div class="track" style:left="calc({progress * 100}% + 4px)"></div>
    </div>
    <span class="left">{loaded ? remaining : ''}</span>
  </header>
  <p class="deck-name">{deckName}{practice ? ' · Practice' : ''}</p>

  {#if !loaded}
    <div class="stage"></div>
  {:else if finished}
    <section class="done">
      <div class="done-icon"><Icon name="check" size={36} /></div>
      {#if !practice && reviewed === 0 && !history.length}
        <h2>Nothing due right now</h2>
        <p>You're all caught up with this deck.</p>
        <div class="done-actions">
          <button class="btn primary lg" onclick={() => go(`/deck/${deckId}/practice`, { replace: true })}>
            <Icon name="shuffle" /> Practice anyway
          </button>
          <button class="btn text lg" onclick={() => back(`/deck/${deckId}`)}>Back to deck</button>
        </div>
      {:else}
        <h2>Session complete</h2>
        <div class="summary">
          {#if practice}
            <div><span class="n">{queue.length}</span><span class="l">cards seen</span></div>
          {:else}
            <div><span class="n">{reviewed}</span><span class="l">reviews</span></div>
            <div>
              <span class="n">{reviewed ? Math.round(((reviewed - againCount) / reviewed) * 100) : 0}%</span>
              <span class="l">recalled</span>
            </div>
          {/if}
          <div><span class="n">{fmtDuration(Date.now() - sessionStart)}</span><span class="l">time</span></div>
        </div>
        <div class="done-actions">
          <button class="btn primary lg" onclick={() => back(`/deck/${deckId}`)}>Done</button>
          {#if practice}
            <button class="btn lg" onclick={restartPractice}><Icon name="shuffle" /> Shuffle & restart</button>
          {:else if history.length}
            <button class="btn text lg" onclick={prev}><Icon name="undo" /> Undo last</button>
          {/if}
        </div>
      {/if}
    </section>
  {:else if current}
    <div class="stage">
      {#if remaining > 1}<div class="stack" aria-hidden="true"></div>{/if}
      <div
        class="card-wrap"
        class:scrollable
        style:transform="translate({dx}px, {dy}px) rotate({dx * 0.04}deg) scale({scale})"
        style:opacity
        style:transition={animate ? 'transform .35s var(--md-emphasized), opacity .25s linear' : 'none'}
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={cancel}
        role="button"
        tabindex="0"
        aria-label={revealed ? 'Answer. Tap to show question' : 'Question. Tap to show answer'}>
        <!-- .lift gives the flip its 3D depth (perspective) and a slight rise toward you mid-turn -->
        <div class="lift" class:lift-a={flips % 2 === 1} class:lift-b={flips > 0 && flips % 2 === 0}>
          <div class="flipper" class:revealed class:instant={!flipAnimate}>
            <div class="face front" class:scroll={overflow.front} bind:this={frontEl}>
              <span class="face-label">Question</span>
              <div class="face-body"><CardContent text={current.front} onrender={measure} /></div>
            </div>
            <div class="face back" class:scroll={overflow.back} bind:this={backEl}>
              <span class="face-label">Answer</span>
              <div class="face-body">
                <div class="q"><CardContent text={current.front} onrender={measure} /></div>
                <div class="divider"></div>
                <CardContent text={current.back} onrender={measure} />
              </div>
            </div>
          </div>
        </div>
        {#if hint}
          <div class="hint" style:opacity={hint.o}>{hint.text}</div>
        {/if}
      </div>
    </div>

    <section class="controls">
      {#if !revealed && device.desktop}
        <!-- Desktop: buttons for what swipes do on the phone, with their keys -->
        <div class="desk-row">
          <button class="btn text lg" onclick={prev} title="Left arrow">
            <Icon name="back" /> {practice ? 'Previous' : 'Back'}
          </button>
          <button class="btn primary lg reveal" onclick={flip}>Show answer <span class="kbd">Space</span></button>
          <button class="btn text lg next" onclick={next} title="Right arrow">
            {practice ? 'Next' : 'Skip'} <Icon name="forward" />
          </button>
        </div>
      {:else if !revealed}
        <p class="gestures">
          <span>← {practice ? 'next' : 'skip'}</span>
          <span>↑ reveal</span>
          <span>→ {practice ? 'previous' : 'back'}</span>
        </p>
        <button class="btn primary lg block" onclick={flip}>Show answer</button>
      {:else if practice}
        <div class="group">
          <button class="grade g1" onclick={practiceAgain}>
            <span class="gl">See again later</span>
            {#if device.desktop}<span class="kbd">1</span>{/if}
          </button>
          <button class="grade g3" onclick={next}>
            <span class="gl">Got it</span>
            {#if device.desktop}<span class="kbd">2</span>{/if}
          </button>
        </div>
      {:else}
        <div class="group">
          {#each GRADES as g (g.grade)}
            <button class="grade g{g.grade}" onclick={() => grade(g.grade)}>
              <span class="gl">{g.label}</span>
              <span class="gi">{intervals[g.grade] ?? ''}</span>
              {#if device.desktop}<span class="kbd">{g.key}</span>{/if}
            </button>
          {/each}
        </div>
      {/if}
      {#if device.desktop}
        <p class="desk-keys">
          Click the card or press <span class="kbd">Space</span> to flip · <span class="kbd">←</span>
          <span class="kbd">→</span> back / skip · <span class="kbd">Ctrl</span> <span class="kbd">Z</span> undo ·
          <span class="kbd">Esc</span> close
        </p>
      {/if}
    </section>
  {/if}
</main>

<style>
  .study { padding-bottom: calc(env(safe-area-inset-bottom) + 16px); height: 100dvh; overflow: hidden; }
  .topbar { gap: 8px; margin-bottom: 0; }

  /* M3 linear progress: active indicator, 4px gap, track, stop dot at the end */
  .progress { position: relative; flex: 1; height: 4px; margin: 0 4px; }
  .bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 2px;
    background: var(--md-primary);
    transition: width 0.4s var(--md-emphasized);
  }
  .track {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    border-radius: 2px;
    background: var(--md-secondary-container);
    transition: left 0.4s var(--md-emphasized);
  }
  .track::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--md-primary);
  }
  .left {
    min-width: 32px;
    margin-right: 12px;
    text-align: right;
    color: var(--md-on-surface-variant);
    font-variant-numeric: tabular-nums;
    font-size: 14px;
    font-weight: 500;
  }
  .deck-name { margin: 0 0 16px; text-align: center; color: var(--md-on-surface-variant); font-size: 14px; }

  /* ---------- Card ---------- */
  .stage {
    position: relative;
    height: min(50dvh, 560px);
    flex-shrink: 0;
    z-index: 2; /* the near edge of a turning card may overlap the controls below */
  }
  .stack {
    position: absolute;
    inset: 0;
    border-radius: var(--md-shape-xl);
    background: var(--md-surface-container);
    transform: translateY(14px) scale(0.92);
  }
  .card-wrap {
    position: absolute;
    inset: 0;
    touch-action: none;
    cursor: grab;
    will-change: transform;
    -webkit-user-select: none;
    user-select: none;
    outline: none;
  }
  .card-wrap.scrollable { touch-action: pan-y; }
  .card-wrap:active { cursor: grabbing; }
  /*
   * The flip: the card turns over its horizontal axis (bottom edge swings up toward you, matching
   * the swipe-up gesture). Perspective must sit on the flipper's direct parent, otherwise the
   * rotation is flattened into a plain vertical squash.
   */
  .lift {
    position: absolute;
    inset: 0;
    perspective: 1800px;
  }
  .lift-a { animation: lift-a 0.6s var(--md-standard); }
  .lift-b { animation: lift-b 0.6s var(--md-standard); }
  @keyframes lift-a { 50% { transform: scale(1.035); } }
  @keyframes lift-b { 50% { transform: scale(1.035); } }
  .flipper {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .flipper.revealed { transform: rotateX(180deg); }
  .flipper.instant, .flipper.instant .face { transition: none; }
  /* A face dims slightly while it's turned away from the light. */
  .face { transition: filter 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
  .flipper.revealed .front, .flipper:not(.revealed) .back { filter: brightness(0.55); }

  @media (prefers-reduced-motion: reduce) {
    .flipper, .face { transition-duration: 0.01s; }
    .lift-a, .lift-b { animation: none; }
  }
  .face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border-radius: var(--md-shape-xl);
    background: var(--md-surface-container-high);
    box-shadow: var(--md-elev-2);
    padding: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .face-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
    padding: 8px 4px 16px;
  }
  .face.scroll { overflow-y: auto; }
  .face.scroll .face-body { justify-content: flex-start; flex: none; }
  .face.back { transform: rotateX(180deg); background: var(--md-surface-container-highest); }
  .face-label {
    align-self: flex-start;
    padding: 4px 12px;
    border-radius: var(--md-shape-sm);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.04em;
    background: var(--md-secondary-container);
    color: var(--md-on-secondary-container);
  }
  .face.back .face-label { background: var(--md-primary-container); color: var(--md-on-primary-container); }
  .q { color: var(--md-on-surface-variant); }
  .q :global(.card-content) { font-size: 15px; }
  .q :global(.card-content strong) { color: inherit; }
  .divider { height: 1px; background: var(--md-outline-variant); margin: 16px 8% 18px; flex-shrink: 0; }

  .hint {
    position: absolute;
    top: 20px;
    right: 20px;
    padding: 6px 14px;
    border-radius: var(--md-shape-sm);
    background: var(--md-inverse-surface);
    color: var(--md-inverse-on-surface);
    font-weight: 500;
    font-size: 14px;
    pointer-events: none;
  }

  /* ---------- Controls (lower half) ---------- */
  .controls {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 16px;
    padding-top: 28px;
  }
  .gestures {
    display: flex;
    justify-content: space-between;
    margin: 0 12px;
    color: var(--md-on-surface-variant);
    font-size: 14px;
  }

  /* M3 connected button group: shared row, small inner corners, large outer corners */
  .group { display: flex; gap: 2px; }
  .grade {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 72px;
    border-radius: var(--md-shape-sm);
    transition: border-radius 0.2s var(--md-emphasized), flex-grow 0.25s var(--md-emphasized);
  }
  .grade:first-child { border-radius: 36px var(--md-shape-sm) var(--md-shape-sm) 36px; }
  .grade:last-child { border-radius: var(--md-shape-sm) 36px 36px var(--md-shape-sm); }
  .grade:active { border-radius: 36px; flex-grow: 1.15; }
  .gl { font-size: 16px; font-weight: 500; }
  .gi { font-size: 12px; opacity: 0.8; font-variant-numeric: tabular-nums; }
  .g1 { background: var(--md-error-container); color: var(--md-on-error-container); }
  .g2 { background: var(--md-surface-container-highest); color: var(--md-on-surface); }
  .g3 { background: var(--md-primary); color: var(--md-on-primary); }
  .g4 { background: var(--md-tertiary-container); color: var(--md-on-tertiary-container); }

  /* ---------- Desktop ---------- */
  .desk-row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; }
  .desk-row .btn.text { justify-self: start; color: var(--md-on-surface-variant); }
  .desk-row .btn.next { justify-self: end; padding: 0 16px 0 20px; }
  .reveal { min-width: 280px; }
  .grade .kbd { margin-top: 4px; height: 20px; font-size: 11px; }
  .desk-keys {
    margin: 4px 0 0;
    text-align: center;
    color: var(--md-outline);
    font-size: 13px;
    line-height: 28px;
  }
  .desk-keys .kbd { opacity: 0.8; }

  :global(html.desktop) .study { max-width: 880px; }
  :global(html.desktop) .stage { height: min(56dvh, 520px); }
  :global(html.desktop) .face { padding: 24px 28px; }
  :global(html.desktop) .face :global(.card-content) { font-size: 26px; }
  :global(html.desktop) .q :global(.card-content) { font-size: 17px; }
  :global(html.desktop) .controls { flex: none; justify-content: flex-start; padding-top: 36px; }
  :global(html.desktop) .grade { min-height: 84px; }

  /* ---------- Done ---------- */
  .done {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 8px;
  }
  .done-icon {
    width: 88px;
    height: 88px;
    border-radius: var(--md-shape-xl);
    display: grid;
    place-items: center;
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
    margin-bottom: 12px;
  }
  .done h2 { margin: 0; font-size: 28px; line-height: 36px; font-weight: 400; }
  .done p { margin: 0; color: var(--md-on-surface-variant); }
  .summary { display: flex; gap: 12px; margin: 20px 0 8px; }
  .summary div {
    display: flex;
    flex-direction: column;
    min-width: 92px;
    padding: 14px 12px;
    border-radius: var(--md-shape-lg);
    background: var(--md-surface-container);
  }
  .summary .n { font-size: 24px; line-height: 32px; }
  .summary .l { font-size: 12px; color: var(--md-on-surface-variant); }
  .done-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 24px; width: min(320px, 100%); }
</style>
