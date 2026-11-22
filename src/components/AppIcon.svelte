<script lang="ts">
  // The app icon drawn with live theme tokens, so it always matches the current theme.
  // Same drawing as lib/appIcon.ts / public/favicon.svg.
  let { size = 40 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
  <rect width="512" height="512" rx="112" fill="var(--md-primary-container)" />
  <rect
    x="150"
    y="118"
    width="250"
    height="190"
    rx="30"
    fill="var(--md-primary)"
    fill-opacity=".5"
    transform="rotate(8 275 213)" />
  <rect x="112" y="170" width="270" height="210" rx="32" fill="var(--md-on-primary-container)" />
  <path d="M190 275h114M247 218v114" stroke="var(--md-primary-container)" stroke-width="30" stroke-linecap="round" />
</svg>
