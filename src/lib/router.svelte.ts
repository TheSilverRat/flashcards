export type Route =
  | { name: 'home' }
  | { name: 'deck'; deckId: string }
  | { name: 'edit'; deckId: string; cardId: string | null }
  | { name: 'study'; deckId: string; mode: 'review' | 'practice' }
  | { name: 'settings' };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'deck' && parts[1]) {
    const deckId = parts[1];
    if (parts[2] === 'edit') return { name: 'edit', deckId, cardId: parts[3] && parts[3] !== 'new' ? parts[3] : null };
    if (parts[2] === 'study') return { name: 'study', deckId, mode: 'review' };
    if (parts[2] === 'practice') return { name: 'study', deckId, mode: 'practice' };
    return { name: 'deck', deckId };
  }
  return { name: 'home' };
}

export const router = $state({ route: parse(location.hash), path: location.hash || '#/' });

function sync() {
  router.route = parse(location.hash);
  router.path = location.hash || '#/';
}

window.addEventListener('popstate', sync);
window.addEventListener('hashchange', sync);

/** Depth of in-app navigation, so the in-app back button never leaves the app. */
function depth(): number {
  return (history.state?.depth as number | undefined) ?? 0;
}

export function go(path: string, { replace = false } = {}) {
  const url = '#' + path;
  if (replace) history.replaceState({ depth: depth() }, '', url);
  else history.pushState({ depth: depth() + 1 }, '', url);
  sync();
}

/** Go back within the app (same as Android's back gesture), or to `fallback` if there's no history. */
export function back(fallback = '/') {
  if (depth() > 0) history.back();
  else go(fallback, { replace: true });
}
