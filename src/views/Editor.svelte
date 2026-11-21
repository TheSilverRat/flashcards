<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { db, createCard, deleteCard, updateCard, isBundledCard } from '../lib/db';
  import { addImage } from '../lib/images';
  import { back } from '../lib/router.svelte';
  import { confirm, toast, ui } from '../lib/ui.svelte';
  import { device } from '../lib/device.svelte';
  import Icon from '../components/Icon.svelte';
  import CardContent from '../components/CardContent.svelte';

  let { deckId, cardId }: { deckId: string; cardId: string | null } = $props();

  type Side = 'front' | 'back';
  let front = $state('');
  let back_ = $state('');
  let deckName = $state('');
  let deckFile = $state('');
  let active: Side = $state('front');
  let preview = $state(true);
  let saving = $state(false);
  let added = $state(0);
  let frontEl: HTMLTextAreaElement | undefined = $state();
  let backEl: HTMLTextAreaElement | undefined = $state();
  let fileEl: HTMLInputElement | undefined = $state();
  let original = { front: '', back: '' };

  const isNew = $derived(cardId === null);
  /** Cards from decks/*.md are edited on the PC; changes here would be overwritten by the next sync. */
  const readOnly = $derived(cardId !== null && isBundledCard(cardId));
  const dirty = $derived(front !== original.front || back_ !== original.back);

  onMount(async () => {
    const deck = await db.decks.get(deckId);
    deckName = deck?.name ?? '';
    deckFile = deck?.file ?? '';
    if (cardId) {
      const card = await db.cards.get(cardId);
      if (card) {
        front = card.front;
        back_ = card.back;
        original = { front, back: back_ };
      }
    } else {
      frontEl?.focus();
    }
  });

  // `|` marks where the cursor goes; selected text replaces it.
  const SNIPPETS: { label: string; insert: string; title: string }[] = [
    { label: '$x$', insert: '$|$', title: 'Inline math' },
    { label: '$$', insert: '\n$$\n|\n$$\n', title: 'Display math' },
    { label: 'xⁿ', insert: '^{|}', title: 'Superscript' },
    { label: 'xₙ', insert: '_{|}', title: 'Subscript' },
    { label: 'a⁄b', insert: '\\frac{|}{}', title: 'Fraction' },
    { label: '√', insert: '\\sqrt{|}', title: 'Square root' },
    { label: '∑', insert: '\\sum_{i=1}^{n} |', title: 'Sum' },
    { label: '∫', insert: '\\int_{a}^{b} | \\,dx', title: 'Integral' },
    { label: 'lim', insert: '\\lim_{x \\to |}', title: 'Limit' },
    { label: 'α', insert: '\\alpha', title: 'Alpha' },
    { label: 'π', insert: '\\pi', title: 'Pi' },
    { label: '→', insert: '\\to ', title: 'Arrow' },
    { label: '∞', insert: '\\infty', title: 'Infinity' },
    { label: 'B', insert: '**|**', title: 'Bold' },
  ];

  function el(side: Side) {
    return side === 'front' ? frontEl : backEl;
  }

  function getText(side: Side) {
    return side === 'front' ? front : back_;
  }

  function setText(side: Side, v: string) {
    if (side === 'front') front = v;
    else back_ = v;
  }

  async function insert(snippet: string) {
    const ta = el(active);
    if (!ta) return;
    const text = getText(active);
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const selected = text.slice(start, end);
    // Don't add a blank line when the snippet already starts on a fresh line.
    if (snippet.startsWith('\n') && (start === 0 || text[start - 1] === '\n')) snippet = snippet.slice(1);
    const [before, after = ''] = snippet.split('|');
    const middle = snippet.includes('|') ? selected : '';
    setText(active, text.slice(0, start) + before + middle + after + text.slice(end));
    await tick();
    ta.focus();
    const caret = start + before.length + middle.length;
    ta.setSelectionRange(caret, caret);
  }

  async function pickImage(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    try {
      const id = await addImage(file);
      await insert(`\n![](img:${id})\n|`);
    } catch {
      toast('Could not add that image');
    }
  }

  async function save(addAnother = false) {
    if (!front.trim() && !back_.trim()) {
      toast('The card is empty');
      return;
    }
    saving = true;
    try {
      if (cardId) await updateCard(cardId, front, back_);
      else await createCard(deckId, front, back_);
      original = { front, back: back_ };
      if (addAnother) {
        front = '';
        back_ = '';
        original = { front: '', back: '' };
        added++;
        toast('Card added');
        active = 'front';
        await tick();
        frontEl?.focus();
      } else {
        back(`/deck/${deckId}`);
      }
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!cardId) return;
    if (!(await confirm('Delete this card?', { confirmLabel: 'Delete', danger: true }))) return;
    await deleteCard(cardId);
    toast('Card deleted');
    back(`/deck/${deckId}`);
  }

  // Ctrl/⌘+S saves, Ctrl/⌘+Enter saves and starts the next card, Escape closes.
  function onKey(e: KeyboardEvent) {
    if (ui.dialog || readOnly && e.key !== 'Escape') return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!saving) save(false);
    } else if (mod && e.key === 'Enter') {
      e.preventDefault();
      if (!saving) save(isNew);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      leave();
    }
  }

  async function leave() {
    if (dirty && !(await confirm('Discard changes?', { confirmLabel: 'Discard', danger: true }))) return;
    back(`/deck/${deckId}`);
  }
</script>

<svelte:window onkeydown={onKey} />

<!-- Insert toolbar: pinned above the keyboard on the phone, above the fields on desktop -->
{#snippet toolbar()}
  <div class="toolbar" role="toolbar" aria-label="Insert">
    <button class="icon-btn" onclick={() => fileEl?.click()} title="Add image" aria-label="Add image">
      <Icon name="image" />
    </button>
    <button
      class="icon-btn"
      class:selected={preview}
      onclick={() => (preview = !preview)}
      title="Toggle preview"
      aria-pressed={preview}
      aria-label="Toggle preview">
      <Icon name="eye" />
    </button>
    <span class="sep"></span>
    {#each SNIPPETS as sn (sn.label)}
      <button class="tool" title={sn.title} onpointerdown={(e) => e.preventDefault()} onclick={() => insert(sn.insert)}>
        {sn.label}
      </button>
    {/each}
  </div>
{/snippet}

<main class="page" class:with-toolbar={!readOnly}>
  <!-- Full-screen dialog pattern: close · title · save -->
  <header class="topbar">
    <button class="icon-btn on-surface" onclick={leave} aria-label="Close"><Icon name="close" /></button>
    <h1>
      {isNew ? 'New card' : readOnly ? 'Card' : 'Edit card'}
      <span class="deck">{deckName}{added ? ` · ${added} added` : ''}</span>
    </h1>
    {#if !isNew && !readOnly}
      <button class="icon-btn" onclick={remove} aria-label="Delete card"><Icon name="trash" /></button>
    {/if}
    {#if !readOnly}
      <button class="btn text save" disabled={saving} onclick={() => save(false)}>Save</button>
    {/if}
  </header>

  {#if readOnly}
    <div class="from-file">
      <Icon name="info" />
      <p>This card comes from <code>decks/{deckFile || '…'}</code>. Edit it in that file on your PC; changes show up here after you push them.</p>
    </div>
    <div class="ro">
      {#each [['Front', front], ['Back', back_]] as [label, text] (label)}
        <section class="preview-card">
          <span class="preview-label">{label}</span>
          <CardContent {text} />
        </section>
      {/each}
    </div>
  {:else}
    <div class="edit-grid" class:solo={!device.desktop || !preview}>
      <div class="edit-col">
        {#if device.desktop}{@render toolbar()}{/if}
        {#each [['front', 'Front'], ['back', 'Back']] as [side, label] (side)}
          {@const s = side as Side}
          <section class="field" class:answer={s === 'back'} class:active={active === s}>
            <label class="filled">
              <span class="label">{label}</span>
              {#if s === 'front'}
                <textarea
                  bind:this={frontEl}
                  bind:value={front}
                  onfocus={() => (active = 'front')}
                  placeholder="Question… use $…$ for math"
                  rows="3"></textarea>
              {:else}
                <textarea
                  bind:this={backEl}
                  bind:value={back_}
                  onfocus={() => (active = 'back')}
                  placeholder="Answer…"
                  rows="4"></textarea>
              {/if}
            </label>
            {#if !device.desktop && preview && getText(s).trim()}
              <div class="preview-card small"><CardContent text={getText(s)} /></div>
            {/if}
          </section>
        {/each}

        {#if isNew}
          <button class="btn tonal lg block" disabled={saving} onclick={() => save(true)}>
            <Icon name="plus" /> Save & add another
          </button>
        {/if}
        {#if device.desktop}
          <p class="keys">
            <span><span class="kbd">Ctrl</span> <span class="kbd">S</span> save</span>
            {#if isNew}<span><span class="kbd">Ctrl</span> <span class="kbd">Enter</span> save & add another</span>{/if}
            <span><span class="kbd">Esc</span> close</span>
          </p>
        {/if}
      </div>

      {#if device.desktop && preview}
        <!-- Desktop: live preview of both sides next to the fields -->
        <aside class="live" aria-label="Preview">
          <section class="preview-card big">
            <span class="face-label">Question</span>
            {#if front.trim()}<CardContent text={front} />{:else}<p class="placeholder">The question shows here</p>{/if}
          </section>
          <section class="preview-card big back">
            <span class="face-label">Answer</span>
            {#if back_.trim()}<CardContent text={back_} />{:else}<p class="placeholder">The answer shows here</p>{/if}
          </section>
        </aside>
      {/if}
    </div>

    {#if !device.desktop}{@render toolbar()}{/if}
    <input type="file" accept="image/*" bind:this={fileEl} onchange={pickImage} hidden />
  {/if}
</main>

<style>
  h1 { display: flex; flex-direction: column; line-height: 1.2; }
  .deck { font-size: 12px; line-height: 16px; color: var(--md-on-surface-variant); overflow: hidden; text-overflow: ellipsis; }
  .save { margin-right: 4px; font-size: 14px; }

  .field { margin-bottom: 16px; }
  /* M3 filled text field with the label inside */
  .filled {
    display: block;
    background: var(--md-surface-container-highest);
    border-radius: var(--md-shape-xs) var(--md-shape-xs) 0 0;
    box-shadow: inset 0 -1px 0 var(--md-on-surface-variant);
    padding: 8px 16px 6px;
    transition: box-shadow 0.15s var(--md-standard);
  }
  .field.active .filled:focus-within { box-shadow: inset 0 -2px 0 var(--md-primary); }
  .label { display: block; font-size: 12px; line-height: 16px; color: var(--md-on-surface-variant); }
  .filled:focus-within .label { color: var(--md-primary); }
  .filled textarea {
    display: block;
    width: 100%;
    min-height: 72px;
    resize: vertical;
    border: none;
    outline: none;
    background: none;
    padding: 4px 0;
    font-family: var(--font-mono);
    font-size: 15px;
    line-height: 1.55;
    color: var(--md-on-surface);
  }
  .filled textarea::placeholder { color: var(--md-on-surface-variant); opacity: 0.7; }

  .preview-card {
    margin-top: 8px;
    padding: 20px 16px;
    border-radius: var(--md-shape-lg);
    background: var(--md-surface-container-low);
    border: 1px solid var(--md-outline-variant);
    text-align: center;
  }
  .preview-card.small :global(.card-content) { font-size: 18px; }
  .preview-label {
    display: block;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--md-on-surface-variant);
    text-align: left;
  }

  .from-file {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin: 0 0 16px;
    padding: 16px;
    border-radius: var(--md-shape-lg);
    background: var(--md-secondary-container);
    color: var(--md-on-secondary-container);
  }
  .from-file p { margin: 0; font-size: 14px; line-height: 20px; }
  .from-file code { font-family: var(--font-mono); font-size: 13px; font-weight: 600; }

  .toolbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 12px calc(env(safe-area-inset-bottom) + 8px);
    background: var(--md-surface-container);
    overflow-x: auto;
    scrollbar-width: none;
    z-index: 10;
  }
  .toolbar .icon-btn.selected { background: var(--md-secondary-container); color: var(--md-on-secondary-container); }
  .tool {
    flex-shrink: 0;
    min-width: 44px;
    height: 36px;
    padding: 0 12px;
    border-radius: var(--md-shape-sm);
    border: 1px solid var(--md-outline-variant);
    color: var(--md-on-surface);
    font-size: 15px;
    display: grid;
    place-items: center;
  }
  /* ---------- Desktop: fields left, live preview right ---------- */
  .keys { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 16px 4px 0; color: var(--md-on-surface-variant); font-size: 13px; }
  .keys > span { display: inline-flex; align-items: center; gap: 4px; }
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
  .back .face-label { background: var(--md-primary-container); color: var(--md-on-primary-container); }
  .placeholder { margin: auto 0; color: var(--md-outline); font-size: 16px; }

  :global(html.desktop) .page { max-width: 1240px; }
  :global(html.desktop) .edit-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }
  :global(html.desktop) .edit-grid.solo { grid-template-columns: minmax(0, 760px); justify-content: center; }
  :global(html.desktop) .filled textarea { min-height: 120px; }
  :global(html.desktop) .field.answer .filled textarea { min-height: 200px; }
  :global(html.desktop) .toolbar {
    position: sticky;
    top: 72px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    padding: 8px;
    border-radius: var(--md-shape-lg);
    overflow: visible;
  }
  :global(html.desktop) .live { position: sticky; top: 88px; display: flex; flex-direction: column; gap: 16px; }
  :global(html.desktop) .preview-card.big {
    min-height: 220px;
    margin: 0;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border: none;
    border-radius: var(--md-shape-xl);
    background: var(--md-surface-container-high);
    box-shadow: var(--md-elev-1);
  }
  :global(html.desktop) .preview-card.big.back { background: var(--md-surface-container-highest); }
  :global(html.desktop) .preview-card.big :global(.card-content) { margin: auto 0; }
  :global(html.desktop) .ro { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  :global(html.desktop) .ro .preview-card { margin: 0; padding: 28px 24px; }

  .sep { width: 1px; height: 24px; background: var(--md-outline-variant); flex-shrink: 0; }
</style>
