# DipankarkunjNGO

Website of **Deepankar-Kunj [NGO]**, Amarpur, Banka (Bihar) · Reg. 849, 2010-11.
Plain static site — HTML + CSS + vanilla JS. No build step, no dependencies.

## Run locally

Open `index.html` in a browser, or serve the folder (recommended, so paths behave like production):

```sh
python -m http.server 8000   # then open http://localhost:8000
```

## Project structure

```
index.html            all page markup (every "page" is a group of sections)
css/
  01-base.css … 13-*.css   design layers, loaded IN ORDER — later files override earlier ones
  14-site-chrome.css       site header, mobile menu, page banner, footer (website look)
js/
  translations.js      English strings (window.DK_EN) — Hindi is the text in index.html
  main.js              loader, router, language toggle, lightbox, carousel, join form, receipt
assets/                photos (all images used by the site)
```

### How pages work

The site is one HTML file with hash routes: `#/home`, `#/about`, `#/story`,
`#/achievements`, `#/testimonials`, `#/donate`. Every section carries
`data-page="<name>"`; `showPage()` in `js/main.js` hides the others.
Plain anchors like `#judiye` open the page that contains that section, then scroll to it.

To add a section to a page: add `<section class="sec" data-page="about">…</section>` in `index.html`.
To add a new page: add its name to `PAGES` in `js/main.js`, a nav link in `#topnav`, and its sections.

### Bilingual text (Hindi / English)

- Hindi text is written directly in the HTML.
- Any translatable element gets `data-i18n="some.key"` (or `data-i18n-aria` / `data-i18n-alt` for attributes).
- Add the English for that key in `js/translations.js`. Missing keys simply stay in Hindi.

### CSS layers

`css/01` → `css/13` are the design history of the site; each file overrides the previous ones,
so **order matters** — keep the `<link>` order in `index.html`. For new styling, edit
`14-site-chrome.css` or add a new numbered file at the end rather than editing early layers.
Colour tokens (`--saffron`, `--board`, `--ink`, …) are defined in `07-v7-white-editorial.css`.

## Contact / WhatsApp

Join / Donate / Membership buttons open WhatsApp +91 78570 43185 (set in `index.html` links and `js/main.js`).

## Deploy (Netlify)

Drag this whole folder (with `index.html`, `css/`, `js/`, `assets/`) onto https://app.netlify.com/drop.
Or connect this GitHub repo in Netlify — no build command, publish directory `/`.
