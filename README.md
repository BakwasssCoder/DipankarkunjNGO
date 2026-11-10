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
  store.js             DK_STORE — demo data layer (localStorage) shared with the admin panel
  main.js              loader, router, language toggle, lightbox, carousel, join form, receipt
admin/                 admin panel (index.html, admin.css, admin.js) — open /admin/
assets/                photos (all images used by the site)
robots.txt             keeps /admin/ out of search engines
```

## Admin panel (demo)

Open `http://localhost:8000/admin/` — demo password **`dk@2010`** (set in `admin/admin.js`).

| Sidebar | What it does |
|---|---|
| डैशबोर्ड | totals: members, pending requests, donations, this month |
| सदस्य | requests from the website "सदस्य बनिए" form — search, filter, change status, WhatsApp, CSV export, add manually |
| दान | record donations, print receipt, CSV export |
| गैलरी व अख़बार | upload photos → they appear in the website gallery / press section; hide or delete |
| संदेश | inbox for the website contact / volunteer form (हमारे बारे में → संदेश भेजिए), unread badge, CSV |
| सूचनाएँ | events & notices → shown on the homepage ("कार्यक्रम व सूचनाएँ"; hidden while empty) |
| सेटिंग्स | announcement strip at the top of the website, real social-media links, wipe demo data |
| डेटा अनुरोध (DPDP) | privacy rights requests (30-day due date), look up / erase a person's data, retention clean-up, processing log |

## Privacy / DPDP

Forms show a short notice and need two unticked checkboxes (consent + 18 or older) before anything is saved.
The full privacy notice is at `#/privacy` (link in the footer). See **[docs/DPDP-COMPLIANCE.md](docs/DPDP-COMPLIANCE.md)**
for what is covered and what the NGO still has to do before collecting real data.

**Demo limits:** all data is stored in the browser's `localStorage` (`js/store.js`).
It is per-browser (another phone/computer sees nothing), limited to ~5 MB, and the
password is visible in the source. Website and admin must be opened on the same
address (both `localhost:8000`, or both on the same Netlify domain).

**Going live:** replace the functions in `js/store.js` with calls to a real backend
(e.g. Supabase: tables `members`, `donations`, `media` + Auth for login). Website and admin
code only talk to `DK_STORE`, so nothing else needs to change.

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
