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
  supabase-config.js   Supabase URL + publishable key
  store.js             DK_STORE — data layer (Supabase) shared by website, admin and member portal
  member-card.js       membership card renderer (admin + member portal)
  main.js              loader, router, language toggle, lightbox, carousel, join form, receipt
admin/                 admin panel — open /admin/
member/                member portal — open /member/
supabase/schema.sql    database tables, security rules and functions
assets/                photos (all images used by the site)
robots.txt             keeps /admin/ out of search engines
```

## Backend — Supabase

Data lives in Supabase (project `zwhfquywbjzrgljfodpc`). `js/supabase-config.js` holds the URL and the
**publishable** key — safe in the browser because every permission is enforced by Row Level Security in
`supabase/schema.sql`. Never put the secret (`sb_secret_…`) key in any file in this repo.

### One-time setup

1. Supabase → **SQL Editor** → paste all of `supabase/schema.sql` → **Run** (safe to re-run).
2. **Authentication → Sign In / Providers → Email**: turn **"Confirm email" OFF**
   (member portal logins use member number + password, not real email addresses).
3. **Authentication → Users → Add user**: admin email + password, tick **Auto Confirm User**.
4. SQL Editor: `insert into public.admins (email) values ('<admin email, lowercase>');`
5. Open `/admin/` and log in with that email + password.

### Who can do what

| Who | Can |
|---|---|
| Website visitor (publishable key) | submit membership / contact / privacy forms (via database functions), read published notices, photos, settings, count visits |
| Member (portal login) | read only their own membership, notifications, tasks, achievements; tick their own tasks done |
| Admin (email in `admins`) | everything below |

## Admin panel — `/admin/`

| Sidebar | What it does |
|---|---|
| डैशबोर्ड | members, paid members, pending, outstanding pledges, money received (total / this month), portal users, website visitors |
| सदस्य | member cards — search, filter, sort; **भुगतान दर्ज** (mark paid → automatically adds a receipt in दान), undo payment, status, membership card (PNG), member-portal login code (sent on WhatsApp), CSV |
| दान | all money received (membership fees + other donations), add donation, print receipt, CSV |
| सदस्य-संपर्क | send notifications (one member / all), assign tasks (one / all), award achievements |
| गैलरी व अख़बार | upload photos to Supabase Storage → shown on the website; hide or delete |
| संदेश | contact / volunteer form inbox |
| सूचनाएँ | events & notices on the homepage |
| सेटिंग्स | announcement strip, social-media links |
| डेटा अनुरोध (DPDP) | privacy rights requests, look up / erase a person's data, retention clean-up, processing log |

## Member portal — `/member/`

Admin clicks **लॉगिन कोड** on an approved/paid member's card → a 6-digit code is sent on WhatsApp →
the member opens `/member/` → *पहली बार / नया पासवर्ड* → member number + code → sets a password.
After that they log in with member number + password and see their card, notifications, tasks and achievements.
A forgotten password = admin issues a new code.

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
