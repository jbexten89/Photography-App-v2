# Photography Bookkeeping App v2 — Project Context for Claude

> **You (Claude) are reading this at the start of a fresh session.** This file is the handoff from prior sessions. Read it once, then act. The user is Jamie Bexten, a photographer, not a programmer — write plain-language explanations, never assume framework knowledge.

---

## 1. What this project is

A **single-page vanilla HTML/CSS/JS bookkeeping app** for Jamie Bexten Photography. No framework, no build step, no bundler. Three core files do everything:

| File | Role |
| --- | --- |
| `index.html` | All markup, all pages, all modals. ~160 KB. Pulls CSS/JS via cache-busted query strings. |
| `app.js` | All logic — state, rendering, filters, charts, formulas, Supabase sync. ~670 KB. |
| `styles.css` | All styling, including print rules and mobile breakpoint. ~300 KB. |
| `manual.html` | End-user manual (31 sections, every formula). Opened from Settings in a new tab. |
| `infrastructure.html` | Architecture/deploy reference (GitHub + Vercel + Supabase) with SVG diagrams. |
| `supabase-setup.sql` | One-time DB schema + RLS policy. **Note: this file refers to `app_state` but the live table is `app_state_v2`.** |

There are also CSV/JSON files prefixed `_20NN_*` — those are historical bookkeeping imports from QuickBooks-era data. Don't touch them.

---

## 2. The stack (top-to-bottom)

```
GitHub  (jbexten89/Photography-App-v2, branch: main, remote alias: v2)
   │  push triggers webhook
   ▼
Vercel  (static hosting + CDN, no build step, env keys baked into app.js)
   │  serves files
   ▼
Browser (loads index.html → app.js → reads localStorage → renders UI)
   │  direct, not via Vercel
   ▼
Supabase (Postgres: app_state_v2 table, jsonb blob, RLS by user_id; Auth: email+password JWT)
```

- `infrastructure.html` has full diagrams of all three flows. Refer the user there when they ask "how does it all work."
- Vercel is **not on the data path**. The browser talks to Supabase directly.

---

## 3. Critical conventions (do not violate)

### 3a. Every change must be auto-committed and pushed.
The user's memory file says: **"user wants every code change auto-committed and pushed without asking."** After any edit, immediately:
```bash
git add <files>
git commit -m "..." # with Co-Authored-By trailer
git push v2 HEAD:main
```
Use the `v2` remote, not `origin`. `origin` is the old v1 repo.

### 3b. Bump cache busters.
`index.html` loads `app.js?v=NNN` and `styles.css?v=NNN`. **Every time you edit `app.js` or `styles.css`, bump both `v=` numbers in `index.html` in the same commit.** Otherwise phones serve a stale cached copy and the user will report "your fix didn't work."

### 3c. Never break the LOC-heavy single-file structure.
The user prefers everything in one file per concern. Do not split `app.js` into modules. Do not introduce a bundler. Do not add npm/node dependencies.

### 3d. Mobile is a hard constraint.
The breakpoint is `@media (max-width: 768px)`. The user tests on phone constantly and **will notice sub-pixel wraps, off-by-one paddings, and hidden inputs.** Before adding any layout CSS, grep the full `styles.css` for related properties (`min-width`, `max-width`, `flex-basis`, `overflow`) on the same selector — there's almost always an existing rule that will conflict. The user has explicitly criticized "look harder" / "look deeper" when this wasn't done.

### 3e. Use `?.` optional chaining for DOM lookups.
Many `getElementById(...).addEventListener` calls have caused TDZ-style crashes when an element was removed elsewhere. Always write `document.getElementById("x")?.addEventListener(...)`.

### 3f. Answer questions before acting.
When the user asks "thoughts on X" or "answer first" they want a plain-English explanation of tradeoffs before any code change. Do not jump to code.

### 3g. Plain language only.
Jamie is not a developer. Avoid jargon. When you must use a technical term, define it the first time. Speak like you're explaining to a smart colleague who happens to not know web stack vocabulary.

### 3h. Don't create files unless needed.
No spec docs, no READMEs, no extra HTML pages unless explicitly asked. Edit existing files in place.

---

## 4. State model (memorize the shape)

LocalStorage key: `photo-bookkeeping-v1`. Cloud table: `app_state_v2`. The full state blob lives in both. Top-level keys:

```
transactions    - array of {date, amount, type, category, account, payee, memo, tags, reconciled, jobId, invoiceId}
jobs            - array of named photography jobs (Wedding, Portrait, etc.)
invoices        - array of invoice objects with line items
trips           - mileage trip log
scheduledJobs   - calendar events
categories      - all category strings used
customers       - invoice customer list
vendors         - expense vendor list
payees          - normalized payee strings
accounts        - bank/credit account list
chartAccounts   - QuickBooks-style chart of accounts
expensesTable   - import staging area
filterPresets   - saved filter combinations
lockedYears     - years that are read-only (after tax filing)
savingsGoal     - target annual savings
mileageRate     - IRS rate (e.g. 0.67)
```

Three category-name constants live near the top of `app.js`:
- `JOB_ORDER` — canonical job list (Wedding, Portrait, etc.). Used for revenue/job-expense classification.
- `SAVINGS_CATEGORIES` — categories counted as savings, not expenses.
- `NON_JOB_CATEGORIES` — categories excluded from job-tied calculations.

---

## 5. Filter system (touch carefully)

Universal filters drive most views. Key helpers in `app.js`:
- `filterStates` — current selection object
- `filterPasses(filterId, value)` — generic check
- `filterPassesCategory(value)` — splits JOB vs non-JOB and routes correctly (Job filter narrows `JOB_ORDER`, Category filter narrows the rest)
- `selectedYears()`, `selectedMonths()` — current year/month selection

Drill-downs from analytics into the Transactions list use these globals:
- `__txDrillFilter`, `__txDrillLabel`, `__txBackToAnalytics`, `__txBackToAnalyticsView`

---

## 6. Pages and key analytics views

**Pages (top-level):** Overview, Calendar, New Job, Transactions, Analytics, Invoices, Mileage, Reports, Settings.

**Analytics views (inside Analytics page):** Year Matrix, By Job, Cash Flow, By Category, Trends, Flow, vs Expense, Breakdown (d3-sankey), Savings Rate, Savings.

Every view supports universal filters and most support drill-down into Transactions. See `manual.html` for full feature/formula coverage — refer to it rather than re-deriving.

---

## 7. Common formulas (cheat sheet — full list in manual.html §29)

```
Net               = Income − Expense
YoY %             = (current − prior) / |prior| × 100
Savings Rate      = Savings ÷ (Income − JobExp − COGS) × 100
Profit Base       = Income − JobExp − COGS         (denominator for savings rate)
Ghost bar rule    = render faint capped bar when sav > 0 AND profitBase ≤ 0
Mileage deduction = miles × mileageRate
```

---

## 8. Things the user has already rejected or asked for

- **Asked for, done:** auto-push on every change; mobile-first invoice editor; Year Matrix drill-down; Savings analytics view; ghost bars on Savings Rate; year-dropdown replacing arrow nav on Mileage/Calendar; sidebar order Analytics-before-Transactions.
- **Rejected:** frameworks, build steps, splitting files, removing offline-first behavior.
- **Discussed but not built:** swipe-to-reconcile gesture on transactions (Jamie was considering Option A using existing Reconciled state — not yet implemented).

---

## 9. Workflow shortcuts

```bash
# Push to live
git push v2 HEAD:main

# If Vercel misses a webhook
git commit --allow-empty -m "nudge" && git push v2 HEAD:main

# Cache buster bump pattern in index.html
# find:   app.js?v=143
# replace: app.js?v=144
```

The Backups/ folder contains user-downloaded JSON backups — read-only reference, never modify.

---

## 10. If the user says "we lost work"

Likely cause: cache buster not bumped. Second likely: a JS exception during auth restore breaking the render path (use `?.` on every DOM lookup). The data itself is almost certainly safe in localStorage and/or Supabase — check both before assuming loss.

---

## 11. Where to look for prior context

- `manual.html` — every feature, every page, every formula, written for end users
- `infrastructure.html` — how GitHub/Vercel/Supabase fit together, with diagrams
- `git log --oneline` — months of commit history, each message describes what changed and why
- Local transcripts: `C:\Users\Jamie\.claude\projects\E--TEST---PHOTOGRAPHY-APP\*.jsonl` — full prior Claude Code sessions

---

*Last updated: 2026-05-27. Bump this file whenever a convention changes.*
