# DPDP compliance — Deepankar-Kunj website

The Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025 were notified on 13 Nov 2025.
Most Data Fiduciary duties (notice, consent, security, breach, retention, rights, grievance — Rules 3, 5–16)
apply from **about 13 May 2027** (18 months after notification). Check the exact date and wording against the
official Gazette notification before relying on this file. It is a working checklist, not legal advice.

The NGO is the **Data Fiduciary** for everything collected through this site.

## Done in the website / admin panel

| Requirement | Where |
|---|---|
| Notice before collection: itemised data, purpose, how to withdraw consent, rights, complaint to the Board (s.5, Rule 3) | Short notice above every form + full page `#/privacy` (Hindi + English) |
| Free, specific, unambiguous consent — separate, unticked checkbox (s.6) | `jConsent` / `cConsent` in `index.html`; nothing is stored without it |
| Consent record (who, when, which notice version) | `consent: {at, notice}` on members and messages — `NOTICE_VERSION` in `js/store.js` |
| Withdrawal as easy as giving consent (s.6(4)) | “Data rights request” form on `#/privacy`, or one WhatsApp message |
| Children: forms are for 18+; under-18 only via parent/guardian (s.9) | “I am 18 or older” checkbox on every form; notice section 3 |
| Rights: access, correction, erasure, grievance, nomination (s.11–14) | Rights form → admin **डेटा अनुरोध (DPDP)** with 30-day due date, overdue in red |
| Erasure when purpose ends / on request; legal retention kept (s.8(7), Rule 8) | Admin → lookup by mobile → erase memberships + messages; donations kept for accounting law |
| Retention periods stated and applied | Notice table; admin button “1 वर्ष से पुराने रिकॉर्ड मिटाएँ” |
| Processing log kept ≥ 1 year (Rule 8(3)) | `dk_log` — collection, access, status changes, exports, erasures; never wiped (log stores only last 4 digits of a mobile) |
| Grievance officer contact published (Rule 9) | Notice section 7 + footer link |
| Purpose limitation, no sale / ads | Notice section 1 |
| Export of personal data warned and logged | Every CSV download asks for confirmation and is logged |

## Still to do by the NGO (cannot be done in code)

1. **Real backend before real data.** The current admin is a demo: data sits in one browser's `localStorage`,
   the password is in `admin/admin.js`. That does **not** meet Rule 6 (reasonable security safeguards).
   Before collecting real member data: move `js/store.js` to a server/Supabase with real logins,
   per-user access, encryption in transit (HTTPS) and at rest, backups, and access logs.
2. **Name the Grievance Officer.** The notice says “Secretary” with the WhatsApp number. Confirm the person,
   add an email address, and update section 7 of the notice (Hindi and English).
3. **Breach procedure.** Write down who does what if data leaks: inform affected people without delay and the
   Data Protection Board — first intimation without delay, detailed report within 72 hours (Rule 7).
4. **48-hour notice before erasure** when *you* decide to erase (end of purpose), not when the person asked.
5. **Offline / office entries.** Members added from the admin panel have no website consent record —
   keep a signed form or WhatsApp confirmation.
6. **Processors.** Any hosting / database / SMS provider that handles the data needs a written contract
   saying they only process it on your instructions and delete it when asked.
7. **CSV files and WhatsApp chats** containing member data are personal data too — keep them on a protected
   device and delete when no longer needed.
8. **Google Fonts** share visitors' IP with Google (disclosed in the notice). To avoid it, self-host the fonts.
9. **When the notice changes:** update `#/privacy`, the date/version line, and `NOTICE_VERSION` in `js/store.js`;
   ask existing members for fresh consent if purposes change.
