/**
 * The app icon (two stacked cards with a plus), drawn from a theme's colors:
 *  - background: primary container
 *  - back card:  primary at half opacity
 *  - front card: on-primary container, plus sign cut out in the background color
 * public/favicon.svg is this same drawing in the default (blue) theme; it's the source for the
 * PNG app icons (`npm run icons`).
 */
export interface IconColors {
  bg: string;
  back: string;
  front: string;
}

export function iconSvg({ bg, back, front }: IconColors): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${bg}"/>
  <rect x="150" y="118" width="250" height="190" rx="30" fill="${back}" fill-opacity=".5" transform="rotate(8 275 213)"/>
  <rect x="112" y="170" width="270" height="210" rx="32" fill="${front}"/>
  <path d="M190 275h114M247 218v114" stroke="${bg}" stroke-width="30" stroke-linecap="round"/>
</svg>`;
}
