# Bank for a Buck

A privacy-first personal expense dashboard — a single self-contained HTML file
(`index.html`) deployed at sammilan.github.io/f-planning via GitHub Pages.
All processing happens client-side in the browser. No backend, no cloud,
no external network requests at runtime. Data persists in localStorage.

## Stack

Vanilla JS, Chart.js 4.4.4, pdf.js 3.11.174, PapaParse 5.4.1 — all bundled
inline as raw/base64 text inside `<script>` tags in `index.html` (zero CDN
dependencies at runtime). The PDF worker is base64-encoded and loaded via
a Blob URL.

## Workflow rules

- **Always commit and push after making a change**, unless told otherwise.
  Use a clear commit message describing what changed.
- Before rebuilding `index.html`, verify the bundler is using the correct
  HTML template (see "Bundler" section below) — never re-bundle from a
  previously-bundled output file.
- After any parser or categorization change, run a quick regression test
  using `vm.runInContext()` in Node against known transaction examples
  before considering the change done.

## Architecture

Three logical parts, currently bundled into one `index.html`:

1. **Core** — category taxonomy (`CAT_META`), keyword-based merchant
   categorization (`KEYWORD_RULES`, regex substring matching, first-match-
   wins — NOT fuzzy/AI matching), `normMerchant()` (strips payment-processor
   prefixes like `AplPay`, `DD *`, `IC*`, `BT*DD *`, then takes first 3
   meaningful words as the merchant key), `categorize()`, storage/undo
   history.

2. **Parsers** — `parseStatementLines()` uses a two-pass approach for PDF
   statement text extracted via pdf.js:
   - Pass 1: standard single-line regex matching (date + description +
     amount all on one line) — works for Chase, Citi, and some Amex formats.
   - Pass 2: multi-line lookahead for Amex's table format, where date,
     description, and amount often land on separate lines because pdf.js
     buckets text by Y-coordinate and Amex's columns sit at slightly
     different Y-positions. Pass 2 scans for date-starting lines and looks
     ahead up to 8 lines to assemble the transaction, skipping Amex category
     labels (`isAmexCatLabel()`) and metadata lines like phone numbers/URLs
     (`isAmexMetaLine()`).
   - IMPORTANT: a `TOTAL: XX.XX` receipt-total pattern (e.g. Lowe's-style
     line-item receipts) must be checked BEFORE `NOISE_RE`/`isAmexMetaLine`
     filtering, since those lines also match noise patterns (they often
     start with `TAX:`).
   - Pass 1 and Pass 2 results are deduplicated via a `mo/da/yr|amount` key.

3. **UI** — tabs (Summary/Trends/Ledger/Cuts/Next 3 Mo), filters, review
   queue, sheets, and a debug viewer (shows raw extracted PDF lines
   color-coded by classification — essential for diagnosing parser misses).

## Categorization model

Pure regex substring matching. A list of `[regex, category, subcategory]`
rules is checked top-to-bottom, first match wins. User-confirmed merchant
rules (from the review queue, or "apply to all" on transaction edits) are
saved to localStorage and checked before falling through to keyword rules.
Anything matching nothing lands in "Other." This is NOT fuzzy matching or
AI — be precise when describing this to the user.

## Bundler

The bundler MUST use the original non-bundled HTML file (with static
`<head>`/CSS/`<body>` markup and CDN `<script src=...>` tags) as its
template — never re-bundle from a previously-bundled output file. Doing so
has caused real bugs: the PDF worker getting embedded twice (bloating the
file and breaking iOS Safari with a blank page / "Script error"), and
losing the `<body>` HTML and CSS entirely.

Use string-based replacement (not regex) when inlining large minified
library content, to avoid regex special-character/backslash issues.

## Known data quirks (from real statement screenshots)

- `GOOGLE *TASTY TRAVELS` and `CRICUT` are intentionally grouped together
  under Shopping/Online — it's a kid's Google Play account, per explicit
  user request. Do not "fix" this grouping without asking first.
- Amex payment-method prefixes to strip in `normMerchant()`: `AplPay`,
  `DD *`, `BT*DD *`, `IC*`, `GDP=`, `WL *`.
- `PAYMENT_RE` excludes `AMEX SEND`, `ADD MONEY`, `CITI FLEX PAY CREDIT`,
  and standard autopay/thank-you lines so they aren't imported as expenses.

## User context

The user (Sammilan) primarily works on iPhone day-to-day but is now also
using Claude Code on a PC for development. Deployment is via git push to
this repo; GitHub Pages serves `index.html` directly from the `main`
branch. No local dev server is used — changes are tested by pushing and
reloading the live Pages URL.
