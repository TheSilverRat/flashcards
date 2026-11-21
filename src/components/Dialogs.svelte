<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { ui } from '../lib/ui.svelte';

  let value = $state('');
  let input: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (ui.dialog?.kind === 'prompt') {
      value = ui.dialog.value ?? '';
      queueMicrotask(() => {
        input?.focus();
        input?.select();
      });
    }
  });

  function close(result: string | boolean | null) {
    const d = ui.dialog;
    ui.dialog = null;
    d?.resolve(result);
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    close(ui.dialog?.kind === 'prompt' ? value : true);
  }
</script>

<svelte:window onkeydown={(e) => ui.dialog && e.key === 'Escape' && close(null)} />

{#if ui.dialog}
  {@const d = ui.dialog}
  <div class="scrim" transition:fade={{ duration: 200 }} onclick={() => close(null)} role="presentation"></div>
  <form
    class="sheet"
    onsubmit={submit}
    transition:fly={{ y: 300, duration: 300, easing: cubicOut, opacity: 1 }}
    aria-label={d.title}>
    <div class="handle" aria-hidden="true"></div>
    <h2>{d.title}</h2>
    {#if d.message}<p>{d.message}</p>{/if}
    {#if d.kind === 'prompt'}
      <input class="input" bind:this={input} bind:value placeholder={d.placeholder} />
    {/if}
    {#if d.kind === 'choose'}
      <div class="options">
        {#each d.options ?? [] as o (o.value)}
          <button type="button" class="btn lg block {o.danger ? 'danger' : ''}" onclick={() => close(o.value)}>
            {o.label}
          </button>
        {/each}
        <button type="button" class="btn text block" onclick={() => close(null)}>Cancel</button>
      </div>
    {:else}
      <div class="actions">
        <button type="button" class="btn text" onclick={() => close(null)}>Cancel</button>
        <button type="submit" class="btn {d.danger ? 'danger' : 'primary'}">{d.confirmLabel}</button>
      </div>
    {/if}
  </form>
{/if}

{#if ui.toast}
  {#key ui.toast.id}
    <div class="snackbar" role="status" transition:fly={{ y: 24, duration: 250, easing: cubicOut }}>
      {ui.toast.text}
    </div>
  {/key}
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.5);
    z-index: 50;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0 auto;
    width: min(640px, 100%);
    background: var(--md-surface-container-low);
    border-radius: var(--md-shape-xl) var(--md-shape-xl) 0 0;
    padding: 0 24px calc(env(safe-area-inset-bottom) + 24px);
    box-shadow: var(--md-elev-1);
    z-index: 51;
  }
  .handle {
    width: 32px;
    height: 4px;
    border-radius: 2px;
    background: var(--md-on-surface-variant);
    opacity: 0.4;
    margin: 22px auto 18px;
  }
  h2 { margin: 0 0 12px; font-size: 24px; line-height: 32px; font-weight: 400; }
  p { margin: 0 0 16px; color: var(--md-on-surface-variant); font-size: 14px; line-height: 20px; }
  .options { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }

  .snackbar {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(env(safe-area-inset-bottom) + 88px);
    margin: 0 auto;
    max-width: 560px;
    min-height: 48px;
    display: flex;
    align-items: center;
    padding: 14px 16px;
    border-radius: var(--md-shape-xs);
    background: var(--md-inverse-surface);
    color: var(--md-inverse-on-surface);
    font-size: 14px;
    line-height: 20px;
    box-shadow: var(--md-elev-3);
    z-index: 60;
  }
</style>
