<script lang="ts">
  import { tick } from 'svelte';
  import { renderCard } from '../lib/render';

  let { text, onrender }: { text: string; onrender?: () => void } = $props();
  let html = $state('');

  $effect(() => {
    const src = text;
    let stale = false;
    renderCard(src).then(async (h) => {
      if (stale) return;
      html = h;
      await tick();
      onrender?.();
    });
    return () => (stale = true);
  });
</script>

<div class="card-content">{@html html}</div>
