/**
 * Color theme (Settings → Display → Theme). The palettes live in app.css as `:root[data-theme=…]`.
 * Stored per browser in localStorage so it applies before the first paint, without waiting for
 * the database.
 */

export type ThemeId = 'orange' | 'blue' | 'pink' | 'purple';

/** `swatch` = the theme's primary color, `surface` = its background (used for the status bar). */
export const THEMES: { id: ThemeId; label: string; swatch: string; surface: string }[] = [
  { id: 'orange', label: 'Original', swatch: '#ffb59c', surface: '#161312' },
  { id: 'blue', label: 'Blue', swatch: '#a8c8ff', surface: '#111318' },
  { id: 'pink', label: 'Pink', swatch: '#ffb1c8', surface: '#191113' },
  { id: 'purple', label: 'Purple', swatch: '#d0bcff', surface: '#141218' },
];

const KEY = 'theme';
/** Used until you pick another one. index.html sets it on <html> too, so the first paint matches. */
export const DEFAULT_THEME: ThemeId = 'purple';

function readTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    if (THEMES.some((t) => t.id === v)) return v as ThemeId;
  } catch {
    /* storage blocked: default theme */
  }
  return DEFAULT_THEME;
}

export const theme = $state({ id: readTheme() });

function apply() {
  const t = THEMES.find((x) => x.id === theme.id) ?? THEMES[0];
  const root = document.documentElement;
  if (t.id === 'orange') delete root.dataset.theme;
  else root.dataset.theme = t.id;
  // Android colors the status bar from this.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.surface);
}

export function setTheme(id: ThemeId) {
  theme.id = id;
  try {
    if (id === DEFAULT_THEME) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
  } catch {
    /* not remembered, still applied for this visit */
  }
  apply();
}

apply();
