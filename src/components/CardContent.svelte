<script lang="ts">
  import { tick } from 'svelte';
  import { renderCard } from '../lib/render';

  let { text, onrender }: { text: string; onrender?: () => void } = $props();
  let html = $state('');
  let root: HTMLDivElement | undefined = $state();

  /**
   * Display formulas wider than the card can't be scrolled sideways (that gesture swipes the card),
   * so shrink each one just enough to fit, down to 55% of its normal size.
   */
  function fitMath() {
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>('.katex-display')) {
      el.style.fontSize = '';
      const avail = el.clientWidth;
      const need = el.querySelector<HTMLElement>('.katex')?.scrollWidth ?? 0;
      if (avail > 0 && need > avail) el.style.fontSize = `${Math.max(0.55, (avail - 2) / need).toFixed(3)}em`;
    }
  }

  // Re-fit when math fonts finish loading (glyph widths change) or the card's width changes.
  $effect(() => {
    if (!root) return;
    let lastWidth = root.clientWidth;
    const ro = new ResizeObserver(() => {
      if (root && root.clientWidth !== lastWidth) {
        lastWidth = root.clientWidth;
        fitMath();
      }
    });
    ro.observe(root);
    document.fonts?.addEventListener('loadingdone', fitMath);
    return () => {
      ro.disconnect();
      document.fonts?.removeEventListener('loadingdone', fitMath);
    };
  });

  $effect(() => {
    const src = text;
    let stale = false;
    renderCard(src).then(async (h) => {
      if (stale) return;
      html = h;
      await tick();
      fitMath();
      onrender?.();
      document.fonts?.ready.then(() => {
        if (!stale) fitMath();
      });
    });
    return () => (stale = true);
  });
</script>

<div class="card-content" bind:this={root}>{@html html}</div>
