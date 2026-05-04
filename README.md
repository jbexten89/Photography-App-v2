# Photography Bookkeeping

A single-page web app for tracking a photography business — transactions, invoices, jobs, mileage, and reports. Runs entirely in the browser with no server required.

## Features

- **Dashboard** — Income/expense summary, yearly income chart with goal line, savings goal progress, jobs donut
- **Transactions** — Manual entry, filters (year/category/account/type/payee/memo/tags), reconciliation, bulk select, CSV export
- **Analytics / Trends** — Per-job breakdowns, donut charts, year-over-year bar chart, stacked-by-payee trend chart
- **Invoices** — QuickBooks-style invoice editor (matching a real PDF template), paid tracking, customer autocomplete, sales tax with Ohio default 7.25%
- **Mileage** — Trip logging with IRS standard rate, printable Mileage by Vehicle Summary report
- **Reports** — Profit & Loss with drill-down, Sales Tax Liability, Mileage — all with date range presets and print-to-PDF
- **Schedule** — 9-month calendar grid (Mar–Nov) with color-coded event cells
- **Chart of Accounts** — 50+ default accounts (QuickBooks-style), transaction tagging
- **Data** — JSON backup/restore, MoneyStats CSV import

## Running

Just open `index.html` in a modern browser (Chrome / Edge / Firefox / Safari). Double-click `start.bat` on Windows.

### Deploy to static hosting (for iPhone access etc.)

Drop the folder onto [Netlify Drop](https://app.netlify.com/drop) or push to GitHub Pages. All files are static — no build step.

## Data

All data lives in your browser's `localStorage`. Use **Settings → Download Backup (JSON)** regularly. Your data never leaves your machine.

## Tech

Vanilla HTML + CSS + JavaScript. No framework, no build step, no dependencies.
