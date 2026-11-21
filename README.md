# Flashcards

A simple, offline-first spaced-repetition flashcard app with Markdown, LaTeX (KaTeX) and image support.
Built with Svelte 5 + Vite, stores everything on-device in IndexedDB (Dexie), schedules reviews with FSRS (ts-fsrs),
and installs as a PWA.

## Adding cards from your PC

Every `.md` file in the `decks/` folder is a deck that ships with the app.
Write cards in any text editor, then push to GitHub. The phone picks them up the next time you open the app.

```markdown
# Linear Algebra

Notes above the first Q: are ignored.

Q: Determinant of a $2 \times 2$ matrix?
A: $$\det\begin{pmatrix} a & b \\ c & d \end{pmatrix} = ad - bc$$

Q: What does it mean if $\det(A) = 0$?
A: $A$ is **not invertible**.

The answer can be several lines long, until the next Q:.

Q: Eigenvalue definition
A: $\lambda$ is an eigenvalue of $A$ if $Av = \lambda v$ for some $v \neq 0$.

Q: A diagram question
A: ![](images/rotation.png)
```

- `# Name` sets the deck name (otherwise the file name is used).
- `Q:` and `A:` must be capitalised and at the very start of a line.
- Markdown and LaTeX work the same as in the app.
- Images: put them in `decks/images/` and reference them as `![](images/file.png)`.

How syncing works:
- **New cards** are added. **Edited answers** update in place, and your review progress is kept.
- **Changing a question** counts as a new card: the old one is removed and the new one starts fresh.
- **Removing a card** (or a whole file) removes it from the app.
- Cards you add on the phone stay on the phone. They are never overwritten.

To preview changes locally before pushing, run `npm run dev` and open http://localhost:5173.

## Develop

```powershell
npm install
npm run dev      # http://localhost:5173 (also reachable from your phone on the same Wi-Fi)
npm run check    # type-check
npm run build    # production build in dist/
```

## Deploy (GitHub Pages)

1. Create a GitHub repo and push this folder to the `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` builds and publishes to `https://<user>.github.io/<repo>/`.

## Install on Android

Open the Pages URL in Chrome → ⋮ → **Add to Home screen** → **Install**.

## Card syntax

- Markdown: `**bold**`, lists, `code`, tables
- Inline math `$a^2 + b^2$`, display math `$$\int_0^1 x\,dx$$` (also `\( \)` and `\[ \]`)
- Images: use the image button in the editor (stored as compressed WebP on the device)

## Study gestures

- Swipe **up** or tap: flip the card
- Swipe **left**: skip (review) / next (practice)
- Swipe **right**: bring back the previous card (undoes its rating)
- Keyboard: Space = flip, ← / → = previous / next, 1–4 = Again / Hard / Good / Easy, Ctrl+Z = undo, Esc = close

## Desktop layout

On a PC browser (window at least 840px wide, mouse or trackpad) the app switches to a desktop layout:
navigation rail on the left, decks as a grid, the deck page in two columns, the editor with a live
preview beside the fields (Ctrl+S save, Ctrl+Enter save & add another), and study with on-screen
Back / Skip buttons and key hints. Narrow the window and it falls back to the phone layout.
Settings → Display → Layout can force Phone or Desktop for that browser.
