/**
 * Color theme (Settings → Display → Theme). The palettes live in app.css as `:root[data-theme=…]`.
 * Stored per browser in localStorage so it applies before the first paint, without waiting for
 * the database.
 */
import { iconSvg, type IconColors } from './appIcon';

export type ThemeId = 'orange' | 'blue' | 'pink' | 'purple';

/**
 * `swatch` = the theme's primary color, `surface` = its background (status bar),
 * `icon` = primary container / primary / on-primary container, for the browser-tab icon.
 */
export const THEMES: { id: ThemeId; label: string; swatch: string; surface: string; icon: IconColors }[] = [
  { id: 'orange', label: 'Original', swatch: '#ffb59c', surface: '#161312', icon: { bg: '#7a2f16', back: '#ffb59c', front: '#ffdbcf' } },
  { id: 'blue', label: 'Blue', swatch: '#a8c8ff', surface: '#111318', icon: { bg: '#1f477b', back: '#a8c8ff', front: '#d5e3ff' } },
  { id: 'pink', label: 'Pink', swatch: '#ffb1c8', surface: '#191113', icon: { bg: '#7b2949', back: '#ffb1c8', front: '#ffd9e2' } },
  { id: 'purple', label: 'Purple', swatch: '#d0bcff', surface: '#141218', icon: { bg: '#4f378b', back: '#d0bcff', front: '#eaddff' } },
];

const KEY = 'theme';
/** Used until you pick another one. index.html sets it on <html> too, so the first paint matches. */
export const DEFAULT_THEME: ThemeId = 'blue';

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
  // Browser-tab icon in the theme's colors (installed app icons are fixed PNGs in the default theme).
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
  if (link) link.href = `data:image/svg+xml,${encodeURIComponent(iconSvg(t.icon))}`;
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
