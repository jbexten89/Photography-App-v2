// ============================================================
// Photography Bookkeeping App
// ============================================================

// ---------- App Password Gate ----------
// Casual access gate. Default password = "changeme". To set your own:
//   1. Open the live site, press F12, paste this into the Console:
//        await crypto.subtle.digest("SHA-256",
//          new TextEncoder().encode("YOUR_NEW_PASSWORD"))
//        .then(b => Array.from(new Uint8Array(b))
//          .map(x => x.toString(16).padStart(2,"0")).join(""))
//   2. Copy the 64-char hash it prints.
//   3. Replace APP_GATE_HASH below with the new hash, push to git.
// SHA-256 of "changeme":
const APP_GATE_HASH = "5f6222f05d908058e3158ac14334f9a054ce7de98f676cbbc6baaeabadfb2eba";
const APP_GATE_KEY  = "photo-app-gate-v1";

(function appGate() {
  const gate = document.getElementById("app-gate");
  if (!gate) return;
  // If previously unlocked, stay unlocked.
  if (localStorage.getItem(APP_GATE_KEY) === APP_GATE_HASH) return;
  gate.hidden = false;
  document.body.style.overflow = "hidden";
  const form  = document.getElementById("app-gate-form");
  const input = document.getElementById("app-gate-input");
  const errEl = document.getElementById("app-gate-error");
  async function sha256(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = input.value;
    if (!v) return;
    const h = await sha256(v);
    if (h === APP_GATE_HASH) {
      localStorage.setItem(APP_GATE_KEY, APP_GATE_HASH);
      gate.hidden = true;
      document.body.style.overflow = "";
    } else {
      errEl.hidden = false;
      input.value = "";
      input.focus();
    }
  });
})();

const STORAGE_KEY = "photo-bookkeeping-v1";
const THEME_KEY = "photo-bookkeeping-theme";

// --------- Theme ---------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.querySelector(".theme-icon");
  if (icon) icon.innerHTML = theme === "dark" ? "&#9728;" : "&#9790;"; // sun / moon
}

const savedTheme = localStorage.getItem(THEME_KEY) || "light";
applyTheme(savedTheme);

document.getElementById("btn-theme").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  const next = cur === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// --------- State ---------
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn("Load failed", e); }
  return {
    categories: [],
    accounts: [],
    payees: [],
    vendors: [],
    transactions: [],
    invoices: [],
    nextInvoiceNumber: 26002,
    trips: [],
    mileageRate: 0.70,
    chartAccounts: [],
    customers: [],
    startupView: "dashboard",           // "dashboard" | "transactions"
    startupDashboardYear: "current",    // "current" | "all"
    mobileNavStyle: "sidebar",          // "sidebar" | "bottom"
    filterPresets: [],                  // saved analytics filter presets
    txMobileCols: {                     // visibility per column on mobile
      date: true, vendor: true, customer: true, payee: true,
      category: true, chart: true, amount: true, memo: true, recon: true, tags: true
    },
    txColWidths: {},                    // user-resized column widths (px)
    txColsLocked: true,                 // lock/unlock manual resize
    reportsInverted: false              // dark inversion for report sheets on screen
  };
}

// Backfill vendors field on existing state
if (!Array.isArray(state.vendors)) state.vendors = [];
if (!Array.isArray(state.customers)) state.customers = [];

// Default savings goal (persisted)
if (typeof state.savingsGoal !== "number") state.savingsGoal = 12000;

// Scheduled jobs
if (!Array.isArray(state.scheduledJobs)) state.scheduledJobs = [];

// Color scheme — applies an accent palette on top of light/dark.
if (typeof state.colorScheme !== "string") state.colorScheme = "";
function applyColorScheme(scheme) {
  if (scheme) document.documentElement.dataset.colorScheme = scheme;
  else delete document.documentElement.dataset.colorScheme;
}
applyColorScheme(state.colorScheme);

// Chart palette — DONUT_PALETTE swap. Default "vibrant".
if (typeof state.chartPalette !== "string" || !["vibrant", "pastel", "bold"].includes(state.chartPalette)) {
  state.chartPalette = "vibrant";
}

// Invoice line autocompletes — Settings-managed lists. On first init, seed
// from any existing invoice line items / descriptions so the dropdowns aren't
// empty for users coming from the auto-derived behavior.
if (!Array.isArray(state.invoiceItems)) {
  const seenI = new Set();
  state.invoiceItems = [];
  (state.invoices || []).forEach(inv => (inv.lineItems || []).forEach(l => {
    const v = (l.item || "").trim();
    if (v && !seenI.has(v)) { seenI.add(v); state.invoiceItems.push(v); }
  }));
  state.invoiceItems.sort();
}
if (!Array.isArray(state.invoiceDescs)) {
  const seenD = new Set();
  state.invoiceDescs = [];
  (state.invoices || []).forEach(inv => (inv.lineItems || []).forEach(l => {
    const v = (l.description || "").trim();
    if (v && !seenD.has(v)) { seenD.add(v); state.invoiceDescs.push(v); }
  }));
  state.invoiceDescs.sort();
}

// Mobile transactions column visibility (per-column toggles in Settings).
if (!state.txMobileCols || typeof state.txMobileCols !== "object") {
  state.txMobileCols = { date: true, vendor: true, customer: true, jobno: true, payee: true, expinc: true, category: true, chart: true, amount: true, memo: true, recon: true, tags: true };
}
// Backfill the chart column flag for users whose state predates it.
if (state.txMobileCols.chart === undefined) state.txMobileCols.chart = true;
if (state.txMobileCols.expinc === undefined) state.txMobileCols.expinc = true;
if (state.txMobileCols.jobno === undefined) state.txMobileCols.jobno = true;
// Backfill column-width persistence + lock for users whose state predates them.
if (!state.txColWidths || typeof state.txColWidths !== "object") state.txColWidths = {};
if (typeof state.txColsLocked !== "boolean") state.txColsLocked = true;
if (typeof state.reportsInverted !== "boolean") state.reportsInverted = false;
document.body.classList.toggle("reports-inverted", state.reportsInverted);
if (typeof state.txMobile3Line !== "boolean") state.txMobile3Line = false;
document.body.classList.toggle("tx-mobile-3line", state.txMobile3Line);
if (typeof state.njMobile3Line !== "boolean") state.njMobile3Line = false;
document.body.classList.toggle("nj-mobile-3line", state.njMobile3Line);
if (typeof state.invMobile3Line !== "boolean") state.invMobile3Line = false;
document.body.classList.toggle("inv-mobile-3line", state.invMobile3Line);
// Default ON; toggle in Settings → All Transactions Table.
if (typeof state.chartSalesHighlight !== "boolean") state.chartSalesHighlight = true;
document.body.classList.toggle("chart-sales-off", !state.chartSalesHighlight);
// Default OFF; toggle in Settings → All Transactions Table.
if (typeof state.txJobExpenseHighlight !== "boolean") state.txJobExpenseHighlight = false;
document.body.classList.toggle("tx-job-expense-highlight", state.txJobExpenseHighlight);
// Default OFF; only takes effect when both Sales-row green and job-expense
// red highlights are off (CSS scopes it that way).
if (typeof state.txJobColorRows !== "boolean") state.txJobColorRows = false;
document.body.classList.toggle("tx-job-color-rows", state.txJobColorRows);
// Locked years — array of "YYYY" strings. Transactions/invoices whose date
// falls in a locked year cannot be edited or deleted from the UI.
if (!Array.isArray(state.lockedYears)) state.lockedYears = [];

function isLockedDate(dateStr) {
  if (!dateStr) return false;
  const m = String(dateStr).match(/^(\d{4})/);
  if (!m) return false;
  return (state.lockedYears || []).includes(m[1]);
}
function blockedToast(year) {
  if (window.toast) toast(`Year ${year} is locked — unlock in Settings to make changes`, { kind: "error", ttl: 3500 });
  else alert(`Year ${year} is locked — unlock in Settings to make changes.`);
}

// Startup preferences
if (state.startupView !== "dashboard" && state.startupView !== "transactions") state.startupView = "dashboard";
if (state.startupDashboardYear !== "all" && state.startupDashboardYear !== "current") state.startupDashboardYear = "current";
if (state.mobileNavStyle !== "sidebar" && state.mobileNavStyle !== "bottom") state.mobileNavStyle = "sidebar";

// Apply the mobile-nav preference to the body so the right CSS kicks in immediately
document.body.classList.toggle("mobile-nav-bottom", state.mobileNavStyle === "bottom");

// Apply tx column visibility (mobile-only via CSS @media). Each unchecked col
// adds a body.tx-hide-{col} class; matching CSS rule hides it on mobile.
function applyTxMobileColumns() {
  const cols = state.txMobileCols || {};
  ["date","vendor","customer","jobno","payee","expinc","category","chart","amount","memo","recon","tags"].forEach(c => {
    document.body.classList.toggle("tx-hide-" + c, cols[c] === false);
  });
}
applyTxMobileColumns();

// Apply persisted column widths (inline style on each th + .tx-select-col) and
// reflect the lock state on body so CSS can show/hide resize handles.
// Default width for each column when table-layout becomes fixed. Used as a
// fallback for columns the user hasn't manually resized — otherwise fixed
// layout distributes remaining space among them, which can collapse a
// column to 0 if the sized columns already fill the table.
const TX_COL_DEFAULT_WIDTHS = {
  date: 90, vendor: 110, customer: 120, jobno: 70, payee: 130, expinc: 130, category: 130,
  chart: 130, amount: 100, memo: 160, recon: 40, tags: 36,
};

function applyTxColWidths() {
  document.body.classList.toggle("tx-cols-locked", state.txColsLocked !== false);
  const widths = state.txColWidths || {};
  const anyWidth = Object.values(widths).some(v => v);
  const tbl = document.getElementById("tx-table");
  // Switch to fixed layout once the user has set ANY explicit width — that's
  // the only way explicit widths actually size the columns reliably.
  if (tbl) tbl.style.tableLayout = anyWidth ? "fixed" : "";
  document.querySelectorAll("#tx-table th[data-col]").forEach(th => {
    const c = th.dataset.col;
    if (widths[c]) {
      th.style.width    = widths[c] + "px";
      th.style.minWidth = widths[c] + "px";
      th.style.maxWidth = widths[c] + "px";
    } else if (anyWidth && TX_COL_DEFAULT_WIDTHS[c]) {
      // Fixed layout in effect but this column has no saved width — apply a
      // default so it doesn't collapse to 0 and disappear.
      const w = TX_COL_DEFAULT_WIDTHS[c];
      th.style.width    = w + "px";
      th.style.minWidth = w + "px";
      th.style.maxWidth = w + "px";
    } else {
      th.style.width = "";
      th.style.minWidth = "";
      th.style.maxWidth = "";
    }
  });
}
applyTxColWidths();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  cloudSyncSchedulePush();
}

// --------- Supabase Cloud Sync ---------
const SUPABASE_URL  = "https://rmtoevvzknrqqbmpgsvy.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtdG9ldnZ6a25ycXFibXBnc3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNjQ5MDAsImV4cCI6MjA5MjY0MDkwMH0.icOjxd6KRkhwPRW2paqU4JIOlh_zPW4YHCGNw3fYhxY";

let supa = null;
let supaUser = null;          // { id, email } when signed in
let cloudSyncTimer = null;
let cloudSyncInFlight = false;
let cloudSyncLastAt = null;

function setSyncStatus(kind, text) {
  const el = document.getElementById("cloud-sync-status");
  if (!el) return;
  el.className = "cloud-sync-status " + kind;
  el.textContent = text;
}

function formatSyncTimestamp(d) {
  if (!d) return "never";
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function refreshCloudSyncUI() {
  const signedOut = document.getElementById("cloud-sync-signed-out");
  const signedIn  = document.getElementById("cloud-sync-signed-in");
  const sidebarStatus = document.getElementById("sidebar-cloud-status");
  const flyoutStatus  = document.getElementById("flyout-cloud-status");
  const statusEls = [sidebarStatus, flyoutStatus].filter(Boolean);
  if (!signedOut || !signedIn) return;
  if (supaUser) {
    signedOut.hidden = true;
    signedIn.hidden = false;
    const userEl = document.getElementById("cloud-sync-user");
    if (userEl) userEl.textContent = supaUser.email || "(authenticated)";
    const lastEl = document.getElementById("cloud-sync-last");
    if (lastEl) lastEl.textContent = formatSyncTimestamp(cloudSyncLastAt);
    statusEls.forEach(el => {
      el.hidden = false;
      const t = el.querySelector(".sidebar-cloud-text");
      if (t) t.textContent = "Signed in";
    });
  } else {
    signedOut.hidden = false;
    signedIn.hidden = true;
    statusEls.forEach(el => { el.hidden = true; });
  }
}

function initSupabase() {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.warn("Supabase library not loaded — cloud sync disabled");
    setSyncStatus("offline", "● Offline");
    return;
  }
  supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  // Restore an existing session if there is one
  supa.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      supaUser = { id: session.user.id, email: session.user.email };
      refreshCloudSyncUI();
      cloudSyncPull(/*merge*/ true);
    } else {
      setSyncStatus("offline", "● Signed Out");
    }
  });
  supa.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      supaUser = { id: session.user.id, email: session.user.email };
      setSyncStatus("synced", "● Signed In");
    } else {
      supaUser = null;
      setSyncStatus("offline", "● Signed Out");
    }
    refreshCloudSyncUI();
  });
}

async function cloudSyncPull(mergeFromLocal) {
  if (!supa || !supaUser) return;
  setSyncStatus("syncing", "◐ Syncing…");
  try {
    const { data, error } = await supa.from("app_state_v2")
      .select("data, updated_at")
      .eq("user_id", supaUser.id)
      .maybeSingle();
    if (error) throw error;
    if (data && data.data) {
      // Remote row exists — overwrite local with it.
      state = data.data;
      // Re-run backfill so older backups still load cleanly
      if (!Array.isArray(state.vendors)) state.vendors = [];
      if (!Array.isArray(state.customers)) state.customers = [];
      if (!Array.isArray(state.scheduledJobs)) state.scheduledJobs = [];
      if (!Array.isArray(state.chartAccounts)) state.chartAccounts = [];
      if (typeof state.savingsGoal !== "number") state.savingsGoal = 12000;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      cloudSyncLastAt = new Date(data.updated_at || Date.now());
      setSyncStatus("synced", "● Synced");
      refreshCloudSyncUI();
      // Defer render() to after the current task so any top-level let/const
      // declarations below this point in the file have time to initialize
      // (TDZ-safe). Otherwise an auth-restore-triggered render during initial
      // script parse can throw on dashboardYearInitialized / CHART_ACCOUNT_TYPES.
      if (typeof render === "function") setTimeout(() => { try { render(); } catch (e) { console.error("post-pull render failed", e); } }, 0);
    } else if (mergeFromLocal) {
      // First sign-in on this account — seed the remote row from local state.
      await cloudSyncPush();
    } else {
      setSyncStatus("synced", "● Synced (empty)");
    }
  } catch (e) {
    console.warn("cloudSyncPull failed:", e);
    setSyncStatus("error", "● Error");
  }
}

async function cloudSyncPush() {
  if (!supa || !supaUser) return;
  if (cloudSyncInFlight) return;
  // SAFETY: never push an essentially-empty local state on top of a cloud row
  // that has data. This guards against the data-loss scenario where a fresh
  // browser/incognito session loaded with an empty localStorage briefly
  // pushed empty defaults to the cloud and overwrote real records.
  const localIsEmpty = !Array.isArray(state.transactions) || state.transactions.length === 0;
  if (localIsEmpty) {
    try {
      const { data } = await supa.from("app_state_v2")
        .select("data")
        .eq("user_id", supaUser.id)
        .maybeSingle();
      const remoteHasData = data && data.data && Array.isArray(data.data.transactions) && data.data.transactions.length > 0;
      if (remoteHasData) {
        console.warn("cloudSyncPush blocked: local state is empty but remote has data. Refusing to overwrite.");
        setSyncStatus("error", "● Empty local — push blocked");
        return;
      }
    } catch (e) {
      // If the existence check fails, err on the side of NOT pushing.
      console.warn("cloudSyncPush pre-check failed; aborting push to be safe:", e);
      setSyncStatus("error", "● Error");
      return;
    }
  }
  cloudSyncInFlight = true;
  setSyncStatus("syncing", "◐ Syncing…");
  try {
    const now = new Date().toISOString();
    const { error } = await supa.from("app_state_v2")
      .upsert({ user_id: supaUser.id, data: state, updated_at: now });
    if (error) throw error;
    cloudSyncLastAt = new Date(now);
    setSyncStatus("synced", "● Synced");
    refreshCloudSyncUI();
  } catch (e) {
    console.warn("cloudSyncPush failed:", e);
    setSyncStatus("error", "● Error");
  } finally {
    cloudSyncInFlight = false;
  }
}

function cloudSyncSchedulePush() {
  if (!supa || !supaUser) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(cloudSyncPush, 2000);
}

// Wire auth buttons + force push/pull controls
document.addEventListener("DOMContentLoaded", () => {
  initSupabase();

  const emailEl = () => document.getElementById("cloud-sync-email");
  const passEl  = () => document.getElementById("cloud-sync-password");
  const errEl   = () => document.getElementById("cloud-sync-error");
  const showErr = msg => {
    const el = errEl();
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
  };

  const signInBtn  = document.getElementById("btn-cloud-signin");
  const signUpBtn  = document.getElementById("btn-cloud-signup");
  const signOutBtn = document.getElementById("btn-cloud-signout");
  const pushBtn    = document.getElementById("btn-cloud-push");
  const pullBtn    = document.getElementById("btn-cloud-pull");

  signInBtn?.addEventListener("click", async () => {
    if (!supa) return showErr("Cloud sync library failed to load.");
    showErr("");
    setSyncStatus("syncing", "◐ Signing in…");
    const { error } = await supa.auth.signInWithPassword({
      email: (emailEl().value || "").trim(),
      password: passEl().value || ""
    });
    if (error) { showErr(error.message); setSyncStatus("error", "● Error"); }
    else { passEl().value = ""; cloudSyncPull(true); }
  });

  signUpBtn?.addEventListener("click", async () => {
    if (!supa) return showErr("Cloud sync library failed to load.");
    showErr("");
    setSyncStatus("syncing", "◐ Creating account…");
    const { error } = await supa.auth.signUp({
      email: (emailEl().value || "").trim(),
      password: passEl().value || ""
    });
    if (error) { showErr(error.message); setSyncStatus("error", "● Error"); return; }
    // Some Supabase projects require email confirmation; if confirmation is off,
    // the user is immediately signed in and the pull below seeds their row.
    showErr("Account created. Check your email if confirmation is required.");
    setSyncStatus("synced", "● Signed Up");
    cloudSyncPull(true);
  });

  signOutBtn?.addEventListener("click", async () => {
    if (!supa) return;
    await supa.auth.signOut();
    setSyncStatus("offline", "● Signed Out");
  });

  pushBtn?.addEventListener("click", () => cloudSyncPush());
  pullBtn?.addEventListener("click", () => cloudSyncPull(false));
});

// One-time cleanup: remove default account names that aren't used by any transaction
(function removeUnusedDefaultAccounts() {
  const DEFAULT_NAMES = ["Cash", "Checking", "Credit Card", "Savings"];
  const used = new Set(state.transactions.map(t => t.account));
  const before = state.accounts.length;
  state.accounts = state.accounts.filter(a => !(DEFAULT_NAMES.includes(a) && !used.has(a)));
  if (state.accounts.length !== before) saveState();
})();

// One-time normalization: strip " - Photo" suffix from any category name
(function normalizeCategoryNames() {
  const strip = s => (s || "").replace(/\s*-\s*Photo\s*$/, "").trim();
  let changed = false;

  state.transactions.forEach(t => {
    const cleaned = strip(t.category);
    if (cleaned !== t.category) {
      t.category = cleaned;
      changed = true;
    }
  });

  const seen = new Set();
  const newCats = [];
  state.categories.forEach(c => {
    const cleaned = strip(c);
    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      newCats.push(cleaned);
    }
  });
  if (newCats.length !== state.categories.length || newCats.some((c, i) => c !== state.categories[i])) {
    state.categories = newCats.sort();
    changed = true;
  }

  if (changed) saveState();
})();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtMoney(n) {
  const v = Number(n) || 0;
  return (v < 0 ? "-" : "") + "$" + Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// --------- Mobile hamburger menu ---------
const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const mobileBackdrop = document.getElementById("mobile-backdrop");

function setSidebarOpen(open) {
  document.body.classList.toggle("sidebar-open", open);
}

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener("click", () => {
    setSidebarOpen(!document.body.classList.contains("sidebar-open"));
  });
}
if (mobileBackdrop) {
  mobileBackdrop.addEventListener("click", () => setSidebarOpen(false));
}

// --------- Tabs ---------
// When a tab becomes active, sync the "active" class across all .tab-btn
// instances that target the same data-tab (sidebar, bottom-nav, right-flyout).
function syncTabActive(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    syncTabActive(tab);
    document.getElementById(tab).classList.add("active");
    // Clicking any sidebar tab (including Transactions directly) clears the
    // "came from Analytics" context and hides the Back arrow.
    window.__txBackToAnalytics = false;
    window.__txBackToAnalyticsView = null;
    const backBtn = document.getElementById("btn-tx-back");
    if (backBtn) backBtn.hidden = true;
    render();
    // Scroll to the top whenever a tab is opened so the user always sees
    // the heading first instead of landing wherever the previous page ended.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    // On mobile, close the left-slide drawer after picking a tab
    setSidebarOpen(false);
    // Also close the bottom-nav right flyout if it was open
    setRightFlyoutOpen(false);
  });
});

// --------- Mobile bottom-bar "More" right-flyout ---------
function setRightFlyoutOpen(open) {
  document.body.classList.toggle("right-flyout-open", open);
}
const btnMobileMore = document.getElementById("btn-mobile-more");
if (btnMobileMore) {
  btnMobileMore.addEventListener("click", () => {
    setRightFlyoutOpen(!document.body.classList.contains("right-flyout-open"));
  });
}
const rightFlyoutBackdrop = document.getElementById("right-flyout-backdrop");
if (rightFlyoutBackdrop) {
  rightFlyoutBackdrop.addEventListener("click", () => setRightFlyoutOpen(false));
}
// Theme toggle inside the right flyout — mirror the main toggle
const btnThemeFlyout = document.getElementById("btn-theme-flyout");
if (btnThemeFlyout) {
  btnThemeFlyout.addEventListener("click", () => {
    const main = document.getElementById("btn-theme");
    if (main) main.click();
  });
}

// Back arrow on Transactions → returns to Analytics overview
document.getElementById("btn-tx-back").addEventListener("click", () => {
  const origin = window.__txBackTo || (window.__txBackToAnalytics ? "jobs" : null);
  const analyticsView = window.__txBackToAnalyticsView || "by-category";
  window.__txBackToAnalytics = false;
  window.__txBackTo = null;
  window.__txBackToAnalyticsView = null;
  document.getElementById("btn-tx-back").hidden = true;
  // Clear the category filter so Transactions isn't still filtered after the round-trip
  document.getElementById("tx-filter-category").value = "";

  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  if (origin === "dashboard") {
    // Return to the Overview / Dashboard tab
    syncTabActive("dashboard");
    document.getElementById("dashboard").classList.add("active");
  } else {
    // Default: return to Analytics master with whichever view the user
    // drilled from (set by the drill click handler) — falls back to By Job.
    syncTabActive("jobs");
    document.getElementById("jobs").classList.add("active");
    if (typeof activateAnalyticsView === "function") activateAnalyticsView(analyticsView);
  }
  render();
});

// --------- Analytics view pills ---------
// All analytics views (Net Worth, Cash Flow, Trends, By Category, Flow, vs Expense)
// live inside the single #jobs master section. Pills toggle which inner
// .analytics-view is shown.
function activateAnalyticsView(viewName) {
  document.querySelectorAll(".analytics-pill").forEach(b => {
    b.classList.toggle("active", b.dataset.view === viewName);
  });
  document.querySelectorAll(".analytics-view").forEach(v => {
    v.classList.toggle("active", v.dataset.view === viewName);
  });
  // Keep the mobile picker in sync with whichever view is active.
  const sel = document.getElementById("analytics-view-select");
  if (sel && sel.value !== viewName) sel.value = viewName;
  if (typeof syncAmvpFromActiveView === "function") syncAmvpFromActiveView(viewName);
  if (typeof syncJobsModeTogglePlacement === "function") syncJobsModeTogglePlacement(viewName);
  if (typeof refreshFilterTriggers === "function") refreshFilterTriggers();
  if (viewName === "flow"   && typeof renderTrends   === "function") renderTrends();
  if (viewName === "trends" && typeof renderByCategory === "function") renderByCategory();
  if (viewName === "cash-flow" && typeof renderCashFlow === "function") renderCashFlow();
  if (viewName === "breakdown" && typeof renderBreakdown === "function") renderBreakdown();
  if (viewName === "vs-expense" && typeof renderVsExpense === "function") renderVsExpense();
  if (viewName === "spending-trends" && typeof renderSpendingTrends === "function") renderSpendingTrends();
  if (viewName === "savings-rate" && typeof renderSavingsRate === "function") renderSavingsRate();
  if (viewName === "savings"      && typeof renderSavings      === "function") renderSavings();
  if (viewName === "year-matrix"  && typeof renderYearMatrix  === "function") renderYearMatrix();
}

document.querySelectorAll(".analytics-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    activateAnalyticsView(btn.dataset.view);
  });
});

// Mobile dropdown for views (legacy <select> kept hidden, no listener needed)

// On mobile, move the Gross/Net toggle into the analytics-toolbar-row so it
// shares a row with Filters / Presets. On desktop (or when leaving the
// By Job view), put it back where it lived in markup.
const _jobsModeToggle = document.getElementById("jobs-mode-toggle");
const _jobsModeOrigParent = _jobsModeToggle?.parentNode || null;
const _jobsModeOrigNext   = _jobsModeToggle?.nextSibling || null;
function syncJobsModeTogglePlacement(viewName) {
  if (!_jobsModeToggle || !_jobsModeOrigParent) return;
  const isByJob   = (viewName || document.querySelector(".analytics-view.active")?.dataset.view) === "by-category";
  const toolbarRow = document.querySelector("#jobs .analytics-toolbar-row");
  // Desktop only: when By Job is active, lift the Gross/Net toggle into the
  // analytics toolbar-row (alongside Filters / Presets / active-preset chip).
  // margin-left:auto in CSS pins it to the right side.
  // On mobile we DON'T move it — the top row is already crowded by filter
  // chips, and the Gross/Net pill would get pushed off the right edge.
  // Leave it in its original spot in the Jobs section header where my
  // mobile CSS gives it its own row beneath the By Customer/Category/Job No.
  // group toggle.
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  if (isByJob && toolbarRow && !isMobile) {
    if (_jobsModeToggle.parentNode !== toolbarRow) toolbarRow.appendChild(_jobsModeToggle);
  } else {
    if (_jobsModeToggle.parentNode !== _jobsModeOrigParent) {
      _jobsModeOrigParent.insertBefore(_jobsModeToggle, _jobsModeOrigNext);
    }
  }
}
window.addEventListener("resize", () => syncJobsModeTogglePlacement());
// Also run once at startup so the initial render reflects the right home.
setTimeout(() => syncJobsModeTogglePlacement(), 0);

// On mobile, relocate the + New Invoice button into the invoice-summary grid
// so it sits on the right side of the same row as Outstanding Balance.
const _newInvoiceBtn = document.getElementById("btn-new-invoice");
const _newInvoiceOrigParent = _newInvoiceBtn?.parentNode || null;
const _newInvoiceOrigNext   = _newInvoiceBtn?.nextSibling || null;
function syncNewInvoiceButtonPlacement() {
  if (!_newInvoiceBtn || !_newInvoiceOrigParent) return;
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const summary = document.querySelector("#invoices-list-view .invoice-summary");
  if (isMobile && summary) {
    if (_newInvoiceBtn.parentNode !== summary) summary.appendChild(_newInvoiceBtn);
  } else {
    if (_newInvoiceBtn.parentNode !== _newInvoiceOrigParent) {
      _newInvoiceOrigParent.insertBefore(_newInvoiceBtn, _newInvoiceOrigNext);
    }
  }
}
window.addEventListener("resize", syncNewInvoiceButtonPlacement);
setTimeout(syncNewInvoiceButtonPlacement, 0);

// Measure the running-balance bar height and expose it as a CSS variable
// (--tx-rb-height) so the table header can stick directly below it on mobile.
function syncTxRbHeight() {
  const rb = document.querySelector("#transactions .running-balance");
  if (!rb) return;
  const h = Math.ceil(rb.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--tx-rb-height", h + "px");
}
syncTxRbHeight();
window.addEventListener("resize", syncTxRbHeight);
// Track size changes (Selected pill toggling in/out, etc.).
try {
  const _rb = document.querySelector("#transactions .running-balance");
  if (_rb && typeof ResizeObserver === "function") {
    new ResizeObserver(syncTxRbHeight).observe(_rb);
  }
} catch (_) {}

// ===== Custom Mobile View Picker =====
const amvpEl      = document.getElementById("amvp");
const amvpTrigger = document.getElementById("amvp-trigger");
const amvpMenu    = document.getElementById("amvp-menu");
const amvpLabelEl = document.getElementById("amvp-current-label");
const amvpIconEl  = document.getElementById("amvp-current-icon");

function closeAmvp() {
  if (amvpMenu) amvpMenu.hidden = true;
  if (amvpTrigger) amvpTrigger.setAttribute("aria-expanded", "false");
}
amvpTrigger?.addEventListener("click", e => {
  e.stopPropagation();
  if (!amvpMenu) return;
  const open = !amvpMenu.hidden;
  amvpMenu.hidden = open;
  amvpTrigger.setAttribute("aria-expanded", open ? "false" : "true");
});
document.addEventListener("click", e => {
  if (!amvpEl || !amvpMenu || amvpMenu.hidden) return;
  if (amvpEl.contains(e.target)) return;
  closeAmvp();
});
amvpMenu?.querySelectorAll(".amvp-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    activateAnalyticsView(view);
    closeAmvp();
  });
});

// Reflect the active view on the custom mobile picker (icon + label + active item)
function syncAmvpFromActiveView(viewName) {
  if (!amvpMenu) return;
  amvpMenu.querySelectorAll(".amvp-item").forEach(b => {
    b.classList.toggle("active", b.dataset.view === viewName);
  });
  const activeBtn = amvpMenu.querySelector(`.amvp-item[data-view="${viewName}"]`);
  if (activeBtn) {
    if (amvpLabelEl) amvpLabelEl.textContent = activeBtn.querySelector("span").textContent;
    if (amvpIconEl) {
      const srcSvg = activeBtn.querySelector("svg");
      if (srcSvg) {
        amvpIconEl.innerHTML = srcSvg.innerHTML;
        amvpIconEl.setAttribute("viewBox", srcSvg.getAttribute("viewBox") || "0 0 24 24");
      }
    }
  }
}

// (Mobile bottom-sheet experiment removed — filter popovers now use the
// desktop drop-below-trigger style on mobile too.)
const isMobileSheet = () => false;
function showSheetBackdrop() {}
function hideSheetBackdropIfNoSheets() {}

// ============================================================================
// Multi-select Analytics filters
//   Each filter has { mode: "include" | "exclude", selected: Set<string> }
//   - selected === null   → uninitialized; behaves as "no filter" (all pass)
//   - selected.size === 0 → "no filter" too (all pass)
//   - non-empty include   → only listed values pass
//   - non-empty exclude   → listed values do NOT pass
// ============================================================================
const analyticsFiltersBtn   = document.getElementById("btn-analytics-filters");
const analyticsFiltersPanel = document.getElementById("analytics-filters-panel");

const FILTER_DEFS = {
  "date-range": {
    label: "Date Range",
    getOptions: () => {
      const set = new Set();
      state.transactions.forEach(t => {
        const y = (t.date || "").slice(0, 4);
        if (/^\d{4}$/.test(y)) set.add(y);
      });
      return [...set].sort((a, b) => b.localeCompare(a)); // newest first
    },
  },
  "customer": {
    label: "Customer",
    getOptions: () => [...new Set((state.customers || []).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  },
  "job": {
    label: "Job",
    getOptions: () => JOB_ORDER.filter(j => (state.categories || []).includes(j)),
  },
  "category": {
    label: "Category",
    getOptions: () => (state.categories || [])
      .filter(c => c && !JOB_ORDER.includes(c))
      .sort((a, b) => a.localeCompare(b)),
  },
  "payees": {
    label: "Payee",
    getOptions: () => [...new Set((state.payees || []).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  },
};

// State: filter id → { mode, selected (Set or null) }
const filterStates = {};
Object.keys(FILTER_DEFS).forEach(k => { filterStates[k] = { mode: "include", selected: null }; });

function filterPasses(filterId, value) {
  const s = filterStates[filterId];
  if (!s || s.selected === null || s.selected.size === 0) return true; // no filter
  return s.mode === "include" ? s.selected.has(value) : !s.selected.has(value);
}

// Job filter narrows JOB_ORDER values; Category filter narrows non-JOB values.
// Each transaction's category routes through whichever filter owns its domain
// so a transaction with category "Spring Sports" isn't accidentally blocked by
// a Category filter restricting "Cost of Goods".
//
// IMPORTANT: when the Job filter is set restrictively (specific Includes),
// a non-JOB category (e.g. "Mounted Prints", which isn't in JOB_ORDER) is
// also excluded by default — matching user intent of "only show the chosen
// Jobs". The Category filter can still explicitly add a non-JOB value back.
function filterPassesCategory(catValue) {
  if (JOB_ORDER.includes(catValue)) return filterPasses("job", catValue);
  const jobF = filterStates["job"];
  const catF = filterStates["category"];
  const jobIncludeActive = jobF && jobF.mode === "include" && jobF.selected && jobF.selected.size > 0;
  if (jobIncludeActive) {
    const catIncludeActive = catF && catF.mode === "include" && catF.selected && catF.selected.size > 0;
    if (catIncludeActive) return catF.selected.has(catValue);
    return false;
  }
  return filterPasses("category", catValue);
}

// Returns the currently-selected year strings, or null if no filter is active.
function selectedYears() {
  const s = filterStates["date-range"];
  if (!s || s.selected === null || s.selected.size === 0) return null;
  if (s.mode === "include") return [...s.selected].sort();
  // Exclude mode — derive complement from current options
  const all = FILTER_DEFS["date-range"].getOptions();
  return all.filter(y => !s.selected.has(y)).sort();
}

// Build a chronological YYYY-MM key list across selected years (or all years
// if no date filter is active). Months ordered oldest→newest.
function selectedMonthKeys() {
  let years = selectedYears();
  if (!years) {
    const set = new Set();
    state.transactions.forEach(t => {
      const y = (t.date || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) set.add(y);
    });
    years = [...set].sort();
  } else {
    years = years.slice().sort();
  }
  const keys = [];
  years.forEach(y => {
    for (let m = 1; m <= 12; m++) keys.push(`${y}-${String(m).padStart(2, "0")}`);
  });
  return keys;
}

// Used by chart renderers that need {key, label, date} per month.
function selectedMonths() {
  return selectedMonthKeys().map(k => {
    const [y, m] = k.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return { key: k, label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), date: d };
  });
}

function summarizeFilter(filterId) {
  const s = filterStates[filterId];
  const def = FILTER_DEFS[filterId];
  if (!def) return "All";
  const opts = def.getOptions();
  if (!s || s.selected === null || s.selected.size === 0) return "All";
  if (s.mode === "include" && s.selected.size === opts.length) return "All";
  if (s.mode === "exclude" && s.selected.size === 0) return "All";
  if (s.mode === "include" && s.selected.size === 1) return [...s.selected][0];
  // Years are short (4 chars) — list them inline when there aren't too many,
  // so the user can see exactly which years are filtered.
  if (filterId === "date-range" && s.mode === "include" && s.selected.size <= 6) {
    return [...s.selected].sort().join(", ");
  }
  const verb = s.mode === "include" ? "of" : "excluded";
  return s.mode === "include"
    ? `${s.selected.size} of ${opts.length}`
    : `${opts.length - s.selected.size} of ${opts.length}`;
}

function refreshFilterTriggers() {
  let narrowedCount = 0;
  document.querySelectorAll(".filter-trigger").forEach(btn => {
    const id = btn.dataset.filter;
    const sumEl = btn.querySelector(".filter-summary");
    if (sumEl) sumEl.textContent = summarizeFilter(id);
    const s = filterStates[id];
    const narrowed = s && s.selected && s.selected.size > 0 && summarizeFilter(id) !== "All";
    btn.classList.toggle("is-narrowed", !!narrowed);
    if (narrowed) narrowedCount++;
  });
  // Reflect the count of narrowed filters on the main Filters button.
  const badge = document.getElementById("filter-count-badge");
  if (badge) {
    if (narrowedCount > 0) {
      badge.textContent = String(narrowedCount);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }
  // Render active filters as inline chips next to the Filters/Presets buttons.
  // Click the chip body to re-open its popover; click × to clear that one filter.
  const sumEl = document.getElementById("analytics-filter-summary");
  if (sumEl) {
    const parts = [];
    Object.keys(FILTER_DEFS).forEach(k => {
      if (k === "date-range") return;
      const txt = summarizeFilter(k);
      if (txt && txt !== "All") parts.push({ id: k, label: FILTER_DEFS[k].label, value: txt });
    });
    sumEl.classList.toggle("has-chips", parts.length > 0);
    sumEl.innerHTML = parts.map(p => `
      <button type="button" class="filter-chip" data-filter="${escapeHtml(p.id)}">
        <span class="chip-label">${escapeHtml(p.label)}:</span>
        <span class="chip-value">${escapeHtml(p.value)}</span>
        <span class="chip-x" data-act="clear-filter" aria-label="Clear ${escapeHtml(p.label)} filter">×</span>
      </button>
    `).join("");
  }
  renderFilterAddList();
}

// Render the "+ Add filter" list inside the panel — only filters that are
// currently inactive (i.e., not already shown as a chip in the toolbar).
function renderFilterAddList() {
  const host = document.getElementById("filter-add-list");
  if (!host) return;
  const inactive = Object.keys(FILTER_DEFS).filter(k => {
    if (k === "date-range") return false;
    return summarizeFilter(k) === "All";
  });
  if (!inactive.length) {
    host.innerHTML = `<div class="filter-add-empty muted">All filters applied</div>`;
    return;
  }
  host.innerHTML = inactive.map(id => `
    <button type="button" class="filter-add-row" data-filter="${escapeHtml(id)}">
      <span class="filter-add-plus">+</span>
      <span>${escapeHtml(FILTER_DEFS[id].label)}</span>
    </button>
  `).join("");
}

document.getElementById("filter-add-list")?.addEventListener("click", (e) => {
  const row = e.target.closest(".filter-add-row");
  if (!row) return;
  e.stopPropagation();
  const id = row.dataset.filter;
  if (activeFilterId === id) { closeFilterPopover(); return; }
  openFilterPopover(id, row);
});

// Delegated handlers for the inline filter chips.
document.getElementById("analytics-filter-summary")?.addEventListener("click", (e) => {
  const x = e.target.closest('[data-act="clear-filter"]');
  const chip = e.target.closest(".filter-chip");
  if (!chip) return;
  const id = chip.dataset.filter;
  if (x) {
    e.stopPropagation();
    filterStates[id] = { mode: "include", selected: null };
    // If the popover for THIS filter is currently open, close it too —
    // otherwise the chip disappears but the floating list stays open with
    // no anchor / no obvious way to dismiss it.
    if (activeFilterId === id) closeFilterPopover();
    refreshFilterTriggers();
    if (typeof rerenderActiveAnalyticsView === "function") rerenderActiveAnalyticsView();
    return;
  }
  e.stopPropagation();
  if (activeFilterId === id) { closeFilterPopover(); return; }
  openFilterPopover(id, chip);
});

// Initial trigger summaries (run once on load and on populate)
function populateAnalyticsFilters() {
  // Touch options to apply default selection on first open: empty selected
  // means "all". Auto-select the current year for date-range so charts open
  // with this year by default.
  const dateState = filterStates["date-range"];
  if (dateState && dateState.selected === null) {
    const years = FILTER_DEFS["date-range"].getOptions();
    dateState.selected = new Set(years);
  }
  refreshFilterTriggers();
}

analyticsFiltersBtn?.addEventListener("click", () => {
  if (!analyticsFiltersPanel) return;
  const willShow = analyticsFiltersPanel.hidden;
  if (willShow) populateAnalyticsFilters();
  analyticsFiltersPanel.hidden = !willShow;
  analyticsFiltersBtn.classList.toggle("active", willShow);
  if (!willShow) closeFilterPopover();
});

// Click outside the panel closes it (popover handled separately)
document.addEventListener("click", e => {
  if (!analyticsFiltersPanel || analyticsFiltersPanel.hidden) return;
  if (analyticsFiltersPanel.contains(e.target)) return;
  if (analyticsFiltersBtn && analyticsFiltersBtn.contains(e.target)) return;
  const popover = document.getElementById("filter-popover");
  if (popover && !popover.hidden && popover.contains(e.target)) return;
  analyticsFiltersPanel.hidden = true;
  analyticsFiltersBtn?.classList.remove("active");
  closeFilterPopover();
});

document.getElementById("btn-analytics-clear-filters")?.addEventListener("click", () => {
  Object.keys(FILTER_DEFS).forEach(k => {
    filterStates[k] = { mode: "include", selected: null };
  });
  refreshFilterTriggers();
  rerenderActiveAnalyticsView();
});

// ===== Filter Presets =====
// Each preset captures the active analytics view + the entire filterStates
// snapshot, so applying a preset puts the user back in the same configuration.
function ensurePresetsArray() {
  if (!Array.isArray(state.filterPresets)) state.filterPresets = [];
}
function serializeFilterStates() {
  const out = {};
  Object.keys(filterStates).forEach(k => {
    const s = filterStates[k];
    out[k] = {
      mode: s.mode,
      selected: s.selected ? [...s.selected] : null,
    };
  });
  return out;
}

// Capture every analytics-view's slide-switch / chart-mode state so a preset
// restores you to the exact configuration you saved.
function serializeViewModes() {
  return {
    jobsViewMode:        typeof jobsViewMode        !== "undefined" ? jobsViewMode        : "gross",
    cashFlowMode:        typeof cashFlowMode        !== "undefined" ? cashFlowMode        : "flow",
    byCatChartMode:      typeof byCatChartMode      !== "undefined" ? byCatChartMode      : "donut",
    byCatTypeMode:       typeof byCatTypeMode       !== "undefined" ? byCatTypeMode       : "spending",
    byCatAmountMode:     typeof byCatAmountMode     !== "undefined" ? byCatAmountMode     : "gross",
    spendingTrendsMode:  typeof spendingTrendsMode  !== "undefined" ? spendingTrendsMode  : "stacked",
    trendMode:           typeof trendMode           !== "undefined" ? trendMode           : "year",
    trendAmountMode:     typeof trendAmountMode     !== "undefined" ? trendAmountMode     : "net",
    breakdownTypeMode:   typeof breakdownTypeMode   !== "undefined" ? breakdownTypeMode   : "income",
  };
}

// Generic helper: update a `.mode-switch` wrap's data-mode + active classes.
function syncModeSwitchUI(wrapId, mode) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap.dataset.mode = mode;
  wrap.querySelectorAll(".mode-switch-option").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
}

function applyViewModes(modes) {
  if (!modes) return;
  if (modes.jobsViewMode !== undefined)       jobsViewMode       = modes.jobsViewMode;
  if (modes.cashFlowMode !== undefined)       cashFlowMode       = modes.cashFlowMode;
  if (modes.byCatChartMode !== undefined)     byCatChartMode     = modes.byCatChartMode;
  if (modes.byCatTypeMode !== undefined)      byCatTypeMode      = modes.byCatTypeMode;
  if (modes.byCatAmountMode !== undefined)    byCatAmountMode    = modes.byCatAmountMode;
  if (modes.spendingTrendsMode !== undefined) spendingTrendsMode = modes.spendingTrendsMode;
  if (modes.trendMode !== undefined)          trendMode          = modes.trendMode;
  if (modes.trendAmountMode !== undefined)    trendAmountMode    = modes.trendAmountMode;
  if (modes.breakdownTypeMode !== undefined)  breakdownTypeMode  = modes.breakdownTypeMode;

  // Mirror the new modes onto the DOM controls
  syncModeSwitchUI("cf-mode",               cashFlowMode);
  syncModeSwitchUI("bcat-chart-switch",     byCatChartMode);
  syncModeSwitchUI("bcat-type-switch",      byCatTypeMode);
  syncModeSwitchUI("bcat-amount-switch",    byCatAmountMode);
  syncModeSwitchUI("st-mode",               spendingTrendsMode);
  syncModeSwitchUI("trend-mode-pills",      trendMode);
  syncModeSwitchUI("trend-amount-pills",    trendAmountMode);
  syncModeSwitchUI("breakdown-type-switch", breakdownTypeMode);

  // jobs-mode-toggle uses .year-pill instead of .mode-switch-option
  document.querySelectorAll("#jobs-mode-toggle .year-pill").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === jobsViewMode);
  });

  // Keep By Category's Gross/Net switch enabled-state in sync with Spending/Income
  if (typeof syncBcatAmountSwitchEnabled === "function") syncBcatAmountSwitchEnabled();
}
function applyFilterStatesSnapshot(snap) {
  if (!snap) return;
  Object.keys(FILTER_DEFS).forEach(k => {
    const src = snap[k];
    if (!src) {
      filterStates[k] = { mode: "include", selected: null };
    } else {
      filterStates[k] = {
        mode: src.mode === "exclude" ? "exclude" : "include",
        selected: src.selected ? new Set(src.selected) : null,
      };
    }
  });
}
function presetSummaryLine(preset) {
  // E.g. "Breakdown · Last 6 Months" — pick the most informative filter.
  const viewLabels = {
    "by-category": "By Job",
    "cash-flow":   "Cash Flow",
    "trends":      "By Category",
    "spending-trends": "Trends",
    "flow":        "Flow",
    "vs-expense":  "vs Expense",
    "breakdown":   "Breakdown",
  };
  const viewLabel = viewLabels[preset.view] || preset.view;
  const dr = preset.filters && preset.filters["date-range"];
  let dateLabel = "All Years";
  if (dr && dr.selected && dr.selected.length) {
    const allOpts = FILTER_DEFS["date-range"].getOptions();
    if (dr.mode === "include") {
      dateLabel = dr.selected.length === allOpts.length ? "All Years"
                : dr.selected.length === 1 ? dr.selected[0]
                : `${dr.selected.length} years`;
    } else {
      dateLabel = `Excludes ${dr.selected.length}`;
    }
  }
  return `${viewLabel} · ${dateLabel}`;
}
function makePresetId() { return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

let activePresetId = null;
function setActivePreset(id) {
  activePresetId = id;
  const chip = document.getElementById("btn-active-preset-chip");
  const nameEl = document.getElementById("active-preset-name");
  if (!chip || !nameEl) return;
  if (!id) { chip.hidden = true; return; }
  ensurePresetsArray();
  const p = state.filterPresets.find(x => x.id === id);
  if (!p) { chip.hidden = true; activePresetId = null; return; }
  nameEl.textContent = p.name;
  chip.hidden = false;
}
document.getElementById("btn-active-preset-chip")?.addEventListener("click", () => {
  // Click on chip → clear active preset (filters stay as-is).
  setActivePreset(null);
});

function applyPreset(p) {
  if (!p) return;
  applyFilterStatesSnapshot(p.filters);
  applyViewModes(p.viewModes);  // restore slide-switch positions before activating the view
  refreshFilterTriggers();
  if (p.view && typeof activateAnalyticsView === "function") {
    activateAnalyticsView(p.view);
  } else {
    rerenderActiveAnalyticsView();
  }
  setActivePreset(p.id);
}

const presetsBtn     = document.getElementById("btn-analytics-presets");
const presetsPopover = document.getElementById("presets-popover");
const presetsSearch  = document.getElementById("presets-search");
const presetsList    = document.getElementById("presets-list");
const presetsFavList = document.getElementById("presets-favorites-list");
const presetsFavTitle= document.getElementById("presets-favorites-title");
// Reparent under <body> for the same reason — keeps the bottom-sheet free of
// any clipping ancestor.
if (presetsPopover && presetsPopover.parentElement !== document.body) {
  document.body.appendChild(presetsPopover);
}

function renderPresetsList() {
  ensurePresetsArray();
  const q = (presetsSearch?.value || "").toLowerCase().trim();
  const all = state.filterPresets.filter(p => !q || p.name.toLowerCase().includes(q));
  const favs = all.filter(p => p.isFavorite);
  const rest = all.filter(p => !p.isFavorite);

  const renderRow = p => `
    <li class="preset-row${p.id === activePresetId ? " is-active" : ""}" data-id="${escapeHtml(p.id)}">
      <div class="preset-row-info">
        <div class="preset-row-name">${escapeHtml(p.name)}</div>
        <div class="preset-row-sub">${escapeHtml(presetSummaryLine(p))}</div>
      </div>
      <button type="button" class="preset-row-btn${p.isFavorite ? " is-favorite" : ""}" data-act="fav" title="Favorite">
        <svg viewBox="0 0 24 24" fill="${p.isFavorite ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      <button type="button" class="preset-row-btn" data-act="edit" title="Rename">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button type="button" class="preset-row-btn" data-act="delete" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
    </li>
  `;

  if (presetsFavList && presetsFavTitle) {
    presetsFavTitle.hidden = favs.length === 0;
    presetsFavList.innerHTML = favs.length ? favs.map(renderRow).join("") : "";
  }
  if (presetsList) {
    presetsList.innerHTML = rest.length
      ? rest.map(renderRow).join("")
      : `<li class="presets-empty">${q ? "No matches." : "No presets yet — click \"Save current filters\" below."}</li>`;
  }
}

function openPresetsPopover() {
  if (!presetsPopover) return;
  renderPresetsList();
  presetsPopover.hidden = false;
  // Anchor under the Presets button (viewport-relative since popover is
  // position:fixed under <body>).
  const a = presetsBtn.getBoundingClientRect();
  presetsPopover.style.left = a.left + "px";
  presetsPopover.style.top  = (a.bottom + 4) + "px";
}
function closePresetsPopover() {
  if (presetsPopover) presetsPopover.hidden = true;
}

presetsBtn?.addEventListener("click", e => {
  e.stopPropagation();
  if (presetsPopover.hidden) openPresetsPopover();
  else closePresetsPopover();
});
document.addEventListener("click", e => {
  if (!presetsPopover || presetsPopover.hidden) return;
  if (presetsPopover.contains(e.target)) return;
  if (presetsBtn && presetsBtn.contains(e.target)) return;
  closePresetsPopover();
});

presetsSearch?.addEventListener("input", renderPresetsList);

// Click on preset row → apply; on action buttons → fav/edit/delete
function handlePresetRowClick(e) {
  const row = e.target.closest(".preset-row");
  if (!row) return;
  const id = row.dataset.id;
  ensurePresetsArray();
  const p = state.filterPresets.find(x => x.id === id);
  if (!p) return;
  const actBtn = e.target.closest("[data-act]");
  if (actBtn) {
    e.stopPropagation();
    const act = actBtn.dataset.act;
    if (act === "fav") {
      p.isFavorite = !p.isFavorite;
      saveState();
      renderPresetsList();
    } else if (act === "edit") {
      openPresetModal(p);
    } else if (act === "delete") {
      if (confirm(`Delete preset "${p.name}"?`)) {
        state.filterPresets = state.filterPresets.filter(x => x.id !== id);
        if (activePresetId === id) setActivePreset(null);
        saveState();
        renderPresetsList();
      }
    }
    return;
  }
  applyPreset(p);
  closePresetsPopover();
}
presetsList?.addEventListener("click", handlePresetRowClick);
presetsFavList?.addEventListener("click", handlePresetRowClick);

// Save modal
const presetModal      = document.getElementById("preset-modal");
const presetNameInput  = document.getElementById("preset-name-input");
const presetSummaryUl  = document.getElementById("preset-modal-summary-list");
const presetModalTitle = document.getElementById("preset-modal-title");
let presetModalEditingId = null;

function activeViewName() {
  return document.querySelector(".analytics-view.active")?.dataset.view || "by-category";
}
function buildPresetSummaryRows() {
  const viewLabels = {
    "by-category": "By Job",
    "cash-flow":   "Cash Flow",
    "trends":      "By Category",
    "spending-trends": "Trends",
    "flow":        "Flow",
    "vs-expense":  "vs Expense",
    "breakdown":   "Breakdown",
  };
  const rows = [
    { key: "View", val: viewLabels[activeViewName()] || activeViewName() },
  ];
  Object.keys(FILTER_DEFS).forEach(k => rows.push({ key: FILTER_DEFS[k].label, val: summarizeFilter(k) }));
  return rows;
}
function renderPresetModalSummary() {
  if (!presetSummaryUl) return;
  presetSummaryUl.innerHTML = buildPresetSummaryRows().map(r => `
    <li><span class="preset-summary-key">${escapeHtml(r.key)}</span><span class="preset-summary-val">${escapeHtml(r.val)}</span></li>
  `).join("");
}
function openPresetModal(editing) {
  if (!presetModal) return;
  presetModalEditingId = editing ? editing.id : null;
  presetModalTitle.textContent = editing ? "Update Filter Preset" : "Save Filter Preset";
  presetNameInput.value = editing ? editing.name : "";
  renderPresetModalSummary();
  presetModal.classList.remove("hidden");
  closePresetsPopover();
  setTimeout(() => presetNameInput.focus(), 0);
}
function closePresetModal() {
  presetModal?.classList.add("hidden");
  presetModalEditingId = null;
}
document.getElementById("btn-preset-modal-close")?.addEventListener("click", closePresetModal);
document.getElementById("btn-preset-cancel")?.addEventListener("click", closePresetModal);
presetModal?.addEventListener("click", e => { if (e.target === presetModal) closePresetModal(); });

document.getElementById("btn-save-current-preset")?.addEventListener("click", () => openPresetModal(null));

document.getElementById("btn-preset-save")?.addEventListener("click", () => {
  const name = (presetNameInput.value || "").trim();
  if (!name) { alert("Please give this preset a name."); return; }
  ensurePresetsArray();
  if (presetModalEditingId) {
    // Update name + capture current filters + slide-switch positions
    const p = state.filterPresets.find(x => x.id === presetModalEditingId);
    if (p) {
      p.name = name;
      p.view = activeViewName();
      p.filters = serializeFilterStates();
      p.viewModes = serializeViewModes();
    }
  } else {
    state.filterPresets.push({
      id: makePresetId(),
      name,
      isFavorite: false,
      view: activeViewName(),
      filters: serializeFilterStates(),
      viewModes: serializeViewModes(),
    });
  }
  saveState();
  closePresetModal();
});

presetNameInput?.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("btn-preset-save").click(); }
  else if (e.key === "Escape") closePresetModal();
});

function rerenderActiveAnalyticsView() {
  const activeView = document.querySelector(".analytics-view.active")?.dataset.view;
  if (activeView === "cash-flow")  renderCashFlow();
  if (activeView === "by-category") renderJobs();
  if (activeView === "trends")     renderByCategory();
  if (activeView === "flow")       renderTrends();
  if (activeView === "breakdown")  renderBreakdown();
  if (activeView === "vs-expense") renderVsExpense();
  if (activeView === "spending-trends") renderSpendingTrends();
  if (activeView === "savings-rate")    renderSavingsRate();
  if (activeView === "savings")         renderSavings();
  if (activeView === "year-matrix")     renderYearMatrix();
}

// ===== Multi-select popover =====
let activeFilterId = null;
const filterPopover    = document.getElementById("filter-popover");
const filterPopList    = document.getElementById("filter-popover-list");
const filterPopSearch  = document.getElementById("filter-popover-search");
const filterPopTitle   = document.getElementById("filter-popover-title");
// Detach the popover from its in-panel parent and reparent under <body> so it
// never gets clipped by an ancestor's overflow / stacking-context.
if (filterPopover && filterPopover.parentElement !== document.body) {
  document.body.appendChild(filterPopover);
}

function openFilterPopover(filterId, anchorEl) {
  if (!filterPopover) return;
  activeFilterId = filterId;
  const def = FILTER_DEFS[filterId];
  if (!def) return;
  filterPopTitle.textContent = def.label;
  const s = filterStates[filterId];
  if (s.selected === null) s.selected = new Set(def.getOptions());
  filterPopover.querySelectorAll(".filter-mode-tabs button").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === s.mode);
  });
  filterPopSearch.value = "";
  renderFilterPopList();
  filterPopover.hidden = false;
  positionFilterPopover(anchorEl);
}

function positionFilterPopover(anchorEl) {
  if (!filterPopover || !anchorEl) return;
  // Popover is a child of <body> with position:fixed; anchor directly to the
  // trigger's viewport-relative rect.
  const a = anchorEl.getBoundingClientRect();
  const vpW = window.innerWidth;
  // Pick a width that fits in the viewport with an 8px gutter on each side.
  const desiredW = Math.max(220, a.width);
  const w = Math.min(desiredW, vpW - 16);
  // Anchor at the trigger's left edge, then clamp so the right edge stays
  // 8px inside the viewport (and the left edge stays 8px inside as well).
  let left = a.left;
  if (left + w + 8 > vpW) left = vpW - w - 8;
  if (left < 8) left = 8;
  filterPopover.style.left  = left + "px";
  filterPopover.style.top   = (a.bottom + 4) + "px";
  filterPopover.style.width = w + "px";
}

function closeFilterPopover() {
  if (filterPopover) filterPopover.hidden = true;
  activeFilterId = null;
}

function renderFilterPopList() {
  if (!activeFilterId || !filterPopList) return;
  const def = FILTER_DEFS[activeFilterId];
  const s = filterStates[activeFilterId];
  const q = (filterPopSearch.value || "").toLowerCase().trim();
  const allOpts = def.getOptions();
  const opts = allOpts.filter(v => !q || v.toLowerCase().includes(q));
  // Synthetic "All" row — checked when every option is selected. Clicking it
  // toggles between every-selected and none-selected. Hidden while searching
  // since "All" wouldn't be meaningful in a filtered list.
  const allChecked = s.selected.size === allOpts.length && allOpts.length > 0;
  const allRow = q ? "" : `
    <li class="filter-option-row filter-option-all${allChecked ? " is-checked" : ""}" data-val="__ALL__">
      <span class="filter-option-label"><strong>All</strong></span>
      <span class="filter-check"></span>
    </li>
  `;
  filterPopList.innerHTML = allRow + opts.map(v => `
    <li class="filter-option-row${s.selected.has(v) ? " is-checked" : ""}" data-val="${escapeHtml(v)}">
      <span class="filter-option-label">${escapeHtml(v)}</span>
      <span class="filter-check"></span>
    </li>
  `).join("");
}

filterPopList?.addEventListener("click", e => {
  const row = e.target.closest(".filter-option-row");
  if (!row || !activeFilterId) return;
  // Keep the popover open after each pick — re-rendering the list detaches
  // the clicked row from the DOM, so the document-level outside-click handler
  // would otherwise see e.target as "outside" and close the whole panel.
  e.stopPropagation();
  const val = row.dataset.val;
  const s = filterStates[activeFilterId];
  const allOpts = FILTER_DEFS[activeFilterId].getOptions();
  if (val === "__ALL__") {
    const allChecked = s.selected.size === allOpts.length && allOpts.length > 0;
    s.selected = allChecked ? new Set() : new Set(allOpts);
    renderFilterPopList();
  } else {
    if (s.selected.has(val)) s.selected.delete(val);
    else s.selected.add(val);
    row.classList.toggle("is-checked", s.selected.has(val));
    // Re-render to keep the "All" row in sync.
    renderFilterPopList();
  }
  refreshFilterTriggers();
  rerenderActiveAnalyticsView();
});

filterPopSearch?.addEventListener("input", renderFilterPopList);

filterPopover?.querySelectorAll("[data-act]").forEach(btn => {
  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (!activeFilterId) return;
    const s = filterStates[activeFilterId];
    if (btn.dataset.act === "all") s.selected = new Set(FILTER_DEFS[activeFilterId].getOptions());
    else s.selected = new Set();
    renderFilterPopList();
    refreshFilterTriggers();
    rerenderActiveAnalyticsView();
  });
});

filterPopover?.querySelectorAll(".filter-mode-tabs button").forEach(btn => {
  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (!activeFilterId) return;
    filterPopover.querySelectorAll(".filter-mode-tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filterStates[activeFilterId].mode = btn.dataset.mode;
    refreshFilterTriggers();
    rerenderActiveAnalyticsView();
  });
});

// Wire each .filter-trigger to open the popover
document.querySelectorAll(".filter-trigger").forEach(btn => {
  btn.addEventListener("click", e => {
    e.stopPropagation();
    const id = btn.dataset.filter;
    if (activeFilterId === id) { closeFilterPopover(); return; }
    openFilterPopover(id, btn);
  });
});

// --------- Income vs Expense table ---------
// Set of currently-expanded customer rows on the vs Expense table. Persists
// across re-renders so toggling one row doesn't collapse others.
const vsExpenseExpanded = new Set();
function renderVsExpense() {
  const tableEl = document.getElementById("vs-expense-table");
  if (!tableEl) return;

  const months = selectedMonths();  // [{ key:"YYYY-MM", label:"Apr 26", date }]
  const monthKeySet = new Set(months.map(m => m.key));

  const txs = state.transactions.filter(t => {
    if (NON_JOB_CATEGORIES.includes(t.category)) return false;
    const ymKey = (t.date || "").slice(0, 7);
    if (!monthKeySet.has(ymKey)) return false;
    if (!filterPasses("date-range", (t.date || "").slice(0, 4))) return false;
    if (!filterPasses("customer",   t.customer || "")) return false;
    if (!filterPassesCategory(t.category)) return false;
    if (!filterPasses("payees",     t.payee || "")) return false;
    return true;
  });

  // Income rows keyed by Customer (with fallback to Payee). For each customer
  // we also keep a per-category breakdown so the row can drill down on click.
  const incomeRows = new Map();
  const expenseRows = new Map();
  txs.forEach(t => {
    const ymKey = (t.date || "").slice(0, 7);
    if (t.type === "income") {
      const key = (t.customer || t.payee || "Unspecified").trim() || "Unspecified";
      let row = incomeRows.get(key);
      if (!row) {
        row = { name: key, perMonth: new Map(), total: 0, byCategory: new Map() };
        incomeRows.set(key, row);
      }
      row.perMonth.set(ymKey, (row.perMonth.get(ymKey) || 0) + t.amount);
      row.total += t.amount;
      const cat = t.category || "Uncategorized";
      let sub = row.byCategory.get(cat);
      if (!sub) {
        sub = { name: cat, perMonth: new Map(), total: 0 };
        row.byCategory.set(cat, sub);
      }
      sub.perMonth.set(ymKey, (sub.perMonth.get(ymKey) || 0) + t.amount);
      sub.total += t.amount;
    } else if (t.type === "expense") {
      const key = t.category || "Uncategorized";
      let row = expenseRows.get(key);
      if (!row) {
        row = { name: key, perMonth: new Map(), total: 0 };
        expenseRows.set(key, row);
      }
      row.perMonth.set(ymKey, (row.perMonth.get(ymKey) || 0) + t.amount);
      row.total += t.amount;
    }
  });

  // Sort rows by total descending.
  const incomeArr  = [...incomeRows.values()].sort((a, b) => b.total - a.total);
  const expenseArr = [...expenseRows.values()].sort((a, b) => b.total - a.total);

  // Per-month income / expense totals (used in the summary rows).
  const monthsInc = months.map(m => incomeArr.reduce((s, r) => s + (r.perMonth.get(m.key) || 0), 0));
  const monthsExp = months.map(m => expenseArr.reduce((s, r) => s + (r.perMonth.get(m.key) || 0), 0));
  const totalIn   = monthsInc.reduce((s, v) => s + v, 0);
  const totalOut  = monthsExp.reduce((s, v) => s + v, 0);

  const monthCount = months.length || 1;
  const fmtCell = (v, signed) => {
    if (!v) return `<td class="vs-zero">—</td>`;
    const cls = signed === "expense" ? "vs-amt expense" : "vs-amt income";
    const text = signed === "expense" ? "-" + fmtMoney(v) : fmtMoney(v);
    return `<td class="${cls}">${text}</td>`;
  };

  // Build rows. Each customer is clickable — clicking expands its category
  // breakdown beneath. Expansion state persists in vsExpenseExpanded across
  // re-renders so toggling a single row doesn't collapse the others.
  const incomeRowsHtml = incomeArr.map(r => {
    const expanded = vsExpenseExpanded.has(r.name);
    const subCount = r.byCategory ? r.byCategory.size : 0;
    const canExpand = subCount > 0;
    const chev = canExpand
      ? `<svg class="vs-chev${expanded ? " open" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`
      : `<span class="vs-chev-spacer"></span>`;
    const head = `
      <tr class="vs-customer-row${canExpand ? " is-clickable" : ""}${expanded ? " is-expanded" : ""}" data-customer="${escapeHtml(r.name)}">
        <td><span class="vs-name-cell">${chev}${escapeHtml(r.name)}</span></td>
        ${months.map(m => fmtCell(r.perMonth.get(m.key) || 0, "income")).join("")}
        <td class="vs-amt income">${fmtMoney(r.total / monthCount)}</td>
        <td class="vs-amt income">${fmtMoney(r.total)}</td>
      </tr>
    `;
    if (!expanded || !canExpand) return head;
    const subs = [...r.byCategory.values()].sort((a, b) => b.total - a.total);
    const subHtml = subs.map(s => `
      <tr class="vs-sub-row">
        <td><span class="vs-sub-name">${escapeHtml(s.name)}</span></td>
        ${months.map(m => fmtCell(s.perMonth.get(m.key) || 0, "income")).join("")}
        <td class="vs-amt income">${fmtMoney(s.total / monthCount)}</td>
        <td class="vs-amt income">${fmtMoney(s.total)}</td>
      </tr>
    `).join("");
    return head + subHtml;
  }).join("");

  const totalIncomeRow = `
    <tr class="vs-total-row">
      <td>Total Income</td>
      ${monthsInc.map(v => v ? `<td class="vs-amt income">${fmtMoney(v)}</td>` : `<td class="vs-amt income">${fmtMoney(0)}</td>`).join("")}
      <td class="vs-amt income">${fmtMoney(totalIn / monthCount)}</td>
      <td class="vs-amt income">${fmtMoney(totalIn)}</td>
    </tr>
  `;

  const expensesHeader = `
    <tr class="vs-section-row">
      <td colspan="${months.length + 3}">EXPENSES</td>
    </tr>
  `;

  const expenseRowsHtml = expenseArr.map(r => `
    <tr>
      <td>${escapeHtml(r.name)}</td>
      ${months.map(m => fmtCell(r.perMonth.get(m.key) || 0, "expense")).join("")}
      <td class="vs-amt expense">-${fmtMoney(r.total / monthCount)}</td>
      <td class="vs-amt expense">-${fmtMoney(r.total)}</td>
    </tr>
  `).join("");

  const totalExpenseRow = `
    <tr class="vs-total-row">
      <td>Total Expenses</td>
      ${monthsExp.map(v => v ? `<td class="vs-amt expense">-${fmtMoney(v)}</td>` : `<td class="vs-amt expense">-${fmtMoney(0)}</td>`).join("")}
      <td class="vs-amt expense">-${fmtMoney(totalOut / monthCount)}</td>
      <td class="vs-amt expense">-${fmtMoney(totalOut)}</td>
    </tr>
  `;

  const netRow = `
    <tr class="vs-total-row">
      <td>Net</td>
      ${months.map((m, i) => {
        const v = (monthsInc[i] || 0) - (monthsExp[i] || 0);
        const cls = v >= 0 ? "income" : "expense";
        const text = (v >= 0 ? "" : "-") + fmtMoney(Math.abs(v));
        return `<td class="vs-amt ${cls}">${text}</td>`;
      }).join("")}
      <td class="vs-amt ${(totalIn - totalOut) >= 0 ? "income" : "expense"}">${(totalIn - totalOut) >= 0 ? "" : "-"}${fmtMoney(Math.abs((totalIn - totalOut) / monthCount))}</td>
      <td class="vs-amt ${(totalIn - totalOut) >= 0 ? "income" : "expense"}">${(totalIn - totalOut) >= 0 ? "" : "-"}${fmtMoney(Math.abs(totalIn - totalOut))}</td>
    </tr>
  `;

  tableEl.innerHTML = `
    <thead>
      <tr>
        <th>Name</th>
        ${months.map(m => `<th>${escapeHtml(m.label)}</th>`).join("")}
        <th>Average</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${incomeRowsHtml || `<tr><td colspan="${months.length + 3}" style="color:var(--muted)">No income for the selected filters.</td></tr>`}
      ${totalIncomeRow}
      ${expensesHeader}
      ${expenseRowsHtml || `<tr><td colspan="${months.length + 3}" style="color:var(--muted)">No expenses for the selected filters.</td></tr>`}
      ${totalExpenseRow}
      ${netRow}
    </tbody>
  `;

  // Cache last-rendered data for export
  vsExpenseLastData = { months, incomeArr, expenseArr, monthsInc, monthsExp, totalIn, totalOut };

  // Wire customer-row drill-down toggles
  tableEl.querySelectorAll(".vs-customer-row.is-clickable").forEach(tr => {
    tr.addEventListener("click", () => {
      const name = tr.dataset.customer;
      if (!name) return;
      if (vsExpenseExpanded.has(name)) vsExpenseExpanded.delete(name);
      else vsExpenseExpanded.add(name);
      renderVsExpense();
    });
  });
}

let vsExpenseLastData = null;
document.getElementById("btn-vs-expense-export")?.addEventListener("click", () => {
  if (!vsExpenseLastData) renderVsExpense();
  const d = vsExpenseLastData;
  if (!d) return;
  const rows = [];
  rows.push(["Name", ...d.months.map(m => m.label), "Average", "Total"]);
  d.incomeArr.forEach(r => {
    rows.push([r.name, ...d.months.map(m => (r.perMonth.get(m.key) || 0).toFixed(2)),
              (r.total / d.months.length).toFixed(2), r.total.toFixed(2)]);
  });
  rows.push(["Total Income", ...d.monthsInc.map(v => v.toFixed(2)),
             (d.totalIn / d.months.length).toFixed(2), d.totalIn.toFixed(2)]);
  rows.push([]);
  rows.push(["EXPENSES"]);
  d.expenseArr.forEach(r => {
    rows.push([r.name, ...d.months.map(m => (-(r.perMonth.get(m.key) || 0)).toFixed(2)),
              (-r.total / d.months.length).toFixed(2), (-r.total).toFixed(2)]);
  });
  rows.push(["Total Expenses", ...d.monthsExp.map(v => (-v).toFixed(2)),
             (-d.totalOut / d.months.length).toFixed(2), (-d.totalOut).toFixed(2)]);
  const csv = rows.map(r => r.map(c => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `income-vs-expense-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// --------- Spending Trends (stacked bars / lines) view ---------
let spendingTrendsMode = "stacked"; // "stacked" | "lines"

// --------- Savings Rate (Analytics) ---------
document.getElementById("sr-deduct-toggle")?.addEventListener("click", () => {
  const btn = document.getElementById("sr-deduct-toggle");
  const body = document.getElementById("sr-deduct-body");
  if (!btn || !body) return;
  const open = body.hidden;
  body.hidden = !open;
  btn.classList.toggle("is-open", open);
});

function renderSavingsRate() {
  const chartEl = document.getElementById("sr-chart");
  if (!chartEl) return;

  // Limit to ONE year (same rules as Cash Flow / Spending Trends).
  const srSel = selectedYears();
  let srYear;
  if (srSel && srSel.length) {
    srYear = [...srSel].sort()[srSel.length - 1];
  } else {
    const thisYear = String(new Date().getFullYear());
    const txYears = new Set();
    state.transactions.forEach(t => {
      const y = (t.date || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) txYears.add(y);
    });
    srYear = txYears.has(thisYear)
      ? thisYear
      : ([...txYears].sort().pop() || thisYear);
  }
  const months = selectedMonths().filter(m => m.key.startsWith(srYear));
  const monthKeys = months.map(m => m.key);
  const monthIdx = new Map(monthKeys.map((k, i) => [k, i]));

  // Per-month aggregates:
  //   inc      = gross income (all income txs)
  //   jobExp   = expenses tagged with a Job category (JOB_ORDER)
  //   cogs     = expenses with category "Cost of Goods"
  //   otherExp = every other expense (excluding savings)
  //   sav      = expenses in SAVINGS_CATEGORIES
  const inc      = new Array(monthKeys.length).fill(0);
  const jobExp   = new Array(monthKeys.length).fill(0);
  const cogs     = new Array(monthKeys.length).fill(0);
  const otherExp = new Array(monthKeys.length).fill(0);
  const sav      = new Array(monthKeys.length).fill(0);
  const savByCat = new Map();
  const deductTxs = []; // every tx that contributes to JOB EXP + COGS
  state.transactions.forEach(t => {
    if (NON_JOB_CATEGORIES.includes(t.category)) return;
    if (!filterPasses("date-range", (t.date || "").slice(0, 4))) return;
    if (!filterPasses("customer", t.customer || "")) return;
    if (!filterPassesCategory(t.category)) return;
    if (!filterPasses("payees", t.payee || "")) return;
    const ymKey = (t.date || "").slice(0, 7);
    const mi = monthIdx.get(ymKey);
    if (mi === undefined) return;
    const amt = t.amount || 0;
    if (t.type === "income") {
      inc[mi] += amt;
    } else {
      const cat = t.category || "";
      const ei  = (t.expenseIncome || "").trim();
      // Treat as savings if EITHER the legacy category OR the new-spec
      // expense field flags it. Lets users tag "Savings" via Expense Table
      // mappings without having to also rename the category.
      const isSavings = SAVINGS_CATEGORIES.includes(cat) || SAVINGS_CATEGORIES.includes(ei);
      if (isSavings) {
        sav[mi] += amt;
        const label = SAVINGS_CATEGORIES.includes(cat) ? cat : ei;
        savByCat.set(label, (savByCat.get(label) || 0) + amt);
      } else if (JOB_ORDER.includes(cat)) {
        jobExp[mi] += amt;
        deductTxs.push({ ...t, _bucket: "Job Expense" });
      } else if (cat === "Cost of Goods") {
        cogs[mi] += amt;
        deductTxs.push({ ...t, _bucket: "Cost of Goods" });
      } else {
        otherExp[mi] += amt;
      }
    }
  });

  const totalInc      = inc.reduce((s, v) => s + v, 0);
  const totalJobExp   = jobExp.reduce((s, v) => s + v, 0);
  const totalCogs     = cogs.reduce((s, v) => s + v, 0);
  const totalOtherExp = otherExp.reduce((s, v) => s + v, 0);
  const totalSav      = sav.reduce((s, v) => s + v, 0);

  // Savings Rate = Savings / (Gross Profit - Job Expenses - Cost of Goods)
  const denom = totalInc - totalJobExp - totalCogs;
  const rate = denom > 0 ? (totalSav / denom) * 100 : 0;

  // Mirror the Savings view header: include the picked year alongside the
  // eyebrow label so the user sees "Savings Rate — 2025" at a glance.
  const srEyebrow = document.getElementById("sr-eyebrow");
  if (srEyebrow) srEyebrow.textContent = `Savings Rate — ${srYear}`;
  document.getElementById("sr-rate").textContent          = rate.toFixed(1) + "%";
  document.getElementById("sr-stat-income").textContent   = fmtMoney(totalInc);
  // "Total Expenses" tile shows job + cost-of-goods (the deductions that go
  // into the savings-rate denominator), so the math is visible at a glance.
  document.getElementById("sr-stat-expense").textContent  = fmtMoney(totalJobExp + totalCogs);
  const netEl = document.getElementById("sr-stat-net");
  netEl.textContent = fmtMoney(denom);
  netEl.classList.toggle("income",  denom >= 0);
  netEl.classList.toggle("expense", denom <  0);
  document.getElementById("sr-stat-saved").textContent    = fmtMoney(totalSav);
  document.getElementById("sr-sub").textContent =
    `Savings ÷ (Gross Profit − Job Expenses − Cost of Goods)`;

  // Per-category breakdown
  const catRows = [...savByCat.entries()].sort((a, b) => b[1] - a[1]);
  const listEl = document.getElementById("sr-cat-list");
  if (listEl) {
    if (!catRows.length) {
      listEl.innerHTML = `<li class="muted" style="grid-template-columns:1fr">No savings logged in this window.</li>`;
    } else {
      listEl.innerHTML = catRows.map(([cat, v], i) => `
        <li>
          <span class="sr-cat-dot" style="background:${DONUT_PALETTE[i % DONUT_PALETTE.length]}"></span>
          <span>${escapeHtml(cat)}</span>
          <span class="sr-cat-amount">${fmtMoney(v)}</span>
        </li>
      `).join("");
    }
  }

  // ---- Monthly savings rate bar chart ----
  if (!monthKeys.length) {
    chartEl.innerHTML = `<div class="empty" style="padding:24px;text-align:center;color:var(--muted)">No data for the selected filters.</div>`;
    return;
  }
  const monthlyRate = monthKeys.map((_, i) => {
    const d = inc[i] - jobExp[i] - cogs[i];
    return d > 0 ? (sav[i] / d) * 100 : 0;
  });

  const srIsMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  // Match Cash Flow's chart dimensions (800x380 viewBox) so all the analytics
  // chart cards render at the same height on mobile.
  const W = 800, H = 380;
  // On mobile we rotate month labels 45° to prevent overlap, so reserve more
  // bottom padding for them.
  const padL = 50, padR = 16, padT = 18, padB = srIsMobile ? 80 : 36;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const groupCount = monthKeys.length || 1;
  const slot = plotW / groupCount;
  const barW = Math.min(slot * 0.6, 56);

  // Y axis: 0 to max(50%, ceil(maxRate to next 10))
  const maxRate = Math.max(20, ...monthlyRate);
  const yTop = Math.ceil(maxRate / 10) * 10;
  const tickStep = yTop <= 50 ? 10 : 20;
  const yFor = v => padT + ((yTop - v) / yTop) * plotH;

  let grid = "", yLabels = "";
  for (let v = 0; v <= yTop + 0.001; v += tickStep) {
    const y = yFor(v);
    grid    += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4 4"/>`;
    yLabels += `<text class="sr-yaxis" x="${padL - 8}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="var(--muted)" font-size="11">${v}%</text>`;
  }

  let bars = "";
  monthKeys.forEach((k, i) => {
    const cx = padL + slot * (i + 0.5);
    const x  = cx - barW / 2;
    const r  = monthlyRate[i];
    const profitBase = inc[i] - jobExp[i] - cogs[i];
    // Months with savings but no profit base render as a faint capped bar at
    // the top of the chart — visually says "money was saved here even though
    // the percent metric is undefined" instead of dropping the month entirely.
    const ghost = sav[i] > 0 && profitBase <= 0;
    if (ghost) {
      const ghostTop = yFor(yTop); // full-height bar capped at yTop
      const ghostH   = Math.max(0, yFor(0) - ghostTop);
      bars += `<rect x="${x}" y="${ghostTop}" width="${barW}" height="${ghostH}" fill="var(--income)" opacity="0.18" stroke="var(--income)" stroke-dasharray="4 3" stroke-opacity="0.55" rx="3"><title>${escapeHtml(months[i].label)}: saved ${fmtMoney(sav[i])} (no profit base to compute a rate)</title></rect>`;
    } else {
      const top = yFor(r);
      const h   = Math.max(0, yFor(0) - top);
      bars += `<rect x="${x}" y="${top}" width="${barW}" height="${h}" fill="var(--income)" rx="3"><title>${escapeHtml(months[i].label)}: ${r.toFixed(1)}% (saved ${fmtMoney(sav[i])})</title></rect>`;
    }
    const label = months[i].label;
    const ly = H - padB + 16;
    bars += srIsMobile
      ? `<text class="sr-xaxis" x="${cx}" y="${ly}" text-anchor="start" transform="rotate(45 ${cx} ${ly})" fill="var(--muted)" font-size="10">${escapeHtml(label)}</text>`
      : `<text class="sr-xaxis" x="${cx}" y="${ly}" text-anchor="middle" fill="var(--muted)" font-size="10">${escapeHtml(label)}</text>`;
  });

  chartEl.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="max-height:380px">
      ${grid}
      ${yLabels}
      <line x1="${padL}" y1="${yFor(0)}" x2="${padL + plotW}" y2="${yFor(0)}" stroke="var(--border)" stroke-width="1"/>
      ${bars}
    </svg>
  `;

  // ---- Deduction list (Job Exp + COGS) ----
  const deductTotalEl = document.getElementById("sr-deduct-total");
  if (deductTotalEl) deductTotalEl.textContent = fmtMoney(totalJobExp + totalCogs);

  const deductBody = document.getElementById("sr-deduct-body");
  if (deductBody) {
    if (!deductTxs.length) {
      deductBody.innerHTML = `<div style="padding:14px;text-align:center;color:var(--muted);font-size:12px">No Job Expense or Cost of Goods transactions in this window.</div>`;
    } else {
      // Group by bucket, sort each by date desc, then by amount desc
      const groups = { "Job Expense": [], "Cost of Goods": [] };
      deductTxs.forEach(t => groups[t._bucket].push(t));
      Object.values(groups).forEach(arr =>
        arr.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.amount - a.amount))
      );
      const renderBucket = (name, arr, total) => {
        if (!arr.length) return "";
        return `
          <tr class="sr-deduct-section-row">
            <td colspan="4">${escapeHtml(name)} — ${arr.length} tx · ${fmtMoney(total)}</td>
          </tr>
          ${arr.map(t => `
            <tr>
              <td>${escapeHtml(fmtDate(t.date))}</td>
              <td>${escapeHtml(t.payee || "")}</td>
              <td>${escapeHtml(t.category || "")}</td>
              <td class="amt">${fmtMoney(t.amount)}</td>
            </tr>
          `).join("")}
        `;
      };
      deductBody.innerHTML = `
        <table class="sr-deduct-table">
          <thead>
            <tr><th>Date</th><th>Payee</th><th>Category</th><th class="amt">Amount</th></tr>
          </thead>
          <tbody>
            ${renderBucket("Job Expenses", groups["Job Expense"], totalJobExp)}
            ${renderBucket("Cost of Goods", groups["Cost of Goods"], totalCogs)}
          </tbody>
        </table>
      `;
    }
  }
}

// --------- Savings view ---------
// Monthly vertical bar chart of savings-category deposits for one year.
// Year selection follows the universal Date Range filter (most recent
// selected year, or current calendar year, or most recent year with data).
function renderSavings() {
  const chartEl   = document.getElementById("sv-chart");
  const totalEl   = document.getElementById("sv-total");
  const eyebrowEl = document.getElementById("sv-eyebrow");
  if (!chartEl || !totalEl) return;

  // Pick the year — same rules as Cash Flow / Spending Trends.
  const sel = selectedYears();
  let svYear;
  if (sel && sel.length) {
    svYear = [...sel].sort()[sel.length - 1];
  } else {
    const thisYear = String(new Date().getFullYear());
    const txYears = new Set();
    state.transactions.forEach(t => {
      const y = (t.date || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) txYears.add(y);
    });
    svYear = txYears.has(thisYear) ? thisYear : ([...txYears].sort().pop() || thisYear);
  }

  // Aggregate savings (SAVINGS_CATEGORIES) by month for the chosen year.
  // Treat both legacy category and the new-spec expense-table mapping as savings.
  const months = new Array(12).fill(0);
  const savingsTxs = []; // every contributing tx — used by the breakdown list
  state.transactions.forEach(t => {
    if (!filterPasses("date-range", (t.date || "").slice(0, 4))) return;
    if (!filterPasses("customer",   t.customer || "")) return;
    if (!filterPasses("payees",     t.payee || "")) return;
    const y = (t.date || "").slice(0, 4);
    if (y !== svYear) return;
    const cat = (t.category || "").trim();
    const ei  = (t.expenseIncome || "").trim();
    const isSavings = SAVINGS_CATEGORIES.includes(cat) || SAVINGS_CATEGORIES.includes(ei);
    if (!isSavings) return;
    // Savings are typically logged as expenses (money moved out to a savings
    // account). Count expense rows as positive deposits; income rows would be
    // a withdrawal — subtract.
    const m = parseInt((t.date || "").slice(5, 7), 10) - 1;
    if (m < 0 || m > 11) return;
    const amt = +t.amount || 0;
    months[m] += t.type === "income" ? -amt : amt;
    // Use the category label if it's a savings category, otherwise the
    // expense-table entry name. Bucket determines section header in the list.
    const bucket = (SAVINGS_CATEGORIES.includes(cat) ? cat : ei) || "Savings";
    savingsTxs.push({ ...t, _bucket: bucket });
  });

  const total = months.reduce((s, v) => s + v, 0);
  totalEl.textContent = fmtMoney(total);
  totalEl.style.color = total >= 0 ? "var(--income)" : "var(--expense)";
  if (eyebrowEl) eyebrowEl.textContent = `Savings — ${svYear}`;

  // ---- Year-over-year delta chip ----
  let prevYearTotal = 0;
  const prevYear = String(Number(svYear) - 1);
  state.transactions.forEach(t => {
    const y = (t.date || "").slice(0, 4);
    if (y !== prevYear) return;
    const cat = (t.category || "").trim();
    const ei  = (t.expenseIncome || "").trim();
    if (!(SAVINGS_CATEGORIES.includes(cat) || SAVINGS_CATEGORIES.includes(ei))) return;
    const amt = +t.amount || 0;
    prevYearTotal += t.type === "income" ? -amt : amt;
  });
  const yoyEl = document.getElementById("sv-yoy");
  if (yoyEl) {
    if (prevYearTotal > 0) {
      const pct = ((total - prevYearTotal) / Math.abs(prevYearTotal)) * 100;
      const up = pct >= 0;
      yoyEl.hidden = false;
      yoyEl.className = "sv-yoy " + (up ? "yoy-up" : "yoy-down");
      yoyEl.textContent = `${up ? "▲" : "▼"} ${up ? "+" : ""}${pct.toFixed(1)}% vs ${prevYear}`;
    } else {
      yoyEl.hidden = true;
    }
  }

  // ---- Savings goal progress bar ----
  const goalEl     = document.getElementById("sv-goal");
  const goalFillEl = document.getElementById("sv-goal-fill");
  const goalTextEl = document.getElementById("sv-goal-text");
  const goal       = +state.savingsGoal || 0;
  if (goalEl && goalFillEl && goalTextEl) {
    if (goal > 0) {
      const pct = Math.max(0, Math.min(1, total / goal));
      goalEl.hidden = false;
      goalFillEl.style.width = (pct * 100).toFixed(1) + "%";
      goalFillEl.classList.toggle("met", total >= goal);
      const remaining = goal - total;
      goalTextEl.textContent = total >= goal
        ? `Goal met · ${fmtMoney(total - goal)} over`
        : `${fmtMoney(total)} of ${fmtMoney(goal)} · ${fmtMoney(remaining)} to go`;
    } else {
      goalEl.hidden = true;
    }
  }

  // ---- Stats sidebar ----
  const activeMonths = months.filter(v => v > 0).length;
  const avgPerMonth = activeMonths ? total / activeMonths : 0;
  const bestIdx = months.indexOf(Math.max(0, ...months));
  const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const bestVal = months[bestIdx] || 0;
  const largestSingle = savingsTxs.reduce((m, t) => {
    const signed = (t.type === "income" ? -1 : 1) * (+t.amount || 0);
    return signed > m ? signed : m;
  }, 0);
  const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  setText("sv-stat-avg",     fmtMoney(avgPerMonth));
  setText("sv-stat-best",    bestVal > 0 ? `${MONTH_NAMES_SHORT[bestIdx]} · ${fmtMoney(bestVal)}` : "—");
  setText("sv-stat-active",  String(activeMonths));
  setText("sv-stat-largest", fmtMoney(largestSingle));

  // SVG vertical bars — 12 months
  const W = 800, H = 380;
  const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  const padL = 60, padR = 16, padT = 24, padB = isMobile ? 80 : 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxV = Math.max(0, ...months);
  const tickStep = pickAxisStep(Math.max(1, maxV), 5);
  const yTop = Math.ceil(maxV / tickStep) * tickStep || tickStep;
  const yFor = v => padT + ((yTop - v) / yTop) * plotH;

  const slot = plotW / 12;
  const barW = Math.min(slot * 0.6, 56);

  let grid = "", yLabels = "";
  for (let v = 0; v <= yTop + 0.001; v += tickStep) {
    const y = yFor(v);
    grid    += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4 4"/>`;
    yLabels += `<text class="sv-yaxis" x="${padL - 8}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="var(--muted)" font-size="11">${fmtCashAxis(v)}</text>`;
  }

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  let bars = "";
  months.forEach((v, i) => {
    const cx = padL + slot * (i + 0.5);
    const x = cx - barW / 2;
    const h = v > 0 ? plotH * (v / yTop) : 0;
    const y = yFor(v > 0 ? v : 0);
    if (v > 0) {
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(0, h)}" fill="var(--income)" rx="3"><title>${MONTH_NAMES[i]} ${svYear}: ${fmtMoney(v)}</title></rect>`;
    }
    const ly = H - padB + 16;
    bars += isMobile
      ? `<text class="sv-xaxis" x="${cx}" y="${ly}" text-anchor="start" transform="rotate(45 ${cx} ${ly})" fill="var(--muted)" font-size="10">${MONTH_NAMES[i]}</text>`
      : `<text class="sv-xaxis" x="${cx}" y="${ly}" text-anchor="middle" fill="var(--muted)" font-size="10">${MONTH_NAMES[i]}</text>`;
  });

  // ---- Cumulative line overlay ----
  // Running sum at the END of each month. Plot at the month's center X with a
  // separate Y-scale so the line uses the full plot height even when individual
  // bars are small. Hidden if total is 0.
  let cumLine = "", cumDots = "";
  if (total > 0) {
    let cumMax = 0, running = 0;
    const cumByMonth = months.map(v => { running += v; if (running > cumMax) cumMax = running; return running; });
    const cumYFor = v => padT + ((cumMax - v) / cumMax) * plotH;
    const points = cumByMonth.map((v, i) => `${padL + slot * (i + 0.5)},${cumYFor(v)}`).join(" ");
    cumLine = `<polyline points="${points}" fill="none" stroke="var(--accent, #ffd150)" stroke-width="2" opacity="0.85"/>`;
    cumDots = cumByMonth.map((v, i) => {
      const cx = padL + slot * (i + 0.5);
      const cy = cumYFor(v);
      return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="var(--accent, #ffd150)" stroke="var(--surface)" stroke-width="1"><title>${MONTH_NAMES[i]} cum: ${fmtMoney(v)}</title></circle>`;
    }).join("");
  }

  chartEl.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-height:420px">
      ${grid}
      ${yLabels}
      <line x1="${padL}" y1="${yFor(0)}" x2="${padL + plotW}" y2="${yFor(0)}" stroke="var(--border)" stroke-width="1"/>
      ${bars}
      ${cumLine}
      ${cumDots}
    </svg>
  `;

  // ---- Savings transactions breakdown list ----
  const txTotalEl = document.getElementById("sv-tx-total");
  if (txTotalEl) txTotalEl.textContent = fmtMoney(total);

  const txBody = document.getElementById("sv-tx-body");
  if (txBody) {
    if (!savingsTxs.length) {
      txBody.innerHTML = `<div style="padding:14px;text-align:center;color:var(--muted);font-size:12px">No savings transactions in ${escapeHtml(svYear)}.</div>`;
    } else {
      // Group by bucket, sort each by date desc then amount desc
      const groups = new Map();
      savingsTxs.forEach(t => {
        const key = t._bucket || "Savings";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
      });
      groups.forEach(arr =>
        arr.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.amount - a.amount))
      );
      const renderBucket = (name, arr) => {
        if (!arr.length) return "";
        const bucketTotal = arr.reduce((s, t) => s + ((t.type === "income" ? -1 : 1) * (+t.amount || 0)), 0);
        return `
          <tr class="sr-deduct-section-row">
            <td colspan="4">${escapeHtml(name)} — ${arr.length} tx · ${fmtMoney(bucketTotal)}</td>
          </tr>
          ${arr.map(t => {
            const signed = (t.type === "income" ? -1 : 1) * (+t.amount || 0);
            return `
              <tr>
                <td>${escapeHtml(fmtDate(t.date))}</td>
                <td>${escapeHtml(t.payee || "")}</td>
                <td>${escapeHtml(t.category || t.expenseIncome || "")}</td>
                <td class="amt">${fmtMoney(signed)}</td>
              </tr>
            `;
          }).join("")}
        `;
      };
      txBody.innerHTML = `
        <table class="sr-deduct-table">
          <thead>
            <tr><th>Date</th><th>Payee</th><th>Category</th><th class="amt">Amount</th></tr>
          </thead>
          <tbody>
            ${[...groups.entries()].map(([name, arr]) => renderBucket(name, arr)).join("")}
          </tbody>
        </table>
      `;
    }
  }
}

// Toggle handler for the Savings transactions breakdown list.
document.getElementById("sv-tx-toggle")?.addEventListener("click", () => {
  const btn  = document.getElementById("sv-tx-toggle");
  const body = document.getElementById("sv-tx-body");
  if (!btn || !body) return;
  const opening = body.hidden;
  body.hidden = !opening;
  btn.classList.toggle("is-open", opening);
});

// --------- Year Matrix view ---------
// Pivot table: rows = categories, columns = years, cells = income or expense $.
// Honors the universal Date Range / Customer / Category / Payees filters.
let yearMatrixMode = "income"; // "income" | "expense"
function renderYearMatrix() {
  const tbl = document.getElementById("ym-table");
  const totalEl = document.getElementById("ym-total");
  if (!tbl) return;

  const wantType = yearMatrixMode === "expense" ? "expense" : "income";

  const passes = t => {
    if (t.type !== wantType) return false;
    if (NON_JOB_CATEGORIES.includes(t.category)) return false;
    if (SAVINGS_CATEGORIES.includes(t.category)) return false;
    if (!filterPasses("date-range", (t.date || "").slice(0, 4))) return false;
    if (!filterPasses("customer", t.customer || "")) return false;
    if (!filterPassesCategory(t.category)) return false;
    if (!filterPasses("payees", t.payee || "")) return false;
    return true;
  };

  // grid[category][year] = sum
  const grid = new Map();
  const years = new Set();
  state.transactions.forEach(t => {
    if (!passes(t)) return;
    const cat = (t.category || "Uncategorized").trim();
    const yr  = (t.date || "").slice(0, 4);
    if (!/^\d{4}$/.test(yr)) return;
    years.add(yr);
    if (!grid.has(cat)) grid.set(cat, new Map());
    const cm = grid.get(cat);
    cm.set(yr, (cm.get(yr) || 0) + (t.amount || 0));
  });

  const yearList = [...years].sort((a, b) => b.localeCompare(a)); // newest first
  let catList = [...grid.keys()];

  const rowTotals = new Map();
  catList.forEach(c => {
    const cm = grid.get(c);
    let s = 0;
    yearList.forEach(y => { s += cm.get(y) || 0; });
    rowTotals.set(c, s);
  });
  // Sort categories:
  //   HEAD — the user's preferred photography-job order (Spring Sports first)
  //   MIDDLE — everything else, by lifetime total desc
  //   TAIL — "Product" is pinned at the bottom
  const YM_HEAD_ORDER = [
    "Spring Sports", "Baseball", "Softball", "Tee Ball",
    "Fall Sports", "Banners", "Soccer", "Preschool", "Winter Sports",
    "Framed Prints", "Mounted Prints", "Dry Mount Prints", "Buy Sell",
  ];
  const YM_TAIL_ORDER = ["Product"];
  const headRank = new Map(YM_HEAD_ORDER.map((n, i) => [n, i]));
  const tailRank = new Map(YM_TAIL_ORDER.map((n, i) => [n, i]));
  const tierOf = c => {
    if (headRank.has(c)) return { tier: 0, rank: headRank.get(c) };
    if (tailRank.has(c)) return { tier: 2, rank: tailRank.get(c) };
    return { tier: 1, rank: 0 };
  };
  catList.sort((a, b) => {
    const ta = tierOf(a), tb = tierOf(b);
    if (ta.tier !== tb.tier) return ta.tier - tb.tier;
    if (ta.tier === 1) {
      // Middle tier — sort by lifetime total desc.
      return (rowTotals.get(b) || 0) - (rowTotals.get(a) || 0);
    }
    return ta.rank - tb.rank;
  });

  const colTotals = new Map();
  yearList.forEach(y => {
    let s = 0;
    catList.forEach(c => { s += grid.get(c).get(y) || 0; });
    colTotals.set(y, s);
  });

  const grand = [...rowTotals.values()].reduce((a, b) => a + b, 0);
  if (totalEl) {
    totalEl.textContent = fmtMoney(grand);
    totalEl.style.color = wantType === "expense" ? "var(--expense)" : "var(--income)";
  }
  const eyebrowEl = document.getElementById("ym-eyebrow");
  if (eyebrowEl) {
    eyebrowEl.textContent = wantType === "expense"
      ? "Expense by Category × Year"
      : "Income by Category × Year";
  }

  if (!catList.length || !yearList.length) {
    const noun = wantType === "expense" ? "expense" : "income";
    tbl.innerHTML = `<tbody><tr><td class="ym-empty">No ${noun} data for the selected filters.</td></tr></tbody>`;
    return;
  }

  let head = `<thead><tr><th class="ym-rowhead">Category</th>`;
  yearList.forEach(y => { head += `<th>${escapeHtml(y)}</th>`; });
  head += `<th class="ym-rowhead">Total</th></tr></thead>`;

  const valueClass = wantType === "expense" ? "ym-expense" : "ym-income";
  let body = `<tbody>`;
  catList.forEach(c => {
    const cAttr = escapeHtml(c);
    // Row-head: click drills into ALL years for this category.
    body += `<tr><td class="ym-rowhead ym-drill" data-cat="${cAttr}">${escapeHtml(c)}</td>`;
    yearList.forEach(y => {
      const v = grid.get(c).get(y) || 0;
      if (v === 0) {
        body += `<td class="ym-zero">—</td>`;
      } else {
        // Cell click drills into (category × year) transactions.
        body += `<td class="${valueClass} ym-drill" data-cat="${cAttr}" data-year="${y}">${fmtMoney(v)}</td>`;
      }
    });
    body += `<td class="ym-row-total ${wantType === "expense" ? "ym-row-total-expense" : ""} ym-drill" data-cat="${cAttr}">${fmtMoney(rowTotals.get(c))}</td></tr>`;
  });
  // Column-total row: each year cell drills into ALL categories for that year.
  body += `<tr class="ym-col-total-row"><td class="ym-rowhead">Total</td>`;
  yearList.forEach(y => {
    body += `<td class="${valueClass} ym-drill" data-year="${y}">${fmtMoney(colTotals.get(y))}</td>`;
  });
  body += `<td class="${valueClass}">${fmtMoney(grand)}</td></tr></tbody>`;

  tbl.innerHTML = head + body;
}

// Year Matrix → drill into Transactions. Click any cell (or row/column
// header) to jump to the Transactions tab pre-filtered to the matching
// (category, year, income/expense) subset.
document.getElementById("ym-table")?.addEventListener("click", (e) => {
  const cell = e.target.closest(".ym-drill");
  if (!cell) return;
  const cat  = cell.dataset.cat  || "";
  const year = cell.dataset.year || "";
  const wantType = yearMatrixMode === "expense" ? "expense" : "income";

  __txDrillFilter = (t) => {
    if (t.type !== wantType) return false;
    if (NON_JOB_CATEGORIES.includes(t.category)) return false;
    if (SAVINGS_CATEGORIES.includes(t.category)) return false;
    if (cat && (t.category || "").trim() !== cat) return false;
    if (year && (t.date || "").slice(0, 4) !== year) return false;
    return true;
  };
  if (typeof __txDrillLabel !== "undefined") {
    const typeWord = wantType === "expense" ? "Expense" : "Income";
    __txDrillLabel = cat && year
      ? `${cat} · ${year} · ${typeWord}`
      : cat
        ? `${cat} · ${typeWord}`
        : `${year} · ${typeWord}`;
  }
  if (typeof refreshTxDrillChip === "function") setTimeout(refreshTxDrillChip, 0);

  // Navigate to Transactions tab. Clear the Transactions tab's own filters
  // so the drill predicate is the sole narrowing.
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="transactions"]').classList.add("active");
  document.getElementById("transactions").classList.add("active");
  const searchAll = document.getElementById("tx-search-all");
  if (searchAll) searchAll.value = "";
  document.getElementById("tx-filter-type").value = wantType;
  document.getElementById("tx-filter-category").value = "";
  document.getElementById("tx-filter-year").value = year || "";
  window.__txBackToAnalytics = true;
  // Remember which Analytics view the user drilled from so Back returns
  // them to Year Matrix (not the default By Category).
  window.__txBackToAnalyticsView = "year-matrix";
  const backBtn = document.getElementById("btn-tx-back");
  if (backBtn) backBtn.hidden = false;
  if (typeof renderTransactions === "function") renderTransactions();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
});

// Wire the Income / Expense mode-switch on the Year Matrix card.
document.querySelectorAll("#ym-mode .mode-switch-option").forEach(btn => {
  btn.addEventListener("click", () => {
    const next = btn.dataset.mode;
    if (next === yearMatrixMode) return;
    yearMatrixMode = next;
    const wrap = document.getElementById("ym-mode");
    if (wrap) wrap.dataset.mode = yearMatrixMode;
    document.querySelectorAll("#ym-mode .mode-switch-option").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === yearMatrixMode);
    });
    renderYearMatrix();
  });
});

function renderSpendingTrends() {
  const chartEl = document.getElementById("st-chart");
  const listEl  = document.getElementById("st-list");
  if (!chartEl || !listEl) return;

  // Spending Trends only shows ONE year at a time — selectedMonths() can span
  // several years if the user picked multiple in the universal Date Range
  // filter. Pick a single year using the same rules as Cash Flow:
  //   - selection present → most recent selected year
  //   - no selection + current calendar year has data → current year
  //   - otherwise → most recent year that has any transactions
  const stSel = selectedYears();
  let stYear;
  if (stSel && stSel.length) {
    stYear = [...stSel].sort()[stSel.length - 1];
  } else {
    const thisYear = String(new Date().getFullYear());
    const txYears = new Set();
    state.transactions.forEach(t => {
      const y = (t.date || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) txYears.add(y);
    });
    stYear = txYears.has(thisYear)
      ? thisYear
      : ([...txYears].sort().pop() || thisYear);
  }
  const months = selectedMonths().filter(m => m.key.startsWith(stYear));
  const monthKeys = months.map(m => m.key);
  const monthIdx  = new Map(monthKeys.map((k, i) => [k, i]));

  // Aggregate expenses per (category, month). Spending Trends only looks at expenses.
  const catTotals = new Map();          // category -> total
  const catByMonth = new Map();         // category -> [perMonth amounts]
  state.transactions.forEach(t => {
    if (t.type !== "expense") return;
    if (NON_JOB_CATEGORIES.includes(t.category)) return;
    const ymKey = (t.date || "").slice(0, 7);
    const mi = monthIdx.get(ymKey);
    if (mi === undefined) return;
    if (!filterPasses("date-range", (t.date || "").slice(0, 4))) return;
    if (!filterPasses("customer",   t.customer || "")) return;
    if (!filterPassesCategory(t.category)) return;
    if (!filterPasses("payees",     t.payee || "")) return;
    const cat = t.category || "Uncategorized";
    if (!catByMonth.has(cat)) catByMonth.set(cat, new Array(monthKeys.length).fill(0));
    catByMonth.get(cat)[mi] += Math.abs(t.amount || 0);
    catTotals.set(cat, (catTotals.get(cat) || 0) + Math.abs(t.amount || 0));
  });

  // Sorted categories — largest first
  const cats = [...catTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, total], idx) => ({
      name,
      total,
      color: DONUT_PALETTE[idx % DONUT_PALETTE.length],
      perMonth: catByMonth.get(name),
    }));

  const totalSpending = cats.reduce((s, c) => s + c.total, 0);
  const monthlySums = monthKeys.map((_, i) =>
    cats.reduce((s, c) => s + (c.perMonth[i] || 0), 0)
  );
  // Months with actual data — drives the MONTHS stat and Monthly Avg.
  const monthsWithData = monthlySums.filter(v => v > 0).length || 0;
  const avg = monthsWithData ? totalSpending / monthsWithData : 0;

  // Header + stat tiles
  document.getElementById("st-total").textContent       = fmtMoney(totalSpending);
  document.getElementById("st-stat-total").textContent  = fmtMoney(totalSpending);
  document.getElementById("st-stat-avg").textContent    = fmtMoney(avg);
  document.getElementById("st-stat-cats").textContent   = String(cats.length);
  document.getElementById("st-stat-months").textContent = String(monthsWithData);

  // ---- Build chart SVG ----
  const stIsMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  // Match Cash Flow's chart dimensions (800x380 viewBox) so both cards render
  // at the same height on mobile.
  const baseWidth = 800, height = 380;
  // On mobile we rotate month labels 45° to prevent overlap, so reserve more
  // bottom padding for them.
  const padL = 56, padR = 12, padT = 18, padB = stIsMobile ? 80 : 36;
  const basePlotW = baseWidth - padL - padR;

  // Lock the per-month slot at the 12-month width. When more than 12 months are
  // in view, expand the SVG and let the chart container scroll horizontally so
  // the bars stay readable instead of getting squashed.
  const groupCount = monthKeys.length || 1;
  const lockedSlot = basePlotW / 12;
  const scrolling  = groupCount > 12;
  const plotW   = scrolling ? lockedSlot * groupCount : basePlotW;
  const width   = padL + padR + plotW;
  const plotH   = height - padT - padB;

  const maxStack = Math.max(1, ...monthlySums);
  const tickStep = pickAxisStep(maxStack, 5);
  const yTop     = Math.ceil(maxStack / tickStep) * tickStep || tickStep;
  const yFor     = v => padT + ((yTop - v) / yTop) * plotH;

  const groupSlot  = plotW / groupCount;
  const barW       = Math.max(8, Math.min(groupSlot * 0.6, 56));

  // Y-axis grid + labels
  let gridLines = "", yLabels = "";
  for (let v = 0; v <= yTop + 0.0001; v += tickStep) {
    const y = yFor(v);
    gridLines += `<line class="st-grid-line" x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}"/>`;
    yLabels   += `<text class="st-axis-text st-yaxis" x="${padL - 8}" y="${y}" text-anchor="end" dominant-baseline="middle">${fmtCashAxis(v)}</text>`;
  }

  // X-axis month labels — rotate 45° on mobile so they don't overlap.
  let xLabels = "";
  monthKeys.forEach((k, i) => {
    const cx = padL + groupSlot * (i + 0.5);
    const ly = height - padB + 16;
    xLabels += stIsMobile
      ? `<text class="st-axis-text st-xaxis" x="${cx}" y="${ly}" text-anchor="start" transform="rotate(45 ${cx} ${ly})">${escapeHtml(months[i].label)}</text>`
      : `<text class="st-axis-text st-xaxis" x="${cx}" y="${ly}" text-anchor="middle">${escapeHtml(months[i].label)}</text>`;
  });

  let chartBody = "";
  if (spendingTrendsMode === "stacked") {
    // Stack from largest category at the bottom upward (sorted order already).
    let bars = "";
    monthKeys.forEach((k, i) => {
      const cx = padL + groupSlot * (i + 0.5);
      const x  = cx - barW / 2;
      let yCursor = yFor(0); // bottom
      cats.forEach(c => {
        const v = c.perMonth[i] || 0;
        if (v <= 0) return;
        const top = yFor(yCursor === yFor(0) ? v : ((yTop - (yFor(0) - yCursor) / plotH * yTop) + v));
        // Simpler: convert running total in $ to y
        const runningPrev = (yFor(0) - yCursor) / plotH * yTop; // current stack height in dollars
        const newRunning  = runningPrev + v;
        const newY = yFor(newRunning);
        bars += `<rect class="st-bar" x="${x}" y="${newY}" width="${barW}" height="${Math.max(0, yCursor - newY)}" fill="${c.color}"><title>${escapeHtml(months[i].label)} — ${escapeHtml(c.name)}: ${fmtMoney(v)}</title></rect>`;
        yCursor = newY;
      });
    });
    chartBody = bars;
  } else {
    // Lines — one polyline per category, plus dots
    let lines = "", dots = "";
    cats.forEach(c => {
      const pts = c.perMonth.map((v, i) => {
        const cx = padL + groupSlot * (i + 0.5);
        const cy = yFor(v);
        return `${cx},${cy}`;
      }).join(" ");
      lines += `<polyline class="st-line-path" points="${pts}" stroke="${c.color}"/>`;
      c.perMonth.forEach((v, i) => {
        const cx = padL + groupSlot * (i + 0.5);
        const cy = yFor(v);
        dots += `<circle class="st-line-dot" cx="${cx}" cy="${cy}" r="3" fill="${c.color}"><title>${escapeHtml(months[i].label)} — ${escapeHtml(c.name)}: ${fmtMoney(v)}</title></circle>`;
      });
    });
    chartBody = lines + dots;
  }

  chartEl.classList.toggle("scrollable", scrolling);
  chartEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet"${scrolling ? ` style="width:${width}px; height:${height}px; max-width:none;"` : ""}>
      ${gridLines}
      ${yLabels}
      <line x1="${padL}" y1="${yFor(0)}" x2="${padL + plotW}" y2="${yFor(0)}" stroke="var(--border)" stroke-width="1"/>
      ${chartBody}
      ${xLabels}
    </svg>
  `;

  // Right-side categories list
  if (!cats.length) {
    listEl.innerHTML = `<li class="st-cat-row" style="grid-template-columns:1fr"><span class="muted">No expenses for the selected filters.</span></li>`;
  } else {
    listEl.innerHTML = cats.map(c => `
      <li class="st-cat-row">
        <span class="st-cat-dot" style="background:${c.color}"></span>
        <span class="st-cat-name">${escapeHtml(c.name)}</span>
        <span class="st-cat-amount">${fmtMoney(c.total)}</span>
      </li>
    `).join("");
  }
}

// Mode-switch (Stacked / Lines) — wire after DOM is ready
(() => {
  const modeEl = document.getElementById("st-mode");
  if (!modeEl) return;
  modeEl.querySelectorAll(".mode-switch-option").forEach(btn => {
    btn.addEventListener("click", () => {
      spendingTrendsMode = btn.dataset.mode;
      modeEl.dataset.mode = spendingTrendsMode;
      modeEl.querySelectorAll(".mode-switch-option").forEach(b => {
        b.classList.toggle("active", b.dataset.mode === spendingTrendsMode);
      });
      renderSpendingTrends();
    });
  });
})();
// --------- Breakdown (d3-sankey: Customer → Category → Payee) ---------
let breakdownTypeMode = "income"; // "income" | "spending"

document.getElementById("breakdown-type-switch")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-mode]");
  if (!btn) return;
  const next = btn.dataset.mode;
  if (next === breakdownTypeMode) return;
  breakdownTypeMode = next;
  const wrap = document.getElementById("breakdown-type-switch");
  if (wrap) {
    wrap.dataset.mode = next;
    wrap.querySelectorAll(".mode-switch-option").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === next);
    });
  }
  renderBreakdown();
});

// Render the chip row for the N-stage Sankey picker. Each chip is draggable
// (HTML5 drag-and-drop) for reordering; ✕ removes; "+ Add stage" opens a
// menu of remaining types. Called from inside renderBreakdown() each render.
function renderBreakdownStageChips(STAGE_TYPES, usedStages, mode) {
  const chipsEl = document.getElementById("breakdown-stage-chips");
  const addBtn  = document.getElementById("breakdown-stage-add-btn");
  const menuEl  = document.getElementById("breakdown-stage-add-menu");
  if (!chipsEl || !addBtn || !menuEl) return;

  const writeStages = (next) => {
    const m = breakdownTypeMode;
    state.breakdownStages[m] = next;
    saveState();
    renderBreakdown();
  };

  // Build chips. A trailing arrow appears between consecutive chips.
  chipsEl.innerHTML = usedStages.map((s, i) => {
    const label = STAGE_TYPES[s] ? STAGE_TYPES[s].label : s;
    const arrow = i < usedStages.length - 1
      ? `<span class="breakdown-stage-chip-arrow">→</span>` : "";
    return `<span class="breakdown-stage-chip" draggable="true" data-stage="${escapeHtml(s)}" data-idx="${i}">
      <span class="breakdown-stage-chip-handle">⋮⋮</span>
      <span class="breakdown-stage-chip-label">${escapeHtml(label)}</span>
      <button type="button" class="breakdown-stage-chip-x" title="Remove" data-idx="${i}">×</button>
    </span>${arrow}`;
  }).join("");

  // Remove handler
  chipsEl.querySelectorAll(".breakdown-stage-chip-x").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx, 10);
      const next = usedStages.slice();
      next.splice(idx, 1);
      writeStages(next);
    });
  });

  // Drag-reorder
  let dragIdx = -1;
  chipsEl.querySelectorAll(".breakdown-stage-chip").forEach(chip => {
    chip.addEventListener("dragstart", (e) => {
      dragIdx = parseInt(chip.dataset.idx, 10);
      chip.classList.add("dragging");
      try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(dragIdx)); } catch {}
    });
    chip.addEventListener("dragend", () => {
      chip.classList.remove("dragging");
      chipsEl.querySelectorAll(".drop-before, .drop-after").forEach(c => c.classList.remove("drop-before", "drop-after"));
      dragIdx = -1;
    });
    chip.addEventListener("dragover", (e) => {
      e.preventDefault();
      const r = chip.getBoundingClientRect();
      const before = (e.clientX - r.left) < r.width / 2;
      chipsEl.querySelectorAll(".drop-before, .drop-after").forEach(c => c.classList.remove("drop-before", "drop-after"));
      chip.classList.add(before ? "drop-before" : "drop-after");
    });
    chip.addEventListener("drop", (e) => {
      e.preventDefault();
      const targetIdx = parseInt(chip.dataset.idx, 10);
      if (dragIdx === -1 || dragIdx === targetIdx) return;
      const r = chip.getBoundingClientRect();
      const before = (e.clientX - r.left) < r.width / 2;
      let insertAt = before ? targetIdx : targetIdx + 1;
      const next = usedStages.slice();
      const [moved] = next.splice(dragIdx, 1);
      if (dragIdx < insertAt) insertAt -= 1;
      next.splice(insertAt, 0, moved);
      writeStages(next);
    });
  });

  // Build the "+ Add stage" menu fresh each render so it reflects what's already used.
  const used = new Set(usedStages);
  menuEl.innerHTML = Object.entries(STAGE_TYPES).map(([k, v]) =>
    `<button type="button" data-add="${k}"${used.has(k) ? " disabled" : ""}>${escapeHtml(v.label)}${used.has(k) ? " ✓" : ""}</button>`
  ).join("");
  menuEl.querySelectorAll("button[data-add]").forEach(b => {
    b.addEventListener("click", () => {
      const k = b.dataset.add;
      if (used.has(k)) return;
      const next = usedStages.slice(); next.push(k);
      menuEl.hidden = true;
      writeStages(next);
    });
  });

  // Toggle the menu only once — wire on first render via a flag on the button.
  if (addBtn.dataset.wired !== "1") {
    addBtn.dataset.wired = "1";
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menuEl.hidden = !menuEl.hidden;
    });
    document.addEventListener("click", (e) => {
      if (menuEl.hidden) return;
      if (e.target === addBtn || addBtn.contains(e.target)) return;
      if (menuEl.contains(e.target)) return;
      menuEl.hidden = true;
    });
  }
}

function renderBreakdown() {
  const chartEl = document.getElementById("breakdown-chart");
  const totalEl = document.getElementById("breakdown-total");
  if (!chartEl || !totalEl) return;

  // d3 + d3-sankey are loaded async from CDN; bail out gracefully if not yet ready.
  if (typeof d3 === "undefined" || typeof d3.sankey !== "function") {
    chartEl.innerHTML = `<div class="empty" style="padding:32px;text-align:center;color:var(--muted)">Loading chart library…</div>`;
    setTimeout(renderBreakdown, 250);
    return;
  }

  const wantType = breakdownTypeMode === "spending" ? "expense" : "income";

  const txs = state.transactions.filter(t => {
    if (t.type !== wantType) return false;
    if (NON_JOB_CATEGORIES.includes(t.category)) return false;
    if (!filterPasses("date-range", (t.date || "").slice(0, 4))) return false;
    if (!filterPasses("customer",   t.customer || "")) return false;
    if (!filterPassesCategory(t.category)) return false;
    if (!filterPasses("payees",     t.payee || "")) return false;
    return true;
  });

  const total = txs.reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  totalEl.textContent = fmtMoney(total);
  totalEl.style.color = wantType === "income" ? "var(--income)" : "var(--expense)";

  if (!txs.length) {
    chartEl.innerHTML = `<div class="empty" style="padding:32px;text-align:center;color:var(--muted)">No data for the selected filters.</div>`;
    return;
  }

  // Build the 3-stage graph: Customer (stage 0) → Category (stage 1) → Payee (stage 2).
  // Node keys are namespaced by stage so identical labels in different stages
  // don't collide.
  const nodeIndex = new Map();
  const nodes = [];
  const ensureNode = (key, name, stage) => {
    if (nodeIndex.has(key)) return nodeIndex.get(key);
    const idx = nodes.length;
    nodes.push({ name, stage });
    nodeIndex.set(key, idx);
    return idx;
  };
  const linkMap = new Map(); // "src|tgt" -> value
  const addLink = (src, tgt, v) => {
    const k = `${src}|${tgt}`;
    linkMap.set(k, (linkMap.get(k) || 0) + v);
  };

  // ---- N-stage extractor table ----
  const _jobsByNo = new Map((state.jobs || []).map(j => [j.jobNo, j]));
  const STAGE_TYPES = {
    customer: { label: "Customer", fn: (t) => {
      const v = (t.customer || "").trim();
      return { id: "c:" + (v || "__none__"), label: v || "(no customer)" };
    }},
    vendor: { label: "Vendor", fn: (t) => {
      const v = (t.vendor || "").trim();
      return { id: "v:" + (v || "__none__"), label: v || "(no vendor)" };
    }},
    category: { label: "Category", fn: (t) => {
      const v = (t.category || "").trim() || "Uncategorized";
      return { id: "a:" + v, label: v };
    }},
    payee: { label: "Payee", fn: (t) => {
      const v = (t.payee || "").trim();
      return { id: "p:" + (v || "__none__"), label: v || "(no payee)" };
    }},
    jobno: { label: "Job No.", fn: (t) => {
      if (t.jobNo && _jobsByNo.has(t.jobNo)) {
        const j = _jobsByNo.get(t.jobNo);
        return { id: "j:" + t.jobNo, label: `${t.jobNo} - ${j.customer || ""}${j.category ? " / " + j.category : ""}` };
      }
      if (t.jobNo) return { id: "j:" + t.jobNo, label: t.jobNo };
      return { id: "j:__unspec__", label: "(unspecified)" };
    }},
    expense: { label: "Expense", fn: (t) => {
      const v = (t.expenseIncome || "").trim();
      return { id: "e:" + (v || "__none__"), label: v || "(unspecified)" };
    }},
    chartAccount: { label: "Chart of Accounts", fn: (t) => {
      const v = (t.chartAccount || "").trim();
      return { id: "ca:" + (v || "__none__"), label: v || "(no COA)" };
    }},
    year:  { label: "Year",  fn: (t) => { const v = (t.date || "").slice(0, 4) || "—"; return { id: "y:" + v, label: v }; } },
    month: { label: "Month", fn: (t) => { const v = (t.date || "").slice(0, 7) || "—"; return { id: "m:" + v, label: v }; } },
  };

  // Default stages by mode (kept identical to the previous hardcoded behavior).
  const DEFAULT_STAGES_INCOME   = ["customer", "category", "jobno"];
  const DEFAULT_STAGES_SPENDING = ["customer", "category", "expense"];
  // Persisted user choice per mode (any length ≥ 0).
  if (!state.breakdownStages || typeof state.breakdownStages !== "object") {
    state.breakdownStages = { income: DEFAULT_STAGES_INCOME, spending: DEFAULT_STAGES_SPENDING };
  }
  if (!Array.isArray(state.breakdownStages.income))   state.breakdownStages.income   = DEFAULT_STAGES_INCOME.slice();
  if (!Array.isArray(state.breakdownStages.spending)) state.breakdownStages.spending = DEFAULT_STAGES_SPENDING.slice();
  // Drop legacy empty-string slots from the 4-fixed-dropdown era.
  state.breakdownStages.income   = state.breakdownStages.income.filter(Boolean);
  state.breakdownStages.spending = state.breakdownStages.spending.filter(Boolean);
  const usedStages = (wantType === "income" ? state.breakdownStages.income : state.breakdownStages.spending)
    .filter(s => STAGE_TYPES[s]); // sanitize unknown values
  // Need at least 2 stages to draw a flow.
  if (usedStages.length < 2) {
    chartEl.innerHTML = `<div class="empty" style="padding:32px;text-align:center;color:var(--muted)">Pick at least two stages above to build the flow.</div>`;
    renderBreakdownStageChips(STAGE_TYPES, usedStages, wantType);
    const _eyebrow = document.getElementById("breakdown-eyebrow");
    if (_eyebrow) _eyebrow.textContent = (usedStages.map(s => STAGE_TYPES[s].label).join(" · ") || "—") + " Flow";
    return;
  }

  txs.forEach(t => {
    const v = Math.abs(t.amount || 0);
    if (v <= 0) return;
    // Build the path through the chosen stages for this tx.
    const ids = usedStages.map((stype, i) => {
      const r = STAGE_TYPES[stype].fn(t);
      return ensureNode(r.id + "@" + i, r.label, i);
    });
    for (let i = 0; i < ids.length - 1; i++) addLink(ids[i], ids[i + 1], v);
  });

  // Update the section eyebrow to reflect the active stages.
  const _eyebrow = document.getElementById("breakdown-eyebrow");
  if (_eyebrow) _eyebrow.textContent = usedStages.map(s => STAGE_TYPES[s].label).join(" · ") + " Flow";

  // (Re)render the stage-picker chip row to reflect the current selection.
  renderBreakdownStageChips(STAGE_TYPES, usedStages, wantType);
  // Pass the count of stages out for use by the label-placement code below.
  window.__breakdownStageCount = usedStages.length;

  const links = [...linkMap.entries()].map(([k, value]) => {
    const [source, target] = k.split("|").map(Number);
    return { source, target, value };
  });

  // Stable color per node. Pick one "rainbow stage" (the middle-ish one) to
  // pull from the donut palette so it reads as the focal categorization;
  // outer stages get a stable color per stage.
  const _stageCount = window.__breakdownStageCount || 3;
  const _palettePer = Math.max(1, Math.floor(_stageCount / 2));
  const stageColors = ["#6c7ae0", "#f5a623", "#2ec4b6", "#e85d75", "#9b59b6", "#3498db"];
  nodes.forEach((n, i) => {
    if (n.stage === _palettePer) n.color = DONUT_PALETTE[i % DONUT_PALETTE.length];
    else n.color = stageColors[n.stage % stageColors.length] || "#888";
  });

  // Lay out with d3-sankey
  const containerW = chartEl.clientWidth || 1100;
  // On mobile we render the Sankey inside a horizontal-scroll wrapper, so
  // give it a generous fixed width regardless of container size to prevent
  // node labels from overlapping each other / the next stage's column.
  const breakdownIsMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  const width  = breakdownIsMobile ? 1200 : Math.max(720, containerW);
  const height = Math.max(420, Math.min(720, nodes.length * 14));

  const sankeyGen = d3.sankey()
    .nodeId(d => d.index)
    .nodeWidth(14)
    .nodePadding(8)
    .nodeAlign(d3.sankeyJustify)
    // Wide left/right gutters so customer + payee labels never clip on long names.
    // Right gutter widened (was 200) so long labels like "25001 - Montpelier Schools / Spring Sports"
    // have room without wrapping or clipping at the edge.
    .extent([[230, 16], [width - 340, height - 16]]);

  const graph = sankeyGen({
    nodes: nodes.map((d, i) => ({ ...d, index: i })),
    links: links.map(d => ({ ...d })),
  });

  const linkPath = d3.sankeyLinkHorizontal();

  // Build SVG markup directly (no d3 mount needed — keeps the rest of the app's
  // vanilla approach consistent).
  let svg = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-height:720px">`;

  // Links — colored by source-node color, tinted via stroke-opacity
  graph.links.forEach(l => {
    const d = linkPath(l);
    const stroke = (l.source && l.source.color) || "#888";
    svg += `<path d="${d}" fill="none" stroke="${stroke}" stroke-opacity="0.45" stroke-width="${Math.max(1, l.width)}"><title>${escapeHtml(l.source.name)} → ${escapeHtml(l.target.name)}: ${fmtMoney(l.value)}</title></path>`;
  });

  // Nodes
  graph.nodes.forEach(n => {
    const w = (n.x1 - n.x0) || 1;
    const h = (n.y1 - n.y0) || 1;
    svg += `<rect x="${n.x0}" y="${n.y0}" width="${w}" height="${h}" fill="${n.color}" rx="2"><title>${escapeHtml(n.name)}: ${fmtMoney(n.value)}</title></rect>`;
    // Skip labels for very small nodes to reduce clutter
    if (h < 6) return;
    // First stage → label to the left of the node; everything else → right.
    const outsideRight = n.stage !== 0;
    const labelX = outsideRight ? n.x1 + 6 : n.x0 - 6;
    const anchor = outsideRight ? "start" : "end";
    const labelY = (n.y0 + n.y1) / 2;
    svg += `<text x="${labelX}" y="${labelY}" dominant-baseline="middle" text-anchor="${anchor}" fill="var(--text)" font-size="11" font-weight="500">${escapeHtml(n.name)} <tspan fill="var(--muted)" font-weight="400">${fmtMoney(n.value)}</tspan></text>`;
  });

  svg += `</svg>`;
  chartEl.innerHTML = svg;
  // Re-apply any current pinch-zoom transform after each render so changing
  // filters / stages doesn't reset the user's zoom level.
  if (typeof _breakdownApplyZoom === "function") _breakdownApplyZoom();
}

// --------- Breakdown pinch-zoom + pan (mobile only) ---------
// Two-finger pinch scales the SVG via CSS transform; single-finger drag pans
// when zoomed in (>1x); double-tap resets to 1x.
let _breakdownApplyZoom = null;
(function setupBreakdownPinchZoom() {
  if (typeof window === "undefined" || !("ontouchstart" in window)) return;
  const container = document.getElementById("breakdown-chart");
  if (!container) return;

  let scale = 1, tx = 0, ty = 0;
  let pinchStart = null;
  let panStart = null;
  let lastTapAt = 0;

  const apply = () => {
    const svg = container.querySelector("svg");
    if (!svg) return;
    svg.style.transformOrigin = "0 0";
    svg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    svg.style.willChange = "transform";
  };
  _breakdownApplyZoom = apply;

  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const mid  = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });

  container.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      pinchStart = {
        d: dist(e.touches[0], e.touches[1]),
        startScale: scale,
        startTx: tx,
        startTy: ty,
        midPx: mid(e.touches[0], e.touches[1]),
      };
      panStart = null;
    } else if (e.touches.length === 1 && scale > 1.001) {
      panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, startTx: tx, startTy: ty };
    }
  }, { passive: true });

  container.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && pinchStart) {
      e.preventDefault();
      const d = dist(e.touches[0], e.touches[1]);
      const ratio = d / pinchStart.d;
      const newScale = Math.min(4, Math.max(0.5, pinchStart.startScale * ratio));
      // Zoom around the pinch midpoint so content under fingers stays put.
      const rect = container.getBoundingClientRect();
      const mx = pinchStart.midPx.x - rect.left;
      const my = pinchStart.midPx.y - rect.top;
      tx = mx - (mx - pinchStart.startTx) * (newScale / pinchStart.startScale);
      ty = my - (my - pinchStart.startTy) * (newScale / pinchStart.startScale);
      scale = newScale;
      apply();
    } else if (e.touches.length === 1 && panStart) {
      e.preventDefault();
      tx = panStart.startTx + (e.touches[0].clientX - panStart.x);
      ty = panStart.startTy + (e.touches[0].clientY - panStart.y);
      apply();
    }
  }, { passive: false });

  container.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) pinchStart = null;
    if (e.touches.length === 0) panStart = null;
    // Double-tap (within 300ms, single finger) resets zoom.
    if (e.changedTouches.length === 1 && e.touches.length === 0) {
      const now = Date.now();
      if (now - lastTapAt < 300) {
        scale = 1; tx = 0; ty = 0;
        apply();
        lastTapAt = 0;
      } else {
        lastTapAt = now;
      }
    }
  });
})();

// --------- Cash Flow view ---------
let cashFlowMode = "flow"; // "flow" or "trend"

document.querySelectorAll("#cf-mode .mode-switch-option").forEach(btn => {
  btn.addEventListener("click", () => {
    cashFlowMode = btn.dataset.mode;
    const container = document.getElementById("cf-mode");
    container.dataset.mode = cashFlowMode;
    container.querySelectorAll(".mode-switch-option").forEach(b => {
      b.classList.toggle("active", b === btn);
    });
    renderCashFlow();
  });
});

// Build the months window from a date-range key.
function cashFlowMonths(rangeKey) {
  const now = new Date();
  const out = [];
  function addMonth(year, monthIdx) {
    const d = new Date(year, monthIdx, 1);
    out.push({
      date: d,
      key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    });
  }
  // year-YYYY — single calendar year
  const yearMatch = /^year-(\d{4})$/.exec(rangeKey || "");
  if (yearMatch) {
    const yr = Number(yearMatch[1]);
    for (let m = 0; m < 12; m++) addMonth(yr, m);
    return out;
  }
  if (rangeKey === "all-years") {
    // Span every month from the earliest transaction date through the current month.
    const allYears = [];
    state.transactions.forEach(t => {
      const y = (t.date || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) allYears.push(Number(y));
    });
    const minYear = allYears.length ? Math.min(...allYears) : now.getFullYear();
    const startD = new Date(minYear, 0, 1);
    const cur = new Date(startD);
    while (cur <= now) {
      addMonth(cur.getFullYear(), cur.getMonth());
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }
  if (rangeKey === "this-year") {
    for (let m = 0; m <= now.getMonth(); m++) addMonth(now.getFullYear(), m);
  } else if (rangeKey === "last-year") {
    for (let m = 0; m < 12; m++) addMonth(now.getFullYear() - 1, m);
  } else if (rangeKey === "last-3-years") {
    const start = new Date(now.getFullYear(), now.getMonth() - 35, 1);
    for (let i = 0; i < 36; i++) addMonth(start.getFullYear(), start.getMonth() + i);
  } else if (rangeKey === "last-30-days") {
    addMonth(now.getFullYear(), now.getMonth() - 1);
    addMonth(now.getFullYear(), now.getMonth());
  } else if (rangeKey === "last-6-months") {
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    for (let i = 0; i < 6; i++) addMonth(start.getFullYear(), start.getMonth() + i);
  } else {
    // "all" — show last 12 months by default
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    for (let i = 0; i < 12; i++) addMonth(start.getFullYear(), start.getMonth() + i);
  }
  return out;
}

function fmtCashAxis(v) {
  const abs = Math.abs(v);
  const s = abs >= 1000 ? "$" + (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "K"
                        : "$" + Math.round(v);
  return v < 0 ? "-" + s.slice(1) : s; // ensure sign
}

function pickAxisStep(maxValue, targetTicks = 4) {
  if (maxValue <= 0) return 1;
  const rough = maxValue / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  let step = 10;
  if (n <= 1) step = 1;
  else if (n <= 2) step = 2;
  else if (n <= 5) step = 5;
  return step * pow;
}

function renderCashFlow() {
  const chartEl = document.getElementById("cf-chart");
  const listEl  = document.getElementById("cf-list");
  if (!chartEl || !listEl) return;

  // Cash Flow only ever shows ONE year at a time. selectedMonths() can span
  // multiple years if the user picked several in the universal Date Range
  // filter, so pick a single year:
  //   - selection present → most recent selected year
  //   - no selection → current calendar year if it has any transactions,
  //     otherwise the most recent year that does
  const sel = selectedYears();
  let cfYear;
  if (sel && sel.length) {
    cfYear = [...sel].sort()[sel.length - 1];
  } else {
    const thisYear = String(new Date().getFullYear());
    const txYears = new Set();
    state.transactions.forEach(t => {
      const y = (t.date || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) txYears.add(y);
    });
    cfYear = txYears.has(thisYear)
      ? thisYear
      : ([...txYears].sort().pop() || thisYear);
  }
  const months = selectedMonths().filter(m => m.key.startsWith(cfYear));
  const data = months.map(m => ({ ...m, in: 0, out: 0 }));
  const dataMap = new Map(data.map(d => [d.key, d]));

  state.transactions.forEach(t => {
    if (NON_JOB_CATEGORIES.includes(t.category)) return;
    if (!filterPasses("customer", t.customer || "")) return;
    if (!filterPassesCategory(t.category)) return;
    if (!filterPasses("payees", t.payee || "")) return;
    const ymKey = (t.date || "").slice(0, 7);
    const d = dataMap.get(ymKey);
    if (!d) return;
    if (t.type === "income")  d.in  += t.amount;
    if (t.type === "expense") d.out += t.amount;
  });

  const totalIn  = data.reduce((s, d) => s + d.in,  0);
  const totalOut = data.reduce((s, d) => s + d.out, 0);
  const net      = totalIn - totalOut;
  const monthsCount = data.length || 1;
  const avg      = net / monthsCount;
  const avgOut   = totalOut / monthsCount;

  // Header + stats
  const totalEl = document.getElementById("cf-total");
  totalEl.textContent = (net >= 0 ? "+" : "") + fmtMoney(net);
  totalEl.style.color = net >= 0 ? "var(--income)" : "var(--expense)";

  const subEl = document.getElementById("cf-subtitle");
  subEl.innerHTML = data.some(d => d.in || d.out)
    ? `On average, ${net >= 0 ? "saving" : "spending"} <strong style="color:${net >= 0 ? 'var(--income)' : 'var(--expense)'}">${fmtMoney(Math.abs(avg))}</strong>/month`
    : `No data for the selected filters.`;

  const netEl = document.getElementById("cf-stat-net");
  netEl.textContent = (net >= 0 ? "+" : "") + fmtMoney(net);
  netEl.style.color = net >= 0 ? "var(--income)" : "var(--expense)";

  const avgEl = document.getElementById("cf-stat-avg");
  avgEl.textContent = fmtMoney(avg);
  avgEl.style.color = avg >= 0 ? "var(--income)" : "var(--expense)";
  document.getElementById("cf-stat-avg-sub").textContent = "Out: " + fmtMoney(avgOut);
  document.getElementById("cf-stat-in").textContent  = fmtMoney(totalIn);
  document.getElementById("cf-stat-out").textContent = fmtMoney(totalOut);

  // Build the chart SVG
  const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  const baseWidth = 800, height = 380;
  // On mobile we rotate month labels 45° to prevent overlap, so reserve more
  // bottom padding for them.
  const padL = 64, padR = 20, padT = 18, padB = isMobile ? 80 : 36;
  const basePlotW = baseWidth - padL - padR;
  const groupCount = data.length || 1;
  const lockedSlot = basePlotW / 12;
  const scrolling  = groupCount > 12;
  const plotW   = scrolling ? lockedSlot * groupCount : basePlotW;
  const width   = padL + padR + plotW;
  const plotH   = height - padT - padB;

  const maxIn  = Math.max(0, ...data.map(d => d.in));
  const maxOut = Math.max(0, ...data.map(d => d.out));
  const maxAbs = Math.max(maxIn, maxOut, 1);
  const tickStep = pickAxisStep(maxAbs, 4);
  const yTop = Math.ceil(maxAbs / tickStep) * tickStep || tickStep;
  const yBottom = -yTop;
  const yRange = yTop - yBottom || 1;
  const yFor = v => padT + ((yTop - v) / yRange) * plotH;

  const groupSlot = plotW / groupCount;
  const barW = Math.max(8, Math.min(groupSlot * 0.6, 56));

  const gridLines = [];
  const yLabels = [];
  for (let v = -yTop; v <= yTop + 0.0001; v += tickStep) {
    const y = yFor(v);
    gridLines.push(`<line class="trend-grid-line" x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}"></line>`);
    yLabels.push(`<text class="cf-yaxis" x="${padL - 8}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="var(--muted)" font-size="11" font-variant-numeric="tabular-nums">${fmtCashAxis(v)}</text>`);
  }

  const showBars = cashFlowMode === "flow";
  const bars = !showBars ? "" : data.map((d, i) => {
    const cx = padL + groupSlot * (i + 0.5);
    const x = cx - barW / 2;
    const inTop  = yFor(d.in);
    const outBot = yFor(-d.out);
    const zeroY  = yFor(0);
    const hasIn  = d.in  > 0;
    const hasOut = d.out > 0;
    return `
      ${hasIn  ? `<rect x="${x}" y="${inTop}" width="${barW}" height="${Math.max(0, zeroY - inTop)}" fill="var(--income)"  rx="3"><title>${escapeHtml(d.label)}: In ${fmtMoney(d.in)}</title></rect>`  : ""}
      ${hasOut ? `<rect x="${x}" y="${zeroY}"  width="${barW}" height="${Math.max(0, outBot - zeroY)}" fill="var(--expense)" rx="3"><title>${escapeHtml(d.label)}: Out ${fmtMoney(d.out)}</title></rect>` : ""}
    `;
  }).join("");

  const monthLabels = data.map((d, i) => {
    const cx = padL + groupSlot * (i + 0.5);
    const ly = height - padB + 16;
    return isMobile
      ? `<text class="cf-xaxis" x="${cx}" y="${ly}" text-anchor="start" transform="rotate(45 ${cx} ${ly})" fill="var(--muted)" font-size="11">${escapeHtml(d.label)}</text>`
      : `<text class="cf-xaxis" x="${cx}" y="${ly}" text-anchor="middle" fill="var(--muted)" font-size="11">${escapeHtml(d.label)}</text>`;
  }).join("");

  const linePoints = data.map((d, i) => {
    const cx = padL + groupSlot * (i + 0.5);
    const cy = yFor(d.in - d.out);
    return `${cx},${cy}`;
  }).join(" ");
  const lineDots = data.map((d, i) => {
    const cx = padL + groupSlot * (i + 0.5);
    const cy = yFor(d.in - d.out);
    return `<circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--primary)" stroke="var(--surface)" stroke-width="1.5"/>`;
  }).join("");

  chartEl.classList.toggle("scrollable", scrolling);
  chartEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet"${scrolling ? ` style="width:${width}px; height:${height}px; max-width:none;"` : ""}>
      ${gridLines.join("")}
      ${yLabels.join("")}
      <line x1="${padL}" y1="${yFor(0)}" x2="${padL + plotW}" y2="${yFor(0)}" stroke="var(--border)" stroke-width="1"/>
      ${bars}
      <polyline points="${linePoints}" fill="none" stroke="var(--primary)" stroke-width="${showBars ? 2 : 3}" />
      ${lineDots}
      ${monthLabels}
    </svg>
  `;

  // Monthly list — newest first
  listEl.innerHTML = data.slice().reverse().map(d => {
    const netD = d.in - d.out;
    const sign = netD >= 0 ? "+" : "-";
    const color = netD >= 0 ? "var(--income)" : "var(--expense)";
    return `
      <li class="cf-row">
        <div class="cf-row-month">${escapeHtml(d.label)}</div>
        <div class="cf-row-net" style="color:${color}">${sign}${fmtMoney(Math.abs(netD))}</div>
        <div class="cf-row-detail">In ${fmtMoney(d.in)} / Out ${fmtMoney(d.out)}</div>
      </li>
    `;
  }).join("");
}

// --------- Transaction Modal ---------
const modal = document.getElementById("tx-modal");
const txForm = document.getElementById("tx-form");

function openTxModal(tx) {
  populateDatalist("payee-datalist", state.payees);
  populateDatalist("category-datalist", state.categories);
  populateDatalist("account-datalist", state.accounts);
  populateDatalist("vendor-datalist", state.vendors);
  // Customer is a <select> dropdown (with a "+ Add new…" option to prompt for a new name)
  const custSel = document.getElementById("tx-customer");
  if (custSel) {
    const customers = Array.isArray(state.customers) ? state.customers : [];
    custSel.innerHTML =
      `<option value="">— None —</option>` +
      customers.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("") +
      `<option value="__new__">+ Add new…</option>`;
  }
  populateChartAccountSelect("tx-chart-account");

  const hasId = !!tx?.id;
  const isDup = tx && !hasId;
  document.getElementById("modal-title").textContent =
    hasId ? "Edit Transaction" :
    isDup ? "Duplicate Transaction" :
    "New Transaction";
  document.getElementById("tx-id").value = tx?.id || "";
  document.getElementById("btn-delete-tx").style.display = hasId ? "inline-block" : "none";
  document.getElementById("btn-duplicate-tx").style.display = hasId ? "inline-block" : "none";
  document.getElementById("tx-date").value = tx?.date || new Date().toISOString().slice(0, 10);
  document.getElementById("tx-payee").value = tx?.payee || "";
  document.getElementById("tx-vendor").value = tx?.vendor || "";
  // Set customer select; if saved value isn't in the list, add it so it stays selected.
  const custSelEl = document.getElementById("tx-customer");
  const initialCust = tx?.customer || "";
  if (custSelEl && initialCust && ![...custSelEl.options].some(o => o.value === initialCust)) {
    const opt = document.createElement("option");
    opt.value = initialCust;
    opt.textContent = initialCust;
    custSelEl.insertBefore(opt, custSelEl.querySelector('option[value="__new__"]'));
  }
  if (custSelEl) custSelEl.value = initialCust;
  document.getElementById("tx-outflow").value = tx && tx.type === "expense" ? tx.amount : "";
  document.getElementById("tx-inflow").value = tx && tx.type === "income" ? tx.amount : "";
  document.getElementById("tx-category").value = tx?.category || "";
  document.getElementById("tx-account").value = tx?.account || "";
  document.getElementById("tx-memo").value = tx?.memo || "";
  document.getElementById("tx-tags").value = (tx?.tags || []).join(", ");
  document.getElementById("tx-chart-account").value = tx?.chartAccount || "";
  // Hours field removed from the form — legacy tx.hours stays on the record.
  // Hours only matters for Income — hide the row when Outflow has a value.
  if (typeof updateTxHoursVisibility === "function") updateTxHoursVisibility();

  modal.classList.remove("hidden");
  // Only auto-focus on desktop. On mobile, focusing an input pops the keyboard
  // and scrolls the form around — users prefer to tap the field they want.
  const isMobile = window.matchMedia("(max-width: 768px)").matches
    || ("ontouchstart" in window && window.innerWidth < 1024);
  if (!isMobile) {
    document.getElementById("tx-payee").focus();
  } else {
    // Aggressively clear focus so iOS keyboard stays down
    const killFocus = () => {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    };
    killFocus();
    // iOS sometimes delays focus transitions — blur again on next ticks
    setTimeout(killFocus, 0);
    setTimeout(killFocus, 50);
    setTimeout(killFocus, 200);
  }
}

function closeTxModal() {
  modal.classList.add("hidden");
  txForm.reset();
}

document.getElementById("btn-new-tx").addEventListener("click", () => openTxModal(null));
document.getElementById("btn-cancel-tx").addEventListener("click", closeTxModal);
modal.addEventListener("click", e => { if (e.target === modal) closeTxModal(); });

document.getElementById("btn-delete-tx").addEventListener("click", () => {
  const id = document.getElementById("tx-id").value;
  if (!id) return;
  const orig = state.transactions.find(t => t.id === id);
  if (orig && isLockedDate(orig.date)) { blockedToast(orig.date.slice(0, 4)); return; }
  if (!confirm("Delete this transaction?")) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState();
  closeTxModal();
  render();
});

document.getElementById("btn-duplicate-tx").addEventListener("click", () => {
  // Snapshot the current form values (no id), then re-open the modal in "new" mode.
  // Detect type by which field has a value (so $0 amounts are allowed).
  const outflowRaw = document.getElementById("tx-outflow").value.trim();
  const inflowRaw  = document.getElementById("tx-inflow").value.trim();
  const outflow = parseFloat(outflowRaw);
  const inflow  = parseFloat(inflowRaw);
  const hasInflow = inflowRaw !== "" && !isNaN(inflow);
  const type = hasInflow ? "income" : "expense";
  const amount = type === "income" ? (isNaN(inflow) ? 0 : inflow) : (isNaN(outflow) ? 0 : outflow);
  const dup = {
    // intentionally no id → modal treats as a duplicate / new
    date: document.getElementById("tx-date").value || new Date().toISOString().slice(0, 10),
    payee: document.getElementById("tx-payee").value,
    vendor: document.getElementById("tx-vendor").value,
    customer: document.getElementById("tx-customer").value,
    type,
    amount,
    category: document.getElementById("tx-category").value,
    account: document.getElementById("tx-account").value,
    memo: document.getElementById("tx-memo").value,
    tags: document.getElementById("tx-tags").value.split(",").map(s => s.trim()).filter(Boolean),
    chartAccount: document.getElementById("tx-chart-account").value,
  };
  closeTxModal();
  openTxModal(dup);
});

// --------- App Info Modal ---------
const appInfoModal = document.getElementById("app-info-modal");

async function countLines(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    // Match Unix line count: number of \n in the file (empty file => 0)
    if (!text.length) return 0;
    const matches = text.match(/\n/g);
    return (matches ? matches.length : 0) + (text.endsWith("\n") ? 0 : 1);
  } catch {
    return null;
  }
}

// Derive a best-guess URL for each source file. Uses the actual element src/href
// when present (so we don't guess a relative path that might not resolve), and
// falls back to a filename in the current directory.
function appInfoUrls() {
  const scriptEl = document.querySelector('script[src*="app.js"]');
  const linkEl   = document.querySelector('link[rel="stylesheet"][href*="styles.css"]');
  // Strip the ?v=... cache-buster so we measure the actual file the browser
  // fetches (not a stale cached version).
  const clean = u => u ? u.split("?")[0] : u;
  return {
    js:   clean(scriptEl?.src)  || new URL("app.js",     location.href).href,
    css:  clean(linkEl?.href)   || new URL("styles.css", location.href).href,
    html: new URL("index.html", location.href).href,
  };
}

function openAppInfo() {
  const jsEl    = document.getElementById("app-info-js");
  const cssEl   = document.getElementById("app-info-css");
  const htmlEl  = document.getElementById("app-info-html");
  const totalEl = document.getElementById("app-info-total");
  [jsEl, cssEl, htmlEl].forEach(el => { if (el) el.textContent = "counting…"; });
  if (totalEl) totalEl.innerHTML = "<strong>—</strong>";
  appInfoModal.classList.remove("hidden");

  const urls = appInfoUrls();
  Promise.all([
    countLines(urls.js),
    countLines(urls.css),
    countLines(urls.html),
  ]).then(([js, css, html]) => {
    // Fallbacks: if the network fetch fails for the HTML shell, we can still
    // count the live DOM serialization as a reasonable proxy.
    if (html == null) {
      const src = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
      html = (src.match(/\n/g) || []).length + 1;
    }
    const fmt = n => (n == null ? "?" : n.toLocaleString());
    if (jsEl)   jsEl.textContent   = fmt(js);
    if (cssEl)  cssEl.textContent  = fmt(css);
    if (htmlEl) htmlEl.textContent = fmt(html);
    const total = [js, css, html].reduce((s, n) => s + (n || 0), 0);
    if (totalEl) totalEl.innerHTML = `<strong>${total.toLocaleString()}</strong>`;
  }).catch(err => {
    console.error("App Info failed:", err);
    [jsEl, cssEl, htmlEl].forEach(el => { if (el) el.textContent = "?"; });
    if (totalEl) totalEl.innerHTML = "<strong>?</strong>";
  });
}
function closeAppInfo() { appInfoModal.classList.add("hidden"); }

document.getElementById("btn-app-info").addEventListener("click", openAppInfo);

// One-off data fix: rename a bare payee (e.g. "Diane", "Cost") to
// "<Payee> <Category>" so each transaction is distinguishable by its category.
// Idempotent — already-renamed entries are skipped.
function mergePayeeWithCategory(targetPayee) {
  const targets = state.transactions.filter(t => (t.payee || "").trim() === targetPayee);
  if (!targets.length) {
    alert(`No transactions found with payee exactly equal to "${targetPayee}".`);
    return;
  }
  const byCat = {};
  targets.forEach(t => {
    const cat = (t.category || "").trim() || "Uncategorized";
    byCat[cat] = (byCat[cat] || 0) + 1;
  });
  const lines = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => `  • ${n}× → "${targetPayee} ${cat}"`)
    .join("\n");
  if (!confirm(`Rename ${targets.length} transaction(s) with payee "${targetPayee}":\n\n${lines}\n\nProceed?`)) return;

  let renamed = 0;
  const newPayees = new Set(state.payees || []);
  targets.forEach(t => {
    const cat = (t.category || "").trim();
    const newName = cat ? `${targetPayee} ${cat}` : targetPayee;
    if (t.payee === newName) return;
    t.payee = newName;
    newPayees.add(newName);
    renamed++;
  });
  const stillUsingBare = state.transactions.some(t => (t.payee || "") === targetPayee);
  if (!stillUsingBare) newPayees.delete(targetPayee);
  state.payees = [...newPayees].sort((a, b) => a.localeCompare(b));

  saveState();
  render();
  alert(`Renamed ${renamed} transaction(s).`);
}

document.getElementById("btn-merge-diane-cat")?.addEventListener("click", () => mergePayeeWithCategory("Diane"));
document.getElementById("btn-merge-cost-cat")?.addEventListener("click",  () => mergePayeeWithCategory("Cost"));

// One-off data fix: copy memo into Customer for any transaction where Customer
// is blank and Memo has content. Adds those memo values to state.customers so
// they show up in the customer pickers/filters afterward.
document.getElementById("btn-fill-customer-from-memo")?.addEventListener("click", () => {
  const targets = state.transactions.filter(t =>
    !((t.customer || "").trim()) && ((t.memo || "").trim())
  );
  if (!targets.length) {
    alert("No transactions with a blank Customer and a non-blank Memo.");
    return;
  }
  // Preview a few examples + count by memo value so the user sees what's about to happen.
  const byMemo = {};
  targets.forEach(t => {
    const m = (t.memo || "").trim();
    byMemo[m] = (byMemo[m] || 0) + 1;
  });
  const samples = Object.entries(byMemo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([m, n]) => `  • ${n}× → "${m}"`)
    .join("\n");
  const more = Object.keys(byMemo).length > 12 ? `\n  …and ${Object.keys(byMemo).length - 12} more distinct memos` : "";
  if (!confirm(`Copy the Memo into Customer for ${targets.length} transaction(s):\n\n${samples}${more}\n\nProceed?`)) return;

  const customersSet = new Set(state.customers || []);
  let updated = 0;
  targets.forEach(t => {
    const m = (t.memo || "").trim();
    if (!m) return;
    t.customer = m;
    customersSet.add(m);
    updated++;
  });
  state.customers = [...customersSet].sort((a, b) => a.localeCompare(b));

  saveState();
  render();
  alert(`Filled Customer on ${updated} transaction(s) from their Memo.`);
});
document.getElementById("btn-close-app-info").addEventListener("click", closeAppInfo);
appInfoModal.addEventListener("click", e => { if (e.target === appInfoModal) closeAppInfo(); });

// Customer "+ Add new…" option in the tx modal — prompt then insert + select
document.getElementById("tx-customer").addEventListener("change", e => {
  if (e.target.value !== "__new__") return;
  const name = (prompt("New customer name:") || "").trim();
  if (!name) { e.target.value = ""; return; }
  if (!Array.isArray(state.customers)) state.customers = [];
  if (!state.customers.includes(name)) {
    state.customers.push(name);
    state.customers.sort();
    saveState();
  }
  // Re-populate the dropdown so the new entry appears in sorted order
  const opts = [`<option value="">— None —</option>`]
    .concat(state.customers.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`))
    .concat([`<option value="__new__">+ Add new…</option>`]);
  e.target.innerHTML = opts.join("");
  e.target.value = name;
});

// Mutually exclusive Outflow / Inflow — typing in one clears the other
const outflowInput = document.getElementById("tx-outflow");
const inflowInput = document.getElementById("tx-inflow");

outflowInput.addEventListener("input", () => {
  if (outflowInput.value !== "") inflowInput.value = "";
  updateTxHoursVisibility();
});
inflowInput.addEventListener("input", () => {
  if (inflowInput.value !== "") outflowInput.value = "";
  updateTxHoursVisibility();
});

// Highlight the full value when focusing the amount fields so typing replaces it.
[outflowInput, inflowInput].forEach(el => {
  if (!el) return;
  el.addEventListener("focus", () => {
    // Defer selection until the focus settles (Firefox / Safari quirk)
    setTimeout(() => { try { el.select(); } catch {} }, 0);
  });
  el.addEventListener("click", () => {
    try { el.select(); } catch {}
  });
});

// The Hours field only matters for Income — hide it whenever Outflow is in use
// so the form doesn't suggest expenses can have hours.
function updateTxHoursVisibility() {
  // Hours stays visible for both inflow and outflow per user request.
  const row = document.getElementById("tx-hours-row");
  if (!row) return;
  row.style.display = "";
}

document.getElementById("btn-swap-flow").addEventListener("click", () => {
  const o = outflowInput.value;
  const i = inflowInput.value;
  outflowInput.value = i;
  inflowInput.value = o;
});

txForm.addEventListener("submit", e => {
  e.preventDefault();
  const id = document.getElementById("tx-id").value;
  const payee = document.getElementById("tx-payee").value.trim();
  const vendor = document.getElementById("tx-vendor").value.trim();
  const customer = document.getElementById("tx-customer").value.trim();
  const tagsRaw = document.getElementById("tx-tags").value.trim();
  const newDateRaw = document.getElementById("tx-date").value;

  // Locked-year guard: block edits where either the original or new date
  // falls in a locked year so users can't move tx into/out of a locked year.
  const lockedYearOld = id ? (() => {
    const orig = state.transactions.find(t => t.id === id);
    return orig && isLockedDate(orig.date) ? orig.date.slice(0, 4) : null;
  })() : null;
  const lockedYearNew = isLockedDate(newDateRaw) ? newDateRaw.slice(0, 4) : null;
  if (lockedYearOld) { blockedToast(lockedYearOld); return; }
  if (lockedYearNew) { blockedToast(lockedYearNew); return; }

  // Customer is required only when Payee is "Job"
  if (payee.toLowerCase() === "job" && !customer) {
    alert("Customer is required when Payee is \"Job\".");
    document.getElementById("tx-customer").focus();
    return;
  }
  // Detect "field has a value" (including 0) by checking the raw string,
  // so the user can record a $0 transaction in either column.
  const outflowRaw = document.getElementById("tx-outflow").value.trim();
  const inflowRaw  = document.getElementById("tx-inflow").value.trim();
  const outflow = parseFloat(outflowRaw);
  const inflow  = parseFloat(inflowRaw);
  const hasOutflow = outflowRaw !== "" && !isNaN(outflow);
  const hasInflow  = inflowRaw  !== "" && !isNaN(inflow);

  if (!hasOutflow && !hasInflow) {
    alert("Enter an amount in either Outflow or Inflow.");
    return;
  }
  if (hasOutflow && hasInflow) {
    alert("Enter an amount in only one of Outflow or Inflow, not both.");
    return;
  }

  const type = hasOutflow ? "expense" : "income";
  const amount = hasOutflow ? outflow : inflow;
  const category = document.getElementById("tx-category").value.trim();
  // This app only uses one Account — pick the first known account,
  // fall back to the default label so every tx still has a populated account.
  const account = (state.accounts[0] || document.getElementById("tx-account").value || "📷 Photo - (1506)").trim();

  const existing = id ? state.transactions.find(t => t.id === id) : null;

  const tx = {
    id: id || uid(),
    type,
    date: document.getElementById("tx-date").value,
    payee,
    vendor,
    customer,
    amount,
    category,
    account,
    memo: document.getElementById("tx-memo").value.trim(),
    tags: tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [],
    reconciled: existing?.reconciled || "",
    chartAccount: document.getElementById("tx-chart-account").value,
  };
  // Preserve any pre-existing hours value on edit so legacy data isn't dropped.
  if (existing?.hours != null) tx.hours = existing.hours;

  if (id) {
    const idx = state.transactions.findIndex(t => t.id === id);
    if (idx >= 0) state.transactions[idx] = tx;
  } else {
    state.transactions.push(tx);
  }

  // Auto-track payees
  if (payee && !state.payees.includes(payee)) {
    state.payees.push(payee);
    state.payees.sort();
  }

  // Auto-track vendors
  if (vendor && !state.vendors.includes(vendor)) {
    state.vendors.push(vendor);
    state.vendors.sort();
  }

  // Auto-track customers
  if (!Array.isArray(state.customers)) state.customers = [];
  if (customer && !state.customers.includes(customer)) {
    state.customers.push(customer);
    state.customers.sort();
  }

  // Auto-track categories
  if (category && !state.categories.includes(category)) {
    state.categories.push(category);
    state.categories.sort();
  }

  // Auto-track accounts
  if (account && !state.accounts.includes(account)) {
    state.accounts.push(account);
    state.accounts.sort();
  }

  saveState();
  closeTxModal();
  render();
  if (window.toast) toast(id ? "Transaction updated" : "Transaction saved", { kind: "success" });
});

// --------- Helpers ---------
function populateSelect(id, values, keepPlaceholder) {
  const el = document.getElementById(id);
  const current = el.value;
  const first = keepPlaceholder ? el.querySelector("option").outerHTML : "";
  el.innerHTML = first + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  if (values.includes(current)) el.value = current;
}

function populateDatalist(id, values) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = values.map(v => `<option value="${escapeHtml(v)}"></option>`).join("");
}

// Populate a <select> with the Chart of Accounts, grouped by type with sub-account indentation.
function populateChartAccountSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const current = sel.value;
  // Group by type, preserving the canonical order of CHART_ACCOUNT_TYPES
  const byType = {};
  (state.chartAccounts || []).forEach(a => {
    if (!byType[a.type]) byType[a.type] = [];
    byType[a.type].push(a);
  });
  let html = `<option value="">— None —</option>`;
  CHART_ACCOUNT_TYPES.forEach(type => {
    const list = byType[type];
    if (!list || !list.length) return;
    html += `<optgroup label="${escapeHtml(type)}">`;
    // Parents first, then children indented
    const parents = list.filter(a => !a.parent);
    const children = list.filter(a => a.parent);
    parents.forEach(p => {
      html += `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`;
      children.filter(c => c.parent === p.name).forEach(c => {
        html += `<option value="${escapeHtml(p.name + ":" + c.name)}">&nbsp;&nbsp;&nbsp;${escapeHtml(c.name)}</option>`;
      });
    });
    // Orphaned children (parent missing or in different type) — list as-is
    children.filter(c => !parents.some(p => p.name === c.parent)).forEach(c => {
      html += `<option value="${escapeHtml(c.parent + ":" + c.name)}">${escapeHtml(c.parent + ":" + c.name)}</option>`;
    });
    html += `</optgroup>`;
  });
  sel.innerHTML = html;
  sel.value = current;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --------- Filters ---------
// __txDrillFilter: optional predicate set when drilling in from a By Category
// card. Lets us narrow Transactions to exactly the tx counted on the card
// (which honors the universal Date Range / Customer / Payee filters that
// Transactions itself doesn't expose). Cleared as soon as the user touches
// any of the Transactions tab's own filters so it never sticks around.
let __txDrillFilter = null;

// All Categories filter — custom button + panel matching the All Charts /
// All Jobs look, single-select. Backed by the hidden #tx-filter-category
// select so existing render/filter code keeps reading its value.
function rebuildTxFilterCategoryList() {
  const list = document.getElementById("tx-filter-category-list");
  const sel  = document.getElementById("tx-filter-category");
  if (!list || !sel) return;
  const cur = sel.value || "";
  const cats = (state.categories || []).slice().sort((a, b) => a.localeCompare(b));
  const items = [{ value: "", label: "All Categories" }, ...cats.map(c => ({ value: c, label: c }))];
  list.innerHTML = items.map(it => {
    const selCls = it.value === cur ? " is-selected" : "";
    return `<button type="button" class="tx-filter-jobno-item${selCls}" data-value="${escapeHtml(it.value)}">${escapeHtml(it.label)}</button>`;
  }).join("");
}
function refreshTxFilterCategoryButtonLabel() {
  const btn = document.getElementById("tx-filter-category-btn");
  const sel = document.getElementById("tx-filter-category");
  if (!btn || !sel) return;
  btn.firstChild.nodeValue = (sel.value || "All Categories") + " ";
}
(function wireTxFilterCategoryPanel() {
  const btn = document.getElementById("tx-filter-category-btn");
  const panel = document.getElementById("tx-filter-category-panel");
  const list = document.getElementById("tx-filter-category-list");
  const sel = document.getElementById("tx-filter-category");
  if (!btn || !panel || !list || !sel) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = panel.hidden;
    if (opening) {
      rebuildTxFilterCategoryList();
      closeOtherNestedFilterPanels("tx-filter-category-panel");
    }
    panel.hidden = !opening;
    if (!panel.hidden) requestAnimationFrame(() => positionNestedFilterPanel(btn, panel));
  });
  document.addEventListener("click", (e) => {
    if (panel.hidden) return;
    if (e.target.closest("#tx-filter-category-panel") || e.target.closest("#tx-filter-category-btn")) return;
    panel.hidden = true;
  });
  list.addEventListener("click", (e) => {
    const item = e.target.closest(".tx-filter-jobno-item");
    if (!item) return;
    sel.value = item.dataset.value || "";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    refreshTxFilterCategoryButtonLabel();
    panel.hidden = true;
  });
  sel.addEventListener("change", refreshTxFilterCategoryButtonLabel);
  refreshTxFilterCategoryButtonLabel();
})();

// All Jobs filter — custom button + panel matching the All Charts look,
// but single-select. Backed by the hidden #tx-filter-jobno select so existing
// render/filter code keeps reading its value.
function rebuildTxFilterJobNoList() {
  const list = document.getElementById("tx-filter-jobno-list");
  const sel  = document.getElementById("tx-filter-jobno");
  if (!list || !sel) return;
  const cur = sel.value || "";
  const jobs = (state.jobs || []).slice().sort((a, b) => (b.jobNo || "").localeCompare(a.jobNo || ""));
  const items = [
    { value: "",         label: "All Jobs" },
    { value: "__any__",  label: "Only Jobs" },
    { value: "__none__", label: "No Job" },
    ...jobs.map(j => ({
      value: j.jobNo,
      label: `${j.jobNo} - ${j.customer || ""}${j.category ? " / " + j.category : ""}`,
    })),
  ];
  list.innerHTML = items.map(it => {
    const sel = it.value === cur ? " is-selected" : "";
    return `<button type="button" class="tx-filter-jobno-item${sel}" data-value="${escapeHtml(it.value)}">${escapeHtml(it.label)}</button>`;
  }).join("");
}
function refreshTxFilterJobNoButtonLabel() {
  const btn = document.getElementById("tx-filter-jobno-btn");
  const sel = document.getElementById("tx-filter-jobno");
  if (!btn || !sel) return;
  const v = sel.value || "";
  let label = "All Jobs";
  if (v === "__any__")  label = "Only Jobs";
  else if (v === "__none__") label = "No Job";
  else if (v) {
    const job = (state.jobs || []).find(j => j.jobNo === v);
    label = job ? `${job.jobNo}` : v;
  }
  btn.firstChild.nodeValue = label + " ";
}
(function wireTxFilterJobNoPanel() {
  const btn = document.getElementById("tx-filter-jobno-btn");
  const panel = document.getElementById("tx-filter-jobno-panel");
  const list = document.getElementById("tx-filter-jobno-list");
  const sel = document.getElementById("tx-filter-jobno");
  if (!btn || !panel || !list || !sel) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = panel.hidden;
    if (opening) {
      rebuildTxFilterJobNoList();
      closeOtherNestedFilterPanels("tx-filter-jobno-panel");
    }
    panel.hidden = !opening;
    if (!panel.hidden) requestAnimationFrame(() => positionNestedFilterPanel(btn, panel));
  });
  document.addEventListener("click", (e) => {
    if (panel.hidden) return;
    if (e.target.closest("#tx-filter-jobno-panel") || e.target.closest("#tx-filter-jobno-btn")) return;
    panel.hidden = true;
  });
  list.addEventListener("click", (e) => {
    const item = e.target.closest(".tx-filter-jobno-item");
    if (!item) return;
    sel.value = item.dataset.value || "";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    refreshTxFilterJobNoButtonLabel();
    panel.hidden = true;
  });
  // Keep the button label fresh when something else changes the select.
  sel.addEventListener("change", refreshTxFilterJobNoButtonLabel);
  refreshTxFilterJobNoButtonLabel();
})();

// Position a nested filter panel (Categories/Jobs/Charts) at fixed viewport
// coordinates anchored to its trigger button. Picks the side with the most
// room (right by default; left if the panel would overflow off-screen).
function closeOtherNestedFilterPanels(exceptId) {
  ["tx-filter-category-panel", "tx-filter-jobno-panel", "tx-filter-chart-panel"].forEach(id => {
    if (id === exceptId) return;
    const p = document.getElementById(id);
    if (p && !p.hidden) p.hidden = true;
  });
}
function positionNestedFilterPanel(btn, panel) {
  if (!btn || !panel) return;
  const r = btn.getBoundingClientRect();
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  const panelW = Math.min(panel.offsetWidth || 240, vpW - 24);
  panel.style.minWidth = "220px";
  panel.style.maxWidth = `${vpW - 24}px`;
  // Prefer placing to the right of the button; fall back to left if it
  // would overflow, or below it if neither side fits.
  let left = r.right + 8;
  if (left + panelW + 8 > vpW) {
    left = Math.max(12, r.left - panelW - 8);
  }
  // Vertical: align top of panel near top of button, but clamp inside viewport.
  let top = Math.max(12, r.top - 4);
  const panelH = panel.offsetHeight || 240;
  if (top + panelH + 12 > vpH) {
    top = Math.max(12, vpH - panelH - 12);
  }
  panel.style.left = `${left}px`;
  panel.style.top  = `${top}px`;
}

// Combined Filters dropdown — moves the existing All Jobs + All Charts
// wraps into the merged panel so the toolbar shows just one "Filters" button.
(function setupCombinedFiltersPanel() {
  const panel = document.getElementById("tx-filter-combined-panel");
  const btn   = document.getElementById("tx-filter-combined-btn");
  if (!panel || !btn) return;
  const jobsRow   = document.getElementById("tx-filter-combined-row-jobs");
  const chartsRow = document.getElementById("tx-filter-combined-row-charts");
  const jobsWrap  = document.querySelector(".tx-filter-jobno-wrap");
  const chartsWrap = document.querySelector(".tx-filter-chart-wrap.tx-filter-chart-wrap-original")
                  || document.querySelector(".toolbar > .tx-filter-chart-wrap:not(.tx-filter-combined-wrap):not(.tx-filter-category-wrap):not(.tx-filter-jobno-wrap)");
  if (jobsRow && jobsWrap)     jobsRow.appendChild(jobsWrap);
  if (chartsRow && chartsWrap) chartsRow.appendChild(chartsWrap);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
  });
  document.addEventListener("click", (e) => {
    if (panel.hidden) return;
    if (e.target.closest("#tx-filter-combined-panel") || e.target.closest("#tx-filter-combined-btn")) return;
    // Don't close if a nested filter panel (Category/Jobs/Charts) is open.
    const nestedOpen = panel.querySelector(".tx-filter-chart-panel:not([hidden])");
    if (nestedOpen && (e.target.closest(".tx-filter-chart-panel") || e.target.closest(".tx-filter-chart-btn"))) return;
    panel.hidden = true;
  });
})();

// Sort by Job No. — only visible when the All Jobs filter = "Only Jobs".
let txSortByJobNo = false;
(function wireTxSortJobNo() {
  const btn = document.getElementById("tx-sort-jobno");
  if (!btn) return;
  btn.addEventListener("click", () => {
    txSortByJobNo = !txSortByJobNo;
    btn.textContent = txSortByJobNo ? "Sort: Job No." : "Sort: Date";
    if (typeof renderTransactions === "function") renderTransactions();
  });
})();
function refreshTxSortJobNoVisibility() {
  const btn = document.getElementById("tx-sort-jobno");
  const sel = document.getElementById("tx-filter-jobno");
  if (!btn || !sel) return;
  const onlyJobs = sel.value === "__any__";
  btn.hidden = !onlyJobs;
  if (!onlyJobs && txSortByJobNo) {
    txSortByJobNo = false;
    btn.textContent = "Sort: Date";
  }
}

// Chart of Accounts multi-select filter (between All Types and Search).
// `null` means "no filter / all"; an empty Set means "none selected".
let txFilterCharts = null;
function refreshTxFilterChartUi() {
  const btn = document.getElementById("tx-filter-chart-btn");
  if (!btn) return;
  if (!txFilterCharts || !txFilterCharts.size) {
    btn.firstChild.nodeValue = "All Charts ";
  } else if (txFilterCharts.size === 1) {
    btn.firstChild.nodeValue = `${[...txFilterCharts][0]} `;
  } else {
    btn.firstChild.nodeValue = `${txFilterCharts.size} Charts `;
  }
}
function rebuildTxFilterChartList() {
  const list = document.getElementById("tx-filter-chart-list");
  if (!list) return;
  const charts = Array.from(new Set(
    (state.transactions || []).map(t => (t.chartAccount || "").trim()).filter(Boolean)
  )).sort();
  list.innerHTML = charts.map(c => {
    const checked = txFilterCharts && txFilterCharts.has(c) ? " checked" : "";
    return `<label><input type="checkbox" value="${escapeHtml(c)}"${checked} /> ${escapeHtml(c)}</label>`;
  }).join("") || `<div class="muted" style="padding:8px;font-size:12px">No Chart of Accounts in transactions yet.</div>`;
}
(function wireTxFilterChart() {
  const btn = document.getElementById("tx-filter-chart-btn");
  const panel = document.getElementById("tx-filter-chart-panel");
  const list = document.getElementById("tx-filter-chart-list");
  if (!btn || !panel || !list) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = panel.hidden;
    if (opening) {
      rebuildTxFilterChartList();
      closeOtherNestedFilterPanels("tx-filter-chart-panel");
    }
    panel.hidden = !opening;
    if (!panel.hidden) requestAnimationFrame(() => positionNestedFilterPanel(btn, panel));
  });
  document.addEventListener("click", (e) => {
    if (panel.hidden) return;
    if (e.target.closest("#tx-filter-chart-panel") || e.target.closest("#tx-filter-chart-btn")) return;
    panel.hidden = true;
  });
  list.addEventListener("change", (e) => {
    const cb = e.target.closest('input[type="checkbox"]');
    if (!cb) return;
    if (!txFilterCharts) txFilterCharts = new Set();
    if (cb.checked) txFilterCharts.add(cb.value);
    else txFilterCharts.delete(cb.value);
    if (!txFilterCharts.size) txFilterCharts = null;
    refreshTxFilterChartUi();
    if (typeof renderTransactions === "function") renderTransactions();
  });
  panel.querySelector('[data-act="all"]').addEventListener("click", () => {
    txFilterCharts = null;
    list.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
    refreshTxFilterChartUi();
    if (typeof renderTransactions === "function") renderTransactions();
  });
  panel.querySelector('[data-act="none"]').addEventListener("click", () => {
    txFilterCharts = new Set(); // empty set = "none"
    list.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
    refreshTxFilterChartUi();
    if (typeof renderTransactions === "function") renderTransactions();
  });
})();

["tx-search-all", "tx-filter-year", "tx-filter-category", "tx-filter-type", "tx-filter-jobno"].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  const handler = () => {
    __txDrillFilter = null;
    __txDrillLabel = "";
    renderTransactions();
    refreshTxDrillChip();
  };
  el.addEventListener("input", handler);
  el.addEventListener("change", handler);
});

// "Drill filter active" chip — surfaces when a hidden drill filter is in
// effect (e.g. after double-clicking a By Job card). Lets the user clear
// it without going Back to Analytics.
let __txDrillLabel = "";
function refreshTxDrillChip() {
  const btn = document.getElementById("btn-tx-drill-clear");
  const lbl = document.getElementById("tx-drill-clear-label");
  if (!btn) return;
  const active = !!__txDrillFilter;
  btn.hidden = !active;
  if (active && lbl) lbl.textContent = "Drill: " + (__txDrillLabel || "filtered subset");
}
document.getElementById("btn-tx-drill-clear")?.addEventListener("click", () => {
  __txDrillFilter = null;
  __txDrillLabel = "";
  refreshTxDrillChip();
  renderTransactions();
});

// Magnifying-glass Find button — toggle the expandable input
const btnTxFind = document.getElementById("btn-tx-find");
const txFindWrap = btnTxFind?.closest(".tx-find-wrap");
const txFindInput = document.getElementById("tx-search-all");
if (btnTxFind && txFindWrap && txFindInput) {
  btnTxFind.addEventListener("click", () => {
    const open = txFindWrap.classList.toggle("open");
    if (open) setTimeout(() => txFindInput.focus(), 0);
    else { txFindInput.value = ""; renderTransactions(); }
  });
  // ✕ Close button (mobile Search Mode) — clears input and exits.
  document.getElementById("btn-tx-find-close")?.addEventListener("click", () => {
    txFindInput.value = "";
    txFindWrap.classList.remove("open");
    renderTransactions();
  });
  // Collapse automatically when input loses focus and is empty
  txFindInput.addEventListener("blur", () => {
    if (!txFindInput.value) txFindWrap.classList.remove("open");
  });
}

// --------- Transaction Selection Mode ---------
let txSelectMode = false;

// Toast utility — small floating "Saved" / status confirmation near the
// bottom of the screen. Use as `toast("Saved")` or `toast("Job 26012 saved", { kind: "success" })`.
(function setupToast() {
  let container;
  function ensureContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.createElement("div");
    container.id = "toast-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
    return container;
  }
  window.toast = function (message, opts = {}) {
    if (!message) return;
    const c = ensureContainer();
    const el = document.createElement("div");
    el.className = "toast" + (opts.kind ? " toast-" + opts.kind : "");
    el.textContent = message;
    c.appendChild(el);
    // Force layout, then add .visible so the transition runs.
    void el.offsetWidth;
    el.classList.add("visible");
    const ttl = opts.ttl || 2200;
    setTimeout(() => {
      el.classList.remove("visible");
      setTimeout(() => el.remove(), 250);
    }, ttl);
  };
})();

// Job Analytics swipe-left → reveal Edit action (3-line mode only)
(function setupNjSwipe() {
  const tbl = document.getElementById("nj-analytics-table");
  if (!tbl) return;

  let activeRow = null;
  let panel = null;
  let startX = 0, startY = 0, dx = 0, dy = 0, isSwiping = false, locked = false;
  const REVEAL = 160;
  const TRIGGER = 50;

  function isMobile3Line() {
    return document.body.classList.contains("nj-mobile-3line") &&
           window.matchMedia("(max-width: 768px)").matches;
  }
  function closeSwipe() {
    if (activeRow) {
      activeRow.style.transform = "";
      activeRow.classList.remove("nj-row-swiped");
    }
    if (panel) panel.remove();
    panel = null;
    activeRow = null;
    locked = false;
  }
  function openActions(row) {
    if (panel) panel.remove();
    panel = document.createElement("div");
    panel.className = "nj-row-actions";
    panel.innerHTML = `
      <button type="button" class="nj-action-edit">Edit</button>
      <button type="button" class="nj-action-delete">Delete</button>
    `;
    row.appendChild(panel);
    panel.querySelector(".nj-action-edit").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const jobNo = row.dataset.jobno;
      closeSwipe();
      if (jobNo && typeof openJobEditModal === "function") openJobEditModal(jobNo);
    });
    panel.querySelector(".nj-action-delete").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const jobNo = row.dataset.jobno;
      if (!jobNo) { closeSwipe(); return; }
      const job = (state.jobs || []).find(j => j.jobNo === jobNo);
      if (job && typeof isLockedDate === "function" && isLockedDate(job.date)) {
        if (typeof blockedToast === "function") blockedToast(job.date.slice(0, 4));
        closeSwipe();
        return;
      }
      if (!confirm(`Delete job ${jobNo}? (Job number ${jobNo} will become reusable.)`)) { closeSwipe(); return; }
      state.jobs = (state.jobs || []).filter(j => j.jobNo !== jobNo);
      (state.transactions || []).forEach(t => { if (t.jobNo === jobNo) delete t.jobNo; });
      saveState();
      closeSwipe();
      if (typeof renderNjJobsTable === "function") renderNjJobsTable();
      if (typeof renderNjAnalytics === "function") renderNjAnalytics();
    });
  }

  tbl.addEventListener("touchstart", (e) => {
    if (!isMobile3Line()) return;
    const row = e.target.closest("tr.nj-row-edit");
    if (!row) { if (activeRow) closeSwipe(); return; }
    if (e.target.closest("button, input, select, .nj-row-actions, .nj-job-expand-btn")) return;
    if (locked && activeRow !== row) { closeSwipe(); return; }
    if (activeRow && activeRow !== row) closeSwipe();
    activeRow = row;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0; dy = 0;
    isSwiping = false;
  }, { passive: true });

  tbl.addEventListener("touchmove", (e) => {
    if (!activeRow) return;
    dx = e.touches[0].clientX - startX;
    dy = e.touches[0].clientY - startY;
    if (!isSwiping) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) isSwiping = true;
      else if (Math.abs(dy) > 10) { activeRow = null; return; }
    }
    if (isSwiping) {
      if (e.cancelable) e.preventDefault();
      const base = locked ? -REVEAL : 0;
      const x = Math.min(0, Math.max(-REVEAL, base + dx));
      activeRow.style.transform = `translateX(${x}px)`;
    }
  }, { passive: false });

  tbl.addEventListener("touchend", () => {
    if (!activeRow) return;
    if (isSwiping) {
      const base = locked ? -REVEAL : 0;
      const finalX = base + dx;
      if (finalX < -TRIGGER) {
        activeRow.style.transform = `translateX(-${REVEAL}px)`;
        activeRow.classList.add("nj-row-swiped");
        if (!panel) openActions(activeRow);
        locked = true;
      } else {
        closeSwipe();
      }
    }
    isSwiping = false;
  });

  document.addEventListener("touchstart", (e) => {
    if (!activeRow || !locked) return;
    if (e.target.closest("tr.nj-row-edit") === activeRow) return;
    closeSwipe();
  }, true);
})();

// Mileage trips swipe-left → reveal Edit + Delete (mobile only)
(function setupMileageSwipe() {
  const tbl = document.getElementById("mileage-trips-table");
  if (!tbl) return;

  let activeRow = null;
  let panel = null;
  let startX = 0, startY = 0, dx = 0, dy = 0, isSwiping = false, locked = false;
  const REVEAL = 160;
  const TRIGGER = 50;

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }
  function closeSwipe() {
    if (activeRow) {
      activeRow.style.transform = "";
      activeRow.classList.remove("trip-row-swiped");
    }
    if (panel) panel.remove();
    panel = null;
    activeRow = null;
    locked = false;
  }
  function openActions(row) {
    if (panel) panel.remove();
    panel = document.createElement("div");
    panel.className = "trip-row-actions";
    panel.innerHTML = `
      <button type="button" class="trip-action-edit">Edit</button>
      <button type="button" class="trip-action-delete">Delete</button>
    `;
    row.appendChild(panel);
    panel.querySelector(".trip-action-edit").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const id = row.dataset.id;
      const trip = (state.trips || []).find(t => t.id === id);
      closeSwipe();
      if (trip && typeof openTripModal === "function") openTripModal(trip);
    });
    panel.querySelector(".trip-action-delete").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const id = row.dataset.id;
      if (!id) { closeSwipe(); return; }
      const trip = (state.trips || []).find(t => t.id === id);
      if (trip && typeof isLockedDate === "function" && isLockedDate(trip.date)) {
        if (typeof blockedToast === "function") blockedToast(trip.date.slice(0, 4));
        closeSwipe();
        return;
      }
      if (!confirm("Delete this trip?")) { closeSwipe(); return; }
      state.trips = (state.trips || []).filter(t => t.id !== id);
      saveState();
      closeSwipe();
      if (typeof renderMileage === "function") renderMileage();
      if (window.toast) toast("Trip deleted", { kind: "success" });
    });
  }

  tbl.addEventListener("touchstart", (e) => {
    if (!isMobile()) return;
    const row = e.target.closest("tr.trip-row");
    if (!row) { if (activeRow) closeSwipe(); return; }
    if (e.target.closest("button, input, select, .trip-row-actions")) return;
    if (locked && activeRow !== row) { closeSwipe(); return; }
    if (activeRow && activeRow !== row) closeSwipe();
    activeRow = row;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0; dy = 0;
    isSwiping = false;
  }, { passive: true });

  tbl.addEventListener("touchmove", (e) => {
    if (!activeRow) return;
    dx = e.touches[0].clientX - startX;
    dy = e.touches[0].clientY - startY;
    if (!isSwiping) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) isSwiping = true;
      else if (Math.abs(dy) > 10) { activeRow = null; return; }
    }
    if (isSwiping) {
      if (e.cancelable) e.preventDefault();
      const base = locked ? -REVEAL : 0;
      const x = Math.min(0, Math.max(-REVEAL, base + dx));
      activeRow.style.transform = `translateX(${x}px)`;
    }
  }, { passive: false });

  tbl.addEventListener("touchend", () => {
    if (!activeRow) return;
    if (isSwiping) {
      const base = locked ? -REVEAL : 0;
      const finalX = base + dx;
      if (finalX < -TRIGGER) {
        activeRow.style.transform = `translateX(-${REVEAL}px)`;
        activeRow.classList.add("trip-row-swiped");
        if (!panel) openActions(activeRow);
        locked = true;
      } else {
        closeSwipe();
      }
    }
    isSwiping = false;
  });

  document.addEventListener("touchstart", (e) => {
    if (!activeRow || !locked) return;
    if (e.target.closest("tr.trip-row") === activeRow) return;
    closeSwipe();
  }, true);
})();

// Mileage — open/close the Add Trip modal
(function wireMileageAddModal() {
  function openModal() {
    const m = document.getElementById("mileage-add-modal");
    if (!m) return;
    m.classList.remove("hidden");
    const d = document.getElementById("mileage-new-date");
    if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
    setTimeout(() => d && d.focus(), 0);
  }
  function closeModal() {
    const m = document.getElementById("mileage-add-modal");
    if (m) m.classList.add("hidden");
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("#mileage-open-add-modal")) { openModal(); return; }
    if (e.target.closest("#mileage-cancel-add"))     { closeModal(); return; }
    if (e.target.id === "mileage-add-modal")         { closeModal(); return; }
    // Auto-close after Save Trip — the existing #btn-add-trip handler
    // commits the trip; we just dismiss the modal afterwards.
    if (e.target.closest("#btn-add-trip"))           { setTimeout(closeModal, 0); }
  });
})();

// All Transactions — Clear filters button (resets every toolbar filter)
(function wireTxClearFilters() {
  const btn = document.getElementById("btn-tx-clear-filters");
  if (!btn) return;
  btn.addEventListener("click", () => {
    ["tx-filter-year", "tx-filter-category", "tx-filter-jobno", "tx-filter-type"].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ""; el.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    const search = document.getElementById("tx-search-all");
    if (search) { search.value = ""; search.dispatchEvent(new Event("input", { bubbles: true })); }
    // Reset the multi-select Chart filter too.
    txFilterCharts = null;
    if (typeof refreshTxFilterChartUi === "function") refreshTxFilterChartUi();
    if (typeof refreshTxDrillChip === "function") {
      window.__txDrillFilter = null;
      window.__txDrillLabel = "";
      refreshTxDrillChip();
    }
    if (typeof renderTransactions === "function") renderTransactions();
  });
})();

// New Job — open/close the Add Job modal
(function wireNjAddModal() {
  function openModal() {
    const m = document.getElementById("nj-add-modal");
    if (!m) return;
    m.classList.remove("hidden");
    const d = document.getElementById("nj-date");
    if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
    setTimeout(() => d && d.focus(), 0);
  }
  function closeModal() {
    const m = document.getElementById("nj-add-modal");
    if (m) m.classList.add("hidden");
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("#nj-open-add-modal")) { openModal(); return; }
    if (e.target.closest("#nj-cancel-add"))     { closeModal(); return; }
    if (e.target.id === "nj-add-modal")         { closeModal(); return; }
  });
  document.addEventListener("submit", (e) => {
    if (e.target && e.target.id === "nj-form") {
      setTimeout(() => closeModal(), 0);
    }
  });
})();

// Measure the heights of the sticky bands above the All Transactions table
// (heading + running-balance) and write them into CSS variables so the
// toolbar can offset itself precisely beneath them. Re-measures on resize
// and after every tx render (running-balance height grows when select count
// expands the row, etc.).
// Wrap the All Transactions heading + running-balance + toolbar into a
// single sticky band so they stay glued together at the top while the table
// scrolls — avoids the per-element stacking glitches seen when each was
// individually sticky.
function ensureTxStickyHeader() {
  const sect = document.getElementById("transactions");
  if (!sect) return;
  if (sect.querySelector(":scope > .tx-sticky-header")) return; // already wrapped
  const heading = sect.querySelector(":scope > .page-heading-mobile");
  const balance = sect.querySelector(":scope > .running-balance");
  const toolbar = sect.querySelector(":scope > .toolbar");
  if (!toolbar) return;
  const wrap = document.createElement("div");
  wrap.className = "tx-sticky-header";
  // Insert wrapper where the heading currently is (or before balance/toolbar)
  const anchor = heading || balance || toolbar;
  sect.insertBefore(wrap, anchor);
  if (heading) wrap.appendChild(heading);
  if (balance) wrap.appendChild(balance);
  wrap.appendChild(toolbar);
}
window.addEventListener("DOMContentLoaded", ensureTxStickyHeader);
setTimeout(ensureTxStickyHeader, 0);
// Measure the sticky header band's height and write it to a CSS variable so
// the Select all bar (and other sub-headers) can stick just below it.
function syncTxStickyHeights() {
  const sect = document.getElementById("transactions");
  if (!sect) return;
  const wrap = sect.querySelector(":scope > .tx-sticky-header");
  if (!wrap) return;
  const h = Math.ceil(wrap.getBoundingClientRect().height);
  sect.style.setProperty("--tx-sticky-header-h", `${h}px`);
}
window.addEventListener("resize", syncTxStickyHeights);
window.addEventListener("DOMContentLoaded", () => setTimeout(syncTxStickyHeights, 50));
setTimeout(syncTxStickyHeights, 200);
const txSelectedIds = new Set();
let txLastClickedId = null;
let txVisibleIds = []; // ids in currently displayed order (for range selection)
let hideReconciled = false;

// ========== Reconcile ==========
const reconcileModal = document.getElementById("reconcile-modal");
// Map from tx id → 1 if user marked it as cleared in this session, else 0.
// Rows that were already "C" before reconcile opened start pre-checked.
let reconcileChecked = new Set();
// Track the last row the user toggled, to support shift-click range selection.
let reconcileLastClickedId = null;
// Cache of the current candidate list (in displayed order) for range selection + select-all.
let reconcileCandidateIds = [];

function fmtLastReconciled(iso) {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Never";
    return d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit"
    });
  } catch (e) {
    return "Never";
  }
}

function updateLastReconciledDisplay() {
  const account = document.getElementById("reconcile-account").value;
  const rec = (state.lastReconciled || {})[account];
  const label = rec ? fmtLastReconciled(rec) : "Never";
  document.getElementById("reconcile-last").textContent = `Last reconciled: ${label}`;
}

function openReconcile() {
  // Ensure the lastReconciled record exists on state
  if (!state.lastReconciled) state.lastReconciled = {};

  // Populate account dropdown (default to only one if there's just one)
  const acctSel = document.getElementById("reconcile-account");
  const accounts = state.accounts.length
    ? state.accounts
    : Array.from(new Set(state.transactions.map(t => t.account).filter(Boolean)));
  acctSel.innerHTML = accounts.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("");

  // Default date to today
  const dateEl = document.getElementById("reconcile-date");
  if (!dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);

  // Default statement balance to empty
  document.getElementById("reconcile-balance").value = "";

  // Pre-check rows that are already marked "C"
  reconcileChecked = new Set(
    state.transactions.filter(t => t.reconciled === "C").map(t => t.id)
  );
  reconcileLastClickedId = null;

  updateLastReconciledDisplay();
  reconcileModal.classList.remove("hidden");
  renderReconcileList();
}

function closeReconcile() {
  reconcileModal.classList.add("hidden");
}

function signedAmount(t) {
  return (t.type === "income" ? 1 : -1) * t.amount;
}

function renderReconcileList() {
  const account = document.getElementById("reconcile-account").value;
  const statementDate = document.getElementById("reconcile-date").value;
  const statementBal = parseFloat(document.getElementById("reconcile-balance").value) || 0;

  // Previously reconciled balance (R) in this account — the starting point
  let prevReconciledBal = 0;
  state.transactions.forEach(t => {
    if (account && t.account !== account) return;
    if (t.reconciled === "R") prevReconciledBal += signedAmount(t);
  });

  // Candidates: not yet reconciled (empty or "C") for this account, on/before statement date
  const candidates = state.transactions.filter(t => {
    if (account && t.account !== account) return false;
    if (t.reconciled === "R") return false;
    if (statementDate && (t.date || "") > statementDate) return false;
    return true;
  }).sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  reconcileCandidateIds = candidates.map(t => t.id);

  // Prune checked ids that are no longer visible
  [...reconcileChecked].forEach(id => {
    if (!reconcileCandidateIds.includes(id)) reconcileChecked.delete(id);
  });

  // Render list
  const tbody = document.querySelector("#reconcile-list tbody");
  if (!candidates.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">No un-reconciled transactions for this selection.</td></tr>`;
  } else {
    tbody.innerHTML = candidates.map(t => {
      const isChecked = reconcileChecked.has(t.id);
      const amt = signedAmount(t);
      return `
        <tr data-id="${t.id}" class="${isChecked ? "checked" : ""}">
          <td><input type="checkbox" ${isChecked ? "checked" : ""} /></td>
          <td>${fmtDate(t.date)}</td>
          <td>${escapeHtml(t.payee || "")}</td>
          <td class="amount ${amt >= 0 ? "income" : "expense"}">${fmtMoney(amt)}</td>
        </tr>
      `;
    }).join("");

    const applyToggle = (id, setTo) => {
      if (setTo === undefined) {
        if (reconcileChecked.has(id)) reconcileChecked.delete(id);
        else reconcileChecked.add(id);
      } else if (setTo) {
        reconcileChecked.add(id);
      } else {
        reconcileChecked.delete(id);
      }
    };

    const handleClick = (id, shift) => {
      if (shift && reconcileLastClickedId && reconcileLastClickedId !== id) {
        const a = reconcileCandidateIds.indexOf(reconcileLastClickedId);
        const b = reconcileCandidateIds.indexOf(id);
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          // Range takes the target state of the anchor row (the one just clicked): if the
          // clicked row ends up checked, fill the range with checked; else uncheck it.
          const targetChecked = !reconcileChecked.has(id);
          for (let i = lo; i <= hi; i++) {
            applyToggle(reconcileCandidateIds[i], targetChecked);
          }
          reconcileLastClickedId = id;
          renderReconcileList();
          return;
        }
      }
      applyToggle(id);
      reconcileLastClickedId = id;
      renderReconcileList();
    };

    tbody.querySelectorAll("tr").forEach(row => {
      const id = row.dataset.id;
      const cb = row.querySelector("input[type='checkbox']");
      row.addEventListener("click", e => {
        if (e.target === cb) return; // let the checkbox handler run
        handleClick(id, e.shiftKey);
      });
      cb.addEventListener("click", e => {
        e.stopPropagation();
        handleClick(id, e.shiftKey);
      });
    });
  }

  // Select-all master checkbox in the header
  const master = document.getElementById("reconcile-select-all");
  const total = reconcileCandidateIds.length;
  const checkedCount = reconcileCandidateIds.filter(id => reconcileChecked.has(id)).length;
  master.checked = total > 0 && checkedCount === total;
  master.indeterminate = checkedCount > 0 && checkedCount < total;
  master.onclick = e => e.stopPropagation();
  master.onchange = () => {
    if (master.checked) reconcileCandidateIds.forEach(id => reconcileChecked.add(id));
    else reconcileCandidateIds.forEach(id => reconcileChecked.delete(id));
    reconcileLastClickedId = null;
    renderReconcileList();
  };

  // Compute cleared-this-session total
  let clearedBal = 0;
  state.transactions.forEach(t => {
    if (reconcileChecked.has(t.id)) clearedBal += signedAmount(t);
  });

  const currentTotal = prevReconciledBal + clearedBal;
  const diff = statementBal - currentTotal;

  document.getElementById("reconcile-prev").textContent = fmtMoney(prevReconciledBal);
  document.getElementById("reconcile-cleared").textContent = fmtMoney(clearedBal);
  document.getElementById("reconcile-current").textContent = fmtMoney(currentTotal);
  const diffEl = document.getElementById("reconcile-diff");
  diffEl.textContent = fmtMoney(diff);
  const isZero = Math.abs(diff) < 0.005;
  diffEl.classList.toggle("zero", isZero);
  diffEl.classList.toggle("nonzero", !isZero);

  // Enable Finalize only when statement balance is provided AND difference is zero
  const finalizeBtn = document.getElementById("btn-finalize-reconcile");
  const hasBalance = document.getElementById("reconcile-balance").value !== "";
  finalizeBtn.disabled = !hasBalance || !isZero || reconcileChecked.size === 0;
}

document.getElementById("btn-reconcile").addEventListener("click", openReconcile);
document.getElementById("btn-cancel-reconcile").addEventListener("click", closeReconcile);
reconcileModal.addEventListener("click", e => { if (e.target === reconcileModal) closeReconcile(); });

// Mobile "?" help button — toggle the instructions paragraph
const btnReconcileHelp = document.getElementById("btn-reconcile-help");
const reconcileInstructions = document.getElementById("reconcile-instructions");
if (btnReconcileHelp && reconcileInstructions) {
  btnReconcileHelp.addEventListener("click", () => {
    const shown = reconcileInstructions.classList.toggle("visible");
    btnReconcileHelp.classList.toggle("active", shown);
  });
}

["reconcile-balance", "reconcile-date", "reconcile-account"].forEach(id => {
  document.getElementById(id).addEventListener("input", renderReconcileList);
  document.getElementById(id).addEventListener("change", renderReconcileList);
});

document.getElementById("reconcile-account").addEventListener("change", updateLastReconciledDisplay);

document.getElementById("btn-finalize-reconcile").addEventListener("click", () => {
  if (!confirm(`Mark ${reconcileChecked.size} transaction(s) as reconciled? This cannot be undone through the UI.`)) return;
  state.transactions.forEach(t => {
    if (reconcileChecked.has(t.id)) t.reconciled = "R";
  });
  // Record the reconciliation timestamp for the selected account
  const account = document.getElementById("reconcile-account").value;
  if (!state.lastReconciled) state.lastReconciled = {};
  if (account) state.lastReconciled[account] = new Date().toISOString();
  saveState();
  closeReconcile();
  render();
  alert("Reconciliation complete.");
});

// "..." More actions dropdown
const moreBtn = document.getElementById("btn-more");
const moreMenu = document.getElementById("tx-more-menu");

moreBtn.addEventListener("click", e => {
  e.stopPropagation();
  moreMenu.hidden = !moreMenu.hidden;
});

// Close menu after any item is clicked
moreMenu.querySelectorAll(".tx-more-item").forEach(item => {
  item.addEventListener("click", () => { moreMenu.hidden = true; });
});

// Toggle hide-reconciled from the more-actions menu
document.getElementById("btn-toggle-reconciled").addEventListener("click", () => {
  hideReconciled = !hideReconciled;
  document.getElementById("btn-toggle-label").textContent =
    hideReconciled ? "Show Reconciled" : "Hide Reconciled";
  // When reconciled items are shown, drop the slash on the eye (acts like a normal "eye" icon).
  document.getElementById("btn-toggle-icon").classList.toggle("showing", hideReconciled);
  renderTransactions();
});

document.addEventListener("click", e => {
  if (!moreMenu.hidden && !moreMenu.contains(e.target) && e.target !== moreBtn) {
    moreMenu.hidden = true;
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") moreMenu.hidden = true;
});

document.getElementById("btn-select-mode").addEventListener("click", () => {
  txSelectMode = !txSelectMode;
  if (!txSelectMode) {
    txSelectedIds.clear();
    txLastClickedId = null;
  }
  document.getElementById("btn-select-label").textContent =
    txSelectMode ? "Exit Select Mode" : "Select Transactions";
  // Toggle the table class immediately for snappy UI; the checkboxes are
  // already in the DOM, only their visibility is gated by .select-mode.
  const _txTable = document.getElementById("tx-table");
  if (_txTable) _txTable.classList.toggle("select-mode", txSelectMode);
  document.body.classList.toggle("tx-select-active", txSelectMode);
  ensureTxSelectAllBar();
  syncTxStickyHeights();
  if (!txSelectMode) {
    // On exit, clear any checked rows visually without a full re-render.
    document.querySelectorAll("#tx-table tbody tr.is-checked").forEach(r => r.classList.remove("is-checked"));
    document.querySelectorAll("#tx-table tbody .tx-select-box:checked").forEach(c => { c.checked = false; });
    const sa = document.getElementById("tx-select-all");
    if (sa) sa.checked = false;
    const saMirror = document.getElementById("tx-select-all-mirror");
    if (saMirror) saMirror.checked = false;
  }
});

// Inject a Select-all bar inside the .tx-sticky-header so it stays visible
// while scrolling (the <thead> version has reliability issues across browsers
// when the table becomes display:block in 3-line mode).
function ensureTxSelectAllBar() {
  const sect = document.getElementById("transactions");
  const wrap = sect && sect.querySelector(":scope > .tx-sticky-header");
  if (!wrap) return;
  let bar = document.getElementById("tx-select-all-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "tx-select-all-bar";
    bar.innerHTML = `
      <label>
        <input type="checkbox" id="tx-select-all-mirror" />
        <span>Select all</span>
      </label>
    `;
    wrap.appendChild(bar);
    const mirror = bar.querySelector("#tx-select-all-mirror");
    mirror.addEventListener("change", () => {
      const orig = document.getElementById("tx-select-all");
      if (!orig) return;
      orig.checked = mirror.checked;
      orig.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
}

document.getElementById("dashboard-year").addEventListener("change", renderDashboard);
document.getElementById("jobs-year").addEventListener("change", renderJobs);

document.querySelectorAll("#trends .trends-income-toggle .year-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    trendsIncomeMode = btn.dataset.mode;
    document.querySelectorAll("#trends .trends-income-toggle .year-pill").forEach(b => {
      b.classList.toggle("active", b === btn);
    });
    renderTrendsIncomeChart();
  });
});

document.getElementById("settings-savings-goal").addEventListener("input", e => {
  const v = parseFloat(e.target.value);
  if (!isNaN(v) && v >= 0) {
    state.savingsGoal = v;
    saveState();
    renderDashboard();
  }
});

document.getElementById("settings-startup-view").addEventListener("change", e => {
  state.startupView = e.target.value === "transactions" ? "transactions" : "dashboard";
  saveState();
  const yearField = document.getElementById("settings-startup-year-field");
  if (yearField) yearField.style.display = state.startupView === "dashboard" ? "" : "none";
});

document.getElementById("settings-startup-year").addEventListener("change", e => {
  state.startupDashboardYear = e.target.value === "all" ? "all" : "current";
  saveState();
});

document.getElementById("settings-mobile-nav").addEventListener("change", e => {
  state.mobileNavStyle = e.target.value === "bottom" ? "bottom" : "sidebar";
  saveState();
  document.body.classList.toggle("mobile-nav-bottom", state.mobileNavStyle === "bottom");
  // Make sure no stale open-states linger after switching modes
  setSidebarOpen(false);
  setRightFlyoutOpen(false);
});

// Color scheme picker
const _csSel = document.getElementById("settings-color-scheme");
if (_csSel) {
  _csSel.value = state.colorScheme || "";
  _csSel.addEventListener("change", e => {
    state.colorScheme = e.target.value || "";
    saveState();
    applyColorScheme(state.colorScheme);
  });
}

// Chart palette picker
const _cpSel = document.getElementById("settings-chart-palette");
if (_cpSel) {
  _cpSel.value = state.chartPalette || "vibrant";
  _cpSel.addEventListener("change", e => {
    state.chartPalette = e.target.value || "vibrant";
    saveState();
    applyChartPalette(state.chartPalette);
    // Re-render so charts pick up the new palette immediately.
    if (typeof render === "function") render();
  });
}

// ===== Manual column resize on the All Transactions table =====
// A 6px-wide handle sits on the right edge of each th. Drag = resize.
// Hidden when state.txColsLocked is true (body.tx-cols-locked).
function ensureTxResizeHandles() {
  document.querySelectorAll("#tx-table thead th[data-col]").forEach(th => {
    if (th.querySelector(".tx-resize-handle")) return;
    // Don't force position:relative inline — the date column needs to keep
    // its CSS-driven position:sticky on mobile. position:sticky also acts as
    // a positioning context for absolute children, so the handle still
    // anchors correctly without us touching the th's position.
    const h = document.createElement("div");
    h.className = "tx-resize-handle";
    h.addEventListener("pointerdown", startTxColResize);
    h.addEventListener("click", e => e.stopPropagation());
    th.appendChild(h);
  });
}
function startTxColResize(e) {
  if (state.txColsLocked) return;
  e.preventDefault();
  e.stopPropagation();
  const handle = e.currentTarget;
  const th = handle.closest("th[data-col]");
  if (!th) return;
  try { handle.setPointerCapture(e.pointerId); } catch (_) {}
  const startX = e.clientX;
  const startW = th.getBoundingClientRect().width;
  const col = th.dataset.col;
  document.body.classList.add("tx-resizing");
  // Force table-layout:fixed during the drag so explicit widths actually
  // size the column instead of being treated as a hint.
  const tbl = document.getElementById("tx-table");
  const prevLayout = tbl ? tbl.style.tableLayout : "";
  if (tbl) tbl.style.tableLayout = "fixed";

  const onMove = ev => {
    const newW = Math.max(40, Math.round(startW + (ev.clientX - startX)));
    th.style.width = newW + "px";
    th.style.minWidth = newW + "px";
    th.style.maxWidth = newW + "px";
  };
  const onUp = () => {
    const finalW = Math.round(th.getBoundingClientRect().width);
    state.txColWidths = state.txColWidths || {};
    state.txColWidths[col] = finalW;
    saveState();
    document.body.classList.remove("tx-resizing");
    if (tbl) tbl.style.tableLayout = prevLayout;
    // Listeners attached to BOTH the handle (with capture) and the document,
    // for safety on browsers/devices where capture is flaky.
    handle.removeEventListener("pointermove",   onMove);
    handle.removeEventListener("pointerup",     onUp);
    handle.removeEventListener("pointercancel", onUp);
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup",   onUp);
    document.removeEventListener("pointercancel", onUp);
    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  handle.addEventListener("pointermove",   onMove);
  handle.addEventListener("pointerup",     onUp);
  handle.addEventListener("pointercancel", onUp);
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup",   onUp);
  document.addEventListener("pointercancel", onUp);
}
// Run once at startup so handles exist on initial render
setTimeout(ensureTxResizeHandles, 0);

// Settings: lock/unlock toggle. Initialize from state.
const _lockBox = document.getElementById("setting-tx-cols-locked");
if (_lockBox) {
  _lockBox.checked = state.txColsLocked !== false;
  _lockBox.addEventListener("change", e => {
    state.txColsLocked = !!e.target.checked;
    applyTxColWidths();
    saveState();
  });
}

// Settings: green highlight for Sales-account income rows.
const _chartSalesBox = document.getElementById("setting-chart-sales-highlight");
if (_chartSalesBox) {
  _chartSalesBox.checked = state.chartSalesHighlight !== false;
  _chartSalesBox.addEventListener("change", e => {
    state.chartSalesHighlight = !!e.target.checked;
    document.body.classList.toggle("chart-sales-off", !state.chartSalesHighlight);
    saveState();
  });
}
// Settings: red highlight for expenses linked to a Job No.
const _jobExpenseBox = document.getElementById("setting-job-expense-highlight");
if (_jobExpenseBox) {
  _jobExpenseBox.checked = !!state.txJobExpenseHighlight;
  _jobExpenseBox.addEventListener("change", e => {
    state.txJobExpenseHighlight = !!e.target.checked;
    document.body.classList.toggle("tx-job-expense-highlight", state.txJobExpenseHighlight);
    saveState();
  });
}
// Settings: collapsible cards. Each .settings-col becomes click-to-expand
// on its h2; collapsed state is persisted per-card in localStorage so the
// user's choices survive refresh.
(function setupSettingsCollapsibles() {
  const SETTINGS_COLLAPSE_KEY = "photo-settings-collapsed-v1";
  const sect = document.getElementById("settings");
  if (!sect) return;
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(SETTINGS_COLLAPSE_KEY) || "{}") || {}; }
  catch (e) { stored = {}; }
  const cards = sect.querySelectorAll(".settings-col");
  cards.forEach((card, idx) => {
    const h2 = card.querySelector(":scope > h2");
    if (!h2) return;
    card.classList.add("settings-collapsible");
    // Stable per-card key based on the h2 text (falls back to index).
    const key = (h2.textContent || "").trim().toLowerCase().replace(/\s+/g, "-") || `card-${idx}`;
    card.dataset.collapseKey = key;
    // Default: collapsed unless localStorage says expanded for this card.
    const collapsed = stored[key] !== false; // missing or true → collapsed
    card.classList.toggle("collapsed", collapsed);
    h2.addEventListener("click", () => {
      const nowCollapsed = !card.classList.contains("collapsed");
      card.classList.toggle("collapsed", nowCollapsed);
      stored[key] = !nowCollapsed; // store true = expanded
      try { localStorage.setItem(SETTINGS_COLLAPSE_KEY, JSON.stringify(stored)); } catch (e) {}
    });
  });
})();

// Settings: locked-years list — render checkboxes for every year that has
// data, with the current locked state checked. Toggling persists to state.
function renderLockedYearsList() {
  const el = document.getElementById("locked-years-list");
  if (!el) return;
  const years = new Set();
  (state.transactions || []).forEach(t => { const m = (t.date || "").match(/^(\d{4})/); if (m) years.add(m[1]); });
  (state.invoices || []).forEach(i => { const m = (i.date || "").match(/^(\d{4})/); if (m) years.add(m[1]); });
  const sorted = Array.from(years).sort((a, b) => b.localeCompare(a)); // newest first
  if (!sorted.length) {
    el.innerHTML = `<div class="muted" style="font-size:12px;padding:6px">No years with data yet.</div>`;
    return;
  }
  el.innerHTML = sorted.map(y => {
    const checked = (state.lockedYears || []).includes(y) ? " checked" : "";
    return `<label class="check-pill"><input type="checkbox" data-year="${y}"${checked} /> ${y}</label>`;
  }).join("");
}
(function wireLockedYears() {
  const el = document.getElementById("locked-years-list");
  if (!el) return;
  renderLockedYearsList();
  el.addEventListener("change", (e) => {
    const cb = e.target.closest('input[type="checkbox"][data-year]');
    if (!cb) return;
    const y = cb.dataset.year;
    if (!Array.isArray(state.lockedYears)) state.lockedYears = [];
    const set = new Set(state.lockedYears);
    if (cb.checked) set.add(y); else set.delete(y);
    state.lockedYears = Array.from(set).sort();
    saveState();
    if (window.toast) toast(cb.checked ? `Year ${y} locked` : `Year ${y} unlocked`, { kind: "success" });
  });
})();

// Settings: per-job color tint on All Transactions rows (matches donut palette).
const _jobColorBox = document.getElementById("setting-tx-job-color-rows");
if (_jobColorBox) {
  _jobColorBox.checked = !!state.txJobColorRows;
  _jobColorBox.addEventListener("change", e => {
    state.txJobColorRows = !!e.target.checked;
    document.body.classList.toggle("tx-job-color-rows", state.txJobColorRows);
    saveState();
    if (typeof renderTransactions === "function") renderTransactions();
  });
}

// Settings: 3-line stacked layout for All Transactions on mobile.
const _tx3lineBox = document.getElementById("setting-tx-mobile-3line");
if (_tx3lineBox) {
  _tx3lineBox.checked = !!state.txMobile3Line;
  _tx3lineBox.addEventListener("change", e => {
    state.txMobile3Line = !!e.target.checked;
    document.body.classList.toggle("tx-mobile-3line", state.txMobile3Line);
    saveState();
  });
}
// Settings: 3-line stacked layout for Job Analytics on mobile.
const _nj3lineBox = document.getElementById("setting-nj-mobile-3line");
if (_nj3lineBox) {
  _nj3lineBox.checked = !!state.njMobile3Line;
  _nj3lineBox.addEventListener("change", e => {
    state.njMobile3Line = !!e.target.checked;
    document.body.classList.toggle("nj-mobile-3line", state.njMobile3Line);
    saveState();
  });
}
// Settings: 3-line stacked layout for Invoices on mobile.
const _inv3lineBox = document.getElementById("setting-inv-mobile-3line");
if (_inv3lineBox) {
  _inv3lineBox.checked = !!state.invMobile3Line;
  _inv3lineBox.addEventListener("change", e => {
    state.invMobile3Line = !!e.target.checked;
    document.body.classList.toggle("inv-mobile-3line", state.invMobile3Line);
    saveState();
  });
}

// Settings: invert report colors on screen.
const _invBox = document.getElementById("setting-reports-inverted");
if (_invBox) {
  _invBox.checked = !!state.reportsInverted;
  _invBox.addEventListener("change", e => {
    state.reportsInverted = !!e.target.checked;
    document.body.classList.toggle("reports-inverted", state.reportsInverted);
    saveState();
  });
}

// Mass-update Chart of Accounts: pick a category + chart account, then update
// every transaction whose category matches.
function populateMassCoaCategorySelect() {
  const sel = document.getElementById("mass-coa-category");
  if (!sel) return;
  const current = sel.value;
  const cats = [...new Set((state.categories || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  sel.innerHTML = `<option value="">— Pick a category —</option>` +
    cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if (cats.includes(current)) sel.value = current;
}

document.getElementById("btn-mass-coa-apply")?.addEventListener("click", () => {
  const catSel    = document.getElementById("mass-coa-category");
  const acctSel   = document.getElementById("mass-coa-account");
  const statusEl  = document.getElementById("mass-coa-status");
  const cat   = catSel?.value || "";
  const acct  = acctSel?.value || "";
  if (!cat) { alert("Pick a category first."); return; }
  const matches = state.transactions.filter(t => t.category === cat);
  if (!matches.length) {
    if (statusEl) statusEl.textContent = `No transactions found with category "${cat}".`;
    return;
  }
  const acctLabel = acct || "(none)";
  if (!confirm(`Set Chart of Accounts to "${acctLabel}" on ${matches.length} transaction(s) with category "${cat}"?`)) return;
  let changed = 0;
  matches.forEach(t => {
    if ((t.chartAccount || "") !== acct) {
      t.chartAccount = acct;
      changed++;
    }
  });
  saveState();
  if (typeof renderTransactions === "function") renderTransactions();
  if (statusEl) statusEl.textContent = changed
    ? `Updated ${changed} of ${matches.length} transaction(s) — Chart of Accounts set to ${acctLabel}.`
    : `All ${matches.length} transaction(s) already had that value.`;
});

// Populate the mass-update selects whenever Settings becomes active so
// newly-added categories / chart accounts show up. The first-time fill
// is deferred so it runs AFTER every const/let in this file has been
// initialized (CHART_ACCOUNT_TYPES is declared further down — calling
// populateChartAccountSelect at top-level would hit a temporal dead zone
// and crash the rest of the script).
document.querySelectorAll(".tab-btn[data-tab='settings']").forEach(b => {
  b.addEventListener("click", () => {
    populateMassCoaCategorySelect();
    populateChartAccountSelect("mass-coa-account");
  });
});
// Initial populate after script eval completes
setTimeout(() => {
  try {
    populateMassCoaCategorySelect();
    populateChartAccountSelect("mass-coa-account");
  } catch (e) { console.warn("mass-coa initial populate failed:", e); }
}, 0);

// Transactions column toggles (Settings) — every checkbox with data-tx-col.
// Wire via delegation on the container so dynamically-added checkboxes also
// work, and listen for both change and click in case a label-wrapped click
// doesn't bubble through to a 'change' on every browser.
function initTxColumnToggleCheckboxes() {
  document.querySelectorAll("[data-tx-col]").forEach(cb => {
    if (!state.txMobileCols || typeof state.txMobileCols !== "object") {
      state.txMobileCols = { date: true, vendor: true, customer: true, payee: true, category: true, amount: true, memo: true, recon: true, tags: true };
    }
    cb.checked = state.txMobileCols[cb.dataset.txCol] !== false;
  });
}
initTxColumnToggleCheckboxes();
document.addEventListener("change", e => {
  const cb = e.target;
  if (!cb || !cb.matches?.("[data-tx-col]")) return;
  if (!state.txMobileCols || typeof state.txMobileCols !== "object") state.txMobileCols = {};
  state.txMobileCols[cb.dataset.txCol] = cb.checked;
  applyTxMobileColumns();
  saveState();
});

document.getElementById("income-year-prev").addEventListener("click", () => {
  // Left arrow → slide the window toward NEWER years → offset decreases
  dashboardIncomeYearOffset = Math.max(0, dashboardIncomeYearOffset - 1);
  renderDashboard();
});
document.getElementById("income-year-next").addEventListener("click", () => {
  // Right arrow → slide the window toward OLDER years → offset increases
  dashboardIncomeYearOffset += 1;
  renderDashboard();
});

document.querySelectorAll("#dashboard-income-toggle .year-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    dashboardIncomeMode = btn.dataset.mode;
    document.querySelectorAll("#dashboard-income-toggle .year-pill").forEach(b => {
      b.classList.toggle("active", b === btn);
    });
    renderDashboard();
  });
});

document.querySelectorAll("#jobs-mode-toggle .year-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    jobsViewMode = btn.dataset.mode;
    document.querySelectorAll("#jobs-mode-toggle .year-pill").forEach(b => {
      b.classList.toggle("active", b === btn);
    });
    renderJobs();
  });
});

document.querySelectorAll("#jobs-group-toggle .year-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    jobsGroupMode = btn.dataset.group;
    document.querySelectorAll("#jobs-group-toggle .year-pill").forEach(b => {
      b.classList.toggle("active", b === btn);
    });
    renderJobs();
  });
});

// --------- Settings list handlers ---------
function bindListEditor(listKey, listElId, inputId, addBtnId) {
  const addBtn = document.getElementById(addBtnId);
  const inp    = document.getElementById(inputId);
  // Cards may have been removed from Settings — guard so a missing element
  // doesn't throw and break the rest of the module.
  if (!addBtn || !inp) return;
  addBtn.addEventListener("click", () => {
    const v = inp.value.trim();
    if (!v) return;
    if (!state[listKey].includes(v)) {
      state[listKey].push(v);
      state[listKey].sort();
      saveState();
      render();
    }
    inp.value = "";
    inp.focus();
  });

  inp.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      addBtn.click();
    }
  });
}

bindListEditor("categories", "cat-list", "new-cat", "btn-add-cat");
bindListEditor("accounts", "acct-list", "new-acct", "btn-add-acct");
bindListEditor("payees", "payee-list", "new-payee", "btn-add-payee");
bindListEditor("customers", "customer-list", "new-customer", "btn-add-customer");
bindListEditor("invoiceItems", "invoice-items-list", "new-invoice-item", "btn-add-invoice-item");
bindListEditor("invoiceDescs", "invoice-descs-list", "new-invoice-desc", "btn-add-invoice-desc");

// Chart of Accounts — add new account
document.getElementById("new-chart-type").addEventListener("change", refreshParentSelect);
document.getElementById("btn-add-chart-account").addEventListener("click", () => {
  const nameEl = document.getElementById("new-chart-name");
  const typeEl = document.getElementById("new-chart-type");
  const parentEl = document.getElementById("new-chart-parent");
  const name = nameEl.value.trim();
  const type = typeEl.value;
  const parent = parentEl.value;
  if (!name) { nameEl.focus(); return; }
  if (!type) { typeEl.focus(); return; }
  // Avoid duplicates within the same type
  const dup = state.chartAccounts.find(a => a.name === name && a.type === type);
  if (dup) { alert(`"${name}" already exists under ${type}.`); return; }
  state.chartAccounts.push({ id: uid(), name, type, parent });
  saveState();
  nameEl.value = "";
  renderChartAccounts();
  refreshChartAccountSelectors();
  nameEl.focus();
});
document.getElementById("new-chart-name").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("btn-add-chart-account").click(); }
});

// --------- Backup/Restore/Clear ---------
// Build a date+time-stamped filename like "JBPhoto-backup-2026-04-23_14-30-15.json"
function backupFilename() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
              + `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `JBPhoto-backup-${stamp}.json`;
}

document.getElementById("btn-backup").addEventListener("click", async () => {
  const data = JSON.stringify(state, null, 2);
  const suggestedName = backupFilename();

  // Preferred path: File System Access API (Chrome/Edge/Opera) — opens native Save dialog
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        startIn: "documents",
        types: [{
          description: "JSON Backup",
          accept: { "application/json": [".json"] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // user clicked cancel in save dialog
      console.warn("Save dialog failed, falling back to automatic download:", e);
    }
  }

  // Fallback for browsers without the File System Access API (Firefox, Safari)
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
});

// --------- Backup to JBPhoto Folder (remembered directory) ---------
// Stores a FileSystemDirectoryHandle in IndexedDB so subsequent backups
// write straight to the user's chosen folder (ideally iCloud > JBPhoto)
// without re-prompting for location.
const JBPHOTO_IDB_DB   = "jbphoto-backup";
const JBPHOTO_IDB_STORE = "handles";
const JBPHOTO_HANDLE_KEY = "folder";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(JBPHOTO_IDB_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(JBPHOTO_IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGetHandle() {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(JBPHOTO_IDB_STORE, "readonly");
      const store = tx.objectStore(JBPHOTO_IDB_STORE);
      const req = store.get(JBPHOTO_HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => reject(req.error);
    });
  } catch { return null; }
}
async function idbPutHandle(handle) {
  const db = await idbOpen();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(JBPHOTO_IDB_STORE, "readwrite");
    tx.objectStore(JBPHOTO_IDB_STORE).put(handle, JBPHOTO_HANDLE_KEY);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function ensureFolderPermission(handle) {
  if (!handle) return false;
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

document.getElementById("btn-backup-icloud")?.addEventListener("click", async () => {
  if (!window.showDirectoryPicker) {
    alert(
      "This browser doesn't support direct folder writes.\n\n" +
      "Use \"Download Backup (JSON)\" and save to iCloud Drive > JBPhoto from the save dialog."
    );
    return;
  }

  const filename = backupFilename();
  const data = JSON.stringify(state, null, 2);

  try {
    let dirHandle = await idbGetHandle();
    let haveAccess = dirHandle && await ensureFolderPermission(dirHandle);

    if (!haveAccess) {
      // First-time or lost-permission — prompt the user to pick their JBPhoto folder
      alert(
        "Pick your backup folder (e.g. iCloud Drive › JBPhoto).\n\n" +
        "The app will remember this choice — future backups save directly with no prompt."
      );
      dirHandle = await window.showDirectoryPicker({
        mode: "readwrite",
        startIn: "documents"
      });
      await idbPutHandle(dirHandle);
    }

    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    alert(`Backup saved as ${filename}`);
  } catch (e) {
    if (e?.name === "AbortError") return;
    console.error("iCloud backup failed:", e);
    alert("Backup failed: " + (e?.message || e));
  }
});

document.getElementById("file-restore").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm("Restore will replace all current data. Continue?")) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.transactions || !Array.isArray(data.transactions)) throw new Error("Invalid file");
      // Preserve every field the backup contains (chartAccounts, vendors,
      // invoices, nextInvoiceNumber, trips, mileageRate, savingsGoal,
      // scheduledJobs, etc.) and backfill any missing required arrays.
      state = {
        categories: [],
        accounts: [],
        payees: [],
        vendors: [],
        transactions: [],
        invoices: [],
        nextInvoiceNumber: 26002,
        trips: [],
        mileageRate: 0.70,
        chartAccounts: [],
        scheduledJobs: [],
        savingsGoal: 12000,
        ...data
      };
      saveState();
      render();
      alert("Restore complete.");
    } catch (err) {
      alert("Restore failed: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

// --------- CSV Import (MoneyStats format) ---------
const MONTHS = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

function parseMoneyStatsRow(line, delimiter) {
  // Expected: "a"D"b"D"c"D... where D is the delimiter (comma or semicolon).
  // Every field is wrapped in double quotes.
  let s = line.replace(/\r$/, "");
  if (s.startsWith('"')) s = s.slice(1);
  if (s.endsWith('"')) s = s.slice(0, -1);
  return s.split(`"${delimiter}"`);
}

function detectDelimiter(headerLine) {
  // Count occurrences of ";" vs "," between quotes in the header
  const semi = (headerLine.match(/";"/g) || []).length;
  const comma = (headerLine.match(/","/g) || []).length;
  return semi >= comma ? ";" : ",";
}

function parseMoneyStatsDate(str) {
  // "Jan 1, 2025" -> "2025-01-01"
  const m = (str || "").match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!m) return "";
  const mo = MONTHS[m[1]] || "01";
  const day = String(m[2]).padStart(2, "0");
  return `${m[3]}-${mo}-${day}`;
}

function stripPhotoSuffix(s) {
  return (s || "").replace(/\s*-\s*Photo\s*$/, "").trim();
}

function importMoneyStatsCSV(text, accountFilter) {
  const lines = text.split("\n").filter(l => l.trim() !== "");
  if (lines.length < 2) return { added: 0, skipped: 0, total: 0, skippedDetails: [] };

  const delimiter = detectDelimiter(lines[0]);

  // Skip header
  const rows = lines.slice(1);
  let added = 0;
  let skipped = 0;
  const skippedDetails = [];

  rows.forEach((line, idx) => {
    const lineNo = idx + 2; // +2 accounts for 1-based and header row
    const f = parseMoneyStatsRow(line, delimiter);
    if (f.length < 12) {
      skipped++;
      skippedDetails.push({ lineNo, reason: `too few fields (${f.length})`, line: line.slice(0, 120) });
      return;
    }

    const [account, dateStr, amountStr, , , , title, receiver, usage, categoryRaw, comment, tagsRaw] = f;

    if (accountFilter && !account.includes(accountFilter)) return;

    const date = parseMoneyStatsDate(dateStr);
    if (!date) {
      skipped++;
      skippedDetails.push({ lineNo, reason: `unparseable date "${dateStr}"`, line: line.slice(0, 120) });
      return;
    }

    const amt = parseFloat(amountStr) || 0;
    const type = amt < 0 ? "expense" : "income";
    const amount = Math.abs(amt);

    const category = stripPhotoSuffix(categoryRaw);

    // Parse tags
    const tags = (tagsRaw || "")
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    // Payee: for expenses, first tag; else Comment, Receiver, Title
    let payee;
    if (type === "expense" && tags.length) {
      payee = tags[0];
    } else {
      payee = comment || receiver || title || "";
    }
    payee = payee.trim();

    // Memo: Usage, fallback to Title if different from category
    let memo = (usage || "").trim();
    if (!memo && title && title !== categoryRaw) memo = title.trim();

    if (typeof isLockedDate === "function" && isLockedDate(date)) {
      skipped++;
      skippedDetails.push({ lineNo, reason: `year ${date.slice(0,4)} is locked`, line: line.slice(0, 120) });
      return;
    }
    const tx = {
      id: uid(),
      type,
      date,
      payee,
      amount,
      category,
      account,
      memo,
      tags,
      reconciled: ""
    };

    state.transactions.push(tx);

    if (category && !state.categories.includes(category)) state.categories.push(category);
    if (account && !state.accounts.includes(account)) state.accounts.push(account);
    if (payee && !state.payees.includes(payee)) state.payees.push(payee);

    added++;
  });

  state.categories.sort();
  state.accounts.sort();
  state.payees.sort();

  return { added, skipped, total: rows.length, skippedDetails };
}

document.getElementById("file-import-csv").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const filter = prompt(
    "Account to import — partial match is fine (e.g. \"Photo - (1506)\").\n" +
    "Leave blank to import ALL accounts.\n\n" +
    "Filter:",
    "Photo - (1506)"
  );
  if (filter === null) { e.target.value = ""; return; }

  const accountFilter = filter.trim();

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const result = importMoneyStatsCSV(reader.result, accountFilter);
      saveState();
      render();

      let msg = `Import complete.\n\n` +
        `Added: ${result.added} transaction(s)\n` +
        `Skipped: ${result.skipped}\n` +
        (accountFilter ? `Filtered to account: ${accountFilter}` : "All accounts imported");

      if (result.skippedDetails && result.skippedDetails.length) {
        msg += "\n\nSkipped rows:\n";
        result.skippedDetails.forEach(s => {
          msg += `\n• Line ${s.lineNo}: ${s.reason}\n  ${s.line}`;
        });
        console.warn("Skipped rows during import:", result.skippedDetails);
      }
      alert(msg);
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  };
  reader.readAsText(file, "UTF-8");
  e.target.value = "";
});

// --------- Import Expenses CSV ---------
// Expected columns (header row required, case-insensitive, any order):
//   Date, Vendor, ChartAccount (or "Chart of Accounts" / "Split"), Amount
// Each row becomes an expense transaction. Duplicates (same date+vendor+amount)
// are skipped so re-running is safe.
function parseCSVLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
      } else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ""; }
      else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function normalizeImportDate(s) {
  s = (s || "").trim();
  if (!s) return "";
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YYYY or M/D/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    let [, mm, dd, yy] = m;
    if (yy.length === 2) yy = (parseInt(yy, 10) >= 50 ? "19" : "20") + yy;
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return s;
}

// ----- Vendor-specific mapping for the Expenses CSV import -----
// Lookup is case-insensitive. Each entry can override category, expense
// (state.expenseIncome), and chartAccount. Anything left empty defers to
// the row's CSV value (or the "Cost of Goods Sold" → "CoGS" fallback).
const EXPENSE_IMPORT_VENDOR_MAP = {
  "meridian pro":       { category: "CoGS",         expense: "Pictures" },
  "whcc":               { category: "CoGS",         expense: "Pictures" },
  "picture frames.com": { category: "CoGS",         expense: "Frames",       chartAccount: "CoGS" },
  "tyndell":            { category: "Memory Mates", expense: "Memory Mates" },
  "aci":                { category: "Banners",      expense: "Banners" },
};

function normalizeChartAccountForImport(raw) {
  const v = (raw || "").trim();
  // QuickBooks exports "Cost of Goods Sold" — collapse to the app's CoGS short form
  if (/^cost of goods sold$/i.test(v)) return "CoGS";
  return v;
}

document.getElementById("file-import-expenses-csv")?.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      // Strip BOM
      let text = reader.result.replace(/^﻿/, "");
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) { alert("CSV is empty or has no data rows."); e.target.value = ""; return; }

      const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
      const idx = {
        date:   header.findIndex(h => h === "date"),
        vendor: header.findIndex(h => h === "vendor" || h === "name" || h === "payee"),
        chart:  header.findIndex(h => h === "chartaccount" || h === "chart of accounts" || h === "chart" || h === "split"),
        amount: header.findIndex(h => h === "amount"),
      };
      if (idx.date < 0 || idx.amount < 0) {
        alert("CSV header must include at least 'Date' and 'Amount' columns.");
        e.target.value = "";
        return;
      }

      const existingKey = new Set(
        state.transactions.map(t => `${t.date}|${(t.vendor || "").toLowerCase()}|${(+t.amount).toFixed(2)}`)
      );

      // Stamp every row with the same batch id so the user can undo this
      // entire import in one click (Settings → Undo last expense import).
      const importBatchId = "imp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const importedIds = [];

      let added = 0, skipped = 0, malformed = 0;
      const newVendors = new Set(state.vendors || []);
      const newCategories = new Set(state.categories || []);
      const newExpenses = new Set((state.expensesTable || []).map(r => r.entry).filter(Boolean));
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const date = normalizeImportDate(cols[idx.date]);
        const vendor = (idx.vendor >= 0 ? (cols[idx.vendor] || "") : "").trim();
        const chartAccountRaw = (idx.chart >= 0 ? (cols[idx.chart] || "") : "").trim();
        const amtRaw = (cols[idx.amount] || "").replace(/[$,]/g, "").trim();
        const amount = parseFloat(amtRaw);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isFinite(amount) || amount === 0) {
          malformed++;
          continue;
        }
        const key = `${date}|${vendor.toLowerCase()}|${Math.abs(amount).toFixed(2)}`;
        if (existingKey.has(key)) { skipped++; continue; }
        if (typeof isLockedDate === "function" && isLockedDate(date)) { skipped++; continue; }

        // Apply vendor-specific overrides + Split → CoGS shorthand
        const vendorMap = EXPENSE_IMPORT_VENDOR_MAP[vendor.toLowerCase()] || {};
        const chartAccount = vendorMap.chartAccount || normalizeChartAccountForImport(chartAccountRaw);
        const category = vendorMap.category || "";
        const expenseIncome = vendorMap.expense || "";

        const tx = {
          id: uid(),
          type: "expense",
          date,
          payee: "",
          vendor,
          customer: "",
          amount: Math.abs(amount),
          category,
          account: "",
          memo: "",
          tags: [],
          reconciled: "",
          chartAccount,
          importBatch: importBatchId,
        };
        if (expenseIncome) tx.expenseIncome = expenseIncome;
        state.transactions.push(tx);
        importedIds.push(tx.id);
        existingKey.add(key);
        if (vendor) newVendors.add(vendor);
        if (category) newCategories.add(category);
        if (expenseIncome) newExpenses.add(expenseIncome);
        added++;
      }

      if (Array.isArray(state.vendors))    state.vendors = Array.from(newVendors).sort();
      if (Array.isArray(state.categories)) state.categories = Array.from(newCategories).sort();

      // Remember this batch so Settings can offer an Undo button.
      state.lastExpenseImport = added > 0
        ? { batchId: importBatchId, count: added, when: new Date().toISOString() }
        : (state.lastExpenseImport || null);

      saveState();
      render();
      if (typeof refreshExpenseImportUndoUi === "function") refreshExpenseImportUndoUi();

      if (window.toast && added > 0) toast(`Imported ${added} expense${added === 1 ? "" : "s"}`, { kind: "success" });

      alert(
        `Expenses CSV import complete.\n\n` +
        `Added: ${added}\n` +
        `Skipped (duplicates): ${skipped}\n` +
        `Malformed rows: ${malformed}` +
        (added > 0 ? `\n\nThis import can be undone in Settings.` : "")
      );
    } catch (err) {
      alert("Import failed: " + err.message);
      console.error(err);
    }
  };
  reader.readAsText(file, "UTF-8");
  e.target.value = "";
});

// ---- Undo last expense import ----
function refreshExpenseImportUndoUi() {
  const btn = document.getElementById("btn-undo-expense-import");
  const meta = document.getElementById("expense-import-undo-meta");
  if (!btn) return;
  const last = state.lastExpenseImport;
  if (!last || !last.batchId) {
    btn.disabled = true;
    btn.textContent = "Undo last expense import";
    if (meta) meta.textContent = "No recent import to undo.";
    return;
  }
  btn.disabled = false;
  btn.textContent = `Undo last expense import (${last.count})`;
  if (meta) {
    const when = last.when ? new Date(last.when) : null;
    meta.textContent = when
      ? `${last.count} transaction${last.count === 1 ? "" : "s"} imported ${when.toLocaleString()}.`
      : `${last.count} transactions in last import.`;
  }
}
document.getElementById("btn-undo-expense-import")?.addEventListener("click", () => {
  const last = state.lastExpenseImport;
  if (!last || !last.batchId) return;
  // Refuse if any transaction in the batch falls in a locked year.
  const lockedHits = new Set();
  (state.transactions || []).forEach(t => {
    if (t.importBatch === last.batchId && isLockedDate(t.date)) lockedHits.add(t.date.slice(0, 4));
  });
  if (lockedHits.size) {
    alert(`Cannot undo — the import includes transactions in locked year${lockedHits.size === 1 ? "" : "s"} (${[...lockedHits].sort().join(", ")}). Unlock first.`);
    return;
  }
  if (!confirm(`Remove the ${last.count} transaction${last.count === 1 ? "" : "s"} from the most recent expense import? This can't be re-done without importing the CSV again.`)) return;
  const before = state.transactions.length;
  state.transactions = state.transactions.filter(t => t.importBatch !== last.batchId);
  const removed = before - state.transactions.length;
  state.lastExpenseImport = null;
  saveState();
  render();
  refreshExpenseImportUndoUi();
  if (window.toast) toast(`Removed ${removed} imported expense${removed === 1 ? "" : "s"}`, { kind: "success" });
});
// Initial render of the undo UI
setTimeout(refreshExpenseImportUndoUi, 0);

document.getElementById("btn-clear").addEventListener("click", () => {
  const answer = prompt(
    "This will permanently erase ALL transactions, categories, accounts, and payees.\n\n" +
    "This action CANNOT be undone.\n\n" +
    'Type "yes" (without quotes) to confirm:'
  );
  if (answer === null) return; // user hit cancel
  if (answer.trim().toLowerCase() !== "yes") {
    alert("Clear cancelled — you did not type \"yes\".");
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  render();
  alert("All data has been cleared.");
});

// --------- Delete Transactions in Date Range ---------
document.getElementById("btn-delete-range").addEventListener("click", () => {
  const start = prompt(
    "Delete transactions in a date range.\n\n" +
    "Enter the START date (YYYY-MM-DD). Leave blank to include everything up to the end date:"
  );
  if (start === null) return;
  const end = prompt(
    "Enter the END date (YYYY-MM-DD). Leave blank to include everything from the start date onward:"
  );
  if (end === null) return;

  const startDate = (start || "").trim();
  const endDate = (end || "").trim();
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !isoRe.test(startDate)) { alert("Start date must be YYYY-MM-DD."); return; }
  if (endDate && !isoRe.test(endDate)) { alert("End date must be YYYY-MM-DD."); return; }
  if (!startDate && !endDate) { alert("Provide at least one of start or end date."); return; }
  if (startDate && endDate && startDate > endDate) { alert("Start date must be on or before end date."); return; }

  const matches = state.transactions.filter(t => {
    const d = t.date || "";
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  });

  if (matches.length === 0) {
    alert("No transactions found in that range.");
    return;
  }

  // Locked-year guard — refuse if any matched tx falls in a locked year.
  const lockedYears = new Set();
  matches.forEach(t => {
    if (typeof isLockedDate === "function" && isLockedDate(t.date)) {
      lockedYears.add(t.date.slice(0, 4));
    }
  });
  if (lockedYears.size > 0) {
    alert(`Cannot delete — the range includes transactions in locked year${lockedYears.size === 1 ? "" : "s"} (${[...lockedYears].sort().join(", ")}). Unlock the year(s) in Settings first.`);
    return;
  }

  const rangeLabel = `${startDate || "beginning"} to ${endDate || "end"}`;
  const confirmAnswer = prompt(
    `This will permanently delete ${matches.length} transaction(s) dated ${rangeLabel}.\n\n` +
    "This action CANNOT be undone.\n\n" +
    'Type "yes" (without quotes) to confirm:'
  );
  if (confirmAnswer === null) return;
  if (confirmAnswer.trim().toLowerCase() !== "yes") {
    alert("Delete cancelled — you did not type \"yes\".");
    return;
  }

  const matchIds = new Set(matches.map(t => t.id));
  state.transactions = state.transactions.filter(t => !matchIds.has(t.id));
  save();
  render();
  alert(`Deleted ${matches.length} transaction(s).`);
});

// --------- Export CSV ---------
document.getElementById("btn-export").addEventListener("click", async () => {
  const rows = [["Date", "Type", "Vendor", "Payee", "Category", "Account", "Amount", "Memo", "Tags"]];
  state.transactions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(t => {
      rows.push([
        t.date, t.type, t.vendor || "", t.payee, t.category, t.account,
        t.amount.toFixed(2), t.memo || "", (t.tags || []).join("; ")
      ]);
    });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const suggestedName = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;

  // Preferred path: native Save As dialog via the File System Access API (Chrome/Edge/Opera)
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{
          description: "CSV file",
          accept: { "text/csv": [".csv"] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(csv);
      await writable.close();
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // user cancelled
      console.warn("CSV save dialog failed, falling back to automatic download:", e);
    }
  }

  // Fallback: browsers without the File System Access API (Firefox, Safari, file:// contexts)
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
});

// --------- Rendering ---------
function render() {
  renderDashboard();
  renderTransactions();
  renderJobs();
  renderTrends();
  renderYearMatrix();
  renderSavings();
  renderInvoicesList();
  renderMileage();
  renderSchedule();
  renderSettings();
  renderFilters();
}

// ============ SCHEDULE ============
let scheduleViewMonth = null;
let editingSchedEvent = null;

const SCHED_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ensureScheduleState() {
  if (!Array.isArray(state.scheduledJobs)) state.scheduledJobs = [];
  if (!scheduleViewMonth) {
    const t = new Date();
    scheduleViewMonth = new Date(t.getFullYear(), t.getMonth(), 1);
  }
}

function schedColorForJob(jobName) {
  const idx = JOB_ORDER.indexOf(jobName);
  if (idx >= 0) return DONUT_PALETTE[idx % DONUT_PALETTE.length];
  return "#2c6ecb";
}

// Shown months: March(2) through November(10), zero-indexed
const SCHED_MONTHS_TO_SHOW = [2, 3, 4, 5, 6, 7, 8, 9, 10];

function renderSchedule() {
  ensureScheduleState();
  const cal = document.getElementById("schedule-calendar");
  const sel = document.getElementById("sched-year-select");
  if (!cal) return;

  const year = scheduleViewMonth.getFullYear();
  // Build year options: every year with any scheduled job + the current
  // calendar year + one year on either side of the viewed year for easy nav.
  if (sel) {
    const years = new Set();
    (state.scheduledJobs || []).forEach(e => {
      const y = (e.date || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) years.add(Number(y));
    });
    years.add(new Date().getFullYear());
    years.add(year - 1);
    years.add(year);
    years.add(year + 1);
    const sorted = [...years].sort((a, b) => b - a); // newest first
    sel.innerHTML = sorted.map(y => `<option value="${y}">${y}</option>`).join("");
    sel.value = String(year);
  }

  // Group events by ISO date
  const eventsByDate = {};
  state.scheduledJobs.forEach(e => {
    if (!e.date) return;
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });
  Object.values(eventsByDate).forEach(list =>
    list.sort((a, b) => (a.time || "").localeCompare(b.time || ""))
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  cal.innerHTML = SCHED_MONTHS_TO_SHOW
    .map(month => renderMiniMonth(year, month, eventsByDate, todayIso))
    .join("");

  cal.querySelectorAll(".cal-day").forEach(dayEl => {
    dayEl.addEventListener("click", e => {
      if (e.target.closest(".cal-event")) return;
      openSchedModal(null, dayEl.dataset.date);
    });
  });
  cal.querySelectorAll(".cal-event").forEach(evEl => {
    evEl.addEventListener("click", e => {
      e.stopPropagation();
      const id = evEl.dataset.eventId;
      const ev = state.scheduledJobs.find(x => x.id === id);
      if (ev) openSchedModal(ev);
    });
  });

  renderScheduleList();
}

function renderMiniMonth(year, month, eventsByDate, todayIso) {
  const monthName = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long" });
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  SCHED_WEEKDAYS.forEach(d => cells.push(`<div class="cal-day-header">${d[0]}</div>`));

  for (let i = 0; i < startDayOfWeek; i++) {
    const dayNum = daysInPrevMonth - startDayOfWeek + 1 + i;
    cells.push(renderCalDayCell(new Date(year, month - 1, dayNum), true, eventsByDate, todayIso));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(renderCalDayCell(new Date(year, month, d), false, eventsByDate, todayIso));
  }
  const totalSoFar = startDayOfWeek + daysInMonth;
  const trailing = (Math.ceil(totalSoFar / 7) * 7) - totalSoFar;
  for (let i = 1; i <= trailing; i++) {
    cells.push(renderCalDayCell(new Date(year, month + 1, i), true, eventsByDate, todayIso));
  }

  return `
    <div class="mini-calendar">
      <h3 class="mini-calendar-title">${escapeHtml(monthName)}</h3>
      <div class="mini-calendar-grid">${cells.join("")}</div>
    </div>
  `;
}

function renderScheduleList() {
  const tbody = document.querySelector("#schedule-list-table tbody");
  const heading = document.getElementById("sched-list-heading");
  if (!tbody || !heading) return;

  // Track the year currently being viewed in the calendar so prev/next year
  // buttons drive this list too. Fall back to the current calendar year on
  // first render before scheduleViewMonth is set.
  const currentYear = String(
    (typeof scheduleViewMonth !== "undefined" && scheduleViewMonth
      ? scheduleViewMonth
      : new Date()
    ).getFullYear()
  );
  heading.textContent = `Scheduled Jobs — ${currentYear}`;

  const fmtTime = t => {
    if (!t) return "";
    // Convert 24h "HH:MM" to 12h with am/pm
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return t;
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${min} ${ap}`;
  };

  const list = state.scheduledJobs
    .filter(e => (e.date || "").startsWith(currentYear))
    .sort((a, b) => {
      const d = (a.date || "").localeCompare(b.date || "");
      if (d !== 0) return d;
      return (a.time || "").localeCompare(b.time || "");
    });

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">No scheduled jobs for ${escapeHtml(currentYear)}.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(ev => {
    const color = schedColorForJob(ev.job);
    return `
      <tr data-id="${ev.id}" class="sched-row">
        <td>${fmtDate(ev.date)}</td>
        <td>${escapeHtml(fmtTime(ev.time))}</td>
        <td><span class="sched-job-pill" style="background:${color}">${escapeHtml(ev.job || "")}</span></td>
        <td>${escapeHtml(ev.location || "")}</td>
        <td>${escapeHtml(ev.notes || "")}</td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".sched-row").forEach(row => {
    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
      const ev = state.scheduledJobs.find(x => x.id === row.dataset.id);
      if (ev) openSchedModal(ev);
    });
  });
}

function renderCalDayCell(dateObj, isOtherMonth, eventsByDate, todayIso) {
  const iso = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
  const isToday = iso === todayIso;
  const events = eventsByDate[iso] || [];
  const maxShown = 3;
  const shown = events.slice(0, maxShown);
  const overflow = events.length - shown.length;
  // Only treat the day as "having events" for styling purposes when it belongs
  // to the current month — adjacent-month cells stay blank regardless.
  const hasEvents = events.length > 0 && !isOtherMonth;

  // When a day has events, fill the whole cell with the first event's color
  const cellColor = hasEvents ? schedColorForJob(events[0].job) : "";
  const cellStyle = hasEvents ? `background:${cellColor}` : "";
  const filledClass = hasEvents ? "filled" : "";

  const eventsHtml = shown.map(e => {
    const timeLabel = e.time ? e.time + " " : "";
    const label = e.job || e.title || "";
    const tooltip = `${e.time ? e.time + " — " : ""}${label}${e.location ? " @ " + e.location : ""}${e.notes ? "\n" + e.notes : ""}`;
    return `<div class="cal-event" data-event-id="${e.id}" title="${escapeHtml(tooltip)}">${escapeHtml(timeLabel + label)}</div>`;
  }).join("");
  const moreHtml = overflow > 0 ? `<div class="cal-day-more">+${overflow} more</div>` : "";

  return `
    <div class="cal-day ${isOtherMonth ? "other-month" : ""} ${isToday ? "today" : ""} ${filledClass}" data-date="${iso}" style="${cellStyle}">
      <span class="cal-day-num">${dateObj.getDate()}</span>
      ${eventsHtml}
      ${moreHtml}
    </div>
  `;
}

function openSchedModal(ev, defaultDate) {
  ensureScheduleState();

  // Populate the Job dropdown — JOB_ORDER first, then any other non-savings/non-rollover categories
  const jobSel = document.getElementById("sched-job");
  const cats = new Set();
  JOB_ORDER.forEach(j => cats.add(j));
  (state.categories || []).forEach(c => {
    if (SAVINGS_CATEGORIES.includes(c)) return;
    if (NON_JOB_CATEGORIES.includes(c)) return;
    cats.add(c);
  });
  const sorted = Array.from(cats).sort((a, b) => {
    const ai = JOB_ORDER.indexOf(a);
    const bi = JOB_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
  jobSel.innerHTML = sorted.map(j => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`).join("");

  if (ev) {
    editingSchedEvent = { ...ev };
    document.getElementById("sched-modal-title").textContent = "Edit Event";
    document.getElementById("sched-id").value = ev.id;
    document.getElementById("sched-date").value = ev.date || "";
    document.getElementById("sched-time").value = ev.time || "";
    document.getElementById("sched-job").value = ev.job || JOB_ORDER[0];
    document.getElementById("sched-location").value = ev.location || "";
    document.getElementById("sched-notes").value = ev.notes || "";
    document.getElementById("btn-sched-delete").style.display = "inline-block";
  } else {
    editingSchedEvent = null;
    document.getElementById("sched-modal-title").textContent = "Schedule Event";
    document.getElementById("sched-id").value = "";
    document.getElementById("sched-date").value = defaultDate || new Date().toISOString().slice(0, 10);
    document.getElementById("sched-time").value = "";
    document.getElementById("sched-job").value = JOB_ORDER[0] || (jobSel.options[0] && jobSel.options[0].value) || "";
    document.getElementById("sched-location").value = "";
    document.getElementById("sched-notes").value = "";
    document.getElementById("btn-sched-delete").style.display = "none";
  }

  document.getElementById("sched-modal").classList.remove("hidden");
  document.getElementById("sched-job").focus();
}

function closeSchedModal() {
  document.getElementById("sched-modal").classList.add("hidden");
  editingSchedEvent = null;
}

document.getElementById("sched-year-select")?.addEventListener("change", (e) => {
  const y = parseInt(e.target.value, 10);
  if (!Number.isFinite(y)) return;
  ensureScheduleState();
  scheduleViewMonth = new Date(y, 0, 1);
  renderSchedule();
});
document.getElementById("sched-new-event").addEventListener("click", () => openSchedModal(null));
document.getElementById("btn-sched-cancel").addEventListener("click", closeSchedModal);
document.getElementById("sched-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("sched-modal")) closeSchedModal();
});

document.getElementById("sched-form").addEventListener("submit", e => {
  e.preventDefault();
  ensureScheduleState();
  const id = document.getElementById("sched-id").value;
  const job = document.getElementById("sched-job").value;
  const ev = {
    id: id || uid(),
    date: document.getElementById("sched-date").value,
    time: document.getElementById("sched-time").value,
    job,
    title: job, // keep title in sync with job for backward compatibility
    location: document.getElementById("sched-location").value.trim(),
    notes: document.getElementById("sched-notes").value.trim()
  };
  if (id) {
    const idx = state.scheduledJobs.findIndex(x => x.id === id);
    if (idx >= 0) state.scheduledJobs[idx] = ev;
    else state.scheduledJobs.push(ev);
  } else {
    state.scheduledJobs.push(ev);
  }
  saveState();
  closeSchedModal();
  renderSchedule();
});

document.getElementById("btn-sched-delete").addEventListener("click", () => {
  const id = document.getElementById("sched-id").value;
  if (!id) return;
  if (!confirm("Delete this scheduled event?")) return;
  state.scheduledJobs = state.scheduledJobs.filter(x => x.id !== id);
  saveState();
  closeSchedModal();
  renderSchedule();
});

// ============ PROFIT & LOSS REPORT ============
let plInitialized = false;

function applyPLPreset(value) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  let fromDate, toDate;
  const iso = d => d.toISOString().slice(0, 10);
  const lastDayOfMonth = (yr, mi) => new Date(yr, mi + 1, 0);

  if (/^\d{4}$/.test(value)) {
    const yr = parseInt(value, 10);
    document.getElementById("pl-from").value = iso(new Date(yr, 0, 1));
    document.getElementById("pl-to").value = iso(new Date(yr, 11, 31));
    return;
  }
  switch (value) {
    case "this-month":
      fromDate = new Date(y, m, 1); toDate = lastDayOfMonth(y, m); break;
    case "last-month":
      fromDate = new Date(y, m - 1, 1); toDate = lastDayOfMonth(y, m - 1); break;
    case "this-quarter": {
      const qStart = Math.floor(m / 3) * 3;
      fromDate = new Date(y, qStart, 1); toDate = lastDayOfMonth(y, qStart + 2); break;
    }
    case "first-half":
      fromDate = new Date(y, 0, 1); toDate = new Date(y, 5, 30); break;
    case "second-half":
      fromDate = new Date(y, 6, 1); toDate = new Date(y, 11, 31); break;
    case "ytd":
      fromDate = new Date(y, 0, 1); toDate = today; break;
    case "last-year":
      fromDate = new Date(y - 1, 0, 1); toDate = new Date(y - 1, 11, 31); break;
    default: return;
  }
  document.getElementById("pl-from").value = iso(fromDate);
  document.getElementById("pl-to").value = iso(toDate);
}

// Split a chartAccount value ("Parent:Child") into its parent and child names.
function splitChartAccount(val) {
  if (!val) return { parent: "", name: "" };
  const idx = val.indexOf(":");
  if (idx < 0) return { parent: "", name: val };
  return { parent: val.slice(0, idx), name: val.slice(idx + 1) };
}

// Find the chart-account record matching the value stored on a transaction.
function lookupChartAccount(val) {
  if (!val) return null;
  const { parent, name } = splitChartAccount(val);
  return (state.chartAccounts || []).find(a => a.name === name && (a.parent || "") === parent) || null;
}

function renderPLReport() {
  const fromEl = document.getElementById("pl-from");
  const toEl = document.getElementById("pl-to");
  if (!fromEl || !toEl) return;

  if (!plInitialized) {
    plInitialized = true;
    if (!fromEl.value && !toEl.value) {
      document.getElementById("pl-preset").value = "ytd";
      applyPLPreset("ytd");
    }
  }

  const from = fromEl.value;
  const to = toEl.value;
  const fmt = iso => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";
  document.getElementById("pl-range").textContent = `${fmt(from)} — ${fmt(to)}`;
  document.getElementById("pl-col-header").textContent = "Total";

  // Filter transactions to date range and exclude Roll Over / Correction
  const txs = state.transactions.filter(t => {
    if (!t.date) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    if (NON_JOB_CATEGORIES.includes(t.category)) return false;
    return true;
  });

  // Aggregate per chart account (id), tracking the signed total and the list of
  // contributing transactions (with each one's signed contribution for drill-down).
  // P&L rules:
  //   Income-side account  (Income, Other Income):    income tx → +, expense tx → −
  //   Expense-side account (COGS, Expense, Other Expense): expense tx → +, income tx → −
  //   Balance sheet accounts (Bank/Asset/Liability/Equity): excluded from P&L.
  const INCOME_SIDE = ["Income", "Other Income"];
  const EXPENSE_SIDE = ["Cost of Goods Sold", "Expense", "Other Expense"];

  const accountTotals = new Map(); // key = chartAccount id, value = { account, amount, txs: [{t, signed}] }
  const uncategorizedIncomeTxs = [];
  const uncategorizedExpenseTxs = [];

  txs.forEach(t => {
    const acc = lookupChartAccount(t.chartAccount);
    if (!acc) {
      if (t.type === "income") uncategorizedIncomeTxs.push(t);
      else uncategorizedExpenseTxs.push(t);
      return;
    }
    // Skip balance-sheet accounts — they don't belong on P&L
    const isIncomeSide = INCOME_SIDE.includes(acc.type);
    const isExpenseSide = EXPENSE_SIDE.includes(acc.type);
    if (!isIncomeSide && !isExpenseSide) return;

    // Sign the amount based on whether tx direction matches the account's natural side
    let signed;
    if (isIncomeSide) signed = (t.type === "income" ? 1 : -1) * t.amount;
    else signed = (t.type === "expense" ? 1 : -1) * t.amount;

    if (!accountTotals.has(acc.id)) accountTotals.set(acc.id, { account: acc, amount: 0, txs: [] });
    const entry = accountTotals.get(acc.id);
    entry.amount += signed;
    entry.txs.push({ t, signed });
  });

  const uncategorizedIncome = uncategorizedIncomeTxs.reduce((s, t) => s + t.amount, 0);
  const uncategorizedExpense = uncategorizedExpenseTxs.reduce((s, t) => s + t.amount, 0);

  // Group aggregated accounts by type
  const byType = {};
  accountTotals.forEach(({ account, amount, txs }) => {
    if (!byType[account.type]) byType[account.type] = [];
    byType[account.type].push({ account, amount, txs });
  });

  // Build the table rows
  const rows = [];
  const money = v => fmtMoney(v);

  // Open the Ordinary Income/Expense grouping
  rows.push(`<tr class="pl-group-header"><td>Ordinary Income/Expense</td><td></td></tr>`);

  // ---- INCOME ----
  const { total: incomeTotal, rowsHtml: incomeRows } = renderPLSection(byType["Income"] || [], uncategorizedIncome, "Income", uncategorizedIncomeTxs);
  rows.push(`<tr class="pl-section-header"><td>Income</td><td></td></tr>`);
  rows.push(incomeRows);
  rows.push(`<tr class="pl-subtotal"><td>Total Income</td><td>${money(incomeTotal)}</td></tr>`);

  // ---- COST OF GOODS SOLD ----
  const { total: cogsTotal, rowsHtml: cogsRows } = renderPLSection(byType["Cost of Goods Sold"] || [], 0, "Cost of Goods Sold");
  rows.push(`<tr class="pl-section-header"><td>Cost of Goods Sold</td><td></td></tr>`);
  rows.push(cogsRows);
  rows.push(`<tr class="pl-subtotal"><td>Total COGS</td><td>${money(cogsTotal)}</td></tr>`);

  // Gross Profit
  const grossProfit = incomeTotal - cogsTotal;
  rows.push(`<tr class="pl-gross-profit"><td>Gross Profit</td><td>${money(grossProfit)}</td></tr>`);

  // ---- EXPENSE ----
  const { total: expenseTotal, rowsHtml: expenseRows } = renderPLSection(byType["Expense"] || [], uncategorizedExpense, "Expense", uncategorizedExpenseTxs);
  rows.push(`<tr class="pl-section-header"><td>Expense</td><td></td></tr>`);
  rows.push(expenseRows);
  rows.push(`<tr class="pl-subtotal"><td>Total Expense</td><td>${money(expenseTotal)}</td></tr>`);

  // Net Ordinary Income
  const netOrdinary = grossProfit - expenseTotal;
  rows.push(`<tr class="pl-net-ordinary"><td>Net Ordinary Income</td><td>${money(netOrdinary)}</td></tr>`);

  // ---- OTHER INCOME / OTHER EXPENSE ----
  const otherIncomeSection = byType["Other Income"] || [];
  const otherExpenseSection = byType["Other Expense"] || [];
  let netOther = 0;
  if (otherIncomeSection.length || otherExpenseSection.length) {
    rows.push(`<tr class="pl-group-header"><td>Other Income/Expense</td><td></td></tr>`);
    if (otherIncomeSection.length) {
      const { total, rowsHtml } = renderPLSection(otherIncomeSection, 0, "Other Income");
      rows.push(`<tr class="pl-section-header"><td>Other Income</td><td></td></tr>`);
      rows.push(rowsHtml);
      rows.push(`<tr class="pl-subtotal"><td>Total Other Income</td><td>${money(total)}</td></tr>`);
      netOther += total;
    }
    if (otherExpenseSection.length) {
      const { total, rowsHtml } = renderPLSection(otherExpenseSection, 0, "Other Expense");
      rows.push(`<tr class="pl-section-header"><td>Other Expense</td><td></td></tr>`);
      rows.push(rowsHtml);
      rows.push(`<tr class="pl-subtotal"><td>Total Other Expense</td><td>${money(total)}</td></tr>`);
      netOther -= total;
    }
    rows.push(`<tr class="pl-net-ordinary"><td>Net Other Income</td><td>${money(netOther)}</td></tr>`);
  }

  // Net Income
  const netIncome = netOrdinary + netOther;
  rows.push(`<tr class="pl-net-income"><td>Net Income</td><td>${money(netIncome)}</td></tr>`);

  const body = document.getElementById("pl-body");
  if (!txs.length) {
    body.innerHTML = `<tr class="pl-empty"><td colspan="2">No transactions in this date range.</td></tr>`;
  } else {
    body.innerHTML = rows.join("");
    wirePLDrillDown();
  }
  // Reset the toggle-all button label since re-render starts collapsed
  const toggleBtn = document.getElementById("btn-pl-toggle-all");
  if (toggleBtn) toggleBtn.textContent = "Expand All";
}

function wirePLDrillDown() {
  const body = document.getElementById("pl-body");
  body.querySelectorAll(".pl-drillable").forEach(row => {
    row.addEventListener("click", () => {
      const id = row.dataset.drillTarget;
      const expanded = row.classList.toggle("expanded");
      body.querySelectorAll(`.pl-drill-row[data-drill-id="${id}"]`).forEach(r => {
        r.hidden = !expanded;
      });
    });
  });
}

function fromLabelForHeader(from, to) {
  if (!from || !to) return "Total";
  const fd = new Date(from + "T00:00:00");
  const td = new Date(to + "T00:00:00");
  const sameYear = fd.getFullYear() === td.getFullYear();
  const sameMonth = sameYear && fd.getMonth() === td.getMonth();
  if (sameMonth) {
    return fd.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  const fLabel = fd.toLocaleDateString(undefined, { month: "short" });
  const tLabel = td.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  return `${fLabel} - ${tLabel}`;
}

// Render one section (Income / COGS / Expense / Other Income / Other Expense).
// Each account row is clickable to expand a drill-down list of the transactions behind it.
function renderPLSection(items, uncategorizedAmount, sectionName, uncategorizedTxs) {
  const rows = [];
  let total = 0;

  const byName = new Map();
  items.forEach(it => byName.set(it.account.name, it));

  const parents = items.filter(it => !it.account.parent).sort((a, b) => a.account.name.localeCompare(b.account.name));
  const orphanedChildren = items.filter(it => it.account.parent && !byName.has(it.account.parent));

  const accountRow = (label, amount, indent, txs) => {
    const drillId = "pl-drill-" + Math.random().toString(36).slice(2, 10);
    const txArr = Array.isArray(txs) ? txs : [];
    const hasDrill = txArr.length > 0;
    const caret = hasDrill ? `<span class="pl-caret">▸</span>` : `<span class="pl-caret-placeholder"></span>`;
    const amountCell = amount === null ? "" : fmtMoney(amount);
    const extraClass = indent ? `indent-${indent}` : "";
    const rowHtml = `
      <tr class="pl-account ${extraClass} ${hasDrill ? "pl-drillable" : ""}" data-drill-target="${drillId}">
        <td>${caret}${escapeHtml(label)}</td>
        <td>${amountCell}</td>
      </tr>
    `;
    const drillRows = hasDrill ? renderPLDrillRows(txArr, drillId) : "";
    return rowHtml + drillRows;
  };

  parents.forEach(p => {
    const children = items
      .filter(it => it.account.parent === p.account.name)
      .sort((a, b) => a.account.name.localeCompare(b.account.name));

    if (children.length === 0) {
      rows.push(accountRow(p.account.name, p.amount, 0, p.txs));
      total += p.amount;
    } else {
      rows.push(accountRow(p.account.name, null, 0, p.txs));
      let parentSubTotal = p.amount;
      children.forEach(c => {
        rows.push(accountRow(c.account.name, c.amount, 1, c.txs));
        parentSubTotal += c.amount;
      });
      rows.push(`<tr class="pl-subtotal"><td>Total ${escapeHtml(p.account.name)}</td><td>${fmtMoney(parentSubTotal)}</td></tr>`);
      total += parentSubTotal;
    }
  });

  orphanedChildren.forEach(c => {
    rows.push(accountRow(`${c.account.parent}:${c.account.name}`, c.amount, 0, c.txs));
    total += c.amount;
  });

  if (uncategorizedAmount > 0) {
    rows.push(accountRow(`Uncategorized ${sectionName}`, uncategorizedAmount, 0, uncategorizedTxs || []));
    total += uncategorizedAmount;
  }

  if (!rows.length) {
    rows.push(`<tr class="pl-account"><td style="color:#888"><em>— no activity —</em></td><td></td></tr>`);
  }

  return { total, rowsHtml: rows.join("") };
}

function renderPLDrillRows(entries, drillId) {
  // entries may be either raw transactions (uncategorized buckets) or {t, signed} objects.
  // For uncategorized buckets the bucket total is positive, so drill rows use the raw amount.
  const normalized = entries.map(e => {
    if (e && typeof e === "object" && "signed" in e) return e;
    return { t: e, signed: e ? e.amount : 0 };
  });
  normalized.sort((a, b) => (a.t.date || "").localeCompare(b.t.date || ""));
  return normalized.map(({ t, signed }) => `
    <tr class="pl-drill-row" data-drill-id="${drillId}" hidden>
      <td>
        <span class="pl-drill-indent"></span>
        <span class="pl-drill-date">${fmtDate(t.date)}</span>
        <span class="pl-drill-payee">${escapeHtml(t.payee || "")}</span>
        ${t.category ? `<span class="pl-drill-category">${escapeHtml(t.category)}</span>` : ""}
        ${t.memo ? `<span class="pl-drill-memo">— ${escapeHtml(t.memo)}</span>` : ""}
      </td>
      <td>${fmtMoney(signed)}</td>
    </tr>
  `).join("");
}

document.getElementById("pl-from").addEventListener("change", () => {
  document.getElementById("pl-preset").value = "custom";
  renderPLReport();
});
document.getElementById("pl-to").addEventListener("change", () => {
  document.getElementById("pl-preset").value = "custom";
  renderPLReport();
});
document.getElementById("pl-preset").addEventListener("change", e => {
  if (e.target.value !== "custom") {
    applyPLPreset(e.target.value);
    renderPLReport();
  }
});
document.getElementById("btn-pl-print").addEventListener("click", () => window.print());

// Report picker — switch between P&L, Jobs, Sales Tax Liability, and Mileage reports
function showReport(which) {
  const plEl = document.getElementById("pl-report-container");
  const jobsEl = document.getElementById("jobs-report-container");
  const taxEl = document.getElementById("tax-report-container");
  const mileageEl = document.getElementById("mileage-report-container");
  const ieEl = document.getElementById("ie-report-container");
  const hgbEl = document.getElementById("hgb-report-container");
  const txEl  = document.getElementById("tx-report-container");
  if (plEl) plEl.hidden = which !== "pl";
  if (jobsEl) jobsEl.hidden = which !== "jobs";
  if (taxEl) taxEl.hidden = which !== "tax";
  if (mileageEl) mileageEl.hidden = which !== "mileage";
  if (ieEl) ieEl.hidden = which !== "ie";
  if (hgbEl) hgbEl.hidden = which !== "hgb";
  if (txEl) txEl.hidden = which !== "tx";
  const scEl = document.getElementById("sc-report-container");
  if (scEl) scEl.hidden = which !== "sc";

  document.querySelectorAll(".report-picker-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.report === which);
  });

  // "none" is the default placeholder state — show no report.
  if (which === "none") return;

  if (which === "sc") {
    populateReportPresetYears && populateReportPresetYears("sc-report-preset");
    const from = document.getElementById("sc-report-from");
    const to = document.getElementById("sc-report-to");
    if (from && to && !from.value && !to.value) {
      document.getElementById("sc-report-preset").value = "ytd";
      applySCReportPreset("ytd");
    }
    renderSCReport();
    return;
  }

  if (which === "ie") {
    populateReportPresetYears("ie-report-preset");
    const from = document.getElementById("ie-report-from");
    const to = document.getElementById("ie-report-to");
    if (from && to && !from.value && !to.value) {
      document.getElementById("ie-report-preset").value = "ytd";
      applyIEReportPreset("ytd");
    }
    renderIEReport();
    return;
  }
  if (which === "hgb") {
    populateReportPresetYears("hgb-report-preset");
    const from = document.getElementById("hgb-report-from");
    const to = document.getElementById("hgb-report-to");
    if (from && to && !from.value && !to.value) {
      document.getElementById("hgb-report-preset").value = "ytd";
      applyHGBReportPreset("ytd");
    }
    renderHGBReport();
    return;
  }
  if (which === "tx") {
    populateReportPresetYears("tx-report-preset");
    populateTxReportFilters();
    const from = document.getElementById("tx-report-from");
    const to = document.getElementById("tx-report-to");
    if (from && to && !from.value && !to.value) {
      document.getElementById("tx-report-preset").value = "ytd";
      applyTxReportPreset("ytd");
    }
    renderTxReport();
    return;
  }

  if (which === "tax") {
    populateReportPresetYears("tax-report-preset");
    const from = document.getElementById("tax-report-from");
    const to = document.getElementById("tax-report-to");
    if (from && to && !from.value && !to.value) {
      document.getElementById("tax-report-preset").value = "ytd";
      applyTaxReportPreset("ytd");
    }
    renderTaxReport();
  } else if (which === "mileage") {
    populateReportPresetYears("mileage-report-preset");
    const from = document.getElementById("mileage-report-from");
    const to = document.getElementById("mileage-report-to");
    if (from && to && !from.value && !to.value) {
      document.getElementById("mileage-report-preset").value = "ytd";
      applyMileageReportPreset("ytd");
    }
    renderMileageReport();
  } else if (which === "jobs") {
    populateReportPresetYears("jobs-report-preset");
    const from = document.getElementById("jobs-report-from");
    const to = document.getElementById("jobs-report-to");
    if (from && to && !from.value && !to.value) {
      document.getElementById("jobs-report-preset").value = "ytd";
      applyJobsReportPreset("ytd");
    }
    renderJobsReport();
  } else {
    populateReportPresetYears("pl-preset");
    renderPLReport();
  }
}

function applyJobsReportPreset(value) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  let fromDate, toDate;
  const iso = d => d.toISOString().slice(0, 10);
  const lastDayOfMonth = (yr, mi) => new Date(yr, mi + 1, 0);
  if (/^\d{4}$/.test(value)) {
    const yr = parseInt(value, 10);
    fromDate = new Date(yr, 0, 1);
    toDate = new Date(yr, 11, 31);
  } else {
    switch (value) {
      case "this-month":    fromDate = new Date(y, m, 1);     toDate = lastDayOfMonth(y, m); break;
      case "last-month":    fromDate = new Date(y, m - 1, 1); toDate = lastDayOfMonth(y, m - 1); break;
      case "this-quarter": {
        const qStart = Math.floor(m / 3) * 3;
        fromDate = new Date(y, qStart, 1); toDate = lastDayOfMonth(y, qStart + 2); break;
      }
      case "first-half":    fromDate = new Date(y, 0, 1);     toDate = new Date(y, 5, 30); break;
      case "second-half":   fromDate = new Date(y, 6, 1);     toDate = new Date(y, 11, 31); break;
      case "ytd":           fromDate = new Date(y, 0, 1);     toDate = today; break;
      case "last-year":     fromDate = new Date(y - 1, 0, 1); toDate = new Date(y - 1, 11, 31); break;
      default: return;
    }
  }
  document.getElementById("jobs-report-from").value = iso(fromDate);
  document.getElementById("jobs-report-to").value = iso(toDate);
}

// ---- Income vs Expense Report ----
function applyIEReportPreset(value) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  let fromDate, toDate;
  const iso = d => d.toISOString().slice(0, 10);
  const lastDayOfMonth = (yr, mi) => new Date(yr, mi + 1, 0);
  if (/^\d{4}$/.test(value)) {
    const yr = parseInt(value, 10);
    fromDate = new Date(yr, 0, 1);
    toDate = new Date(yr, 11, 31);
  } else {
    switch (value) {
      case "this-month":    fromDate = new Date(y, m, 1);     toDate = lastDayOfMonth(y, m); break;
      case "last-month":    fromDate = new Date(y, m - 1, 1); toDate = lastDayOfMonth(y, m - 1); break;
      case "this-quarter": {
        const qStart = Math.floor(m / 3) * 3;
        fromDate = new Date(y, qStart, 1); toDate = lastDayOfMonth(y, qStart + 2); break;
      }
      case "first-half":    fromDate = new Date(y, 0, 1);     toDate = new Date(y, 5, 30); break;
      case "second-half":   fromDate = new Date(y, 6, 1);     toDate = new Date(y, 11, 31); break;
      case "ytd":           fromDate = new Date(y, 0, 1);     toDate = today; break;
      case "last-year":     fromDate = new Date(y - 1, 0, 1); toDate = new Date(y - 1, 11, 31); break;
      default: return;
    }
  }
  document.getElementById("ie-report-from").value = iso(fromDate);
  document.getElementById("ie-report-to").value = iso(toDate);
}

function renderIEReport() {
  const fromEl = document.getElementById("ie-report-from");
  const toEl = document.getElementById("ie-report-to");
  if (!fromEl || !toEl) return;
  const from = fromEl.value, to = toEl.value;

  // Section toggles
  const incIncome  = document.getElementById("ie-report-include-income")?.checked  !== false;
  const incExpense = document.getElementById("ie-report-include-expense")?.checked !== false;
  const incomeSec  = document.getElementById("ie-report-section-income");
  const expenseSec = document.getElementById("ie-report-section-expense");
  if (incomeSec)  incomeSec.style.display  = incIncome  ? "" : "none";
  if (expenseSec) expenseSec.style.display = incExpense ? "" : "none";

  const rangeEl = document.getElementById("ie-report-range");
  if (rangeEl) {
    const fmtDate = s => s ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
    rangeEl.textContent = (from || to) ? `${fmtDate(from)} — ${fmtDate(to)}` : "All dates";
  }

  const inRange = t => {
    const d = t.date || "";
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };
  const txs = state.transactions.filter(inRange).filter(t => !NON_JOB_CATEGORIES.includes(t.category));

  // Aggregate per category — track each transaction so the drill can show
  // per-tx detail (Date · Vendor / Memo / Expense, amount).
  function aggregate(type) {
    const byCat = new Map();
    txs.filter(t => t.type === type).forEach(t => {
      const cat = t.category || "Uncategorized";
      let row = byCat.get(cat);
      if (!row) {
        row = { cat, count: 0, amount: 0, txs: [] };
        byCat.set(cat, row);
      }
      row.count++;
      row.amount += t.amount || 0;
      row.txs.push(t);
    });
    // Sort transactions chronologically inside each row.
    [...byCat.values()].forEach(r => r.txs.sort((a, b) => (a.date || "").localeCompare(b.date || "")));
    return [...byCat.values()].sort((a, b) => b.amount - a.amount);
  }

  const incomeRows  = aggregate("income");
  const expenseRows = aggregate("expense");
  const totalIncome  = incomeRows.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenseRows.reduce((s, r) => s + r.amount, 0);
  const net = totalIncome - totalExpense;

  function renderTable(rows, total, prefix) {
    if (!rows.length) {
      return `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">No ${prefix} in this range.</td></tr>`;
    }
    return rows.map((r, idx) => {
      const drillId = `ie${prefix}-drill-${idx}`;
      const pct = total > 0 ? (r.amount / total) * 100 : 0;
      // Per-transaction drill rows.
      const subRows = (r.txs || []).map(t => {
        const labelParts = [];
        const ei = (t.expenseIncome || "").trim();
        if (ei) labelParts.push(escapeHtml(ei));
        if (t.vendor) labelParts.push(escapeHtml(t.vendor));
        if (t.customer && t.type === "income") labelParts.push(escapeHtml(t.customer));
        if (t.memo) labelParts.push(`<span class="muted">${escapeHtml(t.memo)}</span>`);
        if (!labelParts.length && t.payee && t.payee !== "Job") labelParts.push(escapeHtml(t.payee));
        const labelHtml = labelParts.length ? labelParts.join(" · ") : '<span class="muted">—</span>';
        const txPct = r.amount > 0 ? ((t.amount / r.amount) * 100).toFixed(1) + "%" : "—";
        return `
          <tr class="pl-drill-row ie-drill-row" data-drill-id="${drillId}" hidden>
            <td><span class="pl-drill-indent"></span>${escapeHtml(t.date || "")} <span class="muted">· ${labelHtml}</span></td>
            <td style="text-align:right">1</td>
            <td style="text-align:right">${fmtMoney(t.amount)}</td>
            <td style="text-align:right">${txPct}</td>
          </tr>
        `;
      }).join("");
      return `
        <tr class="pl-drillable ie-drillable" data-drill-target="${drillId}" style="cursor:pointer">
          <td><span class="pl-drill-caret">▸</span> ${escapeHtml(r.cat)}</td>
          <td style="text-align:right">${r.count}</td>
          <td style="text-align:right;font-weight:600">${fmtMoney(r.amount)}</td>
          <td style="text-align:right">${pct.toFixed(1)}%</td>
        </tr>
        ${subRows}
      `;
    }).join("");
  }

  const incomeBody  = document.getElementById("ie-report-income-body");
  const expenseBody = document.getElementById("ie-report-expense-body");
  if (incomeBody)  incomeBody.innerHTML  = renderTable(incomeRows,  totalIncome,  "Income");
  if (expenseBody) expenseBody.innerHTML = renderTable(expenseRows, totalExpense, "Expense");

  document.getElementById("ie-report-income-total-tx").textContent  = incomeRows.reduce((s, r) => s + r.count, 0);
  document.getElementById("ie-report-income-total").textContent     = fmtMoney(totalIncome);
  document.getElementById("ie-report-expense-total-tx").textContent = expenseRows.reduce((s, r) => s + r.count, 0);
  document.getElementById("ie-report-expense-total").textContent    = fmtMoney(totalExpense);
  const netEl = document.getElementById("ie-report-net");
  if (netEl) {
    netEl.textContent = (net >= 0 ? "" : "-") + fmtMoney(Math.abs(net));
    netEl.style.color = net >= 0 ? "var(--income)" : "var(--expense)";
  }

  // Wire drill toggles
  [incomeBody, expenseBody].forEach(body => {
    if (!body) return;
    body.querySelectorAll(".ie-drillable").forEach(row => {
      row.addEventListener("click", () => {
        const id = row.dataset.drillTarget;
        const expanded = row.classList.toggle("expanded");
        const caret = row.querySelector(".pl-drill-caret");
        if (caret) caret.textContent = expanded ? "▾" : "▸";
        body.querySelectorAll(`.pl-drill-row[data-drill-id="${id}"]`).forEach(r => {
          r.hidden = !expanded;
        });
      });
    });
  });
}

// Wire toolbar
document.getElementById("ie-report-from")?.addEventListener("change", () => {
  document.getElementById("ie-report-preset").value = "custom";
  renderIEReport();
});
document.getElementById("ie-report-to")?.addEventListener("change", () => {
  document.getElementById("ie-report-preset").value = "custom";
  renderIEReport();
});
document.getElementById("ie-report-preset")?.addEventListener("change", e => {
  if (e.target.value !== "custom") {
    applyIEReportPreset(e.target.value);
    renderIEReport();
  }
});
["ie-report-include-income", "ie-report-include-expense"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", renderIEReport);
});
document.getElementById("btn-ie-report-toggle-all")?.addEventListener("click", () => {
  const bodies = ["ie-report-income-body", "ie-report-expense-body"]
    .map(id => document.getElementById(id))
    .filter(Boolean);
  const drillables = [];
  bodies.forEach(b => b.querySelectorAll(".ie-drillable").forEach(r => drillables.push({ row: r, body: b })));
  if (!drillables.length) return;
  const anyCollapsed = drillables.some(({ row }) => !row.classList.contains("expanded"));
  const expand = anyCollapsed;
  drillables.forEach(({ row, body }) => {
    row.classList.toggle("expanded", expand);
    const caret = row.querySelector(".pl-drill-caret");
    if (caret) caret.textContent = expand ? "▾" : "▸";
    const id = row.dataset.drillTarget;
    body.querySelectorAll(`.pl-drill-row[data-drill-id="${id}"]`).forEach(r => { r.hidden = !expand; });
  });
  document.getElementById("btn-ie-report-toggle-all").textContent = expand ? "Collapse All" : "Expand All";
});

// Print in landscape — inject a temporary @page rule that overrides the
// portrait default in the global @media print block.
document.getElementById("btn-ie-report-print")?.addEventListener("click", () => {
  const s = document.createElement("style");
  s.id = "ie-landscape-style";
  s.textContent = "@media print { @page { size: letter landscape; margin: 0.5in; } }";
  document.head.appendChild(s);
  setTimeout(() => {
    window.print();
    setTimeout(() => s.remove(), 200);
  }, 30);
});

// ---- Helper / Give Back Report ----
function applyHGBReportPreset(value) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  let fromDate, toDate;
  const iso = d => d.toISOString().slice(0, 10);
  const lastDayOfMonth = (yr, mi) => new Date(yr, mi + 1, 0);
  if (/^\d{4}$/.test(value)) {
    const yr = parseInt(value, 10);
    fromDate = new Date(yr, 0, 1);
    toDate = new Date(yr, 11, 31);
  } else {
    switch (value) {
      case "this-month":    fromDate = new Date(y, m, 1);     toDate = lastDayOfMonth(y, m); break;
      case "last-month":    fromDate = new Date(y, m - 1, 1); toDate = lastDayOfMonth(y, m - 1); break;
      case "this-quarter": {
        const qStart = Math.floor(m / 3) * 3;
        fromDate = new Date(y, qStart, 1); toDate = lastDayOfMonth(y, qStart + 2); break;
      }
      case "first-half":    fromDate = new Date(y, 0, 1);     toDate = new Date(y, 5, 30); break;
      case "second-half":   fromDate = new Date(y, 6, 1);     toDate = new Date(y, 11, 31); break;
      case "ytd":           fromDate = new Date(y, 0, 1);     toDate = today; break;
      case "last-year":     fromDate = new Date(y - 1, 0, 1); toDate = new Date(y - 1, 11, 31); break;
      default: return;
    }
  }
  document.getElementById("hgb-report-from").value = iso(fromDate);
  document.getElementById("hgb-report-to").value = iso(toDate);
}

function renderHGBReport() {
  const fromEl = document.getElementById("hgb-report-from");
  const toEl = document.getElementById("hgb-report-to");
  if (!fromEl || !toEl) return;
  const from = fromEl.value, to = toEl.value;

  // Section toggles
  const incHelper   = document.getElementById("hgb-report-include-helper")?.checked   !== false;
  const incGiveBack = document.getElementById("hgb-report-include-giveback")?.checked !== false;
  const helperSec   = document.getElementById("hgb-report-section-helper");
  const givebackSec = document.getElementById("hgb-report-section-giveback");
  if (helperSec)   helperSec.style.display   = incHelper   ? "" : "none";
  if (givebackSec) givebackSec.style.display = incGiveBack ? "" : "none";

  const rangeEl = document.getElementById("hgb-report-range");
  if (rangeEl) {
    const fmtDate = s => s ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
    rangeEl.textContent = (from || to) ? `${fmtDate(from)} — ${fmtDate(to)}` : "All dates";
  }

  const inRange = t => {
    const d = t.date || "";
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };
  const txs = state.transactions.filter(inRange);

  // Helper sub-toggles — only enabled when Include Helper is on, and decide
  // which sub-payees actually count toward the Helper section.
  const incDiane   = document.getElementById("hgb-report-include-diane")?.checked   !== false;
  const incTristen = document.getElementById("hgb-report-include-tristen")?.checked !== false;
  const dianeWrap   = document.getElementById("hgb-report-include-diane")?.closest(".check-pill");
  const tristenWrap = document.getElementById("hgb-report-include-tristen")?.closest(".check-pill");
  if (dianeWrap)   dianeWrap.classList.toggle("is-disabled",   !incHelper);
  if (tristenWrap) tristenWrap.classList.toggle("is-disabled", !incHelper);

  // A transaction qualifies as "Helper" when its new-spec Expense field is
  // "Helper", OR (legacy fallback) the payee matches one of the known names.
  const isHelper = t => {
    const ei = (t.expenseIncome || "").trim().toLowerCase();
    if (ei === "helper") {
      const p = t.payee || "";
      // Sub-toggles still apply when the legacy payee match is meaningful.
      // For new-spec Helper entries that don't match Diane/Tristen, default to including.
      if (/diane/i.test(p))   return incDiane;
      if (/tristen/i.test(p)) return incTristen;
      return true;
    }
    // Legacy: payee-based detection.
    const p = t.payee || "";
    if (incDiane   && /diane/i.test(p))   return true;
    if (incTristen && /tristen/i.test(p)) return true;
    return false;
  };
  // "Give Back" qualifies when expenseIncome === "Give Back" OR (legacy) payee matches.
  const isGiveBack = t => {
    const ei = (t.expenseIncome || "").trim().toLowerCase();
    if (ei === "give back") return true;
    return /give\s*back/i.test(t.payee || "");
  };

  // ---- Helper: group by Memo + Job (Memo shown under "Payee", job in its own column) ----
  const _jobsByNo = new Map((state.jobs || []).map(j => [j.jobNo, j]));
  const _helperJobLabel = (t) => {
    if (t.jobNo && _jobsByNo.has(t.jobNo)) {
      const j = _jobsByNo.get(t.jobNo);
      return `${t.jobNo} - ${j.customer || ""}${j.category ? " / " + j.category : ""}`;
    }
    if (t.jobNo) return t.jobNo;
    return (t.category || "").trim() || "—";
  };
  const helperByPayee = new Map();
  txs.forEach(t => {
    if (!isHelper(t)) return;
    const vendor = (t.vendor || "").trim() || "(no vendor)";
    const jobLabel = _helperJobLabel(t);
    const key = vendor + "‖" + jobLabel;
    let row = helperByPayee.get(key);
    if (!row) { row = { payee: vendor, job: jobLabel, count: 0, amount: 0 }; helperByPayee.set(key, row); }
    row.count++;
    row.amount += t.amount || 0;
  });
  const helperRows = [...helperByPayee.values()].sort((a, b) => b.amount - a.amount);
  const totalHelper = helperRows.reduce((s, r) => s + r.amount, 0);

  // ---- Give Back: group by Job No. (falls back to category for legacy txs) ----
  // Detection uses isGiveBack which prefers tx.expenseIncome === "Give Back".
  // For each row we also compute net "job" income across the same window so
  // we can derive "% Give Back" = give-back / (net job income + give-back).
  const jobByNo = new Map((state.jobs || []).map(j => [j.jobNo, j]));
  const giveBackKey = (t) => {
    if (t.jobNo && jobByNo.has(t.jobNo)) {
      const j = jobByNo.get(t.jobNo);
      return { id: "job:" + t.jobNo, label: `${t.jobNo} - ${j.customer || ""}${j.category ? " / " + j.category : ""}` };
    }
    const c = (t.category || "").trim() || "Uncategorized";
    return { id: "cat:" + c, label: c };
  };
  const givebackByCat = new Map();
  txs.forEach(t => {
    if (!isGiveBack(t)) return;
    const k = giveBackKey(t);
    let row = givebackByCat.get(k.id);
    if (!row) { row = { cat: k.label, key: k.id, count: 0, amount: 0 }; givebackByCat.set(k.id, row); }
    row.count++;
    row.amount += t.amount || 0;
  });
  // Net "job" income per row key over the same range, used to derive
  // before-give-back net and % give back.
  const netJobByKey = new Map();
  txs.forEach(t => {
    const k = giveBackKey(t).id;
    if (!netJobByKey.has(k)) netJobByKey.set(k, 0);
    netJobByKey.set(k, netJobByKey.get(k) + (t.type === "income" ? t.amount : -t.amount));
  });
  const givebackRows = [...givebackByCat.values()]
    .map(r => {
      const netJob = netJobByKey.get(r.key) || 0;
      r.beforeGiveBackNet = netJob + r.amount;
      r.pctGiveBack = r.beforeGiveBackNet > 0 ? (r.amount / r.beforeGiveBackNet) * 100 : null;
      return r;
    })
    .sort((a, b) => b.amount - a.amount);
  const totalGiveBack = givebackRows.reduce((s, r) => s + r.amount, 0);
  const totalBeforeGiveBackNet = givebackRows.reduce((s, r) => s + r.beforeGiveBackNet, 0);
  const aggPct = totalBeforeGiveBackNet > 0 ? (totalGiveBack / totalBeforeGiveBackNet) * 100 : null;

  // ---- Render ----
  const helperBody = document.getElementById("hgb-report-helper-body");
  if (helperBody) {
    if (!helperRows.length) {
      helperBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">No Helper transactions in this range.</td></tr>`;
    } else {
      helperBody.innerHTML = helperRows.map(r => `
        <tr>
          <td>${escapeHtml(r.payee)}</td>
          <td>${escapeHtml(r.job || "")}</td>
          <td style="text-align:right">${r.count}</td>
          <td style="text-align:right;font-weight:600">${fmtMoney(r.amount)}</td>
        </tr>
      `).join("");
    }
  }

  const givebackBody = document.getElementById("hgb-report-giveback-body");
  if (givebackBody) {
    if (!givebackRows.length) {
      givebackBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">No Give Back transactions in this range.</td></tr>`;
    } else {
      givebackBody.innerHTML = givebackRows.map(r => {
        const pctGiveBackText = (r.pctGiveBack === null || !isFinite(r.pctGiveBack)) ? "—" : r.pctGiveBack.toFixed(1) + "%";
        return `
          <tr>
            <td>${escapeHtml(r.cat)}</td>
            <td style="text-align:right">${r.count}</td>
            <td style="text-align:right">${fmtMoney(r.beforeGiveBackNet)}</td>
            <td style="text-align:right">${pctGiveBackText}</td>
            <td style="text-align:right;font-weight:600">${fmtMoney(r.amount)}</td>
          </tr>
        `;
      }).join("");
    }
  }

  document.getElementById("hgb-report-helper-total-tx").textContent   = helperRows.reduce((s, r) => s + r.count, 0);
  document.getElementById("hgb-report-helper-total").textContent      = fmtMoney(totalHelper);
  document.getElementById("hgb-report-giveback-total-tx").textContent = givebackRows.reduce((s, r) => s + r.count, 0);
  document.getElementById("hgb-report-giveback-total").textContent    = fmtMoney(totalGiveBack);
  const bgbnTotalEl = document.getElementById("hgb-report-giveback-total-bgbn");
  if (bgbnTotalEl) bgbnTotalEl.textContent = fmtMoney(totalBeforeGiveBackNet);
  const pctTotalEl = document.getElementById("hgb-report-giveback-total-pct");
  if (pctTotalEl) pctTotalEl.textContent = aggPct === null ? "—" : aggPct.toFixed(1) + "%";

  // ---- Reduced Profit By summary ----
  // "Profit before Helper / Give Back" = sum of net (income - expenses) for
  // every Job-category in the selected time frame. A Job-category is one that
  // has positive income in the range and isn't a savings category — same
  // definition the Job/Category report uses for its Jobs section.
  const helperImpact   = incHelper   ? totalHelper   : 0;
  const giveBackImpact = incGiveBack ? totalGiveBack : 0;

  const catAgg = new Map(); // category -> { inc, exp }
  txs.forEach(t => {
    if (NON_JOB_CATEGORIES.includes(t.category)) return;
    const c = t.category || "Uncategorized";
    if (!catAgg.has(c)) catAgg.set(c, { inc: 0, exp: 0 });
    const a = catAgg.get(c);
    if (t.type === "income") a.inc += t.amount;
    else a.exp += t.amount;
  });
  let jobNet = 0;
  catAgg.forEach((v, c) => {
    if (v.inc > 0 && !SAVINGS_CATEGORIES.includes(c)) {
      jobNet += v.inc - v.exp;
    }
  });
  const actualNet = jobNet;
  const theoreticalProfit = actualNet + helperImpact + giveBackImpact;
  const pctOf = v => theoreticalProfit > 0 ? (v / theoreticalProfit) * 100 : null;
  const fmtPart = (v, p) => `${fmtMoney(v)}${p === null ? "" : " — " + p.toFixed(1) + "%"}`;
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setText("hgb-reduce-theoretical", fmtMoney(theoreticalProfit));
  setText("hgb-reduce-helper",      fmtPart(helperImpact,   pctOf(helperImpact)));
  setText("hgb-reduce-giveback",    fmtPart(giveBackImpact, pctOf(giveBackImpact)));
  setText("hgb-reduce-actual",      fmtMoney(actualNet));
  setText("hgb-reduce-total",       fmtPart(helperImpact + giveBackImpact, pctOf(helperImpact + giveBackImpact)));
}

// Wire toolbar
document.getElementById("hgb-report-from")?.addEventListener("change", () => {
  document.getElementById("hgb-report-preset").value = "custom";
  renderHGBReport();
});
document.getElementById("hgb-report-to")?.addEventListener("change", () => {
  document.getElementById("hgb-report-preset").value = "custom";
  renderHGBReport();
});
document.getElementById("hgb-report-preset")?.addEventListener("change", e => {
  if (e.target.value !== "custom") {
    applyHGBReportPreset(e.target.value);
    renderHGBReport();
  }
});
["hgb-report-include-helper", "hgb-report-include-giveback",
 "hgb-report-include-diane",  "hgb-report-include-tristen"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", renderHGBReport);
});
document.getElementById("btn-hgb-report-print")?.addEventListener("click", () => window.print());

// ---- Transactions Report ----
function applyTxReportPreset(value) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  let fromDate, toDate;
  const iso = d => d.toISOString().slice(0, 10);
  const lastDayOfMonth = (yr, mi) => new Date(yr, mi + 1, 0);
  if (/^\d{4}$/.test(value)) {
    const yr = parseInt(value, 10);
    fromDate = new Date(yr, 0, 1);
    toDate = new Date(yr, 11, 31);
  } else {
    switch (value) {
      case "this-month":    fromDate = new Date(y, m, 1);     toDate = lastDayOfMonth(y, m); break;
      case "last-month":    fromDate = new Date(y, m - 1, 1); toDate = lastDayOfMonth(y, m - 1); break;
      case "this-quarter": {
        const qStart = Math.floor(m / 3) * 3;
        fromDate = new Date(y, qStart, 1); toDate = lastDayOfMonth(y, qStart + 2); break;
      }
      case "first-half":    fromDate = new Date(y, 0, 1);     toDate = new Date(y, 5, 30); break;
      case "second-half":   fromDate = new Date(y, 6, 1);     toDate = new Date(y, 11, 31); break;
      case "ytd":           fromDate = new Date(y, 0, 1);     toDate = today; break;
      case "last-year":     fromDate = new Date(y - 1, 0, 1); toDate = new Date(y - 1, 11, 31); break;
      default: return;
    }
  }
  document.getElementById("tx-report-from").value = iso(fromDate);
  document.getElementById("tx-report-to").value = iso(toDate);
}

function populateTxReportFilters() {
  const fill = (id, items, allLabel) => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    const sorted = [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    el.innerHTML = `<option value="">${allLabel}</option>` +
      sorted.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    if (sorted.includes(current)) el.value = current;
  };
  fill("tx-report-category", state.categories || [], "All Categories");
  fill("tx-report-customer", state.customers || [], "All Customers");
  fill("tx-report-payee",    state.payees    || [], "All Payees");

  // Job No. dropdown — newest first, labeled "JOBNO — Customer / Category"
  const jobsSel = document.getElementById("tx-report-jobno");
  if (jobsSel) {
    const cur = jobsSel.value;
    const jobs = (state.jobs || []).slice().sort((a, b) => (b.jobNo || "").localeCompare(a.jobNo || ""));
    jobsSel.innerHTML = `<option value="">All Jobs</option>` +
      jobs.map(j => {
        const label = `${j.jobNo} - ${j.customer || ""}${j.category ? " / " + j.category : ""}`;
        return `<option value="${escapeHtml(j.jobNo)}">${escapeHtml(label)}</option>`;
      }).join("");
    if (jobs.some(j => j.jobNo === cur)) jobsSel.value = cur;
  }
  // Expense dropdown — entries from the new Expenses Table
  const expSel = document.getElementById("tx-report-expense");
  if (expSel) {
    const cur = expSel.value;
    const entries = Array.from(new Set((state.expensesTable || []).map(e => e.entry).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
    expSel.innerHTML = `<option value="">All Expenses</option>` +
      entries.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    if (entries.includes(cur)) expSel.value = cur;
  }
}

function renderTxReport() {
  const fromEl = document.getElementById("tx-report-from");
  const toEl   = document.getElementById("tx-report-to");
  if (!fromEl || !toEl) return;
  const from = fromEl.value, to = toEl.value;
  const fType  = document.getElementById("tx-report-type")?.value     || "";
  const fCat   = document.getElementById("tx-report-category")?.value || "";
  const fCust  = document.getElementById("tx-report-customer")?.value || "";
  const fPayee = document.getElementById("tx-report-payee")?.value    || "";
  const fJobNo = document.getElementById("tx-report-jobno")?.value    || "";
  const fExp   = document.getElementById("tx-report-expense")?.value  || "";
  const qAll   = (document.getElementById("tx-report-search")?.value || "").toLowerCase().trim();

  // Range label + filter summary
  const fmtDate = s => s ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
  document.getElementById("tx-report-range").textContent = (from || to) ? `${fmtDate(from)} — ${fmtDate(to)}` : "All dates";
  const summaryParts = [];
  if (fType)  summaryParts.push("Type: " + (fType.charAt(0).toUpperCase() + fType.slice(1)));
  if (fCat)   summaryParts.push("Category: " + fCat);
  if (fCust)  summaryParts.push("Customer: " + fCust);
  if (fPayee) summaryParts.push("Payee: " + fPayee);
  if (fJobNo) summaryParts.push("Job: " + fJobNo);
  if (fExp)   summaryParts.push("Expense: " + fExp);
  if (qAll)   summaryParts.push(`Find: "${qAll}"`);
  const sumEl = document.getElementById("tx-report-filter-summary");
  if (sumEl) sumEl.textContent = summaryParts.join(" · ");

  // Reflect the selected orientation on the report sheet so the on-screen
  // layout widens for landscape (default) and narrows back for portrait.
  const _orient = document.getElementById("tx-report-orientation")?.value || "landscape";
  const _sheet = document.getElementById("tx-report-sheet");
  if (_sheet) _sheet.classList.toggle("tx-report-landscape", _orient === "landscape");

  const list = state.transactions
    .filter(t => {
      const d = t.date || "";
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      if (fType  && t.type !== fType)  return false;
      if (fCat   && t.category !== fCat) return false;
      if (fCust  && (t.customer || "") !== fCust) return false;
      if (fPayee && (t.payee || "") !== fPayee) return false;
      if (fJobNo && (t.jobNo || "") !== fJobNo) return false;
      if (fExp   && (t.expenseIncome || "") !== fExp) return false;
      if (qAll) {
        const hay = [t.payee, t.memo, t.vendor, t.customer, t.category, t.account,
                     (t.tags || []).join(" "), String(t.amount)]
                     .map(x => (x || "").toLowerCase()).join(" ");
        if (!hay.includes(qAll)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const body = document.getElementById("tx-report-body");
  if (body) {
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#666;padding:20px">No transactions match the selected filters.</td></tr>`;
    } else {
      body.innerHTML = list.map(t => `
        <tr>
          <td>${fmtDate(t.date)}</td>
          <td>${escapeHtml(t.vendor  || "")}</td>
          <td>${escapeHtml(t.customer || "")}</td>
          <td>${escapeHtml(t.jobNo   || "")}</td>
          <td>${escapeHtml(t.expenseIncome || "")}</td>
          <td>${escapeHtml(t.category || "")}</td>
          <td>${escapeHtml(t.memo    || "")}</td>
          <td style="text-align:right;color:${t.type === "income" ? "var(--income)" : "var(--expense)"};font-weight:600">${t.type === "expense" ? "-" : ""}${fmtMoney(t.amount)}</td>
        </tr>
      `).join("");
    }
  }

  const totalIn  = list.reduce((s, t) => s + (t.type === "income"  ? t.amount : 0), 0);
  const totalOut = list.reduce((s, t) => s + (t.type === "expense" ? t.amount : 0), 0);
  const net = totalIn - totalOut;
  const totalAmount = totalIn + totalOut;
  document.getElementById("tx-report-total-count").textContent = `${list.length} tx`;
  document.getElementById("tx-report-total-amount").textContent = fmtMoney(totalAmount);
  const netEl = document.getElementById("tx-report-net");
  if (netEl) {
    netEl.textContent = (net >= 0 ? "" : "-") + fmtMoney(Math.abs(net));
    netEl.style.color = net >= 0 ? "var(--income)" : "var(--expense)";
  }
}

// Wire toolbar
document.getElementById("tx-report-from")?.addEventListener("change", () => {
  document.getElementById("tx-report-preset").value = "custom";
  renderTxReport();
});
document.getElementById("tx-report-to")?.addEventListener("change", () => {
  document.getElementById("tx-report-preset").value = "custom";
  renderTxReport();
});
document.getElementById("tx-report-preset")?.addEventListener("change", e => {
  if (e.target.value !== "custom") {
    applyTxReportPreset(e.target.value);
    renderTxReport();
  }
});
["tx-report-type", "tx-report-category", "tx-report-customer", "tx-report-payee", "tx-report-jobno", "tx-report-expense", "tx-report-orientation"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", renderTxReport);
});
document.getElementById("tx-report-search")?.addEventListener("input", renderTxReport);

// Print with chosen orientation
document.getElementById("btn-tx-report-print")?.addEventListener("click", () => {
  const orient = document.getElementById("tx-report-orientation")?.value || "portrait";
  if (orient === "landscape") {
    const s = document.createElement("style");
    s.id = "tx-landscape-style";
    s.textContent = "@media print { @page { size: letter landscape; margin: 0.5in; } }";
    document.head.appendChild(s);
    setTimeout(() => {
      window.print();
      setTimeout(() => s.remove(), 200);
    }, 30);
  } else {
    window.print();
  }
});

function populateReportPresetYears(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const years = Array.from(new Set(
    state.transactions
      .map(t => (t.date || "").slice(0, 4))
      .filter(y => /^\d{4}$/.test(y))
  )).sort((a, b) => b.localeCompare(a));
  [...sel.options].filter(o => /^\d{4}$/.test(o.value)).forEach(o => o.remove());
  const current = sel.value;
  years.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    sel.appendChild(opt);
  });
  sel.value = current;
}
function populateJobsReportPresetYears() { populateReportPresetYears("jobs-report-preset"); }

function renderJobsReport() {
  const fromEl = document.getElementById("jobs-report-from");
  const toEl = document.getElementById("jobs-report-to");
  if (!fromEl || !toEl) return;

  // Section toggles (each defaults to checked → shown).
  const incJobs = document.getElementById("jobs-report-include-jobs")?.checked !== false;
  const incCat  = document.getElementById("jobs-report-include-category")?.checked !== false;
  const incAcct = document.getElementById("jobs-report-include-account")?.checked !== false;
  const jobsSec = document.getElementById("jobs-report-section-jobs");
  const catSec  = document.getElementById("jobs-report-section-category");
  const acctSec = document.getElementById("jobs-report-section-account");
  if (jobsSec) jobsSec.style.display = incJobs ? "" : "none";
  if (catSec)  catSec.style.display  = incCat  ? "" : "none";
  if (acctSec) acctSec.style.display = incAcct ? "" : "none";
  const from = fromEl.value;
  const to = toEl.value;

  const rangeEl = document.getElementById("jobs-report-range");
  if (rangeEl) {
    const fmtDate = s => s ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
    rangeEl.textContent = (from || to) ? `${fmtDate(from)} — ${fmtDate(to)}` : "All dates";
  }

  const inRange = t => {
    const d = t.date || "";
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const txs = state.transactions.filter(inRange);
  const jobCats = state.categories.filter(c => !NON_JOB_CATEGORIES.includes(c));

  const allRows = jobCats.map(cat => {
    const catTxs = txs.filter(t => t.category === cat);
    let inc = 0, exp = 0;
    catTxs.forEach(t => { if (t.type === "income") inc += t.amount; else exp += t.amount; });
    return { cat, label: cat, count: catTxs.length, inc, exp, net: inc - exp };
  }).filter(r => r.count > 0);

  // The lower section: in By Category mode, groups by tx.category (legacy).
  // In By Job No. mode, groups by tx.expenseIncome (the new "Expense" field)
  // — covers the expense rows below the JOBS table.
  const _groupModeForCat = (typeof window !== "undefined" && window.jobsReportGroupMode) || "job";
  let catRows;
  if (_groupModeForCat === "job") {
    const buckets = new Map();
    txs.forEach(t => {
      if (t.type !== "expense") return;
      if (NON_JOB_CATEGORIES.includes(t.category)) return;
      if (SAVINGS_CATEGORIES.includes(t.category)) return;
      const key = (t.expenseIncome || "").trim() || "Uncategorized";
      const cur = buckets.get(key) || { cat: key, label: key, count: 0, inc: 0, exp: 0 };
      cur.count++;
      if (t.type === "income") cur.inc += t.amount; else cur.exp += t.amount;
      buckets.set(key, cur);
    });
    catRows = [...buckets.values()].map(r => ({ ...r, net: r.inc - r.exp }))
      .sort((a, b) => b.exp - a.exp);
  } else {
    catRows = allRows.filter(r => r.inc === 0 || SAVINGS_CATEGORIES.includes(r.cat)).sort((a, b) => b.net - a.net);
  }
  // Update the lower section's header label to match the active mode.
  const _catHead = document.getElementById("jobs-report-cat-head");
  if (_catHead) _catHead.textContent = _groupModeForCat === "job" ? "Expense" : "Category";

  // The JOBS table can switch between By Category (legacy) and By Job No.
  const groupMode = (typeof window !== "undefined" && window.jobsReportGroupMode) || "job";
  let rows;
  if (groupMode === "job") {
    rows = (state.jobs || []).map(j => {
      const jobTxs = txs.filter(t => t.jobNo === j.jobNo);
      let inc = 0, exp = 0;
      jobTxs.forEach(t => { if (t.type === "income") inc += t.amount; else exp += t.amount; });
      const label = `${j.jobNo} - ${j.customer || ""}${j.category ? " / " + j.category : ""}`;
      return { cat: j.jobNo, label, count: jobTxs.length, inc, exp, net: inc - exp, jobNo: j.jobNo };
    }).filter(r => r.count > 0).sort((a, b) => b.net - a.net);
    // Plus an "Unlinked" row for income txs that have no jobNo (so legacy data still shows somewhere)
    const jobNos = new Set((state.jobs || []).map(j => j.jobNo));
    const unlinkedTxs = txs.filter(t => (!t.jobNo || !jobNos.has(t.jobNo)) && !SAVINGS_CATEGORIES.includes(t.category) && !NON_JOB_CATEGORIES.includes(t.category) && t.type === "income");
    if (unlinkedTxs.length) {
      let inc = 0, exp = 0;
      unlinkedTxs.forEach(t => { if (t.type === "income") inc += t.amount; });
      // Also include any expense txs without jobNo? Keep scope tight — only income side here.
      rows.push({ cat: "__unlinked", label: "Unlinked (no Job No.)", count: unlinkedTxs.length, inc, exp, net: inc - exp, jobNo: "__unlinked" });
    }
  } else {
    rows = allRows.filter(r => r.inc > 0 && !SAVINGS_CATEGORIES.includes(r.cat)).sort((a, b) => b.net - a.net);
  }

  const totalInc = rows.reduce((s, r) => s + r.inc, 0);
  const totalExp = rows.reduce((s, r) => s + r.exp, 0);
  const totalNet = totalInc - totalExp;
  const totalTx  = rows.reduce((s, r) => s + r.count, 0);

  const body = document.getElementById("jobs-report-body");
  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No transactions in this range.</td></tr>`;
  } else {
    body.innerHTML = rows.map((r, idx) => {
      const pct = totalInc > 0 ? (r.inc / totalInc) * 100 : 0;
      const drillId = `jobdrill-${idx}`;

      // Per-transaction drill list — every transaction in this row's bucket.
      const rowFilter = (t) => {
        if (groupMode === "job") {
          if (r.jobNo === "__unlinked") {
            const jobNos = new Set((state.jobs || []).map(j => j.jobNo));
            return (!t.jobNo || !jobNos.has(t.jobNo)) && !SAVINGS_CATEGORIES.includes(t.category) && !NON_JOB_CATEGORIES.includes(t.category);
          }
          return t.jobNo === r.jobNo;
        }
        return t.category === r.cat;
      };
      const linkedTxs = state.transactions.filter(inRange).filter(rowFilter)
        .slice()
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

      const drillRows = linkedTxs.map(t => {
        // Detail label = the new-spec Expense entry (tx.expenseIncome).
        // For income lines without an expenseIncome, fall back to memo / vendor.
        const labelParts = [];
        const ei = (t.expenseIncome || "").trim();
        if (ei) labelParts.push(escapeHtml(ei));
        else if (t.memo) labelParts.push(escapeHtml(t.memo));
        else if (t.vendor) labelParts.push(escapeHtml(t.vendor));
        const labelHtml = labelParts.length ? labelParts.join(" · ") : '<span class="muted">—</span>';
        const incCell = t.type === "income"  ? fmtMoney(t.amount) : "";
        const expCell = t.type === "expense" ? fmtMoney(t.amount) : "";
        const sign = t.type === "expense" ? -1 : 1;
        const pct  = r.inc > 0 && t.type === "income" ? ((t.amount / r.inc) * 100).toFixed(1) + "%" : "";
        return `
          <tr class="pl-drill-row jobs-drill-row" data-drill-id="${drillId}" hidden>
            <td><span class="pl-drill-indent"></span>${escapeHtml(t.date || "")} <span class="muted">· ${labelHtml}</span></td>
            <td style="text-align:right">1</td>
            <td style="text-align:right">${incCell}</td>
            <td style="text-align:right">${expCell}</td>
            <td style="text-align:right;color:${sign >= 0 ? "var(--income)" : "var(--expense)"}">${fmtMoney(sign * t.amount)}</td>
            <td style="text-align:right">${pct}</td>
          </tr>
        `;
      }).join("");

      return `
        <tr class="pl-drillable jobs-drillable" data-drill-target="${drillId}" style="cursor:pointer">
          <td><span class="pl-drill-caret">▸</span> ${escapeHtml(r.label || r.cat)}</td>
          <td style="text-align:right">${r.count}</td>
          <td style="text-align:right">${fmtMoney(r.inc)}</td>
          <td style="text-align:right">${fmtMoney(r.exp)}</td>
          <td style="text-align:right;color:${r.net >= 0 ? "var(--income)" : "var(--expense)"};font-weight:600">${fmtMoney(r.net)}</td>
          <td style="text-align:right">${pct.toFixed(1)}%</td>
        </tr>
        ${drillRows}
      `;
    }).join("");

    body.querySelectorAll(".jobs-drillable").forEach(row => {
      row.addEventListener("click", () => {
        const id = row.dataset.drillTarget;
        const expanded = row.classList.toggle("expanded");
        const caret = row.querySelector(".pl-drill-caret");
        if (caret) caret.textContent = expanded ? "▾" : "▸";
        body.querySelectorAll(`.pl-drill-row[data-drill-id="${id}"]`).forEach(r => {
          r.hidden = !expanded;
        });
      });
    });
  }

  document.getElementById("jobs-report-total-tx").textContent = totalTx;
  document.getElementById("jobs-report-total-inc").textContent = fmtMoney(totalInc);
  document.getElementById("jobs-report-total-exp").textContent = fmtMoney(totalExp);
  document.getElementById("jobs-report-total-net").textContent = fmtMoney(totalNet);

  // By Category table (income-less categories) — drillable like the Jobs table
  const catBody = document.getElementById("jobs-report-cat-body");
  if (catBody) {
    if (catRows.length === 0) {
      catBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">No non-job activity in this range.</td></tr>`;
    } else {
      catBody.innerHTML = catRows.map((r, idx) => {
        const drillId = `catdrill-${idx}`;
        // Aggregate per payee — in job mode, filter by tx.expenseIncome; otherwise by category
        const payeeMap = new Map();
        const _rowFilter = (t) => {
          if (_groupModeForCat === "job") {
            if (t.type !== "expense") return false;
            if (NON_JOB_CATEGORIES.includes(t.category)) return false;
            if (SAVINGS_CATEGORIES.includes(t.category)) return false;
            const k = (t.expenseIncome || "").trim() || "Uncategorized";
            return k === r.cat;
          }
          return t.category === r.cat;
        };
        // Per-transaction drill — every tx in this row's bucket, sorted by date.
        const linkedTxs = txs.filter(_rowFilter)
          .slice()
          .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        const drillRows = linkedTxs.map(t => {
          const labelParts = [];
          if (t.vendor) labelParts.push(escapeHtml(t.vendor));
          if (t.memo)   labelParts.push(`<span class="muted">${escapeHtml(t.memo)}</span>`);
          if (!labelParts.length && t.payee && t.payee !== "Job") labelParts.push(escapeHtml(t.payee));
          const labelHtml = labelParts.length ? labelParts.join(" · ") : '<span class="muted">—</span>';
          const incCell = t.type === "income"  ? fmtMoney(t.amount) : "";
          const expCell = t.type === "expense" ? fmtMoney(t.amount) : "";
          const sign = t.type === "expense" ? -1 : 1;
          return `
            <tr class="pl-drill-row cat-drill-row" data-drill-id="${drillId}" hidden>
              <td><span class="pl-drill-indent"></span>${escapeHtml(t.date || "")} <span class="muted">· ${labelHtml}</span></td>
              <td style="text-align:right">1</td>
              <td style="text-align:right">${incCell}</td>
              <td style="text-align:right">${expCell}</td>
              <td style="text-align:right;color:${sign >= 0 ? "var(--income)" : "var(--expense)"}">${fmtMoney(sign * t.amount)}</td>
            </tr>
          `;
        }).join("");
        return `
          <tr class="pl-drillable cat-drillable" data-drill-target="${drillId}" style="cursor:pointer">
            <td><span class="pl-drill-caret">▸</span> ${escapeHtml(r.label || r.cat)}</td>
            <td style="text-align:right">${r.count}</td>
            <td style="text-align:right">${fmtMoney(r.inc)}</td>
            <td style="text-align:right">${fmtMoney(r.exp)}</td>
            <td style="text-align:right;color:${r.net >= 0 ? "var(--income)" : "var(--expense)"};font-weight:600">${fmtMoney(r.net)}</td>
          </tr>
          ${drillRows}
        `;
      }).join("");
      catBody.querySelectorAll(".cat-drillable").forEach(row => {
        row.addEventListener("click", () => {
          const id = row.dataset.drillTarget;
          const expanded = row.classList.toggle("expanded");
          const caret = row.querySelector(".pl-drill-caret");
          if (caret) caret.textContent = expanded ? "▾" : "▸";
          catBody.querySelectorAll(`.pl-drill-row[data-drill-id="${id}"]`).forEach(r => {
            r.hidden = !expanded;
          });
        });
      });
    }
    const catTotalInc = catRows.reduce((s, r) => s + r.inc, 0);
    const catTotalExp = catRows.reduce((s, r) => s + r.exp, 0);
    const catTotalTx  = catRows.reduce((s, r) => s + r.count, 0);
    document.getElementById("jobs-report-cat-total-tx").textContent = catTotalTx;
    document.getElementById("jobs-report-cat-total-inc").textContent = fmtMoney(catTotalInc);
    document.getElementById("jobs-report-cat-total-exp").textContent = fmtMoney(catTotalExp);
    document.getElementById("jobs-report-cat-total-net").textContent = fmtMoney(catTotalInc - catTotalExp);
  }

  // By Account table
  const acctBody = document.getElementById("jobs-report-acct-body");
  if (acctBody) {
    const byAcct = {};
    (state.accounts || []).forEach(a => { byAcct[a] = { income: 0, expense: 0 }; });
    txs.forEach(t => {
      if (NON_JOB_CATEGORIES.includes(t.category)) return;
      if (!byAcct[t.account]) byAcct[t.account] = { income: 0, expense: 0 };
      byAcct[t.account][t.type] += t.amount;
    });
    const acctEntries = Object.entries(byAcct).filter(([, s]) => s.income > 0 || s.expense > 0);
    if (acctEntries.length === 0) {
      acctBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">No account activity in this range.</td></tr>`;
    } else {
      acctBody.innerHTML = acctEntries.map(([a, s]) => {
        const bal = s.income - s.expense;
        return `<tr>
          <td>${escapeHtml(a)}</td>
          <td style="text-align:right">${fmtMoney(s.income)}</td>
          <td style="text-align:right">${fmtMoney(s.expense)}</td>
          <td style="text-align:right;color:${bal >= 0 ? "var(--income)" : "var(--expense)"};font-weight:600">${fmtMoney(bal)}</td>
        </tr>`;
      }).join("");
    }
    const acctTotalInc = acctEntries.reduce((s, [, v]) => s + v.income, 0);
    const acctTotalExp = acctEntries.reduce((s, [, v]) => s + v.expense, 0);
    document.getElementById("jobs-report-acct-total-inc").textContent = fmtMoney(acctTotalInc);
    document.getElementById("jobs-report-acct-total-exp").textContent = fmtMoney(acctTotalExp);
    document.getElementById("jobs-report-acct-total-bal").textContent = fmtMoney(acctTotalInc - acctTotalExp);
  }
}

document.getElementById("jobs-report-from")?.addEventListener("change", () => {
  document.getElementById("jobs-report-preset").value = "custom";
  renderJobsReport();
});
document.getElementById("jobs-report-to")?.addEventListener("change", () => {
  document.getElementById("jobs-report-preset").value = "custom";
  renderJobsReport();
});
document.getElementById("jobs-report-preset")?.addEventListener("change", e => {
  if (e.target.value !== "custom") {
    applyJobsReportPreset(e.target.value);
    renderJobsReport();
  }
});
document.getElementById("btn-jobs-report-print")?.addEventListener("click", () => window.print());
["jobs-report-include-jobs", "jobs-report-include-category", "jobs-report-include-account"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", renderJobsReport);
});

document.getElementById("btn-jobs-report-toggle-all")?.addEventListener("click", () => {
  const jobsBody = document.getElementById("jobs-report-body");
  const catBody  = document.getElementById("jobs-report-cat-body");
  // Collect drillables from BOTH tables (Jobs + By Category) so a single
  // Expand All button toggles them in unison.
  const groups = [
    { body: jobsBody, sel: ".jobs-drillable" },
    { body: catBody,  sel: ".cat-drillable"  },
  ];
  const allDrillables = [];
  groups.forEach(g => {
    if (!g.body) return;
    g.body.querySelectorAll(g.sel).forEach(r => allDrillables.push({ row: r, body: g.body }));
  });
  if (!allDrillables.length) return;
  const anyCollapsed = allDrillables.some(({ row }) => !row.classList.contains("expanded"));
  const expand = anyCollapsed;
  allDrillables.forEach(({ row, body }) => {
    row.classList.toggle("expanded", expand);
    const caret = row.querySelector(".pl-drill-caret");
    if (caret) caret.textContent = expand ? "▾" : "▸";
    const id = row.dataset.drillTarget;
    body.querySelectorAll(`.pl-drill-row[data-drill-id="${id}"]`).forEach(r => {
      r.hidden = !expand;
    });
  });
  document.getElementById("btn-jobs-report-toggle-all").textContent = expand ? "Collapse All" : "Expand All";
});

document.querySelectorAll(".report-picker-btn").forEach(b => {
  b.addEventListener("click", () => showReport(b.dataset.report));
});

// Mobile shared Print/PDF — forwards to whichever report container is visible
// (each container's own *-print button is hidden on mobile via CSS).
document.getElementById("rmvp-print-btn")?.addEventListener("click", () => {
  const containers = [
    "pl-report-container",
    "tax-report-container",
    "mileage-report-container",
    "jobs-report-container",
    "ie-report-container",
    "tx-report-container",
    "hgb-report-container",
    "sc-report-container",
  ];
  for (const id of containers) {
    const el = document.getElementById(id);
    if (el && !el.hidden) {
      const printBtn = el.querySelector('[id$="-print"]');
      if (printBtn) printBtn.click();
      return;
    }
  }
});

// ===== Mobile Reports pull-down (rmvp) =====
const rmvpEl       = document.getElementById("rmvp");
const rmvpTrigger  = document.getElementById("rmvp-trigger");
const rmvpMenu     = document.getElementById("rmvp-menu");
const rmvpLabelEl  = document.getElementById("rmvp-current-label");

function closeRmvp() {
  if (rmvpMenu) rmvpMenu.hidden = true;
  if (rmvpTrigger) rmvpTrigger.setAttribute("aria-expanded", "false");
}
rmvpTrigger?.addEventListener("click", e => {
  e.stopPropagation();
  if (!rmvpMenu) return;
  const open = !rmvpMenu.hidden;
  rmvpMenu.hidden = open;
  rmvpTrigger.setAttribute("aria-expanded", open ? "false" : "true");
});
document.addEventListener("click", e => {
  if (!rmvpEl || !rmvpMenu || rmvpMenu.hidden) return;
  if (rmvpEl.contains(e.target)) return;
  closeRmvp();
});
rmvpMenu?.querySelectorAll(".amvp-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const which = btn.dataset.report;
    showReport(which);
    closeRmvp();
  });
});

// Keep rmvp trigger label + active item in sync with the active report. Wrap
// showReport so every change goes through the same sync.
const _origShowReport = showReport;
showReport = function(which) {
  _origShowReport(which);
  if (rmvpMenu) {
    rmvpMenu.querySelectorAll(".amvp-item").forEach(b => {
      b.classList.toggle("active", b.dataset.report === which);
    });
    const active = rmvpMenu.querySelector(`.amvp-item[data-report="${which}"]`);
    if (active && rmvpLabelEl) {
      rmvpLabelEl.textContent = active.querySelector("span").textContent;
    }
  }
};

document.getElementById("btn-pl-toggle-all").addEventListener("click", () => {
  const body = document.getElementById("pl-body");
  if (!body) return;
  const drillables = body.querySelectorAll(".pl-drillable");
  if (!drillables.length) return;

  // If any drillable is collapsed, expand all. Otherwise collapse all.
  const anyCollapsed = Array.from(drillables).some(r => !r.classList.contains("expanded"));
  const expand = anyCollapsed;

  drillables.forEach(row => {
    row.classList.toggle("expanded", expand);
    const id = row.dataset.drillTarget;
    body.querySelectorAll(`.pl-drill-row[data-drill-id="${id}"]`).forEach(r => {
      r.hidden = !expand;
    });
  });

  document.getElementById("btn-pl-toggle-all").textContent = expand ? "Collapse All" : "Expand All";
});

// ============ MILEAGE ============
function ensureMileageState() {
  if (!Array.isArray(state.trips)) state.trips = [];
  if (typeof state.mileageRate !== "number") state.mileageRate = 0.70;
}

let mileageViewYear = String(new Date().getFullYear());
let mileageYearInitialized = false;
function renderMileage() {
  ensureMileageState();
  // On first render, jump to the most recent year that has trips so the page
  // isn't blank when the current calendar year has no entries yet.
  if (!mileageYearInitialized) {
    mileageYearInitialized = true;
    const tripYears = (state.trips || [])
      .map(t => (t.date || "").slice(0, 4))
      .filter(y => /^\d{4}$/.test(y));
    if (tripYears.length) {
      const latest = tripYears.sort().slice(-1)[0];
      const thisYear = String(new Date().getFullYear());
      mileageViewYear = tripYears.includes(thisYear) ? thisYear : latest;
    }
  }

  // Sync rate input
  const rateEl = document.getElementById("mileage-rate");
  if (rateEl && document.activeElement !== rateEl) rateEl.value = state.mileageRate;

  // Default date to today if empty
  const dateEl = document.getElementById("mileage-new-date");
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);

  // Vehicle datalist
  const vehicles = Array.from(new Set(state.trips.map(t => t.vehicle).filter(Boolean))).sort();
  const dl = document.getElementById("mileage-vehicle-datalist");
  if (dl) dl.innerHTML = vehicles.map(v => `<option value="${escapeHtml(v)}"></option>`).join("");

  // Year navigation — Summary, All Trips and Total Miles all scope to this year.
  const viewYear = String(mileageViewYear);
  const yearSel = document.getElementById("mileage-year-select");
  if (yearSel) {
    const years = new Set();
    (state.trips || []).forEach(t => {
      const y = (t.date || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) years.add(Number(y));
    });
    years.add(new Date().getFullYear());
    const vy = Number(viewYear);
    if (Number.isFinite(vy)) {
      years.add(vy - 1);
      years.add(vy);
      years.add(vy + 1);
    }
    const sorted = [...years].sort((a, b) => b - a); // newest first
    yearSel.innerHTML = sorted.map(y => `<option value="${y}">${y}</option>`).join("");
    yearSel.value = viewYear;
  }
  const summaryHeading = document.getElementById("mileage-summary-heading");
  if (summaryHeading) summaryHeading.textContent = `Summary by Vehicle — ${viewYear}`;
  const tripsHeading = document.getElementById("mileage-trips-heading");
  if (tripsHeading) tripsHeading.textContent = `All Trips — ${viewYear}`;

  // Summary by vehicle (filtered to the viewed year) + grand total for that year
  const summary = {};
  let grandMilesYear = 0;
  state.trips.forEach(t => {
    if (!(t.date || "").startsWith(viewYear)) return;
    const v = t.vehicle || "(no vehicle)";
    if (!summary[v]) summary[v] = { miles: 0, trips: 0 };
    const miles = parseFloat(t.miles) || 0;
    summary[v].miles += miles;
    summary[v].trips++;
    grandMilesYear += miles;
  });
  const grandEl = document.getElementById("mileage-grand-total");
  if (grandEl) grandEl.textContent = grandMilesYear.toFixed(2);
  const grandLabel = document.querySelector(".mileage-total-display .mileage-total-label");
  if (grandLabel) grandLabel.textContent = `Total Miles ${viewYear}`;
  const summaryBody = document.querySelector("#mileage-summary-table tbody");
  const vehList = Object.keys(summary).sort();
  if (!vehList.length) {
    summaryBody.innerHTML = `<tr><td colspan="4" class="empty">No trips logged in ${escapeHtml(viewYear)}.</td></tr>`;
  } else {
    summaryBody.innerHTML = vehList.map(v => {
      const s = summary[v];
      const expense = s.miles * (state.mileageRate || 0);
      return `
        <tr>
          <td>${escapeHtml(v)}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${s.miles.toFixed(2)}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${fmtMoney(expense)}</td>
          <td style="text-align:right">${s.trips}</td>
        </tr>
      `;
    }).join("");
  }

  // All trips for the viewed year only
  const tripsBody = document.querySelector("#mileage-trips-table tbody");
  const tripsInYear = (state.trips || []).filter(t => (t.date || "").startsWith(viewYear));
  if (!tripsInYear.length) {
    tripsBody.innerHTML = `<tr><td colspan="5" class="empty">No trips in ${escapeHtml(viewYear)}.</td></tr>`;
    return;
  }
  const sorted = tripsInYear.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  tripsBody.innerHTML = sorted.map(t => `
    <tr data-id="${t.id}" class="trip-row">
      <td>${fmtDate(t.date)}</td>
      <td>${escapeHtml(t.vehicle || "")}</td>
      <td>${escapeHtml(t.purpose || "")}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${(parseFloat(t.miles) || 0).toFixed(2)}</td>
      <td><button type="button" class="btn icon trip-del-btn">Delete</button></td>
    </tr>
  `).join("");

  tripsBody.querySelectorAll(".trip-del-btn").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    const id = e.target.closest("tr").dataset.id;
    const trip = (state.trips || []).find(x => x.id === id);
    if (trip && isLockedDate(trip.date)) { blockedToast(trip.date.slice(0, 4)); return; }
    if (!confirm("Delete this trip?")) return;
    state.trips = state.trips.filter(t => t.id !== id);
    saveState();
    renderMileage();
  }));

  // Press and hold (or double-click) any trip row to open it in the edit modal.
  tripsBody.querySelectorAll(".trip-row").forEach(row => {
    let holdTimer = null;
    let didHold = false;

    const openForRow = () => {
      const id = row.dataset.id;
      const trip = state.trips.find(x => x.id === id);
      if (trip) openTripModal(trip);
    };

    row.addEventListener("dblclick", e => {
      if (e.target.closest(".trip-del-btn")) return;
      openForRow();
    });

    const startHold = e => {
      if (e.target.closest(".trip-del-btn")) return;
      didHold = false;
      row.classList.add("pressing");
      holdTimer = setTimeout(() => {
        holdTimer = null;
        didHold = true;
        row.classList.remove("pressing");
        openForRow();
      }, 600);
    };
    const cancelHold = () => {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      row.classList.remove("pressing");
    };

    row.addEventListener("mousedown", e => { if (e.button === 0) startHold(e); });
    row.addEventListener("touchstart", startHold, { passive: true });
    row.addEventListener("mouseup", cancelHold);
    row.addEventListener("mouseleave", cancelHold);
    row.addEventListener("touchend", cancelHold);
    row.addEventListener("touchcancel", cancelHold);
    row.addEventListener("touchmove", cancelHold);
    row.addEventListener("click", e => { if (didHold) { e.stopPropagation(); didHold = false; } });
  });
}

// --- Trip edit modal ---
function openTripModal(trip) {
  // Populate vehicle datalist with previously-used vehicles
  const vehicles = Array.from(new Set(state.trips.map(t => t.vehicle).filter(Boolean))).sort();
  const dl = document.getElementById("trip-vehicle-datalist");
  if (dl) dl.innerHTML = vehicles.map(v => `<option value="${escapeHtml(v)}"></option>`).join("");

  document.getElementById("trip-id").value = trip.id;
  document.getElementById("trip-edit-date").value = trip.date || "";
  document.getElementById("trip-edit-vehicle").value = trip.vehicle || "";
  document.getElementById("trip-edit-miles").value = trip.miles ?? "";
  document.getElementById("trip-edit-purpose").value = trip.purpose || "";
  document.getElementById("trip-modal").classList.remove("hidden");
}

function closeTripModal() {
  document.getElementById("trip-modal").classList.add("hidden");
}

document.getElementById("btn-trip-cancel").addEventListener("click", closeTripModal);
document.getElementById("trip-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("trip-modal")) closeTripModal();
});

document.getElementById("btn-trip-delete").addEventListener("click", () => {
  const id = document.getElementById("trip-id").value;
  if (!id) return;
  const trip = (state.trips || []).find(t => t.id === id);
  if (trip && isLockedDate(trip.date)) { blockedToast(trip.date.slice(0, 4)); return; }
  if (!confirm("Delete this trip?")) return;
  state.trips = state.trips.filter(t => t.id !== id);
  saveState();
  closeTripModal();
  renderMileage();
});

document.getElementById("trip-form").addEventListener("submit", e => {
  e.preventDefault();
  const id = document.getElementById("trip-id").value;
  const date = document.getElementById("trip-edit-date").value;
  const vehicle = document.getElementById("trip-edit-vehicle").value.trim();
  const miles = parseFloat(document.getElementById("trip-edit-miles").value);
  const purpose = document.getElementById("trip-edit-purpose").value.trim();

  if (!date) { alert("Please enter a date."); return; }
  if (!vehicle) { alert("Please enter a vehicle."); return; }
  if (isNaN(miles) || miles <= 0) { alert("Please enter a positive number of miles."); return; }

  const idx = state.trips.findIndex(t => t.id === id);
  if (idx >= 0) {
    const oldDate = state.trips[idx].date;
    if (isLockedDate(oldDate)) { blockedToast(oldDate.slice(0, 4)); return; }
    if (isLockedDate(date)) { blockedToast(date.slice(0, 4)); return; }
    state.trips[idx] = { ...state.trips[idx], date, vehicle, miles, purpose };
    saveState();
  }
  closeTripModal();
  renderMileage();
});

document.getElementById("btn-add-trip").addEventListener("click", () => {
  ensureMileageState();
  const date = document.getElementById("mileage-new-date").value;
  const vehicle = document.getElementById("mileage-new-vehicle").value.trim();
  const miles = parseFloat(document.getElementById("mileage-new-miles").value);
  const purpose = document.getElementById("mileage-new-purpose").value.trim();
  if (!date) { alert("Please enter a date."); return; }
  if (!vehicle) { alert("Please enter a vehicle."); return; }
  if (isNaN(miles) || miles <= 0) { alert("Please enter a positive number of miles."); return; }
  if (isLockedDate(date)) { blockedToast(date.slice(0, 4)); return; }
  state.trips.push({ id: uid(), date, vehicle, miles, purpose });
  saveState();
  // Clear inputs but keep date and vehicle for quick multi-entry
  document.getElementById("mileage-new-miles").value = "";
  document.getElementById("mileage-new-purpose").value = "";
  renderMileage();
  if (window.toast) toast(`${miles} mile${miles === 1 ? "" : "s"} logged`, { kind: "success" });
});

document.getElementById("mileage-rate").addEventListener("input", e => {
  const v = parseFloat(e.target.value);
  if (!isNaN(v) && v >= 0) {
    state.mileageRate = v;
    saveState();
    renderMileage();
  }
});

// Year navigation — dropdown select drives the viewed year (replaces the
// older prev/next/Today button row).
document.getElementById("mileage-year-select")?.addEventListener("change", (e) => {
  const y = parseInt(e.target.value, 10);
  if (!Number.isFinite(y)) return;
  mileageViewYear = String(y);
  renderMileage();
});

// ============ MILEAGE REPORT ============
function openMileageReport() {
  // Switch to the Reports tab with the Mileage report selected
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  const reportsTab = document.querySelector('.tab-btn[data-tab="reports"]');
  if (reportsTab) reportsTab.classList.add("active");
  document.getElementById("reports").classList.add("active");
  showReport("mileage");
}

function applyMileageReportPreset(value) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  let fromDate, toDate;
  const iso = d => d.toISOString().slice(0, 10);
  const lastDayOfMonth = (yr, mi) => new Date(yr, mi + 1, 0);

  if (/^\d{4}$/.test(value)) {
    const yr = parseInt(value, 10);
    document.getElementById("mileage-report-from").value = iso(new Date(yr, 0, 1));
    document.getElementById("mileage-report-to").value = iso(new Date(yr, 11, 31));
    return;
  }
  switch (value) {
    case "this-month":
      fromDate = new Date(y, m, 1); toDate = lastDayOfMonth(y, m); break;
    case "last-month":
      fromDate = new Date(y, m - 1, 1); toDate = lastDayOfMonth(y, m - 1); break;
    case "this-quarter": {
      const qStart = Math.floor(m / 3) * 3;
      fromDate = new Date(y, qStart, 1); toDate = lastDayOfMonth(y, qStart + 2); break;
    }
    case "first-half":
      fromDate = new Date(y, 0, 1); toDate = new Date(y, 5, 30); break;
    case "second-half":
      fromDate = new Date(y, 6, 1); toDate = new Date(y, 11, 31); break;
    case "ytd":
      fromDate = new Date(y, 0, 1); toDate = today; break;
    case "last-year":
      fromDate = new Date(y - 1, 0, 1); toDate = new Date(y - 1, 11, 31); break;
    default: return;
  }
  document.getElementById("mileage-report-from").value = iso(fromDate);
  document.getElementById("mileage-report-to").value = iso(toDate);
}

function renderMileageReport() {
  ensureMileageState();
  const from = document.getElementById("mileage-report-from").value;
  const to = document.getElementById("mileage-report-to").value;
  const rate = state.mileageRate || 0;
  const includeDetail  = document.getElementById("mileage-include-detail")?.checked !== false;
  const includeExpense = document.getElementById("mileage-include-expense")?.checked !== false;

  const fmt = iso => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";
  document.getElementById("mileage-report-range").textContent = `${fmt(from)} — ${fmt(to)}`;

  const trips = state.trips.filter(t => {
    if (!t.date) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    return true;
  }).sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // Summary by vehicle
  const byVeh = {};
  trips.forEach(t => {
    const v = t.vehicle || "(no vehicle)";
    if (!byVeh[v]) byVeh[v] = { miles: 0 };
    byVeh[v].miles += parseFloat(t.miles) || 0;
  });

  const summaryBody = document.getElementById("mileage-report-summary-body");
  const keys = Object.keys(byVeh).sort();
  let totalMiles = 0, totalExpense = 0;
  if (!keys.length) {
    summaryBody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#666">No trips in this range.</td></tr>`;
  } else {
    summaryBody.innerHTML = keys.map(v => {
      const miles = byVeh[v].miles;
      const expense = miles * rate;
      totalMiles += miles;
      totalExpense += expense;
      return `
        <tr>
          <td>${escapeHtml(v)}</td>
          <td style="text-align:right">${miles.toFixed(2)}</td>
          <td style="text-align:right">${fmtMoney(expense)}</td>
        </tr>
      `;
    }).join("");
  }
  document.getElementById("mileage-report-total-miles").textContent = totalMiles.toFixed(2);
  document.getElementById("mileage-report-total-expense").textContent = fmtMoney(totalExpense);

  // Toggle the Mileage Expense column on the Summary table (header, body cells,
  // and footer). When excluded, dim them via CSS .col-hidden.
  const sheet = document.getElementById("mileage-report-sheet");
  if (sheet) sheet.classList.toggle("hide-expense", !includeExpense);
  // Toggle the Trip Detail section visibility entirely.
  const detailSection = document.getElementById("mileage-report-detail-body")?.closest(".tax-report-section");
  if (detailSection) detailSection.style.display = includeDetail ? "" : "none";

  // Trip detail
  const detailBody = document.getElementById("mileage-report-detail-body");
  if (!trips.length) {
    detailBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#666">No trips in this range.</td></tr>`;
  } else {
    detailBody.innerHTML = trips.map(t => {
      const miles = parseFloat(t.miles) || 0;
      const exp = miles * rate;
      return `
        <tr>
          <td>${fmtDate(t.date)}</td>
          <td>${escapeHtml(t.vehicle || "")}</td>
          <td>${escapeHtml(t.purpose || "")}</td>
          <td style="text-align:right">${miles.toFixed(2)}</td>
          <td style="text-align:right">${fmtMoney(exp)}</td>
        </tr>
      `;
    }).join("");
  }
}

// Wire the toggles to re-render
document.getElementById("mileage-include-detail")?.addEventListener("change", renderMileageReport);
document.getElementById("mileage-include-expense")?.addEventListener("change", renderMileageReport);

document.getElementById("btn-open-mileage-report")?.addEventListener("click", openMileageReport);
document.getElementById("btn-mileage-report-print").addEventListener("click", () => window.print());
document.getElementById("mileage-report-from").addEventListener("change", () => {
  document.getElementById("mileage-report-preset").value = "custom";
  renderMileageReport();
});
document.getElementById("mileage-report-to").addEventListener("change", () => {
  document.getElementById("mileage-report-preset").value = "custom";
  renderMileageReport();
});
document.getElementById("mileage-report-preset").addEventListener("change", e => {
  if (e.target.value !== "custom") {
    applyMileageReportPreset(e.target.value);
    renderMileageReport();
  }
});

// ============ INVOICES ============
// Editor state: null means no invoice currently being edited.
let editingInvoice = null;

function ensureInvoiceState() {
  if (!Array.isArray(state.invoices)) state.invoices = [];
  if (typeof state.nextInvoiceNumber !== "number") state.nextInvoiceNumber = 26002;
}

function parseMoneyInput(v) {
  if (v === undefined || v === null || v === "") return NaN;
  // Strip $, commas, spaces
  const cleaned = String(v).replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? NaN : n;
}

function invoiceLineAmount(line) {
  const q = parseFloat(line.qty) || 0;
  const p = parseMoneyInput(line.price);
  return q * (isNaN(p) ? 0 : p);
}

function formatInvoicePriceDisplay(v) {
  const n = parseMoneyInput(v);
  return isNaN(n) ? "" : "$" + n.toFixed(2);
}

function invoiceSubtotal(inv) {
  return (inv.lineItems || []).reduce((s, l) => s + invoiceLineAmount(l), 0);
}

function invoiceTaxAmount(inv) {
  if ((inv.taxMode || "tax") !== "tax") return 0;
  const rate = parseFloat(inv.taxRate);
  if (isNaN(rate)) return 0;
  return invoiceSubtotal(inv) * (rate / 100);
}

function invoiceTotal(inv) {
  return invoiceSubtotal(inv) + invoiceTaxAmount(inv);
}

let invoicesYearInitialized = false;
function renderInvoicesList() {
  ensureInvoiceState();

  // Populate year + job filter dropdowns dynamically from invoice data
  const yearSel = document.getElementById("inv-filter-year");
  const jobSel = document.getElementById("inv-filter-job");
  const curYear = yearSel.value;
  const curJob = jobSel.value;
  const years = Array.from(new Set(
    state.invoices.map(i => (i.date || "").slice(0, 4)).filter(y => /^\d{4}$/.test(y))
  )).sort((a, b) => b.localeCompare(a));
  yearSel.innerHTML = `<option value="">All Years</option>` +
    years.map(y => `<option value="${y}">${y}</option>`).join("");
  // On first render default the filter to the current calendar year (if any
  // invoices exist for it); otherwise keep whatever the user has selected.
  if (!invoicesYearInitialized) {
    invoicesYearInitialized = true;
    const thisYear = String(new Date().getFullYear());
    yearSel.value = years.includes(thisYear) ? thisYear : "";
  } else {
    yearSel.value = curYear;
  }

  // --- Jobs not invoiced: new-spec Job records with no invoice referencing
  // their Job No. (an invoice "covers" a job when invoice.number === job.jobNo).
  // Respects the year filter on the job's date.
  const selectedYear = yearSel.value;
  const uninvoicedCard = document.getElementById("uninvoiced-jobs-card");
  const uninvoicedList = document.getElementById("uninvoiced-list");
  const uninvoicedCount = document.getElementById("uninvoiced-count");
  if (uninvoicedCard && uninvoicedList) {
    // A job is invoiced if any invoice has invoice.jobNo === job.jobNo OR
    // its number matches the job's base jobNo (with optional "-N" suffix
    // stripped) — covers older invoices that predate the explicit jobNo field.
    const invoicedJobNos = new Set();
    (state.invoices || []).forEach(i => {
      if (i.jobNo) { invoicedJobNos.add(String(i.jobNo).trim()); return; }
      const n = (i.number || "").trim();
      if (n) invoicedJobNos.add(n.replace(/-\d+$/, ""));
    });
    const uninvoiced = (state.jobs || [])
      .filter(j => !invoicedJobNos.has(j.jobNo))
      .filter(j => !selectedYear || (j.date || "").startsWith(selectedYear))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    if (uninvoiced.length) {
      uninvoicedCard.hidden = false;
      uninvoicedCount.textContent = uninvoiced.length;
      // Per-job income earned so far (sum of linked income transactions)
      const incomeByJob = new Map();
      (state.transactions || []).forEach(t => {
        if (t.type !== "income" || !t.jobNo) return;
        incomeByJob.set(t.jobNo, (incomeByJob.get(t.jobNo) || 0) + (+t.amount || 0));
      });
      uninvoicedList.onclick = (e) => {
        const row = e.target.closest(".uninvoiced-row");
        if (!row) return;
        const jobNo = row.dataset.jobno;
        if (!jobNo) return;
        const newBtn = document.getElementById("btn-new-invoice");
        if (newBtn) newBtn.click();
        setTimeout(() => {
          const sel = document.getElementById("invoice-job");
          if (!sel) return;
          const opt = [...sel.options].find(o => o.value === "nj:" + jobNo);
          if (opt) {
            sel.value = "nj:" + jobNo;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, 50);
      };
      uninvoicedList.innerHTML = uninvoiced.map(j => {
        const earned = incomeByJob.get(j.jobNo) || 0;
        return `<tr class="uninvoiced-row" data-jobno="${escapeHtml(j.jobNo)}">
           <td data-col="date" class="uninvoiced-date">${escapeHtml(j.date || "")}</td>
           <td data-col="customer" class="uninvoiced-customer">${escapeHtml(j.customer || "")} <span class="muted" style="font-size:11px">· ${escapeHtml(j.jobNo)}</span></td>
           <td data-col="job" class="uninvoiced-job">${escapeHtml(j.category || "")}${(j.status || (j.complete ? "Paid" : "")) ? ' <span class="muted" style="font-size:11px">(' + escapeHtml(j.status || (j.complete ? "Paid" : "")) + ')</span>' : ""}</td>
           <td data-col="amt" class="uninvoiced-amt income">${fmtMoney(earned)}</td>
         </tr>`;
      }).join("");
    } else {
      uninvoicedCard.hidden = true;
    }
  }

  // Summary totals — respect the year filter so "Total Invoiced" and
  // "Total Paid" only reflect invoices matching the selected year.
  const summaryYear = yearSel.value;
  let outstanding = 0, paid = 0;
  state.invoices.forEach(inv => {
    if (summaryYear && !(inv.date || "").startsWith(summaryYear)) return;
    const total = invoiceTotal(inv);
    if (inv.paid) paid += total;
    else outstanding += total;
  });
  const outEl = document.getElementById("inv-sum-outstanding");
  const paidEl = document.getElementById("inv-sum-paid");
  const allEl = document.getElementById("inv-sum-all");
  if (outEl) outEl.textContent = fmtMoney(outstanding);
  if (paidEl) paidEl.textContent = fmtMoney(paid);
  if (allEl) allEl.textContent = fmtMoney(outstanding + paid);
  // Filter dropdown is keyed by Customer (first line of billTo) instead of category.
  const customers = Array.from(new Set(
    state.invoices.map(i => (i.billTo || "").split("\n")[0].trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));
  jobSel.innerHTML = `<option value="">All Customers</option>` +
    customers.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  jobSel.value = curJob;

  const fYear = yearSel.value;
  const fCustomer = jobSel.value;
  const qAll = (document.getElementById("inv-filter-billto").value || "").toLowerCase().trim();

  const tbody = document.querySelector("#invoices-table tbody");
  if (!tbody) return;
  if (!state.invoices.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">No invoices yet. Click + New Invoice to get started.</td></tr>`;
    return;
  }
  const sorted = state.invoices
    .filter(inv => {
      if (fYear && !(inv.date || "").startsWith(fYear)) return false;
      if (fCustomer) {
        const c = (inv.billTo || "").split("\n")[0].trim();
        if (c !== fCustomer) return false;
      }
      // Free-text search runs against every visible/searchable field on the invoice.
      if (qAll) {
        const lineHay = (inv.lineItems || []).map(l =>
          [l.item, l.description, l.qty, l.price].filter(Boolean).join(" ")
        ).join(" ");
        const totalStr = (() => {
          try { return String(invoiceTotal(inv) || ""); } catch (e) { return ""; }
        })();
        const hay = [
          inv.number,
          inv.date,
          fmtDate(inv.date || ""),
          inv.billTo,
          inv.job,
          inv.jobNo,
          inv.paid ? "paid" : "unpaid",
          inv.paidDate || "",
          totalStr,
          lineHay,
        ].map(x => (x || "").toString().toLowerCase()).join(" ");
        if (!hay.includes(qAll)) return false;
      }
      return true;
    })
    // Highest invoice number at the top; fall back to date desc if numbers tie or aren't numeric.
    .sort((a, b) => {
      const na = parseInt(a.number, 10);
      const nb = parseInt(b.number, 10);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return nb - na;
      return (b.date || "").localeCompare(a.date || "");
    });

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">No invoices match the current filters.</td></tr>`;
    return;
  }

  // Cache of currently-live transaction IDs so the linked-count only reflects
  // transactions that still exist (handles deleted or unlinked rows cleanly).
  const liveTxIds = new Set(state.transactions.map(t => t.id));

  tbody.innerHTML = sorted.map(inv => {
    const billToFirst = (inv.billTo || "").split("\n")[0] || "—";
    const status = inv.paid
      ? `<span class="status-pill paid" title="Paid ${inv.paidDate ? fmtDate(inv.paidDate) : ""}">Paid${inv.paidDate ? " " + fmtDate(inv.paidDate) : ""}</span>`
      : `<span class="status-pill unpaid">Unpaid</span>`;
    const lines = (inv.lineItems || []).filter(l =>
      (l.item && l.item.trim()) || (l.description && l.description.trim()) ||
      (l.qty && String(l.qty).trim()) || (l.price && String(l.price).trim())
    );
    const lineRowsHtml = lines.length
      ? `<table class="invoice-lines-mini">
           <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th>Description</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead>
           <tbody>${lines.map(l => {
             const qty = parseFloat(l.qty) || 0;
             const price = parseMoneyInput(l.price);
             const amt = invoiceLineAmount(l);
             // Default qty display to "1" if missing so the drill-down always
             // shows something (qty=1 is the implicit value when blank).
             const qtyDisplay = (l.qty !== undefined && l.qty !== null && String(l.qty).trim() !== "")
               ? String(l.qty)
               : "1";
             return `<tr>
               <td><span class="line-val">${escapeHtml(l.item || "")}</span></td>
               <td style="text-align:right"><span class="line-val">${escapeHtml(qtyDisplay)}</span></td>
               <td><span class="line-val">${escapeHtml(l.description || "")}</span></td>
               <td style="text-align:right"><span class="line-val">${isNaN(price) ? "" : fmtMoney(price)}</span></td>
               <td style="text-align:right"><span class="line-val">${amt ? fmtMoney(amt) : ""}</span></td>
             </tr>`;
           }).join("")}</tbody>
         </table>`
      : `<div class="muted" style="padding:8px 4px">No line items on this invoice.</div>`;
    return `
      <tr data-id="${inv.id}" class="invoice-row${inv.paid ? " paid" : ""}">
        <td data-col="number"><button type="button" class="invoice-expand-btn" aria-label="Expand line items">▸</button> ${escapeHtml(inv.number)}</td>
        <td data-col="total" class="amount inv-total${inv.paid ? " paid" : ""}" style="text-align:right">${fmtMoney(invoiceTotal(inv))}</td>
        <td data-col="date">${fmtDate(inv.date)}</td>
        <td data-col="billto">${escapeHtml(billToFirst)}</td>
        <td data-col="job">${escapeHtml(inv.job || "")}</td>
        <td data-col="status">${status}</td>
      </tr>
      <tr class="invoice-expand-row" data-for="${inv.id}" hidden>
        <td colspan="6" class="invoice-expand-cell">${lineRowsHtml}</td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".invoice-row").forEach(row => {
    row.style.cursor = "pointer";
    row.addEventListener("click", (e) => {
      // Caret click → toggle the expand row instead of opening the editor.
      const expBtn = e.target.closest(".invoice-expand-btn");
      if (expBtn) {
        e.stopPropagation();
        const expRow = tbody.querySelector(`.invoice-expand-row[data-for="${row.dataset.id}"]`);
        if (!expRow) return;
        const open = expRow.hidden;
        expRow.hidden = !open;
        expBtn.textContent = open ? "▾" : "▸";
        return;
      }
      const inv = state.invoices.find(i => i.id === row.dataset.id);
      if (inv) openInvoiceEditor(inv);
    });
  });
}

function openInvoiceEditor(inv) {
  ensureInvoiceState();
  if (!inv) {
    // Invoice numbers follow a YYNNN pattern where YY is the current
    // 2-digit year. First invoice of a new year is YY001 (26001 in 2026,
    // 27001 in 2027, etc.). Auto-number never picks a value below the
    // current year's floor — gaps in older years are left alone.
    // Match against numeric portion of any existing invoice (handles both
    // legacy "26001" and new "INV-26001" / "INV-26001-2" formats).
    const usedSet = new Set();
    state.invoices.forEach(x => {
      const m = String(x.number || "").match(/(\d{5})/);
      if (m) usedSet.add(parseInt(m[1], 10));
    });
    const currentYYYY = new Date().getFullYear();
    const yearFloor = (currentYYYY % 100) * 1000 + 1; // 26001 for 2026
    let candidate = yearFloor;
    while (usedSet.has(candidate)) candidate++;
    inv = {
      id: uid(),
      number: `INV-${candidate}`,
      date: new Date().toISOString().slice(0, 10),
      billTo: "",
      lineItems: [{ item: "", qty: "", description: "", price: "" }],
      taxMode: "nontax",
      taxLabel: "Ohio Sales Tax",
      taxRate: 7.25
    };
    editingInvoice = { data: inv, isNew: true };
  } else {
    // Deep-clone so edits are not applied until Save
    editingInvoice = {
      data: JSON.parse(JSON.stringify(inv)),
      isNew: false
    };
    // Backfill defaults for older invoices that predate the tax feature
    if (!editingInvoice.data.taxMode) editingInvoice.data.taxMode = "tax";
    if (editingInvoice.data.taxLabel === undefined) editingInvoice.data.taxLabel = "Ohio Sales Tax";
    if (editingInvoice.data.taxRate === undefined) editingInvoice.data.taxRate = 7.25;
  }

  document.getElementById("invoices-list-view").hidden = true;
  document.getElementById("invoices-edit-view").hidden = false;

  document.getElementById("invoice-date").value = editingInvoice.data.date;
  document.getElementById("invoice-number").value = editingInvoice.data.number;
  document.getElementById("invoice-billto").value = editingInvoice.data.billTo || "";
  document.getElementById("btn-invoice-delete").hidden = editingInvoice.isNew;

  populateInvoiceDatalists();
  document.getElementById("invoice-customer-picker").value = "";

  // Populate Job dropdown using preferred JOB_ORDER, then any other categories
  const knownCats = [...state.categories];
  const ordered = [];
  JOB_ORDER.forEach(j => { if (knownCats.includes(j)) { ordered.push(j); knownCats.splice(knownCats.indexOf(j), 1); } });
  const otherCats = knownCats
    .filter(c => !SAVINGS_CATEGORIES.includes(c) && !NON_JOB_CATEGORIES.includes(c))
    .sort((a, b) => a.localeCompare(b));
  const options = [...ordered, ...otherCats];
  const jobSel = document.getElementById("invoice-job");
  const currentJob = editingInvoice.data.job || "";
  jobSel.innerHTML = `<option value="">— None —</option>` +
    options.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  // If the saved job isn't in options (e.g. renamed), still show it so the user doesn't lose it
  if (currentJob && !options.includes(currentJob)) {
    jobSel.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(currentJob)}">${escapeHtml(currentJob)}</option>`);
  }
  jobSel.value = currentJob;

  // Tax controls
  const mode = editingInvoice.data.taxMode;
  document.querySelectorAll("input[name='invoice-tax-mode']").forEach(r => {
    r.checked = r.value === mode;
  });
  document.getElementById("invoice-tax-label").value = editingInvoice.data.taxLabel || "";
  // Normalize saved tax rate to 2 decimals so it matches a select option
  // (e.g., "7" or 7 → "7.00"). If it isn't 7.00 / 7.25, inject a one-off
  // option so the existing rate persists on save.
  const _rateSel = document.getElementById("invoice-tax-rate");
  const _rawRate = editingInvoice.data.taxRate;
  const _normRate = (_rawRate === "" || _rawRate == null || isNaN(Number(_rawRate)))
    ? ""
    : Number(_rawRate).toFixed(2);
  if (_normRate && _rateSel && ![..._rateSel.options].some(o => o.value === _normRate)) {
    const opt = document.createElement("option");
    opt.value = _normRate;
    opt.textContent = _normRate;
    _rateSel.appendChild(opt);
  }
  if (_rateSel) _rateSel.value = _normRate;
  document.querySelector(".invoice-tax-controls").classList.toggle("nontax", mode !== "tax");

  // On mobile, tuck the "+ Add Line" button into the tax-controls row so it
  // sits inline with Tax / Non-Tax / Tax Label / Rate. On desktop, leave it
  // in its own .invoice-add-row block.
  syncInvoiceAddLinePlacement();

  renderInvoiceItems();
  renderInvoiceTotals();
  renderInvoiceLinkedTransactions();
  updatePaidUI();
}

function syncInvoiceAddLinePlacement() {
  const btn = document.getElementById("btn-add-line");
  if (!btn) return;
  const taxControls = document.querySelector(".invoice-tax-controls");
  const addRow = document.querySelector(".invoice-add-row");
  if (!taxControls || !addRow) return;
  const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  if (isMobile) {
    if (btn.parentNode !== taxControls) taxControls.insertBefore(btn, taxControls.firstChild);
  } else {
    if (btn.parentNode !== addRow) addRow.appendChild(btn);
  }
}
window.addEventListener("resize", () => { if (typeof syncInvoiceAddLinePlacement === "function") syncInvoiceAddLinePlacement(); });

// --- Linked transactions on the invoice editor ---
// Derived from state.transactions where t.jobNo === invoice.number (i.e., the
// invoice's Job No.). No manual link/unlink — the relationship is the job link.
function renderInvoiceLinkedTransactions() {
  if (!editingInvoice) return;
  const listEl = document.getElementById("invoice-linked-list");
  const countEl = document.getElementById("invoice-linked-count");
  if (!listEl || !countEl) return;
  // Hide the "+ Link Transactions…" button — no longer applicable.
  const linkBtn = document.getElementById("btn-link-transactions");
  if (linkBtn) linkBtn.style.display = "none";

  // Linked tx = transactions whose jobNo matches this invoice's job.
  // Prefer the explicit invoice.jobNo; fall back to invoice.number with any
  // "-N" suffix stripped so legacy invoices keep working.
  const baseJobNo = (editingInvoice.data.jobNo || "").trim()
    || (editingInvoice.data.number || "").trim().replace(/-\d+$/, "");
  const linked = baseJobNo
    ? state.transactions.filter(t => t.jobNo === baseJobNo && t.type === "income")
    : [];
  linked.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  countEl.textContent = linked.length;
  // Total of all linked income transactions (always shown).
  const linkedTotal = linked.reduce((s, t) => s + (+t.amount || 0), 0);
  const totalEl = document.getElementById("invoice-linked-total");
  if (totalEl) totalEl.textContent = fmtMoney(linkedTotal);
  if (!linked.length) {
    listEl.innerHTML = `<li class="muted invoice-linked-empty">No transactions linked to this Job No. yet.</li>`;
    return;
  }
  listEl.innerHTML = linked.map(t => `
    <li class="invoice-linked-item">
      <span class="inv-lk-date">${escapeHtml(t.date || "")}</span>
      <span class="inv-lk-payee">${escapeHtml(t.payee || "")}</span>
      <span class="inv-lk-cust">${escapeHtml(t.customer || "")}</span>
      <span class="inv-lk-cat">${escapeHtml(t.category || "")}</span>
      <span class="inv-lk-amt ${t.type === "income" ? "income" : "expense"}">${fmtMoney((t.type === "income" ? 1 : -1) * t.amount)}</span>
    </li>
  `).join("");
}

// --- Link-transactions modal ---
let linkTxWorkingSet = new Set();

function openLinkTxModal() {
  if (!editingInvoice) return;
  linkTxWorkingSet = new Set(editingInvoice.data.linkedTransactionIds || []);

  // Populate year dropdown from income transactions
  const years = Array.from(new Set(
    state.transactions.filter(t => t.type === "income")
      .map(t => (t.date || "").slice(0, 4))
      .filter(y => /^\d{4}$/.test(y))
  )).sort((a, b) => b.localeCompare(a));
  const yearSel = document.getElementById("link-tx-year");
  const invYear = (editingInvoice.data.date || "").slice(0, 4);
  yearSel.innerHTML = `<option value="">All Years</option>` +
    years.map(y => `<option value="${y}">${y}</option>`).join("");
  yearSel.value = years.includes(invYear) ? invYear : "";

  document.getElementById("link-tx-search").value = "";
  document.getElementById("link-tx-only-unlinked").checked = false;
  renderLinkTxList();
  document.getElementById("link-tx-modal").classList.remove("hidden");
}
function closeLinkTxModal() {
  document.getElementById("link-tx-modal").classList.add("hidden");
}

function renderLinkTxList() {
  const tbody = document.getElementById("link-tx-tbody");
  if (!tbody) return;
  const q = (document.getElementById("link-tx-search").value || "").toLowerCase().trim();
  const y = document.getElementById("link-tx-year").value;
  const onlyUnlinked = document.getElementById("link-tx-only-unlinked").checked;

  // Map transactionId -> array of {number, billTo} for any invoice already linking it (excluding this one)
  const currentInvId = editingInvoice?.data?.id;
  const txToInvoice = new Map();
  state.invoices.forEach(inv => {
    if (inv.id === currentInvId) return;
    (inv.linkedTransactionIds || []).forEach(txId => {
      if (!txToInvoice.has(txId)) txToInvoice.set(txId, []);
      // Use the first line of Bill To as the customer label (it's usually the name)
      const billToName = (inv.billTo || "").split("\n")[0].trim();
      txToInvoice.get(txId).push({ number: inv.number || "?", billTo: billToName });
    });
  });

  // Restrict the candidate pool to transactions that match the invoice:
  //   Bill To (first line) → transaction.customer
  //   Job                  → transaction.category
  // Any saved linked transactions are always kept so they remain visible.
  const invJob = (editingInvoice?.data?.job || "").trim();
  const invCustomer = ((editingInvoice?.data?.billTo || "").split("\n")[0] || "").trim();
  const rows = state.transactions
    .filter(t => t.type === "income")
    .filter(t => {
      if (linkTxWorkingSet.has(t.id)) return true; // already attached
      if (invJob && t.category !== invJob) return false;
      if (invCustomer && (t.customer || "") !== invCustomer) return false;
      return true;
    })
    .filter(t => !y || (t.date || "").startsWith(y))
    .filter(t => {
      if (!onlyUnlinked) return true;
      if (linkTxWorkingSet.has(t.id)) return true; // keep our already-selected
      return !txToInvoice.has(t.id);
    })
    .filter(t => {
      if (!q) return true;
      return (
        (t.payee || "").toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q) ||
        (t.memo || "").toLowerCase().includes(q) ||
        String(t.amount).includes(q)
      );
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted" style="padding:16px;text-align:center">No matching income transactions.</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(t => {
      const checked = linkTxWorkingSet.has(t.id) ? "checked" : "";
      const links = txToInvoice.get(t.id) || [];
      const customerCell = links.length
        ? links.map(l => escapeHtml(l.billTo || "")).filter(Boolean).join("<br>")
        : "";
      const linkedNote = links.length
        ? links.map(l => `<span class="muted">#${escapeHtml(l.number)}</span>`).join("<br>")
        : "";
      return `
        <tr data-id="${t.id}">
          <td><input type="checkbox" class="link-tx-check" data-id="${t.id}" ${checked} /></td>
          <td>${escapeHtml(t.date || "")}</td>
          <td>${customerCell}</td>
          <td>${escapeHtml(t.payee || "")}</td>
          <td>${escapeHtml(t.category || "")}</td>
          <td style="text-align:right" class="income">${fmtMoney(t.amount)}</td>
          <td>${linkedNote}</td>
        </tr>
      `;
    }).join("");
    tbody.querySelectorAll(".link-tx-check").forEach(cb => {
      cb.addEventListener("change", () => {
        if (cb.checked) linkTxWorkingSet.add(cb.dataset.id);
        else linkTxWorkingSet.delete(cb.dataset.id);
        updateLinkTxSelectedTotal();
      });
    });
  }
  updateLinkTxSelectedTotal();
}

function updateLinkTxSelectedTotal() {
  const totalEl = document.getElementById("link-tx-selected-total");
  if (!totalEl) return;
  let total = 0;
  linkTxWorkingSet.forEach(id => {
    const t = state.transactions.find(x => x.id === id);
    if (t && t.type === "income") total += t.amount;
  });
  totalEl.textContent = linkTxWorkingSet.size
    ? `${linkTxWorkingSet.size} selected • ${fmtMoney(total)}`
    : "";
}

document.getElementById("btn-link-transactions").addEventListener("click", openLinkTxModal);
document.getElementById("btn-cancel-link-tx").addEventListener("click", closeLinkTxModal);
document.getElementById("btn-save-link-tx").addEventListener("click", () => {
  if (!editingInvoice) return;
  editingInvoice.data.linkedTransactionIds = Array.from(linkTxWorkingSet);
  renderInvoiceLinkedTransactions();
  closeLinkTxModal();
});
document.getElementById("link-tx-modal").addEventListener("click", e => {
  if (e.target.id === "link-tx-modal") closeLinkTxModal();
});
document.getElementById("link-tx-search").addEventListener("input", renderLinkTxList);
document.getElementById("link-tx-year").addEventListener("change", renderLinkTxList);
document.getElementById("link-tx-only-unlinked").addEventListener("change", renderLinkTxList);

function updatePaidUI() {
  if (!editingInvoice) return;
  const paid = !!editingInvoice.data.paid;
  const btn = document.getElementById("btn-invoice-paid");
  btn.textContent = paid ? "Mark as Unpaid" : "Mark as Paid";
  btn.classList.toggle("is-paid", paid);

  const stamp = document.getElementById("invoice-paid-stamp");
  stamp.hidden = !paid;
  if (paid) {
    document.getElementById("paid-stamp-date").textContent = editingInvoice.data.paidDate ? fmtDate(editingInvoice.data.paidDate) : "";
  }
}

function closeInvoiceEditor() {
  document.getElementById("invoices-list-view").hidden = false;
  document.getElementById("invoices-edit-view").hidden = true;
  editingInvoice = null;
  renderInvoicesList();
}

// Build a lookup of { customerName → most-recent billTo text } and populate the
// customer / item / description datalists used as autocomplete sources in the editor.
const invoiceCustomerIndex = new Map();
function populateInvoiceDatalists() {
  invoiceCustomerIndex.clear();
  const invoices = (state.invoices || []).slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // Customers: key = first non-empty line of billTo, value = most recent full billTo text
  invoices.forEach(inv => {
    const firstLine = ((inv.billTo || "").split("\n").find(l => l.trim()) || "").trim();
    if (firstLine) invoiceCustomerIndex.set(firstLine, inv.billTo);
  });
  // Merge in every customer saved in Settings so the picker covers them too.
  (state.customers || []).forEach(name => {
    const clean = (name || "").trim();
    if (!clean) return;
    if (!invoiceCustomerIndex.has(clean)) invoiceCustomerIndex.set(clean, clean);
  });
  const custDL = document.getElementById("invoice-customer-datalist");
  if (custDL) {
    custDL.innerHTML = Array.from(invoiceCustomerIndex.keys())
      .sort((a, b) => a.localeCompare(b))
      .map(n => `<option value="${escapeHtml(n)}"></option>`)
      .join("");
  }

  // Items + descriptions are Settings-managed lists. Source of truth is
  // state.invoiceItems / state.invoiceDescs only — deletions from Settings
  // take effect immediately even if old invoices still reference the value.
  const items = (state.invoiceItems || []).filter(Boolean);
  const descs = (state.invoiceDescs || []).filter(Boolean);
  const itemDL = document.getElementById("invoice-item-datalist");
  if (itemDL) {
    itemDL.innerHTML = items.slice().sort((a, b) => a.localeCompare(b))
      .map(v => `<option value="${escapeHtml(v)}"></option>`).join("");
  }
  const descDL = document.getElementById("invoice-desc-datalist");
  if (descDL) {
    descDL.innerHTML = descs.slice().sort((a, b) => a.localeCompare(b))
      .map(v => `<option value="${escapeHtml(v)}"></option>`).join("");
  }
}

function renderInvoiceItems() {
  const tbody = document.querySelector("#invoice-items tbody");
  const lines = editingInvoice.data.lineItems;
  // Build sorted option lists for the Item / Description selects from the
  // Settings-managed lists (state.invoiceItems / state.invoiceDescs).
  const itemOpts = (state.invoiceItems || []).slice().sort((a, b) => a.localeCompare(b));
  const descOpts = (state.invoiceDescs || []).slice().sort((a, b) => a.localeCompare(b));
  const buildSelect = (field, opts, value) => {
    const v = (value || "").trim();
    const inList = opts.includes(v);
    return `<select class="invoice-line-select" data-field="${field}">
      <option value="">— Select —</option>
      ${opts.map(o => `<option value="${escapeHtml(o)}"${o === v ? " selected" : ""}>${escapeHtml(o)}</option>`).join("")}
      ${(v && !inList) ? `<option value="${escapeHtml(v)}" selected>${escapeHtml(v)} (legacy)</option>` : ""}
      <option value="__new__">+ Add new…</option>
    </select>`;
  };
  tbody.innerHTML = lines.map((line, idx) => `
    <tr data-idx="${idx}">
      <td class="col-item">${buildSelect("item", itemOpts, line.item)}</td>
      <td class="col-qty"><input type="number" step="any" data-field="qty" value="${escapeHtml(String(line.qty ?? ""))}" /></td>
      <td class="col-desc">${buildSelect("description", descOpts, line.description)}</td>
      <td class="col-price"><input type="text" inputmode="decimal" data-field="price" value="${escapeHtml(formatInvoicePriceDisplay(line.price))}" /></td>
      <td class="col-amount">
        ${fmtMoney(invoiceLineAmount(line))}
        <button type="button" class="invoice-line-delete no-print" title="Remove line" aria-label="Remove">&times;</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr").forEach(row => {
    const idx = parseInt(row.dataset.idx, 10);
    row.querySelectorAll("input, textarea").forEach(el => {
      el.addEventListener("input", () => {
        const field = el.dataset.field;
        editingInvoice.data.lineItems[idx][field] = el.value;
        // Update just the amount + totals without re-rendering all inputs (don't lose focus)
        const amountCell = row.querySelector(".col-amount");
        // Preserve the delete button inside the amount cell while updating just the text
        const delBtn = amountCell.querySelector(".invoice-line-delete");
        amountCell.textContent = fmtMoney(invoiceLineAmount(editingInvoice.data.lineItems[idx]));
        if (delBtn) amountCell.appendChild(delBtn);
        renderInvoiceTotals();
      });
    });
    // Item / Description selects (incl. "+ Add new…" handler)
    row.querySelectorAll("select.invoice-line-select").forEach(sel => {
      sel.addEventListener("change", () => {
        const field = sel.dataset.field; // "item" or "description"
        if (sel.value === "__new__") {
          const promptLabel = field === "item" ? "New item:" : "New description:";
          const v = (prompt(promptLabel) || "").trim();
          if (!v) { sel.value = editingInvoice.data.lineItems[idx][field] || ""; return; }
          const listKey = field === "item" ? "invoiceItems" : "invoiceDescs";
          if (!Array.isArray(state[listKey])) state[listKey] = [];
          if (!state[listKey].includes(v)) {
            state[listKey].push(v);
            state[listKey].sort((a, b) => a.localeCompare(b));
            saveState();
          }
          editingInvoice.data.lineItems[idx][field] = v;
          renderInvoiceItems();
          return;
        }
        editingInvoice.data.lineItems[idx][field] = sel.value;
      });
    });

    // Format the price input to "$X.XX" on blur; strip $ on focus for easier editing.
    const priceInput = row.querySelector("input[data-field='price']");
    if (priceInput) {
      priceInput.addEventListener("focus", () => {
        const n = parseMoneyInput(priceInput.value);
        if (!isNaN(n)) priceInput.value = n.toFixed(2);
      });
      priceInput.addEventListener("blur", () => {
        const formatted = formatInvoicePriceDisplay(priceInput.value);
        priceInput.value = formatted;
        editingInvoice.data.lineItems[idx].price = formatted;
      });
    }
    const delBtn = row.querySelector(".invoice-line-delete");
    if (delBtn) {
      delBtn.addEventListener("click", () => {
        editingInvoice.data.lineItems.splice(idx, 1);
        if (!editingInvoice.data.lineItems.length) {
          editingInvoice.data.lineItems.push({ item: "", qty: "", description: "", price: "" });
        }
        renderInvoiceItems();
      });
    }
  });

  renderInvoiceTotals();
}

function renderInvoiceTotals() {
  if (!editingInvoice) return;
  const inv = editingInvoice.data;
  const tbody = document.getElementById("invoice-totals-body");
  const subtotal = invoiceSubtotal(inv);
  const tax = invoiceTaxAmount(inv);
  const total = subtotal + tax;
  const mode = inv.taxMode || "tax";

  // On mobile, the value column (Amount, 15%) is too narrow for "$2,790.00"
  // once fonts get bumped up. Shift the label cell one column left (so it
  // sits in the Description column, 40%) and give the value cell 2 columns
  // (Price + Amount = 30%) for breathing room.
  const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  const noBorderSpan = isMobile ? 2 : 2;
  const labelSpan    = isMobile ? 1 : 2;
  const valueSpan    = isMobile ? 2 : 1;
  const totalLabelLeftSpan  = isMobile ? 2 : 3;
  const totalLabelOwnSpan   = isMobile ? 1 : 1;
  const totalValueSpan      = isMobile ? 2 : 1;

  if (mode === "tax") {
    const label = (inv.taxLabel || "Tax").trim() || "Tax";
    const rate = parseFloat(inv.taxRate) || 0;
    tbody.innerHTML = `
      <tr>
        <td class="no-border" colspan="${noBorderSpan}"></td>
        <td class="subtotal-label-cell" colspan="${labelSpan}">Subtotal</td>
        <td class="subtotal-value-cell" colspan="${valueSpan}">${fmtMoney(subtotal)}</td>
      </tr>
      <tr>
        <td class="no-border" colspan="${noBorderSpan}"></td>
        <td class="tax-label-cell" colspan="${labelSpan}">${escapeHtml(label)} (${rate.toFixed(2)}%)</td>
        <td class="tax-value-cell" colspan="${valueSpan}">${fmtMoney(tax)}</td>
      </tr>
      <tr class="invoice-total-row">
        <td class="no-border" colspan="${totalLabelLeftSpan}"></td>
        <td class="total-label-cell" colspan="${totalLabelOwnSpan}">Total</td>
        <td class="total-value-cell" colspan="${totalValueSpan}" id="invoice-total">${fmtMoney(total)}</td>
      </tr>
    `;
  } else {
    tbody.innerHTML = `
      <tr class="invoice-total-row">
        <td class="no-border" colspan="${totalLabelLeftSpan}"></td>
        <td class="total-label-cell" colspan="${totalLabelOwnSpan}">Total</td>
        <td class="total-value-cell" colspan="${totalValueSpan}" id="invoice-total">${fmtMoney(total)}</td>
      </tr>
    `;
  }
}

document.getElementById("btn-new-invoice").addEventListener("click", () => openInvoiceEditor(null));

["inv-filter-year", "inv-filter-job", "inv-filter-billto"].forEach(id => {
  document.getElementById(id).addEventListener("input", renderInvoicesList);
  document.getElementById(id).addEventListener("change", renderInvoicesList);
});
document.getElementById("btn-invoice-back").addEventListener("click", closeInvoiceEditor);
document.getElementById("btn-add-line").addEventListener("click", () => {
  editingInvoice.data.lineItems.push({ item: "", qty: "", description: "", price: "" });
  renderInvoiceItems();
});

document.getElementById("invoice-date").addEventListener("input", e => {
  if (editingInvoice) editingInvoice.data.date = e.target.value;
});
document.getElementById("invoice-number").addEventListener("input", e => {
  if (editingInvoice) editingInvoice.data.number = e.target.value.trim();
  // Linked transactions are derived from the invoice number — re-render.
  renderInvoiceLinkedTransactions();
});
document.getElementById("invoice-billto").addEventListener("input", e => {
  if (editingInvoice) editingInvoice.data.billTo = e.target.value;
});

// Customer picker — autofill the Bill To textarea with the saved address for the picked customer
document.getElementById("invoice-customer-picker").addEventListener("change", e => {
  if (!editingInvoice) return;
  const name = e.target.value.trim();
  if (!name) return;
  const savedBillTo = invoiceCustomerIndex.get(name);
  if (savedBillTo !== undefined) {
    editingInvoice.data.billTo = savedBillTo;
    document.getElementById("invoice-billto").value = savedBillTo;
  } else {
    // If the typed value doesn't match a known customer, at least seed the textarea with just that name
    if (!editingInvoice.data.billTo.trim()) {
      editingInvoice.data.billTo = name;
      document.getElementById("invoice-billto").value = name;
    }
  }
  e.target.value = "";
});

document.getElementById("invoice-job").addEventListener("change", e => {
  if (editingInvoice) editingInvoice.data.job = e.target.value;
});

// Tax controls
document.querySelectorAll("input[name='invoice-tax-mode']").forEach(r => {
  r.addEventListener("change", () => {
    if (!editingInvoice) return;
    editingInvoice.data.taxMode = r.value;
    document.querySelector(".invoice-tax-controls").classList.toggle("nontax", r.value !== "tax");
    renderInvoiceTotals();
  });
});

document.getElementById("invoice-tax-label").addEventListener("input", e => {
  if (editingInvoice) {
    editingInvoice.data.taxLabel = e.target.value;
    renderInvoiceTotals();
  }
});

document.getElementById("invoice-tax-rate").addEventListener("change", e => {
  if (editingInvoice) {
    editingInvoice.data.taxRate = e.target.value;
    renderInvoiceTotals();
  }
});

document.getElementById("btn-invoice-save").addEventListener("click", () => {
  if (!editingInvoice) return;
  ensureInvoiceState();
  const inv = { ...editingInvoice.data };
  // Locked-year guard: block saves if either the original or new invoice
  // date falls in a locked year.
  const oldDate = !editingInvoice.isNew
    ? (state.invoices.find(x => x.id === inv.id) || {}).date
    : null;
  if (oldDate && isLockedDate(oldDate)) { blockedToast(oldDate.slice(0, 4)); return; }
  if (isLockedDate(inv.date)) { blockedToast((inv.date || "").slice(0, 4)); return; }
  // Prune any linkedTransactionIds that no longer match an existing transaction
  if (Array.isArray(inv.linkedTransactionIds)) {
    const liveIds = new Set(state.transactions.map(t => t.id));
    inv.linkedTransactionIds = inv.linkedTransactionIds.filter(id => liveIds.has(id));
  }

  // Reject duplicate invoice numbers (excluding this invoice itself)
  const number = String(inv.number || "").trim();
  if (!number) {
    alert("Invoice number is required.");
    document.getElementById("invoice-number").focus();
    return;
  }
  const dupe = state.invoices.find(x => String(x.number).trim() === number && x.id !== inv.id);
  if (dupe) {
    alert(`Invoice number "${number}" is already used by another invoice. Please pick a unique number.`);
    document.getElementById("invoice-number").focus();
    return;
  }
  inv.number = number;

  // Clean empty trailing lines
  inv.lineItems = (inv.lineItems || []).filter(l =>
    (l.item && l.item.trim()) || (l.description && l.description.trim()) ||
    (l.qty && String(l.qty).trim()) || (l.price && String(l.price).trim())
  );
  if (editingInvoice.isNew) {
    state.invoices.push(inv);
    // nextInvoiceNumber is now just a floor — we always auto-number by
    // scanning live invoices for the lowest unused slot, so there's no
    // need to bump this on every save.
  } else {
    const i = state.invoices.findIndex(x => x.id === inv.id);
    if (i >= 0) state.invoices[i] = inv;
  }
  // Auto-track any new line-item / description values into the Settings lists
  // so the dropdowns grow with use (matches the Customers/Payees pattern).
  if (!Array.isArray(state.invoiceItems)) state.invoiceItems = [];
  if (!Array.isArray(state.invoiceDescs)) state.invoiceDescs = [];
  (inv.lineItems || []).forEach(l => {
    const it = (l.item || "").trim();
    const dc = (l.description || "").trim();
    if (it && !state.invoiceItems.includes(it)) state.invoiceItems.push(it);
    if (dc && !state.invoiceDescs.includes(dc)) state.invoiceDescs.push(dc);
  });
  state.invoiceItems.sort((a, b) => a.localeCompare(b));
  state.invoiceDescs.sort((a, b) => a.localeCompare(b));
  saveState();
  closeInvoiceEditor();
});

document.getElementById("btn-invoice-paid").addEventListener("click", () => {
  if (!editingInvoice) return;
  if (isLockedDate(editingInvoice.data.date)) { blockedToast(editingInvoice.data.date.slice(0, 4)); return; }
  if (editingInvoice.data.paid) {
    editingInvoice.data.paid = false;
    editingInvoice.data.paidDate = "";
    updatePaidUI();
    return;
  }
  // Open the calendar-picker modal instead of a plain prompt.
  const modal = document.getElementById("paid-date-modal");
  const picker = document.getElementById("paid-date-picker");
  const manual = document.getElementById("paid-date-manual");
  if (!modal || !picker) return;
  const today = new Date().toISOString().slice(0, 10);
  picker.value = today;
  if (manual) manual.value = "";
  modal.classList.remove("hidden");
  setTimeout(() => picker.focus(), 0);
});

// Wire the paid-date modal once.
(function wirePaidDateModal() {
  const modal = document.getElementById("paid-date-modal");
  if (!modal) return;
  const picker = document.getElementById("paid-date-picker");
  const manual = document.getElementById("paid-date-manual");
  const cancel = document.getElementById("btn-paid-date-cancel");
  const save   = document.getElementById("btn-paid-date-save");

  function close() { modal.classList.add("hidden"); }
  function parseManual(s) {
    s = (s || "").trim();
    if (!s) return null;
    // Accept MM-DD-YYYY, MM/DD/YYYY, or YYYY-MM-DD
    let m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (m) {
      const mm = m[1].padStart(2, "0");
      const dd = m[2].padStart(2, "0");
      return `${m[3]}-${mm}-${dd}`;
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return s;
    return null;
  }

  cancel?.addEventListener("click", close);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });

  save?.addEventListener("click", () => {
    if (!editingInvoice) { close(); return; }
    if (isLockedDate(editingInvoice.data.date)) { blockedToast(editingInvoice.data.date.slice(0, 4)); close(); return; }
    let dateVal = parseManual(manual?.value || "");
    if (!dateVal && picker?.value) dateVal = picker.value;
    if (!dateVal || !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      alert("Please pick a date or type a valid MM-DD-YYYY.");
      return;
    }
    if (isLockedDate(dateVal)) { blockedToast(dateVal.slice(0, 4)); return; }
    editingInvoice.data.paid = true;
    editingInvoice.data.paidDate = dateVal;
    if (typeof updatePaidUI === "function") updatePaidUI();
    close();
  });
})();

document.getElementById("btn-invoice-delete").addEventListener("click", () => {
  if (!editingInvoice || editingInvoice.isNew) return;
  const d = editingInvoice.data.date;
  if (isLockedDate(d)) { blockedToast(d.slice(0, 4)); return; }
  if (!confirm(`Delete invoice #${editingInvoice.data.number}?`)) return;
  state.invoices = state.invoices.filter(i => i.id !== editingInvoice.data.id);
  saveState();
  closeInvoiceEditor();
});

document.getElementById("btn-invoice-print").addEventListener("click", () => {
  window.print();
});

// ============ SALES TAX LIABILITY REPORT ============
function openTaxReport() {
  // Switch to the Reports tab with the Sales Tax Liability report selected
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  const reportsTab = document.querySelector('.tab-btn[data-tab="reports"]');
  if (reportsTab) reportsTab.classList.add("active");
  document.getElementById("reports").classList.add("active");
  showReport("tax");
}

function applyTaxReportPreset(value) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  let fromDate, toDate;

  const iso = d => d.toISOString().slice(0, 10);
  const lastDayOfMonth = (year, monthIdx) => new Date(year, monthIdx + 1, 0);

  if (/^\d{4}$/.test(value)) {
    const yr = parseInt(value, 10);
    document.getElementById("tax-report-from").value = iso(new Date(yr, 0, 1));
    document.getElementById("tax-report-to").value = iso(new Date(yr, 11, 31));
    return;
  }
  switch (value) {
    case "this-month":
      fromDate = new Date(y, m, 1);
      toDate = lastDayOfMonth(y, m);
      break;
    case "last-month":
      fromDate = new Date(y, m - 1, 1);
      toDate = lastDayOfMonth(y, m - 1);
      break;
    case "this-quarter": {
      const qStart = Math.floor(m / 3) * 3;
      fromDate = new Date(y, qStart, 1);
      toDate = lastDayOfMonth(y, qStart + 2);
      break;
    }
    case "last-quarter": {
      const qStart = Math.floor(m / 3) * 3 - 3;
      const qYear = qStart < 0 ? y - 1 : y;
      const qMonth = qStart < 0 ? qStart + 12 : qStart;
      fromDate = new Date(qYear, qMonth, 1);
      toDate = lastDayOfMonth(qYear, qMonth + 2);
      break;
    }
    case "first-half":
      fromDate = new Date(y, 0, 1);   // Jan 1
      toDate = new Date(y, 5, 30);    // Jun 30
      break;
    case "second-half":
      fromDate = new Date(y, 6, 1);   // Jul 1
      toDate = new Date(y, 11, 31);   // Dec 31
      break;
    case "ytd":
      fromDate = new Date(y, 0, 1);
      toDate = today;
      break;
    case "last-year":
      fromDate = new Date(y - 1, 0, 1);
      toDate = new Date(y - 1, 11, 31);
      break;
    default:
      return;
  }
  document.getElementById("tax-report-from").value = iso(fromDate);
  document.getElementById("tax-report-to").value = iso(toDate);
}

function renderTaxReport() {
  const from = document.getElementById("tax-report-from").value;
  const to = document.getElementById("tax-report-to").value;

  // Section toggle: include the Invoice Detail section.
  const incDetail = document.getElementById("tax-report-include-detail")?.checked !== false;
  const detailSection = document.getElementById("tax-report-section-detail");
  if (detailSection) detailSection.style.display = incDetail ? "" : "none";

  // Range label
  const fmt = iso => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";
  document.getElementById("tax-report-range").textContent = `${fmt(from)} — ${fmt(to)}`;

  const invs = (state.invoices || []).filter(inv => {
    if (!inv.date) return false;
    if (from && inv.date < from) return false;
    if (to && inv.date > to) return false;
    return true;
  }).sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // Aggregate by agency (taxLabel + rate combination, tax-mode only)
  const agencyMap = new Map();
  let totalTaxable = 0, totalNonTaxable = 0, totalTaxCollected = 0;

  invs.forEach(inv => {
    const subtotal = invoiceSubtotal(inv);
    if ((inv.taxMode || "tax") === "tax") {
      totalTaxable += subtotal;
      const tax = invoiceTaxAmount(inv);
      totalTaxCollected += tax;
      const rate = parseFloat(inv.taxRate) || 0;
      const label = (inv.taxLabel || "Tax").trim() || "Tax";
      const key = `${label}|${rate.toFixed(4)}`;
      if (!agencyMap.has(key)) {
        agencyMap.set(key, { label, rate, taxable: 0, tax: 0 });
      }
      const row = agencyMap.get(key);
      row.taxable += subtotal;
      row.tax += tax;
    } else {
      totalNonTaxable += subtotal;
    }
  });

  // Agency table
  const agencyBody = document.getElementById("tax-report-agency-body");
  if (!agencyMap.size) {
    agencyBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#666">No taxable invoices in this range.</td></tr>`;
  } else {
    agencyBody.innerHTML = Array.from(agencyMap.values())
      .sort((a, b) => b.tax - a.tax)
      .map(r => `
        <tr>
          <td>${escapeHtml(r.label)}</td>
          <td>${r.rate.toFixed(2)}%</td>
          <td>${fmtMoney(r.taxable)}</td>
          <td>${fmtMoney(r.tax)}</td>
        </tr>
      `).join("");
  }
  document.getElementById("tax-report-taxable-total").textContent = fmtMoney(totalTaxable);
  document.getElementById("tax-report-collected-total").textContent = fmtMoney(totalTaxCollected);

  // Summary
  document.getElementById("sum-taxable").textContent = fmtMoney(totalTaxable);
  document.getElementById("sum-nontaxable").textContent = fmtMoney(totalNonTaxable);
  document.getElementById("sum-sales").textContent = fmtMoney(totalTaxable + totalNonTaxable);
  document.getElementById("sum-tax").textContent = fmtMoney(totalTaxCollected);

  // Detail table
  const detailBody = document.getElementById("tax-report-detail-body");
  if (!invs.length) {
    detailBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#666">No invoices in this range.</td></tr>`;
  } else {
    detailBody.innerHTML = invs.map(inv => {
      const subtotal = invoiceSubtotal(inv);
      const tax = invoiceTaxAmount(inv);
      const total = subtotal + tax;
      const agency = (inv.taxMode || "tax") === "tax"
        ? `${escapeHtml(inv.taxLabel || "Tax")} (${(parseFloat(inv.taxRate) || 0).toFixed(2)}%)`
        : `<em>Non-taxable</em>`;
      const billToFirst = (inv.billTo || "").split("\n")[0] || "—";
      return `
        <tr>
          <td>${fmtDate(inv.date)}</td>
          <td>${escapeHtml(inv.number)}</td>
          <td>${escapeHtml(billToFirst)}</td>
          <td>${agency}</td>
          <td>${fmtMoney(subtotal)}</td>
          <td>${fmtMoney(tax)}</td>
          <td>${fmtMoney(total)}</td>
        </tr>
      `;
    }).join("");
  }
}

document.getElementById("btn-open-tax-report").addEventListener("click", openTaxReport);
document.getElementById("btn-tax-report-print").addEventListener("click", () => window.print());
document.getElementById("tax-report-include-detail")?.addEventListener("change", renderTaxReport);
document.getElementById("tax-report-from").addEventListener("change", () => {
  document.getElementById("tax-report-preset").value = "custom";
  renderTaxReport();
});
document.getElementById("tax-report-to").addEventListener("change", () => {
  document.getElementById("tax-report-preset").value = "custom";
  renderTaxReport();
});
document.getElementById("tax-report-preset").addEventListener("change", e => {
  if (e.target.value !== "custom") {
    applyTaxReportPreset(e.target.value);
    renderTaxReport();
  }
});

// Persisted across re-renders. null = "all" (default). Otherwise a Set of names/years.
let trendSelectedJobs = null;
let trendSelectedPayees = null;
let trendSelectedYears = null;
let trendYearsInitialized = false;
let trendsIncomeMode = "full"; // "full" or "ytd"

function renderTrendsIncomeChart() {
  const years = Array.from(new Set(
    state.transactions
      .filter(t => t.type === "income" && !NON_JOB_CATEGORIES.includes(t.category))
      .map(t => (t.date || "").slice(0, 4))
      .filter(y => /^\d{4}$/.test(y))
  ));
  renderIncomeByYearChart(years, {
    svgId: "trends-income-chart",
    ytd: trendsIncomeMode === "ytd"
  });
}

let trendMode = "year"; // "year" | "job"
let trendAmountMode = "net"; // "gross" | "net"

document.getElementById("trend-amount-pills")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-mode]");
  if (!btn) return;
  const next = btn.dataset.mode;
  if (next === trendAmountMode) return;
  trendAmountMode = next;
  const wrap = document.getElementById("trend-amount-pills");
  if (wrap) {
    wrap.dataset.mode = next;
    wrap.querySelectorAll(".mode-switch-option").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === next);
    });
  }
  renderTrends();
});

const TREND_FILTERS_KEY = "photo-trend-filters-v1";
function saveTrendFilters() {
  try {
    localStorage.setItem(TREND_FILTERS_KEY, JSON.stringify({
      payees: trendSelectedPayees === null ? null : [...trendSelectedPayees],
      mode: trendMode,
    }));
  } catch {}
}
function loadTrendFilters() {
  try {
    const raw = localStorage.getItem(TREND_FILTERS_KEY);
    if (!raw) return;
    const f = JSON.parse(raw);
    if (f && "payees" in f) {
      trendSelectedPayees = f.payees === null ? null : new Set(f.payees);
    }
    if (f && (f.mode === "year" || f.mode === "job")) {
      trendMode = f.mode;
    }
  } catch {}
}
loadTrendFilters();

document.getElementById("trend-mode-pills")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-mode]");
  if (!btn) return;
  const nextMode = btn.dataset.mode;
  if (nextMode === trendMode) return;
  trendMode = nextMode;
  // Reset selections on mode switch so invariants hold on render
  trendYearsInitialized = false;
  trendSelectedJobs = null;
  trendSelectedYears = null;
  saveTrendFilters();
  renderTrends();
});

const TREND_DROPDOWNS = [
  { wrap: "trend-payee-dropdown", toggle: "trend-payee-toggle", menu: "trend-payee-pills" },
  { wrap: "trend-year-dropdown",  toggle: "trend-year-toggle",  menu: "trend-year-pills"  },
  { wrap: "trend-job-dropdown",   toggle: "trend-job-toggle",   menu: "trend-job-pills"   },
];

function closeAllTrendDropdowns(exceptWrapId) {
  TREND_DROPDOWNS.forEach(d => {
    if (d.wrap === exceptWrapId) return;
    const menu = document.getElementById(d.menu);
    const toggle = document.getElementById(d.toggle);
    if (menu && !menu.hidden) {
      menu.hidden = true;
      toggle?.setAttribute("aria-expanded", "false");
    }
  });
}

document.addEventListener("click", (e) => {
  TREND_DROPDOWNS.forEach(d => {
    const wrap = document.getElementById(d.wrap);
    if (!wrap) return;
    if (!wrap.contains(e.target)) {
      const menu = document.getElementById(d.menu);
      const toggle = document.getElementById(d.toggle);
      if (menu && !menu.hidden) {
        menu.hidden = true;
        toggle?.setAttribute("aria-expanded", "false");
      }
    }
  });
});

TREND_DROPDOWNS.forEach(d => {
  document.getElementById(d.toggle)?.addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = document.getElementById(d.menu);
    const toggle = document.getElementById(d.toggle);
    const opening = menu.hidden;
    if (opening) closeAllTrendDropdowns(d.wrap);
    menu.hidden = !opening;
    toggle.setAttribute("aria-expanded", opening ? "true" : "false");
  });
});

function trendYearsFromDateRange(rangeKey) {
  // Returns a Set of "YYYY" strings that the analytics date-range covers, or
  // null to mean "include every year" (used by trendSelectedYears).
  const now = new Date();
  const yearMatch = /^year-(\d{4})$/.exec(rangeKey || "");
  if (yearMatch) return new Set([yearMatch[1]]);
  if (rangeKey === "all-years")     return null;
  if (rangeKey === "this-year")     return new Set([String(now.getFullYear())]);
  if (rangeKey === "last-year")     return new Set([String(now.getFullYear() - 1)]);
  if (rangeKey === "last-3-years") {
    return new Set([0, 1, 2].map(o => String(now.getFullYear() - o)));
  }
  if (rangeKey === "last-6-months") {
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return new Set([String(start.getFullYear()), String(now.getFullYear())]);
  }
  if (rangeKey === "last-30-days") {
    const start = new Date(now.getTime() - 30 * 86400000);
    return new Set([String(start.getFullYear()), String(now.getFullYear())]);
  }
  return null; // "all" / fallback → every year
}

// Sync universal Analytics filters → the trend* state vars renderTrends reads.
function syncTrendFiltersFromAnalytics() {
  // Multi-select aware: pull the selected sets out of filterStates.
  const years = selectedYears();
  trendSelectedYears = years === null ? null : new Set(years);

  const jobState = filterStates["job"];
  if (jobState && jobState.selected && jobState.selected.size > 0) {
    if (jobState.mode === "include") {
      trendSelectedJobs = new Set(jobState.selected);
    } else {
      const all = FILTER_DEFS["job"].getOptions();
      trendSelectedJobs = new Set(all.filter(j => !jobState.selected.has(j)));
    }
  } else {
    trendSelectedJobs = null;
  }

  const payeeState = filterStates["payees"];
  if (payeeState && payeeState.selected && payeeState.selected.size > 0) {
    if (payeeState.mode === "include") {
      trendSelectedPayees = new Set(payeeState.selected);
    } else {
      const all = FILTER_DEFS["payees"].getOptions();
      trendSelectedPayees = new Set(all.filter(p => !payeeState.selected.has(p)));
    }
  } else {
    trendSelectedPayees = null;
  }
}

function renderTrends() {
  syncTrendFiltersFromAnalytics();
  // The legacy in-card dropdowns were removed (filtering moved to the Analytics
  // toolbar). Hand back a throw-away element when their IDs aren't present so
  // the existing population code becomes a harmless no-op.
  const _trendNoop = document.createElement("div");
  const jobPillsEl   = document.getElementById("trend-job-pills")   || _trendNoop;
  const payeePillsEl = document.getElementById("trend-payee-pills") || _trendNoop;
  const chart = document.getElementById("trend-chart");
  const title = document.getElementById("trend-title");

  // A "Job" = any category that has had at least one income transaction
  // (pulling from the registry too so a registered job with no income yet
  // still appears), minus savings and bookkeeping carry-forward categories.
  // The income-required check filters out pure-expense categories like
  // "Cost of Goods Sold" or "Office Supplies".
  const incomeCats = new Set();
  (state.transactions || []).forEach(t => {
    if (t.type === "income" && t.category) incomeCats.add(t.category);
  });
  const jobUniverse = new Set([...(state.categories || []), ...incomeCats]);
  const jobsOnly = [...jobUniverse].filter(c => {
    if (!c) return false;
    if (SAVINGS_CATEGORIES.includes(c)) return false;
    if (NON_JOB_CATEGORIES.includes(c)) return false;
    // Must have at least one income transaction to be considered a Job.
    if (!incomeCats.has(c)) return false;
    return true;
  }).sort((a, b) => {
    const ai = JOB_ORDER.indexOf(a);
    const bi = JOB_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  if (!jobsOnly.length) {
    title.textContent = "Net Profit by Year";
    if (jobPillsEl)   jobPillsEl.innerHTML   = `<span class="trend-empty-filter">No jobs with income yet.</span>`;
    if (payeePillsEl) payeePillsEl.innerHTML = `<span class="trend-empty-filter">No payees.</span>`;
    chart.innerHTML = `<div class="empty">Add some transactions to see trends.</div>`;
    return;
  }

  // Prune stale selections
  if (trendSelectedJobs !== null) {
    trendSelectedJobs = new Set([...trendSelectedJobs].filter(j => jobsOnly.includes(j)));
  }
  const isJobSelected = j => trendSelectedJobs === null || trendSelectedJobs.has(j);

  // Sync mode switch state
  const modeSwitch = document.getElementById("trend-mode-pills");
  if (modeSwitch) modeSwitch.dataset.mode = trendMode;
  document.querySelectorAll("#trend-mode-pills [data-mode]").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === trendMode);
  });

  // In "One Job" mode, require a single explicit selection. Don't auto-pick
  // a job when the user hasn't chosen one — the empty-state branch below
  // prompts them to pick instead.
  if (trendMode === "job") {
    if (trendSelectedJobs === null) {
      // No selection at all — ask the user to pick.
      trendSelectedJobs = new Set();
    } else if (trendSelectedJobs.size > 1) {
      // Multiple selected — keep just the first so the deep-dive chart works.
      const first = [...trendSelectedJobs][0];
      trendSelectedJobs = first ? new Set([first]) : new Set();
    }
  }

  // Populate / wire the visible Job picker dropdown next to the View By toggle.
  const _jobPickerWrap = document.getElementById("trend-job-picker-wrap");
  const _jobPicker     = document.getElementById("trend-job-picker");
  if (_jobPickerWrap && _jobPicker) {
    const visible = (trendMode === "job");
    _jobPickerWrap.hidden = !visible;
    if (visible) {
      const cur = trendSelectedJobs && trendSelectedJobs.size === 1 ? [...trendSelectedJobs][0] : "";
      _jobPicker.innerHTML = `<option value="">— Pick a job —</option>` +
        jobsOnly.map(j => `<option value="${escapeHtml(j)}"${j === cur ? " selected" : ""}>${escapeHtml(j)}</option>`).join("");
      if (!_jobPicker.dataset.wired) {
        _jobPicker.dataset.wired = "1";
        _jobPicker.addEventListener("change", () => {
          const v = _jobPicker.value;
          // Write into filterStates.job (the source of truth) so the next
          // renderTrends() → syncTrendFiltersFromAnalytics() doesn't wipe it.
          const s = filterStates["job"];
          if (s) {
            s.mode = "include";
            s.selected = v ? new Set([v]) : new Set();
          }
          // Also update the local cache + trigger renders.
          trendSelectedJobs = v ? new Set([v]) : new Set();
          if (typeof populateAnalyticsFilters === "function") populateAnalyticsFilters();
          renderTrends();
        });
      }
    }
  }

  // Color palette per job
  const jobColor = {};
  jobsOnly.forEach((j, idx) => {
    jobColor[j] = DONUT_PALETTE[idx % DONUT_PALETTE.length];
  });

  // Render the Jobs dropdown menu (checkboxes in year mode; single-select in job mode)
  const jobsMulti = trendMode !== "job";
  const jobsHeader = jobsMulti
    ? `<div class="trend-payee-menu-head">
         <button type="button" class="btn" data-job-action="all">Select All</button>
         <button type="button" class="btn" data-job-action="none">Clear</button>
       </div>`
    : "";
  jobPillsEl.innerHTML = `
    ${jobsHeader}
    <div class="trend-payee-menu-list">
      ${jobsOnly.map(j => {
        const c = jobColor[j];
        const active = isJobSelected(j);
        const input = jobsMulti
          ? `<input type="checkbox" ${active ? "checked" : ""} />`
          : `<input type="radio" name="trend-job-radio" ${active ? "checked" : ""} />`;
        return `
          <label class="trend-payee-check ${active ? "active" : ""}" data-job="${escapeHtml(j)}">
            ${input}
            <span class="swatch" style="background:${c}"></span>
            <span class="trend-payee-name" style="color:${c}">${escapeHtml(j)}</span>
          </label>
        `;
      }).join("")}
    </div>
  `;

  jobPillsEl.querySelectorAll("[data-job-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      trendSelectedJobs = btn.dataset.jobAction === "all" ? null : new Set();
      renderTrends();
    });
  });

  jobPillsEl.querySelectorAll(".trend-payee-check").forEach(row => {
    row.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const j = row.dataset.job;
      if (trendMode === "job") {
        trendSelectedJobs = new Set([j]);
        closeAllTrendDropdowns();
      } else {
        if (trendSelectedJobs === null) trendSelectedJobs = new Set(jobsOnly);
        if (trendSelectedJobs.has(j)) trendSelectedJobs.delete(j);
        else trendSelectedJobs.add(j);
      }
      renderTrends();
    });
  });

  // Jobs summary
  const jobSummaryEl = document.getElementById("trend-job-summary");
  if (jobSummaryEl) {
    const sel = trendSelectedJobs === null ? jobsOnly : jobsOnly.filter(j => trendSelectedJobs.has(j));
    if (sel.length === jobsOnly.length) jobSummaryEl.textContent = `All jobs (${jobsOnly.length})`;
    else if (sel.length === 0) jobSummaryEl.textContent = "No jobs";
    else if (sel.length === 1) jobSummaryEl.textContent = sel[0];
    else jobSummaryEl.textContent = `${sel.length} of ${jobsOnly.length} jobs`;
  }

  const activeJobs = jobsOnly.filter(isJobSelected);
  if (!activeJobs.length) {
    const isOneJobMode = (trendMode === "job");
    title.textContent = isOneJobMode ? "Pick a job to see its history" : "Net Profit by Year";
    payeePillsEl.innerHTML = `<span class="trend-empty-filter">${isOneJobMode ? "Select a job to see payees." : "Select at least one job to see payees."}</span>`;
    chart.innerHTML = `<div class="empty" style="padding:32px;text-align:center;color:var(--muted)">
      ${isOneJobMode
        ? "Click the <strong>Job</strong> dropdown above and pick a job to see its year-over-year breakdown."
        : "Select at least one job above."}
    </div>`;
    return;
  }

  const titleLabel =
    activeJobs.length === 1 ? activeJobs[0] :
    activeJobs.length === jobsOnly.length ? "All Jobs" :
    `${activeJobs.length} Jobs`;
  const profitWord = trendAmountMode === "gross" ? "Gross" : "Net";
  title.textContent = `${titleLabel} — ${profitWord} Profit by Year`;

  // Year filter pills — multi-select. null = all years.
  // Include every year across *all* transactions (not just the selected job),
  // so the trend chart always spans your full history even when the selected
  // job had no sales in some years (those years just show as empty gaps).
  const yearPillsEl = document.getElementById("trend-year-pills") || _trendNoop;
  const allYearsSet = new Set();
  state.transactions.forEach(t => {
    const y = (t.date || "").slice(0, 4);
    if (/^\d{4}$/.test(y)) allYearsSet.add(y);
  });
  const allYearsList = Array.from(allYearsSet).sort((a, b) => b.localeCompare(a));

  // Year filter — single-select in "year" mode, multi-select in "job" mode.
  if (!trendYearsInitialized) {
    trendYearsInitialized = true;
    if (trendMode === "job") {
      // Default Job mode to ALL years so the chart spans full history.
      trendSelectedYears = new Set(allYearsList);
    } else {
      const thisYear = String(new Date().getFullYear());
      const pick = allYearsSet.has(thisYear) ? thisYear : allYearsList[0];
      trendSelectedYears = pick ? new Set([pick]) : new Set();
    }
  }

  if (trendSelectedYears !== null) {
    const kept = [...trendSelectedYears].filter(y => allYearsSet.has(y));
    // Both modes honor the full multi-year selection from the universal Date
    // Range filter. (Legacy behavior collapsed Year mode to a single year for
    // the old in-card single-select picker, which no longer applies.)
    trendSelectedYears = new Set(kept);
  }
  if ((!trendSelectedYears || trendSelectedYears.size === 0) && allYearsList.length) {
    // If the universal Date Range filter has no narrowing, honor "all years"
    // in both modes — otherwise Year mode falls back to the most recent year.
    const noDateFilter = selectedYears() === null;
    if (trendMode === "job" || noDateFilter) {
      trendSelectedYears = new Set(allYearsList);
    } else {
      trendSelectedYears = new Set([allYearsList[0]]);
    }
  }
  const isYearSelected = y => trendSelectedYears && trendSelectedYears.has(y);

  const yearsMulti = trendMode === "job";
  const yearsHeader = yearsMulti
    ? `<div class="trend-payee-menu-head">
         <button type="button" class="btn" data-year-action="all">Select All</button>
         <button type="button" class="btn" data-year-action="none">Clear</button>
       </div>`
    : "";
  yearPillsEl.innerHTML = `
    ${yearsHeader}
    <div class="trend-payee-menu-list">
      ${allYearsList.map(y => {
        const active = isYearSelected(y);
        const input = yearsMulti
          ? `<input type="checkbox" ${active ? "checked" : ""} />`
          : `<input type="radio" name="trend-year-radio" ${active ? "checked" : ""} />`;
        return `
          <label class="trend-payee-check ${active ? "active" : ""}" data-year="${y}">
            ${input}
            <span class="trend-payee-name">${y}</span>
          </label>
        `;
      }).join("")}
    </div>
  `;

  yearPillsEl.querySelectorAll("[data-year-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (btn.dataset.yearAction === "all") trendSelectedYears = new Set(allYearsList);
      else trendSelectedYears = new Set([allYearsList[0]].filter(Boolean));
      renderTrends();
    });
  });

  yearPillsEl.querySelectorAll(".trend-payee-check").forEach(row => {
    row.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const y = row.dataset.year;
      if (trendMode === "year") {
        trendSelectedYears = new Set([y]);
        closeAllTrendDropdowns();
      } else {
        if (!trendSelectedYears) trendSelectedYears = new Set();
        if (trendSelectedYears.has(y)) {
          if (trendSelectedYears.size > 1) trendSelectedYears.delete(y);
        } else {
          trendSelectedYears.add(y);
        }
      }
      renderTrends();
    });
  });

  // Year summary
  const yearSummaryEl = document.getElementById("trend-year-summary");
  if (yearSummaryEl) {
    const sel = allYearsList.filter(y => isYearSelected(y));
    if (!sel.length) yearSummaryEl.textContent = "No year";
    else if (sel.length === 1) yearSummaryEl.textContent = sel[0];
    else if (sel.length === allYearsList.length) yearSummaryEl.textContent = `All years (${allYearsList.length})`;
    else yearSummaryEl.textContent = `${sel.length} of ${allYearsList.length} years`;
  }

  // Aggregate net per (year, job, payee) across selected jobs, respecting the year filter.
  // Also track raw income totals per (year, job, payee) so "Gross" mode reports
  // actual income (not income netted against expenses to the same payee).
  const byYearJob = {};
  const byYearJobGross = {};
  const payeeTotals = {};
  state.transactions
    .filter(t => activeJobs.includes(t.category))
    .forEach(t => {
      const y = (t.date || "").slice(0, 4);
      if (!/^\d{4}$/.test(y)) return;
      if (!isYearSelected(y)) return;
      // Honor the universal Customer + Category filters from the chips. The
      // Job + Date Range + Payees filters are already enforced upstream (via
      // activeJobs, isYearSelected, and trendSelectedPayees respectively).
      if (!filterPasses("customer", t.customer || "")) return;
      if (!filterPassesCategory(t.category)) return;
      const payee = t.payee || "(no payee)";
      const signed = (t.type === "income" ? 1 : -1) * t.amount;
      if (!byYearJob[y]) byYearJob[y] = {};
      if (!byYearJob[y][t.category]) byYearJob[y][t.category] = {};
      byYearJob[y][t.category][payee] = (byYearJob[y][t.category][payee] || 0) + signed;
      if (t.type === "income") {
        if (!byYearJobGross[y]) byYearJobGross[y] = {};
        if (!byYearJobGross[y][t.category]) byYearJobGross[y][t.category] = {};
        byYearJobGross[y][t.category][payee] = (byYearJobGross[y][t.category][payee] || 0) + t.amount;
      }
      payeeTotals[payee] = (payeeTotals[payee] || 0) + Math.abs(signed);
    });

  // Flat per-year-payee totals (used only for the payee filter panel listing and color assignment).
  const byYear = {};
  Object.entries(byYearJob).forEach(([y, jobs]) => {
    byYear[y] = {};
    Object.values(jobs).forEach(payees => {
      Object.entries(payees).forEach(([p, v]) => {
        byYear[y][p] = (byYear[y][p] || 0) + v;
      });
    });
  });

  const allYears = Object.keys(byYear).sort();
  if (!allYears.length) {
    chart.innerHTML = `<div class="empty">No transactions for this category.</div>`;
    payeePillsEl.innerHTML = `<span class="trend-empty-filter">No payees.</span>`;
    return;
  }

  // Stable color assignment per payee, sorted by overall activity (largest first)
  const allPayees = Object.keys(payeeTotals).sort((a, b) => payeeTotals[b] - payeeTotals[a]);
  const payeeColor = {};
  allPayees.forEach((p, idx) => {
    payeeColor[p] = DONUT_PALETTE[idx % DONUT_PALETTE.length];
  });

  // Payee filter — default is all selected. Prune any selected payees that no longer exist.
  if (trendSelectedPayees !== null) {
    trendSelectedPayees = new Set([...trendSelectedPayees].filter(p => allPayees.includes(p)));
  }
  const isSelected = p => trendSelectedPayees === null || trendSelectedPayees.has(p);

  // Render payee filter as a checkbox list inside a dropdown, with sticky All/Clear header
  payeePillsEl.innerHTML = `
    <div class="trend-payee-menu-head">
      <button type="button" class="btn" data-menu-action="all">Select All</button>
      <button type="button" class="btn" data-menu-action="none">Clear</button>
    </div>
    <div class="trend-payee-menu-list">
      ${allPayees.map(p => `
        <label class="trend-payee-check ${isSelected(p) ? "active" : ""}" data-payee="${escapeHtml(p)}">
          <input type="checkbox" ${isSelected(p) ? "checked" : ""} />
          <span class="trend-payee-name">${escapeHtml(p)}</span>
        </label>
      `).join("")}
    </div>
  `;

  payeePillsEl.querySelectorAll("[data-menu-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (btn.dataset.menuAction === "all") trendSelectedPayees = null;
      else trendSelectedPayees = new Set();
      saveTrendFilters();
      renderTrends();
    });
  });

  // Update the dropdown summary text
  const summaryEl = document.getElementById("trend-payee-summary");
  if (summaryEl) {
    const selCount = trendSelectedPayees === null ? allPayees.length : [...trendSelectedPayees].filter(p => allPayees.includes(p)).length;
    if (selCount === allPayees.length) summaryEl.textContent = `All payees (${allPayees.length})`;
    else if (selCount === 0) summaryEl.textContent = "No payees selected";
    else if (selCount === 1) {
      const only = [...trendSelectedPayees][0];
      summaryEl.textContent = only;
    }
    else summaryEl.textContent = `${selCount} of ${allPayees.length} payees`;
  }

  payeePillsEl.querySelectorAll(".trend-payee-check").forEach(row => {
    row.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (trendSelectedPayees === null) trendSelectedPayees = new Set(allPayees);
      const p = row.dataset.payee;
      if (trendSelectedPayees.has(p)) trendSelectedPayees.delete(p);
      else trendSelectedPayees.add(p);
      saveTrendFilters();
      renderTrends();
    });
  });

  // Filter the aggregated data down to just the selected payees
  const filteredByYear = {};
  allYears.forEach(y => {
    const row = {};
    Object.entries(byYear[y]).forEach(([p, v]) => {
      if (isSelected(p)) row[p] = v;
    });
    if (Object.keys(row).length) filteredByYear[y] = row;
  });

  // Newest year on the left, oldest on the right.
  // In "job" mode, reserve a slot for every data year so unselected years show empty gaps.
  const years = trendMode === "job"
    ? allYearsList.slice().sort((a, b) => b.localeCompare(a))
    : Object.keys(filteredByYear).sort((a, b) => b.localeCompare(a));
  if (!years.length) {
    chart.innerHTML = `<div class="empty">No data for the selected payees. Enable at least one payee above.</div>`;
    return;
  }

  // Shadow allPayees with only the selected ones so the legend matches the chart
  const payeesSorted = allPayees.filter(p => isSelected(p));

  // Build data: for each (year, job) compute its stacked segments (filtered by selected payees).
  // Only keep (year, job) cells that have any data after filtering.
  const yearData = years.map(y => {
    const jobBars = activeJobs.map(job => {
      const payees = (byYearJob[y] && byYearJob[y][job]) || {};
      const grossPayees = (byYearJobGross[y] && byYearJobGross[y][job]) || {};
      const entries = Object.entries(payees)
        .filter(([p, v]) => v !== 0 && isSelected(p))
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
      // Gross = raw income to selected payees; not reduced by expenses to the
      // same payee. Net = signed sum (income − expense) per selected payee.
      const posSum = Object.entries(grossPayees)
        .filter(([p]) => isSelected(p))
        .reduce((s, [, v]) => s + v, 0);
      const negSum = entries.filter(([, v]) => v < 0).reduce((s, [, v]) => s + v, 0);
      const grossTotal = entries.reduce((s, [, v]) => s + Math.abs(v), 0);
      const slotIndex = trendMode === "job" ? 0 : jobsOnly.indexOf(job);
      const netSum = entries.reduce((s, [, v]) => s + v, 0);
      return { job, slotIndex, segs: entries, posSum, negSum, grossTotal, net: netSum };
    });
    return { year: y, jobBars };
  });

  // ============================================================
  // INCOME-FLOW STYLE: pill-shaped horizontal bars + sidebar with stats and
  // a sources list. Each row is one item (year or job) showing total net.
  // ============================================================

  // Build flat items list:
  //   View By Year → one bar per JOB (totals within the selected year(s))
  //   View By Job  → one bar per YEAR (totals within the selected job(s))
  // "gross" → sum of positive income only; "net" → income minus expenses.
  const valueFor = b => trendAmountMode === "gross" ? b.posSum : b.net;
  let flowItems;
  if (trendMode === "year") {
    // Bars are jobs; values summed across the selected years.
    const totals = new Map();
    const payeeBreakdown = new Map(); // job -> Map(payee -> sumPos)
    yearData.forEach(d => d.jobBars.forEach(b => {
      const v = valueFor(b);
      if (v === 0) return;
      totals.set(b.job, (totals.get(b.job) || 0) + v);
      // Stack only the positive payee contributions so the visualization is
      // consistent across Gross / Net (negatives are shown via bar width only).
      let pmap = payeeBreakdown.get(b.job);
      if (!pmap) { pmap = new Map(); payeeBreakdown.set(b.job, pmap); }
      b.segs.forEach(([p, val]) => {
        if (val > 0) pmap.set(p, (pmap.get(p) || 0) + val);
      });
    }));
    flowItems = [...totals.entries()].map(([name, value]) => ({
      name, value, color: jobColor[name] || null,
      payeeSegs: [...(payeeBreakdown.get(name) || new Map()).entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([p, v]) => ({ payee: p, value: v, color: payeeColor[p] || "#888" })),
    }));
  } else {
    // Bars are years; values summed across the selected jobs.
    const totals = new Map();
    const payeeBreakdown = new Map(); // year -> Map(payee -> sumPos)
    yearData.forEach(d => {
      const total = d.jobBars.reduce((s, b) => s + valueFor(b), 0);
      if (total === 0) return;
      totals.set(d.year, (totals.get(d.year) || 0) + total);
      let pmap = payeeBreakdown.get(d.year);
      if (!pmap) { pmap = new Map(); payeeBreakdown.set(d.year, pmap); }
      d.jobBars.forEach(b => b.segs.forEach(([p, val]) => {
        if (val > 0) pmap.set(p, (pmap.get(p) || 0) + val);
      }));
    });
    flowItems = [...totals.entries()].map(([name, value]) => ({
      name, value, color: null,
      payeeSegs: [...(payeeBreakdown.get(name) || new Map()).entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([p, v]) => ({ payee: p, value: v, color: payeeColor[p] || "#888" })),
    }));
  }
  flowItems = flowItems.filter(i => i.value !== 0);
  // Year-mode bars (jobs) sort by value desc.
  // Job-mode bars (years) sort newest → oldest so the most recent year is on top.
  if (trendMode === "job") {
    flowItems.sort((a, b) => b.name.localeCompare(a.name));
  } else {
    flowItems.sort((a, b) => b.value - a.value);
  }

  // Assign palette colors when one isn't already pinned (year bars get palette colors)
  flowItems.forEach((it, idx) => {
    if (!it.color) it.color = DONUT_PALETTE[idx % DONUT_PALETTE.length];
  });

  const flowTotal = flowItems.reduce((s, i) => s + i.value, 0);
  const flowMax   = flowItems.length ? Math.max(...flowItems.map(i => Math.abs(i.value))) : 0;
  const flowAvg   = flowItems.length ? flowTotal / flowItems.length : 0;

  // Build a "nice" axis tick set with ~5 evenly-spaced ticks.
  const niceStep = niceStepFor(flowMax || 1);
  const xMax = Math.ceil((flowMax || 1) / niceStep) * niceStep || niceStep;
  // Pick a tick step that yields ~5 labels — niceStepFor's 0.25/0.5 fractions
  // produce way too many ticks at small magnitudes, so use 1/2/5/10 buckets.
  function pickTickStep(maxValue, targetTicks = 5) {
    if (maxValue <= 0) return 1;
    const rough = maxValue / targetTicks;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const n = rough / pow;
    let step = 10;
    if (n <= 1) step = 1;
    else if (n <= 2) step = 2;
    else if (n <= 5) step = 5;
    return step * pow;
  }
  const tickStep = pickTickStep(xMax, 5);
  const ticks = [];
  for (let v = 0; v <= xMax + 0.0001; v += tickStep) ticks.push(v);

  function fmtTick(v) {
    if (v >= 1000) return "$" + (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "K";
    return "$" + Math.round(v);
  }

  // Stable hatch pattern per payee — same mapping the legacy SVG renderer used.
  function flowHatchStyle(payee) {
    const key = (payee || "").trim().toLowerCase();
    if (!key || key === "job") return null;
    if (key === "cost")      return "diag45";
    if (key === "give back") return "diag-45";
    if (key === "diane")     return "vert";
    if (key === "tristen")   return "horiz";
    return null; // every other payee renders as solid
  }

  // CSS background-image for a given hatch style, layered on top of the base color
  // (the base color is set via `background-color`).
  function flowHatchBg(style) {
    if (style === "diag45")  return "repeating-linear-gradient(45deg, rgba(0,0,0,0.45) 0 2px, transparent 2px 6px)";
    if (style === "diag-45") return "repeating-linear-gradient(-45deg, rgba(0,0,0,0.45) 0 2px, transparent 2px 6px)";
    if (style === "vert")    return "repeating-linear-gradient(90deg, rgba(0,0,0,0.45) 0 2px, transparent 2px 6px)";
    if (style === "horiz")   return "repeating-linear-gradient(0deg,  rgba(0,0,0,0.45) 0 2px, transparent 2px 6px)";
    return "";
  }

  const flowBars = flowItems.map(it => {
    // Both bars and the axis ticks scale to xMax (the next "nice" round up
    // from flowMax) so tick labels line up with the bars and the rightmost
    // tick sits at 100% — never past the card's right edge.
    const widthPct = xMax > 0 ? (Math.abs(it.value) / xMax) * 100 : 0;
    const fitsLabel = widthPct >= 18; // bar wide enough to host the label inside
    const labelInside  = fitsLabel ? `<span class="flow-bar-label">${escapeHtml(it.name)}</span>` : "";
    const labelOutside = !fitsLabel
      ? `<span class="flow-bar-label-outside" style="left: calc(${widthPct}% + 8px);">${escapeHtml(it.name)}</span>`
      : "";

    // Per-payee segment divs (flex-basis sized) so each band can carry its own
    // hatch overlay independently of its neighbors. The base color is the
    // BAR's color (job or year) so legend dots line up with bars; hatching is
    // what distinguishes specific payees (Cost / Give Back / Diane / Tristen).
    const segs = (it.payeeSegs && it.payeeSegs.length) ? it.payeeSegs : [{ payee: it.name, value: 1 }];
    const segTotal = segs.reduce((s, x) => s + x.value, 0) || 1;
    const segHtml = segs.map(s => {
      const flexPct = (s.value / segTotal) * 100;
      const hatch = flowHatchStyle(s.payee);
      const hatchBg = flowHatchBg(hatch);
      const styleParts = [
        `flex: 0 0 ${flexPct}%`,
        `background-color: ${it.color}`,
      ];
      if (hatchBg) styleParts.push(`background-image: ${hatchBg}`);
      return `<div class="flow-bar-seg" style="${styleParts.join(';')}" title="${escapeHtml(`${s.payee}: ${fmtMoney(s.value)}`)}"></div>`;
    }).join("");

    const tooltip = (it.payeeSegs && it.payeeSegs.length > 1)
      ? `${it.name} — ${it.payeeSegs.map(s => `${s.payee}: ${fmtMoney(s.value)}`).join(" · ")}`
      : it.name;

    return `
      <div class="flow-bar-row">
        <div class="flow-bar-track">
          <div class="flow-bar" style="width:${widthPct}%" title="${escapeHtml(tooltip)}">
            ${segHtml}
            ${labelInside}
          </div>
          ${labelOutside}
        </div>
      </div>
    `;
  }).join("");

  const axisHtml = `
    <div class="flow-axis">
      ${ticks.map((v, i) => {
        const pct = xMax > 0 ? (v / xMax) * 100 : 0;
        // Anchor first tick to left, last to right, others centered — keeps the
        // axis labels from spilling outside the chart card on either edge.
        let edgeClass = "";
        if (i === 0)                     edgeClass = " is-first";
        else if (i === ticks.length - 1) edgeClass = " is-last";
        return `<span class="flow-axis-tick${edgeClass}" style="left:${pct}%">${fmtTick(v)}</span>`;
      }).join("")}
    </div>
  `;
  // Faint vertical gridlines at each tick position, overlayed across the bar area.
  const gridlinesHtml = `
    <div class="flow-gridlines" aria-hidden="true">
      ${ticks.map(v => {
        const pct = xMax > 0 ? (v / xMax) * 100 : 0;
        return `<span class="flow-gridline" style="left:${pct}%"></span>`;
      }).join("")}
    </div>
  `;

  // Stats reflect what the bars actually represent:
  //   Year mode → bars are jobs, so count="JOBS", avg="AVG / JOB"
  //   Job mode  → bars are years, so count="YEARS", avg="AVG / YEAR"
  const aggregateLabel = trendMode === "year"
    ? { count: "JOBS", avg: "AVG / JOB" }
    : { count: "YEARS", avg: "AVG / YEAR" };

  // Months covered by the income transactions in this filter set.
  const monthsSet = new Set();
  state.transactions.forEach(t => {
    if (t.type !== "income") return;
    if (NON_JOB_CATEGORIES.includes(t.category)) return;
    const yr = (t.date || "").slice(0, 4);
    if (!years.includes(yr)) return;
    monthsSet.add((t.date || "").slice(0, 7));
  });

  // In One Job (trendMode === "job") view, the items are years — compute a
  // year-over-year % delta for each row by comparing to the immediately
  // preceding calendar year's value. No delta if the previous year is absent
  // or has a zero value (would be ±∞%).
  const yearValueMap = trendMode === "job"
    ? new Map(flowItems.map(it => [it.name, it.value]))
    : null;
  const yoyHtmlFor = (it) => {
    if (!yearValueMap) return "";
    const yr = parseInt(it.name, 10);
    if (!yr) return "";
    const prev = yearValueMap.get(String(yr - 1));
    if (prev === undefined || prev === 0) return "";
    const pct = ((it.value - prev) / Math.abs(prev)) * 100;
    const cls = pct >= 0 ? "yoy-up" : "yoy-down";
    const arrow = pct >= 0 ? "▲" : "▼";
    const sign = pct >= 0 ? "+" : "";
    return `<span class="flow-source-yoy ${cls}" title="vs ${yr - 1}">${arrow} ${sign}${pct.toFixed(1)}%</span>`;
  };
  const sourcesListHtml = flowItems.map(it => `
    <li class="flow-source-row">
      <span class="flow-source-dot" style="background:${it.color}"></span>
      <span class="flow-source-name">${escapeHtml(it.name)}</span>
      <span class="flow-source-end">
        ${yoyHtmlFor(it)}
        <span class="flow-source-value">${fmtMoney(it.value)}</span>
      </span>
    </li>
  `).join("");

  const isNet = trendAmountMode === "net";
  const eyebrowText = isNet ? "Net Flow" : "Gross Flow";
  const totalLabel  = isNet ? "TOTAL NET" : "TOTAL GROSS";
  chart.innerHTML = `
    <div class="flow-grid">
      <div class="flow-main">
        <div class="flow-header">
          <div class="flow-header-text">
            <div class="flow-eyebrow">${eyebrowText}</div>
            <div class="flow-total" style="color:${flowTotal >= 0 ? "var(--primary)" : "var(--expense)"}">${fmtMoney(flowTotal)}</div>
          </div>
        </div>
        <div class="flow-bars-wrap">
          ${gridlinesHtml}
          <div class="flow-bars">${flowBars}</div>
        </div>
        ${axisHtml}
      </div>
      <aside class="flow-aside">
        <div class="flow-stats">
          <div class="flow-stat">
            <div class="flow-stat-label">${totalLabel}</div>
            <div class="flow-stat-value ${flowTotal >= 0 ? "income" : "expense"}">${fmtMoney(flowTotal)}</div>
          </div>
          <div class="flow-stat">
            <div class="flow-stat-label">${aggregateLabel.avg}</div>
            <div class="flow-stat-value income">${fmtMoney(flowAvg)}</div>
          </div>
          <div class="flow-stat">
            <div class="flow-stat-label">${aggregateLabel.count}</div>
            <div class="flow-stat-value">${flowItems.length}</div>
          </div>
          <div class="flow-stat">
            <div class="flow-stat-label">${trendMode === "year" ? "MONTHS" : "PAYEES"}</div>
            <div class="flow-stat-value">${trendMode === "year" ? monthsSet.size : payeesSorted.length}</div>
          </div>
        </div>
        <div class="flow-list-title">${trendMode === "year" ? "JOBS" : "YEARS"}</div>
        <ul class="flow-source-list">${sourcesListHtml}</ul>
      </aside>
    </div>
  `;
  return; // skip the legacy SVG renderer below

  // (Legacy SVG renderer kept temporarily — unreachable due to early return.)

  // Group-layout: one horizontal band per year; inside a band each job is a stacked horizontal bar.
  const groupCount = yearData.length;
  const barGap = 4;
  const slotsPerGroup = Math.max(1, jobsOnly.length);

  // SVG dimensions — width fixed, height grows with number of year bands.
  const width = 900;
  const MIN_ROW_H = 56;
  const padL = 90, padR = 40, padT = 34, padB = 38;
  const calcHeight = padT + padB + groupCount * MIN_ROW_H;
  const height = Math.max(360, calcHeight);
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const groupSlotY = plotH / groupCount;

  const refInnerHeight = Math.max(20, groupSlotY * 0.82);
  const barH = Math.max(6, (refInnerHeight - barGap * (slotsPerGroup - 1)) / slotsPerGroup);

  // Helper: value → x-pixel along the horizontal axis.
  const xFor = v => padL + ((v - xMin) / range) * plotW;
  const zeroX = xFor(0);

  // Grid lines (vertical — one per value tick)
  const gridLines = [];
  const approxTicks = 5;
  const step = niceStepFor(range / approxTicks);
  for (let v = Math.ceil(xMin / step) * step; v <= xMax + 0.0001; v += step) {
    const x = xFor(v);
    gridLines.push(`<line class="trend-grid-line" x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}"></line>`);
  }

  // Year group separators (horizontal lines between bands)
  const separators = [];
  for (let i = 1; i < groupCount; i++) {
    const y = padT + groupSlotY * i;
    separators.push(`<line class="trend-grid-line" x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}"></line>`);
  }

  const showJobLabels = false; // in horizontal mode the legend already identifies jobs

  // Different hatching style per payee (applied on top of the job's color).
  // "Job" (the default photography income payee) stays solid so the chart
  // reads cleanly; secondary payees each get a distinct pattern.
  //   Cost      → diagonal lines 45°
  //   Give Back → diagonal lines -45°
  //   Diane     → vertical lines
  //   Tristen   → horizontal lines
  //   anything else → light dot grid
  const payeeHatch = {};
  const normalizePayee = p => (p || "").trim().toLowerCase();
  function hatchStyle(payee) {
    const key = normalizePayee(payee);
    if (!key || key === "job") return null;
    if (key === "cost")      return "diag45";
    if (key === "give back") return "diag-45";
    if (key === "diane")     return "vert";
    if (key === "tristen")   return "horiz";
    return "dots";
  }
  const hatchDefs = new Map(); // style|color -> id
  function hatchPatternFor(style, color) {
    const key = `${style}|${color}`;
    if (hatchDefs.has(key)) return hatchDefs.get(key);
    const id = `hatch-${hatchDefs.size}-${color.replace(/[^a-z0-9]/gi, "")}`;
    hatchDefs.set(key, id);
    return id;
  }
  function hatchDefSvg(style, color, id) {
    const base = `<rect width="100%" height="100%" fill="${color}"></rect>`;
    let marks = "";
    if (style === "diag45") {
      marks = `<path d="M-1,5 l12,-12 M-1,11 l12,-12 M5,13 l8,-8" stroke="rgba(0,0,0,0.4)" stroke-width="2"/>`;
    } else if (style === "diag-45") {
      marks = `<path d="M-1,-1 l12,12 M-1,5 l12,12 M5,-3 l8,8" stroke="rgba(0,0,0,0.4)" stroke-width="2"/>`;
    } else if (style === "vert") {
      marks = `<path d="M2,0 v12 M6,0 v12 M10,0 v12" stroke="rgba(0,0,0,0.45)" stroke-width="1.5"/>`;
    } else if (style === "horiz") {
      marks = `<path d="M0,2 h12 M0,6 h12 M0,10 h12" stroke="rgba(0,0,0,0.45)" stroke-width="1.5"/>`;
    } else if (style === "dots") {
      marks = `<circle cx="3" cy="3" r="1.2" fill="rgba(0,0,0,0.5)"/><circle cx="9" cy="9" r="1.2" fill="rgba(0,0,0,0.5)"/>`;
    }
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="12" height="12">${base}${marks}</pattern>`;
  }

  const bars = yearData.map((d, gi) => {
    const groupTop = padT + groupSlotY * gi;
    const groupCy  = groupTop + groupSlotY / 2;

    // Only render jobs with data — stack them vertically inside the year band.
    const barsWithData = d.jobBars.filter(b => b.grossTotal > 0);
    const M = barsWithData.length;
    const totalBarsHeight = M > 0 ? (M * barH + (M - 1) * barGap) : 0;
    const startY = groupCy - totalBarsHeight / 2;

    // Year label on the left gutter (always shown, centered on the band)
    const yearLabel = `<text class="trend-year-label" x="${padL - 10}" y="${groupCy}" style="text-anchor:end;dominant-baseline:middle;font-weight:600">${escapeHtml(d.year)}</text>`;

    const innerBars = barsWithData.map((b, localIdx) => {
      const y = startY + localIdx * (barH + barGap);
      const cy = y + barH / 2;

      const barColor = jobColor[b.job] || payeeColor[b.segs[0]?.[0]] || "#2c6ecb";
      let cursor = 0;
      const segs = b.segs.map(([payee, v]) => {
        const abs = Math.abs(v);
        const end = cursor + abs;
        const x1 = xFor(cursor);
        const x2 = xFor(end);
        cursor = end;
        const isNeg = v < 0;
        const hatch = hatchStyle(payee);
        let fill = barColor;
        let stroke = "none";
        let strokeWidth = 0;
        if (isNeg) {
          const id = hatchPatternFor("diag45-neg", barColor);
          fill = `url(#${id})`;
          stroke = barColor;
          strokeWidth = 1;
        } else if (hatch) {
          const id = hatchPatternFor(hatch, barColor);
          fill = `url(#${id})`;
        }
        return `
          <rect class="trend-bar" x="${x1}" y="${y}" width="${Math.max(1, x2 - x1)}" height="${barH}"
            fill="${fill}"
            stroke="${stroke}" stroke-width="${strokeWidth}">
            <title>${escapeHtml(d.year)} • ${escapeHtml(b.job)} • ${escapeHtml(payee)}: ${fmtMoney(v)}${isNeg ? " (expense)" : ""}</title>
          </rect>
        `;
      }).join("");

      // Net label at the right end of the bar — Job mode only; Year mode shows
      // totals in the right-side legend instead.
      const netColor = b.net >= 0 ? "var(--income)" : "var(--expense)";
      const rightX = xFor(b.grossTotal);
      const labelFontPx = 12;
      const netLabel = (trendMode === "job" && b.grossTotal > 0)
        ? `<text class="trend-value" x="${rightX + 6}" y="${cy}" style="text-anchor:start;dominant-baseline:middle;fill:${netColor};font-size:${labelFontPx}px;font-weight:700">${fmtMoney(b.net)}</text>`
        : "";

      // % change vs. previous calendar year (Job mode only) — tucked just to
      // the right of the net label.
      let pctLabel = "";
      if (trendMode === "job" && b.grossTotal > 0) {
        const prevYear = String(Number(d.year) - 1);
        const prevYearData = yearData.find(yd => yd.year === prevYear);
        const prevBar = prevYearData?.jobBars.find(pb => pb.job === b.job);
        if (prevBar && prevBar.net !== 0) {
          const pct = ((b.net - prevBar.net) / Math.abs(prevBar.net)) * 100;
          const sign = pct >= 0 ? "+" : "";
          const pctColor = pct >= 0 ? "var(--income)" : "var(--expense)";
          // Render the % directly above the net label so both stay readable.
          pctLabel = `<text class="trend-value" x="${rightX + 6}" y="${cy - labelFontPx}" style="text-anchor:start;dominant-baseline:middle;fill:${pctColor};font-size:11px;font-weight:600">${sign}${pct.toFixed(1)}%</text>`;
        }
      }

      return `${segs}${netLabel}${pctLabel}`;
    }).join("");

    return `<g>${yearLabel}${innerBars}</g>`;
  }).join("");

  // Jobs total + job-color legend (only relevant in Job mode where each bar is a job).
  // Sum nets ACROSS every selected year (not just yearData[0]) so the total
  // updates when the user selects more than one year.
  let jobSummaryHtml = "";
  if (trendMode === "job") {
    const jobTotals = new Map();
    yearData.forEach(d => {
      d.jobBars.forEach(b => {
        if (!jobTotals.has(b.job)) jobTotals.set(b.job, { job: b.job, net: 0 });
        jobTotals.get(b.job).net += b.net;
      });
    });
    // Preserve activeJobs order if possible
    const aggregated = activeJobs
      .filter(j => jobTotals.has(j))
      .map(j => jobTotals.get(j));
    const totalNet = aggregated.reduce((s, b) => s + b.net, 0);
    const totalColor = totalNet >= 0 ? "var(--income)" : "var(--expense)";
    jobSummaryHtml = `
      <div class="trend-jobs-total">
        <span class="trend-jobs-total-label">Total of All Jobs</span>
        <span class="trend-jobs-total-value" style="color:${totalColor}">${fmtMoney(totalNet)}</span>
      </div>
      <div class="trend-legend trend-legend-jobs">
        ${aggregated.map(b => `
          <div class="trend-legend-item">
            <span class="donut-swatch" style="background:${jobColor[b.job] || '#888'}"></span>
            <span>${escapeHtml(b.job)}</span>
            <span class="trend-legend-val">${fmtMoney(b.net)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Payee legend (always shown)
  const payeeLegend = `
    <div class="trend-legend trend-legend-payees">
      ${payeesSorted.map(p => `
        <div class="trend-legend-item">
          <span class="donut-swatch" style="background:${payeeColor[p]}"></span>
          <span>${escapeHtml(p)}</span>
        </div>
      `).join("")}
    </div>
  `;

  // Build <defs> for every hatch pattern we actually used while rendering bars.
  // Also register a diagonal-stripe pattern for negative values under the key
  // "diag45-neg|<color>" so the reference inside the renderer resolves.
  const patternsSvg = [];
  // Ensure the negative-stripe pattern is defined for every color we might use
  const allBarColors = new Set();
  yearData.forEach(d => d.jobBars.forEach(b => {
    const c = jobColor[b.job] || payeeColor[b.segs[0]?.[0]] || "#2c6ecb";
    allBarColors.add(c);
  }));
  allBarColors.forEach(c => {
    const id = hatchPatternFor("diag45-neg", c);
    patternsSvg.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="6" height="6" fill="${c}" opacity="0.55"/><line x1="0" y1="0" x2="0" y2="6" stroke="${c}" stroke-width="3"/></pattern>`);
  });
  hatchDefs.forEach((id, key) => {
    const [style, color] = key.split("|");
    if (style === "diag45-neg") return; // already emitted above
    patternsSvg.push(hatchDefSvg(style, color, id));
  });

  // Top-right in-chart legend: one row per Job with data, showing the job
  // color swatch, name, and right-justified net-total value for the year range.
  const legendJobTotals = new Map();
  yearData.forEach(d => d.jobBars.forEach(b => {
    if (b.grossTotal === 0) return;
    const prev = legendJobTotals.get(b.job) || 0;
    legendJobTotals.set(b.job, prev + b.net);
  }));
  const legendArr = [...legendJobTotals.entries()]
    .map(([job, net]) => ({ job, net }));
  const legendRowH = 15;
  const legendPadY = 6, legendPadX = 8;
  const legendSwatch = 9;
  const legendFontPx = 11;
  const legendNameW = 110; // fixed column for job name so the value column aligns
  const legendValueW = 70;
  const legendW = legendArr.length ? legendSwatch + 6 + legendNameW + legendValueW + legendPadX * 2 : 0;
  const legendH = legendArr.length ? legendArr.length * legendRowH + legendPadY * 2 : 0;
  const legendX = width - padR - legendW;
  const legendY = padT - 10;
  const legendSvg = legendArr.length ? `
    <g class="trend-chart-legend" transform="translate(${legendX}, ${legendY})">
      <rect x="0" y="0" width="${legendW}" height="${legendH}" rx="6" ry="6"
            fill="var(--surface)" stroke="var(--border)" stroke-width="1" opacity="0.95"></rect>
      ${legendArr.map((item, i) => {
        const yy = legendPadY + i * legendRowH + legendRowH * 0.55;
        const color = jobColor[item.job] || "#888";
        const netColor = item.net >= 0 ? "var(--income)" : "var(--expense)";
        const valueX = legendW - legendPadX;
        return `
          <rect x="${legendPadX}" y="${yy - legendSwatch/2 - 1}" width="${legendSwatch}" height="${legendSwatch}" rx="2" ry="2" fill="${color}"></rect>
          <text x="${legendPadX + legendSwatch + 6}" y="${yy}" style="font-size:${legendFontPx}px;fill:var(--text);dominant-baseline:middle">${escapeHtml(shortLabel(item.job, 18))}</text>
          <text x="${valueX}" y="${yy}" style="font-size:${legendFontPx}px;fill:${netColor};dominant-baseline:middle;text-anchor:end;font-weight:600">${fmtMoney(item.net)}</text>
        `;
      }).join("")}
    </g>
  ` : "";

  chart.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <defs>${patternsSvg.join("")}</defs>
      ${separators.join("")}
      <line class="trend-axis-line" x1="${zeroX}" y1="${padT}" x2="${zeroX}" y2="${padT + plotH}"></line>
      ${bars}
      ${gridLines.join("")}
      ${legendSvg}
    </svg>
    ${jobSummaryHtml}
    ${payeeLegend}
  `;
}

// --------- Treemap (Analytics → Treemap sub-tab) ---------
let treemapMode = "year"; // "year" | "job"

document.querySelectorAll("#treemap-mode-pills .mode-switch-option").forEach(btn => {
  btn.addEventListener("click", () => {
    treemapMode = btn.dataset.mode;
    const container = document.getElementById("treemap-mode-pills");
    container.dataset.mode = treemapMode;
    container.querySelectorAll(".mode-switch-option").forEach(b => {
      b.classList.toggle("active", b === btn);
    });
    renderTreemap();
  });
});

// Simple binary-split treemap: recursively splits the rectangle into two halves
// proportional to the sorted value totals, alternating orientation by aspect.
function binaryTreemap(items, rect) {
  items = items.filter(i => i.value > 0).sort((a, b) => b.value - a.value);
  if (!items.length) return [];
  return treemapStep(items, rect);
}
function treemapStep(items, rect) {
  if (items.length === 1) return [{ item: items[0], ...rect }];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];
  let acc = 0;
  let splitIdx = 1;
  for (let i = 0; i < items.length - 1; i++) {
    acc += items[i].value;
    if (acc >= total / 2) { splitIdx = i + 1; break; }
  }
  const first = items.slice(0, splitIdx);
  const second = items.slice(splitIdx);
  const firstFrac = first.reduce((s, i) => s + i.value, 0) / total;
  let r1, r2;
  if (rect.w >= rect.h) {
    const splitW = rect.w * firstFrac;
    r1 = { x: rect.x, y: rect.y, w: splitW, h: rect.h };
    r2 = { x: rect.x + splitW, y: rect.y, w: rect.w - splitW, h: rect.h };
  } else {
    const splitH = rect.h * firstFrac;
    r1 = { x: rect.x, y: rect.y, w: rect.w, h: splitH };
    r2 = { x: rect.x, y: rect.y + splitH, w: rect.w, h: rect.h - splitH };
  }
  return [...treemapStep(first, r1), ...treemapStep(second, r2)];
}

// --------- By Category (Donut / Columns / Treemap / Rose) ---------
let byCatChartMode = "donut";
let byCatTypeMode  = "spending"; // "spending" | "income"
let byCatAmountMode = "gross";   // "gross" | "net" — Net deducts opposite-type tx in same category

document.getElementById("bcat-chart-switch")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-mode]");
  if (!btn) return;
  const next = btn.dataset.mode;
  if (next === byCatChartMode) return;
  byCatChartMode = next;
  const wrap = document.getElementById("bcat-chart-switch");
  if (wrap) {
    wrap.dataset.mode = next;
    wrap.querySelectorAll(".mode-switch-option").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === next);
    });
  }
  renderByCategory();
});

function syncBcatAmountSwitchEnabled() {
  // Gross/Net is only meaningful for Income; when Spending is selected the
  // switch is disabled and snaps back to Gross.
  const amountWrap = document.getElementById("bcat-amount-switch");
  if (!amountWrap) return;
  const disabled = byCatTypeMode === "spending";
  amountWrap.classList.toggle("is-disabled", disabled);
  amountWrap.querySelectorAll("button").forEach(b => { b.disabled = disabled; });
  if (disabled && byCatAmountMode !== "gross") {
    byCatAmountMode = "gross";
    amountWrap.dataset.mode = "gross";
    amountWrap.querySelectorAll(".mode-switch-option").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === "gross");
    });
  }
}

document.getElementById("bcat-type-switch")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-mode]");
  if (!btn) return;
  const next = btn.dataset.mode;
  if (next === byCatTypeMode) return;
  byCatTypeMode = next;
  const wrap = document.getElementById("bcat-type-switch");
  if (wrap) {
    wrap.dataset.mode = next;
    wrap.querySelectorAll(".mode-switch-option").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === next);
    });
  }
  syncBcatAmountSwitchEnabled();
  renderByCategory();
});

// Initialize disabled state on load (Spending is the default).
syncBcatAmountSwitchEnabled();

document.getElementById("bcat-amount-switch")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-mode]");
  if (!btn) return;
  const next = btn.dataset.mode;
  if (next === byCatAmountMode) return;
  byCatAmountMode = next;
  const wrap = document.getElementById("bcat-amount-switch");
  if (wrap) {
    wrap.dataset.mode = next;
    wrap.querySelectorAll(".mode-switch-option").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === next);
    });
  }
  renderByCategory();
});

function renderByCategory() {
  const chartEl = document.getElementById("bcat-chart");
  const listEl  = document.getElementById("bcat-list");
  if (!chartEl || !listEl) return;

  // Filter by transaction type — Spending (expenses) or Income — driven by the
  // top-level Spending|Income switch on the By Category card.
  // Gross   = sum of |amount| for the chosen type (income or expense).
  // Net     = same, but minus opposite-type transactions in the same category.
  const wantType = byCatTypeMode === "income" ? "income" : "expense";
  const oppType  = wantType === "income" ? "expense" : "income";
  const isNetMode = byCatAmountMode === "net";

  const passesFilters = t => {
    if (NON_JOB_CATEGORIES.includes(t.category)) return false;
    if (!filterPasses("date-range", (t.date || "").slice(0, 4))) return false;
    if (!filterPasses("customer", t.customer || "")) return false;
    if (!filterPassesCategory(t.category)) return false;
    if (!filterPasses("payees", t.payee || "")) return false;
    return true;
  };

  const totals = new Map();
  state.transactions.forEach(t => {
    if (!passesFilters(t)) return;
    if (t.type === wantType) {
      const cat = t.category || "Uncategorized";
      totals.set(cat, (totals.get(cat) || 0) + Math.abs(t.amount || 0));
    } else if (isNetMode && t.type === oppType) {
      const cat = t.category || "Uncategorized";
      totals.set(cat, (totals.get(cat) || 0) - Math.abs(t.amount || 0));
    }
  });

  const items = [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter(i => i.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((it, idx) => ({ ...it, color: DONUT_PALETTE[idx % DONUT_PALETTE.length] }));

  const total = items.reduce((s, i) => s + i.value, 0);
  // Months count: respect the date-range filter (years × 12). When no year is
  // filtered, count distinct months that actually had data.
  const years = selectedYears();
  const monthsCount = years ? (years.length * 12) : (() => {
    const set = new Set();
    state.transactions.forEach(t => {
      if (t.type !== wantType) return;
      const ymKey = (t.date || "").slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ymKey)) set.add(ymKey);
    });
    return set.size;
  })();
  const avg = monthsCount ? total / monthsCount : 0;

  // Header + stat tiles
  const eyebrowEl = document.getElementById("bcat-eyebrow");
  if (eyebrowEl) {
    const base = byCatTypeMode === "income" ? "Income by Category" : "Spending by Category";
    eyebrowEl.textContent = isNetMode ? `Net ${base}` : base;
  }
  document.getElementById("bcat-total").textContent      = fmtMoney(total);
  document.getElementById("bcat-stat-total").textContent = fmtMoney(total);
  document.getElementById("bcat-stat-avg").textContent   = fmtMoney(avg);
  document.getElementById("bcat-stat-count").textContent = String(items.length);
  const topEl = document.getElementById("bcat-stat-top");
  if (items.length) {
    const top = items[0];
    const topPct = total > 0 ? Math.round((top.value / total) * 100) : 0;
    topEl.innerHTML = `${escapeHtml(top.name)}<div style="font-size:10px;color:var(--muted);font-weight:600;margin-top:2px;">${topPct}% of total</div>`;
  } else {
    topEl.textContent = "—";
  }

  // Categories sidebar list
  if (!items.length) {
    listEl.innerHTML = `<li class="bcat-cat-row" style="grid-template-columns:1fr"><span class="muted">No spending for the selected filters.</span></li>`;
  } else {
    listEl.innerHTML = items.map(c => `
      <li class="bcat-cat-row">
        <span class="bcat-cat-dot" style="background:${c.color}"></span>
        <span class="bcat-cat-name">${escapeHtml(c.name)}</span>
        <span class="bcat-cat-amount">${fmtMoney(c.value)}</span>
      </li>
    `).join("");
  }

  // Empty state for the chart area itself
  if (!items.length) {
    chartEl.innerHTML = `<div class="donut-empty">No spending for the selected filters.</div>`;
    return;
  }

  if (byCatChartMode === "donut")    renderBcatDonut(chartEl, items, total);
  else if (byCatChartMode === "columns") renderBcatColumns(chartEl, items, total);
  else if (byCatChartMode === "treemap") renderBcatTreemap(chartEl, items);
  else if (byCatChartMode === "rose")    renderBcatRose(chartEl, items, total);
}

function renderBcatDonut(el, items, total) {
  // Group long tail into "Other" so the donut stays readable.
  const SHOW_TOP = 10;
  let display = items;
  if (items.length > SHOW_TOP) {
    const head = items.slice(0, SHOW_TOP);
    const rest = items.slice(SHOW_TOP);
    const restValue = rest.reduce((s, i) => s + i.value, 0);
    display = [...head, { name: `Other (${rest.length})`, value: restValue, color: "#7d7d8c" }];
  }

  // Match the Rose chart's labeling style: simple radial leader lines, labels
  // anchored by direction (no fixed columns, no elbow, no overlap-resolution).
  const VB_W = 260, VB_H = 220;
  const CX = VB_W / 2, CY = VB_H / 2;
  const R_OUT = 45, R_IN = 28;

  let cum = 0;
  const segs = display.map(it => {
    const pct = (it.value / total) * 100;
    const startDeg = cum * 3.6 - 90;
    cum += pct;
    const endDeg = cum * 3.6 - 90;
    const large = pct > 50 ? 1 : 0;
    const x1 = CX + R_OUT * Math.cos(startDeg * Math.PI / 180);
    const y1 = CY + R_OUT * Math.sin(startDeg * Math.PI / 180);
    const x2 = CX + R_OUT * Math.cos(endDeg * Math.PI / 180);
    const y2 = CY + R_OUT * Math.sin(endDeg * Math.PI / 180);
    const x3 = CX + R_IN * Math.cos(endDeg * Math.PI / 180);
    const y3 = CY + R_IN * Math.sin(endDeg * Math.PI / 180);
    const x4 = CX + R_IN * Math.cos(startDeg * Math.PI / 180);
    const y4 = CY + R_IN * Math.sin(startDeg * Math.PI / 180);
    const path = `M ${x1} ${y1} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${R_IN} ${R_IN} 0 ${large} 0 ${x4} ${y4} Z`;
    return { path, color: it.color, name: it.name, value: it.value, pct, startDeg, endDeg };
  });

  const paths = segs.map(s => `<path d="${s.path}" fill="${s.color}"><title>${escapeHtml(s.name)}: ${fmtMoney(s.value)} (${s.pct.toFixed(1)}%)</title></path>`).join("");

  // Labels: same convention as the Rose chart.
  const labelR = R_OUT + 30;
  const labels = segs.filter(s => s.pct >= 2).map(s => {
    const midDeg = (s.startDeg + s.endDeg) / 2;
    const midRad = midDeg * Math.PI / 180;
    const cos = Math.cos(midRad), sin = Math.sin(midRad);
    const lx = CX + labelR * cos;
    const ly = CY + labelR * sin;
    const anchor = cos >= 0.05 ? "start" : (cos <= -0.05 ? "end" : "middle");
    const lineX = CX + (R_OUT + 1) * cos;
    const lineY = CY + (R_OUT + 1) * sin;
    const line = `<line x1="${lineX}" y1="${lineY}" x2="${lx}" y2="${ly}" stroke="var(--muted)" stroke-width="0.2" opacity="0.6"/>`;
    const labelTxt = `<text class="bcat-donut-label" x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle" fill="var(--text)" font-size="6" font-weight="600">${escapeHtml(shortLabel(s.name, 22))} ${s.pct.toFixed(0)}%</text>`;
    return `${line}${labelTxt}`;
  }).join("");

  el.innerHTML = `
    <svg viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" style="max-height:520px;width:100%">
      ${paths}
      ${labels}
    </svg>
  `;
}

function renderBcatColumns(el, items, total) {
  // Cap to top 12 columns so the chart doesn't get crushed; remainder rolls into "Other".
  const SHOW = 12;
  let display = items;
  if (items.length > SHOW) {
    const head = items.slice(0, SHOW);
    const rest = items.slice(SHOW);
    const restValue = rest.reduce((s, i) => s + i.value, 0);
    display = [...head, { name: `Other (${rest.length})`, value: restValue, color: "#7d7d8c" }];
  }

  const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  const W = 900, H = 480;
  // On mobile we rotate x-axis labels 45° so reserve much more bottom padding.
  const padL = 60, padR = 20, padT = 40, padB = isMobile ? 130 : 70;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const max = Math.max(...display.map(d => d.value), 1);
  const tickStep = pickAxisStep(max, 5);
  const yTop = Math.ceil(max / tickStep) * tickStep || tickStep;
  const yFor = v => padT + ((yTop - v) / yTop) * plotH;

  const slot = plotW / display.length;
  const barW = Math.min(slot * 0.7, 64);

  let grid = "", yLabels = "";
  for (let v = 0; v <= yTop + 0.0001; v += tickStep) {
    const y = yFor(v);
    grid    += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4 4"/>`;
    yLabels += `<text class="bcat-col-yaxis" x="${padL - 8}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="var(--muted)" font-size="11" font-variant-numeric="tabular-nums">${fmtCashAxis(v)}</text>`;
  }

  const bars = display.map((d, i) => {
    const cx = padL + slot * (i + 0.5);
    const x  = cx - barW / 2;
    const top = yFor(d.value);
    const h   = Math.max(0, yFor(0) - top);
    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
    const xLab = shortLabel(d.name, isMobile ? 28 : 18);
    const xLabelY = H - padB + 18;
    const xLabelText = isMobile
      ? `<text class="bcat-col-xaxis" x="${cx}" y="${xLabelY}" text-anchor="start" transform="rotate(45 ${cx} ${xLabelY})" fill="var(--muted)" font-size="10">${escapeHtml(xLab)}</text>`
      : `<text class="bcat-col-xaxis" x="${cx}" y="${xLabelY}" text-anchor="middle" fill="var(--muted)" font-size="10">${escapeHtml(xLab)}</text>`;
    return `
      <g>
        <rect x="${x}" y="${top}" width="${barW}" height="${h}" fill="${d.color}" rx="3"><title>${escapeHtml(d.name)}: ${fmtMoney(d.value)}</title></rect>
        <text class="bcat-col-pct" x="${cx}" y="${top - 6}" text-anchor="middle" fill="var(--muted)" font-size="11" font-weight="600">${pct}%</text>
        ${xLabelText}
      </g>
    `;
  }).join("");

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="max-height:520px">
      ${grid}
      ${yLabels}
      <line x1="${padL}" y1="${yFor(0)}" x2="${padL + plotW}" y2="${yFor(0)}" stroke="var(--border)" stroke-width="1"/>
      ${bars}
    </svg>
  `;
}

function renderBcatTreemap(el, items) {
  // Group long tail into "Other" — keeps the largest 12 cells visible.
  const SHOW = 12;
  let display = items;
  if (items.length > SHOW) {
    const head = items.slice(0, SHOW);
    const rest = items.slice(SHOW);
    const restValue = rest.reduce((s, i) => s + i.value, 0);
    display = [{ name: `Other (${rest.length})`, value: restValue, color: "#7d7d8c" }, ...head];
    display.sort((a, b) => b.value - a.value);
  }

  const treemapItems = display.map(d => ({ name: d.name, value: d.value, color: d.color }));
  const VB_W = 1000, VB_H = 540;
  const cells = binaryTreemap(treemapItems, { x: 0, y: 0, w: VB_W, h: VB_H });

  const svgCells = cells.map(c => {
    const pad = 2;
    const x = c.x + pad, y = c.y + pad;
    const w = Math.max(0, c.w - pad * 2), h = Math.max(0, c.h - pad * 2);
    const showLabel = w > 70 && h > 32;
    const showValue = w > 70 && h > 50;
    // Bump label size on mobile so the SVG-unit text reads clearly when the
    // 1000-wide viewBox is squeezed onto a phone screen.
    const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
    const labelFont = isMobile
      ? Math.max(16, Math.min(28, Math.sqrt(w * h) / 7))
      : Math.max(11, Math.min(20, Math.sqrt(w * h) / 9));
    const subFont   = Math.max(isMobile ? 13 : 10, labelFont - 4);
    const nameText = showLabel
      ? `<text x="${x + 10}" y="${y + 8 + labelFont}" fill="#fff" style="font-size:${labelFont}px;font-weight:700">${escapeHtml(shortLabel(c.item.name, Math.floor(w / (labelFont * 0.6))))}</text>`
      : "";
    const valText = showValue
      ? `<text x="${x + 10}" y="${y + 12 + labelFont + subFont}" fill="rgba(255,255,255,0.85)" style="font-size:${subFont}px">${fmtMoney(c.item.value)}</text>`
      : "";
    return `
      <g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c.item.color}" rx="4" ry="4">
          <title>${escapeHtml(c.item.name)}: ${fmtMoney(c.item.value)}</title>
        </rect>
        ${nameText}${valText}
      </g>
    `;
  }).join("");

  el.innerHTML = `<svg viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" style="max-height:520px;width:100%">${svgCells}</svg>`;
}

function renderBcatRose(el, items, total) {
  // Rose / Coxcomb: each category gets an equal-angle wedge, but radius is
  // scaled by the category's value (sqrt scale so visual area ≈ value).
  const SHOW = 12;
  let display = items;
  if (items.length > SHOW) {
    const head = items.slice(0, SHOW);
    const rest = items.slice(SHOW);
    const restValue = rest.reduce((s, i) => s + i.value, 0);
    display = [...head, { name: `Other (${rest.length})`, value: restValue, color: "#7d7d8c" }];
  }

  const VB_W = 260, VB_H = 220;
  const CX = VB_W / 2, CY = VB_H / 2;
  const R_INNER = 16, R_OUTER_MAX = 78;
  const max = Math.max(...display.map(d => d.value), 1);
  const angle = 360 / display.length;

  const wedges = display.map((d, i) => {
    const r = R_INNER + (Math.sqrt(d.value / max)) * (R_OUTER_MAX - R_INNER);
    const a0 = i * angle - 90;
    const a1 = a0 + angle - 1; // tiny gap between wedges
    const rad0 = a0 * Math.PI / 180;
    const rad1 = a1 * Math.PI / 180;
    const x1 = CX + R_INNER * Math.cos(rad0);
    const y1 = CY + R_INNER * Math.sin(rad0);
    const x2 = CX + r * Math.cos(rad0);
    const y2 = CY + r * Math.sin(rad0);
    const x3 = CX + r * Math.cos(rad1);
    const y3 = CY + r * Math.sin(rad1);
    const x4 = CX + R_INNER * Math.cos(rad1);
    const y4 = CY + R_INNER * Math.sin(rad1);
    const large = (a1 - a0) > 180 ? 1 : 0;
    const path = `M ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${large} 1 ${x3} ${y3} L ${x4} ${y4} A ${R_INNER} ${R_INNER} 0 ${large} 0 ${x1} ${y1} Z`;

    const midA = (a0 + a1) / 2;
    const midRad = midA * Math.PI / 180;
    const labelR = R_OUTER_MAX + 12;
    const lx = CX + labelR * Math.cos(midRad);
    const ly = CY + labelR * Math.sin(midRad);
    const pct = total > 0 ? (d.value / total) * 100 : 0;
    const anchor = Math.cos(midRad) >= 0.05 ? "start" : (Math.cos(midRad) <= -0.05 ? "end" : "middle");
    const labelTxt = `<text class="bcat-rose-label" x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle" fill="var(--text)" font-size="6" font-weight="600">${escapeHtml(shortLabel(d.name, 22))} ${pct.toFixed(0)}%</text>`;
    const lineX = CX + (r + 1) * Math.cos(midRad);
    const lineY = CY + (r + 1) * Math.sin(midRad);
    const line = `<line x1="${lineX}" y1="${lineY}" x2="${lx}" y2="${ly}" stroke="var(--muted)" stroke-width="0.2" opacity="0.6"/>`;
    return `${line}<path d="${path}" fill="${d.color}"><title>${escapeHtml(d.name)}: ${fmtMoney(d.value)} (${pct.toFixed(1)}%)</title></path>${labelTxt}`;
  }).join("");

  el.innerHTML = `<svg viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" style="max-height:520px;width:100%">${wedges}</svg>`;
}

function renderTreemap() {
  const chart  = document.getElementById("treemap-chart");
  const legend = document.getElementById("treemap-legend");
  const title  = document.getElementById("treemap-title");
  if (!chart || !legend) return;

  // Aggregate income by year or job across all transactions.
  // Income types only (expenses + savings excluded).
  const incomeTxs = state.transactions.filter(t =>
    t.type === "income" &&
    !NON_JOB_CATEGORIES.includes(t.category) &&
    !SAVINGS_CATEGORIES.includes(t.category)
  );

  const groups = new Map();
  incomeTxs.forEach(t => {
    let key;
    if (treemapMode === "year") {
      key = (t.date || "").slice(0, 4);
      if (!/^\d{4}$/.test(key)) return;
    } else {
      key = t.category || "Uncategorized";
    }
    groups.set(key, (groups.get(key) || 0) + t.amount);
  });

  const items = [...groups.entries()]
    .map(([name, value]) => ({ name, value }));
  // Stable color per name via DONUT_PALETTE; year mode uses hash-colored so
  // each year gets a distinct color while Job mode uses the donut palette in
  // JOB_ORDER-aware alphabetical order.
  if (treemapMode === "job") {
    items.sort((a, b) => {
      const ai = JOB_ORDER.indexOf(a.name);
      const bi = JOB_ORDER.indexOf(b.name);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  } else {
    items.sort((a, b) => b.name.localeCompare(a.name)); // newest first
  }
  items.forEach((it, idx) => {
    it.color = DONUT_PALETTE[idx % DONUT_PALETTE.length];
  });

  title.textContent = treemapMode === "year" ? "Income by Year" : "Income by Job";

  if (!items.length) {
    chart.innerHTML = `<div class="empty" style="padding:24px;text-align:center;color:var(--muted)">No income data yet.</div>`;
    legend.innerHTML = "";
    return;
  }

  // Render to a fixed internal viewBox so SVG scales with the container.
  const VB_W = 1000, VB_H = 600;
  const cells = binaryTreemap(items, { x: 0, y: 0, w: VB_W, h: VB_H });

  const svgCells = cells.map(c => {
    const pad = 2;
    const x = c.x + pad, y = c.y + pad;
    const w = Math.max(0, c.w - pad * 2), h = Math.max(0, c.h - pad * 2);
    const showLabel = w > 80 && h > 36;
    const showValue = w > 80 && h > 56;
    const labelFont = Math.max(14, Math.min(26, Math.sqrt(w * h) / 8));
    const subFont  = Math.max(12, labelFont - 4);
    const nameText = showLabel
      ? `<text class="treemap-cell-label" x="${x + 10}" y="${y + 8 + labelFont}" style="font-size:${labelFont}px">${escapeHtml(shortLabel(c.item.name, Math.floor(w / (labelFont * 0.58))))}</text>`
      : "";
    const valueText = showValue
      ? `<text class="treemap-cell-sub" x="${x + 10}" y="${y + 12 + labelFont + subFont}" style="font-size:${subFont}px">${fmtMoney(c.item.value)}</text>`
      : "";
    return `
      <g class="treemap-cell">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c.item.color}" rx="4" ry="4">
          <title>${escapeHtml(c.item.name)}: ${fmtMoney(c.item.value)}</title>
        </rect>
        ${nameText}${valueText}
      </g>
    `;
  }).join("");

  chart.innerHTML = `
    <svg viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="none">
      ${svgCells}
    </svg>
  `;

  // Legend — right-justified totals, sorted by value descending.
  const legendItems = items.slice().sort((a, b) => b.value - a.value);
  legend.innerHTML = legendItems.map(it => `
    <li>
      <span class="tm-swatch" style="background:${it.color}"></span>
      <span class="tm-name">${escapeHtml(it.name)}</span>
      <span class="tm-val">${fmtMoney(it.value)}</span>
    </li>
  `).join("");
}

function shortLabel(str, maxChars) {
  if (!str) return "";
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars - 1) + "…";
}

function niceStepFor(max) {
  // Produce a "nice" step size for the axis: 1, 2, 5, 10, 20, 50, 100, ...
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  let step;
  if (n <= 1) step = 0.25;
  else if (n <= 2) step = 0.5;
  else if (n <= 5) step = 1;
  else step = 2.5;
  return step * pow;
}

function renderFilters() {
  const catSel = document.getElementById("tx-filter-category");
  const yearSel = document.getElementById("tx-filter-year");
  if (!catSel || !yearSel) return;
  const curCat = catSel.value;
  const curYear = yearSel.value;
  catSel.innerHTML = `<option value="">All Categories</option>` + state.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  const years = Array.from(new Set(
    state.transactions
      .map(t => (t.date || "").slice(0, 4))
      .filter(y => /^\d{4}$/.test(y))
  )).sort((a, b) => b.localeCompare(a));
  yearSel.innerHTML = `<option value="">All Years</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
  catSel.value = curCat;
  yearSel.value = curYear;
}

let dashboardYearInitialized = false;
let dashboardIncomeMode = "full"; // "full" or "ytd"
// Windowed year view on the Total Income by Year chart (max 6 years at a time).
// offset = 0 shows the 6 most-recent years; higher values slide the window toward older years.
const INCOME_YEARS_WINDOW = 5;
let dashboardIncomeYearOffset = 0;

// Shared renderer used by both the Dashboard and Trends "Total Income by Year" charts.
// opts.svgId       — target SVG element id
// opts.ytd         — when true, sum each year's income only through today's month/day
// opts.titleNote   — extra text appended to chart tooltips (e.g., "YTD through Apr 18")
function renderIncomeByYearChart(years, opts = {}) {
  const svg = document.getElementById(opts.svgId || "dashboard-income-chart");
  if (!svg) return;

  // Newest year on the left, oldest on the right
  let yearAsc = [...years].sort((a, b) => b.localeCompare(a));

  // Apply the 6-year window + offset (only for the dashboard variant;
  // other callers leave opts.window undefined and see the full set).
  const windowSize = opts.window || 0;
  if (windowSize > 0 && yearAsc.length > windowSize) {
    const maxOffset = Math.max(0, yearAsc.length - windowSize);
    const offset = Math.min(Math.max(0, opts.offset || 0), maxOffset);
    yearAsc = yearAsc.slice(offset, offset + windowSize);
    if (opts.onWindowMeta) {
      opts.onWindowMeta({
        totalYears: years.length,
        currentOffset: offset,
        maxOffset,
      });
    }
  } else if (opts.onWindowMeta) {
    opts.onWindowMeta({
      totalYears: years.length,
      currentOffset: 0,
      maxOffset: 0,
    });
  }

  // YTD cutoff: today's month (0-11) and day
  const today = new Date();
  const cutoffMonth = today.getMonth();
  const cutoffDay = today.getDate();

  const inRangeForYear = (dateStr) => {
    if (!opts.ytd) return true;
    // dateStr is "YYYY-MM-DD"
    const m = parseInt(dateStr.slice(5, 7), 10) - 1; // 0-11
    const d = parseInt(dateStr.slice(8, 10), 10);
    if (m < cutoffMonth) return true;
    if (m === cutoffMonth && d <= cutoffDay) return true;
    return false;
  };

  const totals = yearAsc.map(y => {
    let inc = 0;
    state.transactions.forEach(t => {
      if (t.type !== "income") return;
      if (NON_JOB_CATEGORIES.includes(t.category)) return;
      if (!(t.date || "").startsWith(y)) return;
      if (!inRangeForYear(t.date)) return;
      inc += t.amount;
    });
    return { year: y, income: inc };
  });

  if (!totals.length) {
    svg.innerHTML = "";
    return;
  }

  const W = 900, H = 360;
  // Tightened padding so the plot area uses more of the SVG (chart looks
  // larger inside the same card). padL fits the 20px y-axis money labels.
  const padL = 90, padR = 10, padT = 10, padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Compute the current-year goal = average of the 3 previous years (based on calendar year).
  // In descending order, the "previous" years are the entries AFTER the current one.
  // Skipped in YTD mode — a YTD comparison to partial-year averages would be confusing.
  const currentYearStr = String(new Date().getFullYear());
  const currentIdx = totals.findIndex(d => d.year === currentYearStr);
  let goal = 0;
  if (!opts.ytd && currentIdx !== -1 && currentIdx < totals.length - 1) {
    const prev = totals.slice(currentIdx + 1, currentIdx + 4);
    if (prev.length > 0) {
      goal = prev.reduce((s, d) => s + d.income, 0) / prev.length;
    }
  }

  const maxVal = Math.max(1, ...totals.map(d => d.income), goal);
  const niceStep = niceStepFor(maxVal);
  const yMax = Math.ceil(maxVal / niceStep) * niceStep || niceStep;

  const n = totals.length;
  const groupSlot = plotW / n;
  const barW = Math.min(80, groupSlot * 0.6);
  const yFor = v => padT + ((yMax - v) / yMax) * plotH;

  const gridLines = [];
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const v = (yMax / ticks) * i;
    const y = yFor(v);
    gridLines.push(`<line class="trend-grid-line" x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}"></line>`);
    gridLines.push(`<text class="trend-axis-label" x="${padL - 6}" y="${y + 4}" style="text-anchor:end;font-size:20px;fill:var(--muted)">${fmtMoneyCompact(v)}</text>`);
  }

  const bars = totals.map((d, i) => {
    const cx = padL + groupSlot * (i + 0.5);
    const x = cx - barW / 2;
    const y = yFor(d.income);
    const h = Math.max(1, yFor(0) - y);

    // Year-over-year % change vs the previous (calendar-wise earlier) year.
    // In descending-by-year order that earlier year is at index i + 1.
    let deltaSvg = "";
    if (i < totals.length - 1) {
      const prev = totals[i + 1].income;
      if (prev > 0) {
        const pct = ((d.income - prev) / prev) * 100;
        const up = pct >= 0;
        const color = up ? "var(--income)" : "var(--expense)";
        const label = `${up ? "+" : ""}${pct.toFixed(1)}%`;
        deltaSvg = `<text x="${cx}" y="${y - 38}" style="text-anchor:middle;fill:${color};font-size:22px;font-weight:700">${escapeHtml(label)}</text>`;
      } else if (d.income > 0) {
        deltaSvg = `<text x="${cx}" y="${y - 38}" style="text-anchor:middle;fill:var(--income);font-size:22px;font-weight:700">new</text>`;
      }
    }

    // Goal overlay — only for the current calendar year if we have a valid goal
    let goalSvg = "";
    if (i === currentIdx && goal > 0) {
      const yGoal = yFor(goal);
      goalSvg = `
        <line x1="${x - 4}" y1="${yGoal}" x2="${x + barW + 4}" y2="${yGoal}"
          stroke="var(--accent)" stroke-width="2">
          <title>Goal (avg of previous 3 years): ${fmtMoney(goal)}</title>
        </line>
        <text x="${cx}" y="${yGoal - 36}" style="text-anchor:middle;fill:var(--accent);font-size:22px;font-weight:700">Goal</text>
        <text x="${cx}" y="${yGoal - 10}" style="text-anchor:middle;fill:var(--accent);font-size:22px;font-weight:700">${fmtMoney(goal)}</text>
      `;
    }

    return `
      ${goalSvg}
      <rect class="trend-bar" x="${x}" y="${y}" width="${barW}" height="${h}" fill="var(--income)" rx="3">
        <title>${escapeHtml(d.year)}: ${fmtMoney(d.income)}</title>
      </rect>
      ${deltaSvg}
      <text class="trend-value" x="${cx}" y="${y - 12}" style="text-anchor:middle;fill:var(--income);font-size:22px;font-weight:700">${fmtMoney(d.income)}</text>
      <text class="trend-year-label" x="${cx}" y="${H - padB + 22}" style="text-anchor:middle;font-size:22px;font-weight:600">${escapeHtml(d.year)}</text>
    `;
  }).join("");

  svg.innerHTML = `
    ${gridLines.join("")}
    <line class="trend-axis-line" x1="${padL}" y1="${yFor(0)}" x2="${padL + plotW}" y2="${yFor(0)}"></line>
    ${bars}
  `;
}

function renderDashboardJobsDonut(yearFilter) {
  // Match the Trends "jobsOnly" order so DONUT_PALETTE indices line up with Trends colors.
  // A category counts as a "job" if it has any income — either lifetime
  // net-positive (the historical heuristic) OR any income in the
  // currently-selected year. The year-aware test catches legacy categories
  // whose lifetime net is negative but whose income still belongs on the chart.
  const jobsOnly = state.categories.filter(c => {
    if (SAVINGS_CATEGORIES.includes(c)) return false;
    if (NON_JOB_CATEGORIES.includes(c)) return false;
    let net = 0;
    let yearIncome = 0;
    state.transactions.forEach(t => {
      if (t.category !== c) return;
      net += (t.type === "income" ? 1 : -1) * t.amount;
      if (yearFilter && t.type === "income" && (t.date || "").startsWith(yearFilter)) {
        yearIncome += t.amount;
      }
    });
    return net > 0 || yearIncome > 0;
  }).sort((a, b) => {
    const ai = JOB_ORDER.indexOf(a);
    const bi = JOB_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const items = jobsOnly.map((job, idx) => {
    let inc = 0;
    state.transactions.forEach(t => {
      if (t.category !== job) return;
      if (t.type !== "income") return;
      if (yearFilter && !(t.date || "").startsWith(yearFilter)) return;
      inc += t.amount;
    });
    // Keep the Trends palette mapping tied to the stable jobsOnly order (idx),
    // so the color for a job stays consistent regardless of current-year ranking.
    return { label: job, value: inc, color: DONUT_PALETTE[idx % DONUT_PALETTE.length] };
  }).filter(i => i.value > 0)
    .sort((a, b) => b.value - a.value); // greatest income first

  renderDonut("dashboard-jobs-donut", items, "Income");

  const legend = document.getElementById("dashboard-jobs-legend");
  if (legend) {
    const total = items.reduce((s, i) => s + i.value, 0);
    legend.innerHTML = items.map(i => {
      const pct = total > 0 ? (i.value / total) * 100 : 0;
      return `<li>
        <span class="swatch" style="background:${i.color}"></span>
        <span class="name">${escapeHtml(i.label)}</span>
        <span class="val"><span class="pct-part">${pct.toFixed(1)}%</span><span class="money-part"> · ${fmtMoneyCompact(i.value)}</span></span>
      </li>`;
    }).join("");
  }
}

function fmtMoneyCompact(v) {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

function renderDashboard() {
  // Populate year dropdown + pills from transaction dates
  const yearSel = document.getElementById("dashboard-year");
  let currentYear = yearSel.value;
  const years = Array.from(new Set(
    state.transactions
      .map(t => (t.date || "").slice(0, 4))
      .filter(y => /^\d{4}$/.test(y))
  )).sort((a, b) => b.localeCompare(a));

  // On first render after app load, honor the user's Startup preference:
  //   startupDashboardYear = "all"     → blank (All Years)
  //   startupDashboardYear = "current" → current calendar year if it has data
  if (!dashboardYearInitialized) {
    dashboardYearInitialized = true;
    if (state.startupDashboardYear === "all") {
      currentYear = "";
    } else {
      const thisYear = String(new Date().getFullYear());
      currentYear = years.includes(thisYear) ? thisYear : "";
    }
  }

  yearSel.innerHTML = `<option value="">All Years</option>` +
    years.map(y => `<option value="${y}">${y}</option>`).join("");
  yearSel.value = currentYear;

  renderYearPills("dashboard-year-pills", yearSel, years, renderDashboard);

  renderIncomeByYearChart(years, {
    ytd: dashboardIncomeMode === "ytd",
    window: INCOME_YEARS_WINDOW,
    offset: dashboardIncomeYearOffset,
    onWindowMeta: meta => {
      const prevBtn = document.getElementById("income-year-prev");
      const nextBtn = document.getElementById("income-year-next");
      // Prev (left) moves toward newer years → disabled at newest (offset 0)
      // Next (right) moves toward older years → disabled at oldest (offset max)
      if (prevBtn) prevBtn.disabled = meta.currentOffset <= 0;
      if (nextBtn) nextBtn.disabled = meta.currentOffset >= meta.maxOffset;
      // Clamp the stored offset in case data changed
      if (dashboardIncomeYearOffset !== meta.currentOffset) {
        dashboardIncomeYearOffset = meta.currentOffset;
      }
    }
  });

  const yearFilter = yearSel.value;
  renderDashboardJobsDonut(yearFilter);
  const txs = yearFilter
    ? state.transactions.filter(t => (t.date || "").startsWith(yearFilter))
    : state.transactions;

  let inc = 0, exp = 0;
  let savIn = 0, savOut = 0;
  txs.forEach(t => {
    // Roll Over / Correction-style categories are carry-forward entries, not real income/expense
    if (NON_JOB_CATEGORIES.includes(t.category)) return;
    const isSavings = SAVINGS_CATEGORIES.includes(t.category);
    if (t.type === "income") {
      inc += t.amount;
      if (isSavings) savIn += t.amount;
    } else {
      exp += t.amount;
      if (isSavings) savOut += t.amount;
    }
  });

  const savingsNet = savOut - savIn;
  const expNonSavings = exp - savOut + savIn; // strip savings flows out of expenses display

  document.getElementById("sum-income").textContent = fmtMoney(inc);
  document.getElementById("sum-expense").textContent = fmtMoney(expNonSavings);
  document.getElementById("sum-savings").textContent = fmtMoney(savingsNet);

  // Savings goal progress — vertical thermometer-style bar (read-only on dashboard)
  const goal = state.savingsGoal || 0;
  const targetEl = document.getElementById("savings-vbar-target");
  if (targetEl) targetEl.textContent = `of ${fmtMoney(goal)}`;
  const currentEl = document.getElementById("savings-vbar-current");
  const fillEl = document.getElementById("savings-vbar-fill");
  const pctEl = document.getElementById("savings-vbar-pct");
  const remainEl = document.getElementById("savings-vbar-remaining");
  if (currentEl && fillEl && pctEl && remainEl) {
    const progress = goal > 0 ? Math.max(0, savingsNet) / goal : 0;
    const pct = Math.min(100, progress * 100);
    const met = savingsNet >= goal && goal > 0;
    currentEl.textContent = fmtMoney(savingsNet);
    // Use a CSS custom property so the same value can drive vertical (desktop)
    // or horizontal (mobile) fill via media-query rules.
    fillEl.style.setProperty("--fill-pct", pct.toFixed(1) + "%");
    fillEl.classList.toggle("met", met);
    pctEl.textContent = pct.toFixed(1) + "%";
    if (met) {
      const over = savingsNet - goal;
      remainEl.textContent = `Goal met • ${fmtMoney(over)} over`;
    } else {
      remainEl.textContent = `${fmtMoney(Math.max(0, goal - savingsNet))} to go`;
    }
  }
  const net = inc - exp;
  const netEl = document.getElementById("sum-net");
  netEl.textContent = fmtMoney(net);
  netEl.style.color = net >= 0 ? "var(--income)" : "var(--expense)";
  document.getElementById("sum-count").textContent = txs.length;

  // Open / Complete jobs for the selected year (or all years if no filter)
  const jobsForYear = (state.jobs || []).filter(j =>
    !yearFilter || (j.date || "").startsWith(yearFilter)
  );
  const isPaid = (j) => (j.status || (j.complete ? "Paid" : "")) === "Paid";
  const openCount     = jobsForYear.filter(j => !isPaid(j)).length;
  const completeCount = jobsForYear.filter(j =>  isPaid(j)).length;
  const openEl     = document.getElementById("sum-open-jobs");
  const completeEl = document.getElementById("sum-complete-jobs");
  if (openEl)     openEl.textContent     = openCount;
  if (completeEl) completeEl.textContent = completeCount;

  // Year-over-year cards — only meaningful when a specific year is selected.
  const yoyCards = document.getElementById("yoy-cards");
  if (yoyCards) {
    if (!yearFilter) { yoyCards.hidden = true; }
    else {
      const yyyy = parseInt(yearFilter, 10);
      const prev = String(yyyy - 1);
      const today = new Date();
      const isCurrentYear = (yyyy === today.getFullYear());
      // For the current year, compare YTD vs same-period last year.
      const cutoffMMDD = isCurrentYear ? today.toISOString().slice(5, 10) : "12-31";
      const inWindow = (t, year) => {
        const d = (t.date || "");
        if (!d.startsWith(year)) return false;
        return d.slice(5, 10) <= cutoffMMDD;
      };
      let curInc = 0, curExp = 0, prevInc = 0, prevExp = 0;
      state.transactions.forEach(t => {
        if (NON_JOB_CATEGORIES.includes(t.category)) return;
        const isSav = SAVINGS_CATEGORIES.includes(t.category);
        if (isSav) return; // skip savings transfers — they're not income or expense for YoY purposes
        if (inWindow(t, yearFilter)) {
          if (t.type === "income") curInc += t.amount; else curExp += t.amount;
        } else if (inWindow(t, prev)) {
          if (t.type === "income") prevInc += t.amount; else prevExp += t.amount;
        }
      });
      const fmtDelta = (cur, prv) => {
        if (prv === 0) return cur === 0 ? "—" : "+∞%";
        const pct = ((cur - prv) / Math.abs(prv)) * 100;
        const sign = pct >= 0 ? "+" : "";
        return `${sign}${pct.toFixed(1)}%`;
      };
      const colorFor = (cur, prv, goodIsUp) => {
        if (prv === 0 && cur === 0) return "var(--muted)";
        const up = cur >= prv;
        const good = goodIsUp ? up : !up;
        return good ? "var(--income)" : "var(--expense)";
      };
      const set = (id, txt, color) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = txt;
        if (color) el.style.color = color;
      };
      yoyCards.hidden = false;
      yoyCards.querySelectorAll(".yoy-prev-label").forEach(s => { s.textContent = isCurrentYear ? `${prev} YTD` : `${prev}`; });
      set("yoy-income",      fmtDelta(curInc, prevInc),                                colorFor(curInc, prevInc, true));
      set("yoy-income-prev", `${fmtMoney(curInc)} vs ${fmtMoney(prevInc)}`, "");
      set("yoy-expense",     fmtDelta(curExp, prevExp),                                colorFor(curExp, prevExp, false));
      set("yoy-expense-prev",`${fmtMoney(curExp)} vs ${fmtMoney(prevExp)}`, "");
      const curNet = curInc - curExp, prevNet = prevInc - prevExp;
      set("yoy-net",         fmtDelta(curNet, prevNet),                                colorFor(curNet, prevNet, true));
      set("yoy-net-prev",    `${fmtMoney(curNet)} vs ${fmtMoney(prevNet)}`, "");
    }
  }

  // By category — skip Roll Over / Correction entries
  const byCat = {};
  state.categories.forEach(c => {
    if (NON_JOB_CATEGORIES.includes(c)) return;
    byCat[c] = { income: 0, expense: 0, count: 0 };
  });
  txs.forEach(t => {
    if (NON_JOB_CATEGORIES.includes(t.category)) return;
    if (!byCat[t.category]) byCat[t.category] = { income: 0, expense: 0, count: 0 };
    byCat[t.category][t.type] += t.amount;
    byCat[t.category].count++;
  });

  // Split categories into "By Job" (net >= 0) and "By Expense" (net < 0)
  const rowHtml = (cat, s) => {
    const n = s.income - s.expense;
    return `<tr class="dash-drill-row" data-cat="${escapeHtml(cat)}">
      <td>${escapeHtml(cat)}</td>
      <td class="amount income">${fmtMoney(s.income)}</td>
      <td class="amount expense">${fmtMoney(s.expense)}</td>
      <td class="amount" style="color:${n >= 0 ? "var(--income)" : "var(--expense)"}">${fmtMoney(n)}</td>
      <td>${s.count}</td>
    </tr>`;
  };
  // Expense table shows Expense before Income (col order matches its header)
  const expenseRowHtml = (cat, s) => {
    const n = s.income - s.expense;
    return `<tr class="dash-drill-row" data-cat="${escapeHtml(cat)}">
      <td>${escapeHtml(cat)}</td>
      <td class="amount expense">${fmtMoney(s.expense)}</td>
      <td class="amount income">${fmtMoney(s.income)}</td>
      <td class="amount" style="color:${n >= 0 ? "var(--income)" : "var(--expense)"}">${fmtMoney(n)}</td>
      <td>${s.count}</td>
    </tr>`;
  };

  const entries = Object.entries(byCat).filter(([, s]) => (s.income - s.expense) !== 0);
  const jobEntries = entries
    .filter(([c, s]) => s.income > 0 && !SAVINGS_CATEGORIES.includes(c))
    .sort((a, b) => (b[1].income - b[1].expense) - (a[1].income - a[1].expense));
  const expenseEntries = entries
    .filter(([c, s]) => SAVINGS_CATEGORIES.includes(c) || (s.income === 0 && s.expense > 0))
    .sort((a, b) => (b[1].income - b[1].expense) - (a[1].income - a[1].expense));

  const catBody = document.querySelector("#job-summary-table tbody");
  catBody.innerHTML = jobEntries.map(([c, s]) => rowHtml(c, s)).join("")
    || `<tr><td colspan="5" class="empty">No jobs with positive net yet.</td></tr>`;

  const expBody = document.querySelector("#expense-summary-table tbody");
  if (expBody) {
    expBody.innerHTML = expenseEntries.map(([c, s]) => expenseRowHtml(c, s)).join("")
      || `<tr><td colspan="5" class="empty">No expense-only categories yet.</td></tr>`;
  }

  // By account — skip Roll Over / Correction entries
  const byAcct = {};
  state.accounts.forEach(a => byAcct[a] = { income: 0, expense: 0 });
  txs.forEach(t => {
    if (NON_JOB_CATEGORIES.includes(t.category)) return;
    if (!byAcct[t.account]) byAcct[t.account] = { income: 0, expense: 0 };
    byAcct[t.account][t.type] += t.amount;
  });

  const acctBody = document.querySelector("#account-summary-table tbody");
  acctBody.innerHTML = Object.entries(byAcct)
    .map(([a, s]) => {
      const bal = s.income - s.expense;
      return `<tr>
        <td>${escapeHtml(a)}</td>
        <td class="amount income">${fmtMoney(s.income)}</td>
        <td class="amount expense">${fmtMoney(s.expense)}</td>
        <td class="amount" style="color:${bal >= 0 ? "var(--income)" : "var(--expense)"}">${fmtMoney(bal)}</td>
        <td></td>
      </tr>`;
    }).join("") || `<tr><td colspan="5" class="empty">No accounts configured</td></tr>`;

  // Drill-through from Overview tables: long-press on mobile (or click on
  // desktop) opens the matching category's transactions with a Back arrow.
  wireDashboardDrillThrough();
}

function navigateToTxFromDashboard(category) {
  const yearFromDashboard = document.getElementById("dashboard-year")?.value || "";
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="transactions"]')?.classList.add("active");
  syncTabActive("transactions");
  document.getElementById("transactions").classList.add("active");
  const searchAll = document.getElementById("tx-search-all");
  if (searchAll) searchAll.value = "";
  document.getElementById("tx-filter-type").value = "";
  document.getElementById("tx-filter-category").value = category;
  document.getElementById("tx-filter-year").value = yearFromDashboard;
  // Remember where we came from so the Back arrow returns to Dashboard
  window.__txBackTo = "dashboard";
  const backBtn = document.getElementById("btn-tx-back");
  if (backBtn) backBtn.hidden = false;
  renderTransactions();
}

function wireDashboardDrillThrough() {
  const rows = document.querySelectorAll(
    "#job-summary-table tbody tr.dash-drill-row, " +
    "#expense-summary-table tbody tr.dash-drill-row"
  );
  rows.forEach(row => {
    const cat = row.dataset.cat;
    if (!cat) return;
    row.classList.add("drillable");

    // Desktop: single click drills through
    row.addEventListener("click", e => {
      if (e.pointerType === "touch") return; // mobile handled via long-press below
      navigateToTxFromDashboard(cat);
    });

    // Mobile: long-press (500 ms) to open
    let pressTimer = null;
    let suppressClick = false;
    const startX = { x: 0, y: 0 };
    const startPress = e => {
      const touch = e.touches ? e.touches[0] : e;
      startX.x = touch.clientX;
      startX.y = touch.clientY;
      suppressClick = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        suppressClick = true;
        row.classList.add("drill-active");
        if (navigator.vibrate) { try { navigator.vibrate(15); } catch {} }
        navigateToTxFromDashboard(cat);
      }, 500);
    };
    const cancelPress = () => {
      clearTimeout(pressTimer);
      pressTimer = null;
      row.classList.remove("drill-active");
    };
    const moveCheck = e => {
      const touch = e.touches ? e.touches[0] : e;
      if (Math.abs(touch.clientX - startX.x) > 10 || Math.abs(touch.clientY - startX.y) > 10) {
        cancelPress();
      }
    };
    row.addEventListener("touchstart", startPress, { passive: true });
    row.addEventListener("touchend",   cancelPress);
    row.addEventListener("touchcancel", cancelPress);
    row.addEventListener("touchmove",  moveCheck, { passive: true });
  });
}

function renderTransactions() {
  const qAll = (document.getElementById("tx-search-all")?.value || "").toLowerCase().trim();
  const fYear = document.getElementById("tx-filter-year").value;
  const fCat = document.getElementById("tx-filter-category").value;
  const fType = document.getElementById("tx-filter-type").value;
  const fJobNo = document.getElementById("tx-filter-jobno")?.value || "";
  if (typeof refreshTxSortJobNoVisibility === "function") refreshTxSortJobNoVisibility();
  if (typeof refreshTxFilterJobNoButtonLabel === "function") refreshTxFilterJobNoButtonLabel();
  if (typeof refreshTxFilterCategoryButtonLabel === "function") refreshTxFilterCategoryButtonLabel();

  // Populate the Job No. filter options each render so it stays in sync with
  // jobs that exist in state.jobs (newest first). Includes a synthetic
  // "Only Job Numbers" option that shows every transaction with a jobNo set.
  const jobNoSel = document.getElementById("tx-filter-jobno");
  if (jobNoSel) {
    const cur = jobNoSel.value;
    const jobs = (state.jobs || []).slice().sort((a, b) => (b.jobNo || "").localeCompare(a.jobNo || ""));
    jobNoSel.innerHTML =
      `<option value="">All Jobs</option>` +
      `<option value="__any__">Only Jobs</option>` +
      `<option value="__none__">No Job</option>` +
      jobs.map(j => {
        const lbl = `${j.jobNo} - ${j.customer || ""}${j.category ? " / " + j.category : ""}`;
        return `<option value="${escapeHtml(j.jobNo)}">${escapeHtml(lbl)}</option>`;
      }).join("");
    if (cur === "__any__" || cur === "__none__" || jobs.some(j => j.jobNo === cur)) jobNoSel.value = cur;
  }

  const list = state.transactions
    .filter(t => {
      if (__txDrillFilter && !__txDrillFilter(t)) return false;
      if (fYear && !(t.date || "").startsWith(fYear)) return false;
      if (fCat && t.category !== fCat) return false;
      if (fType && t.type !== fType) return false;
      if (fJobNo === "__any__") {
        if (!t.jobNo) return false;
      } else if (fJobNo === "__none__") {
        if (t.jobNo) return false;
      } else if (fJobNo && (t.jobNo || "") !== fJobNo) return false;
      // Refresh the Sort: Job No. toggle visibility on every render.
      // (Cheap idempotent UI tweak — safe to run inside the filter callback.)
      // Chart of Accounts multi-select (null = no filter, empty Set = match nothing)
      if (txFilterCharts) {
        if (!txFilterCharts.size) return false;
        if (!txFilterCharts.has((t.chartAccount || "").trim())) return false;
      }
      if (qAll) {
        const reconLabel = t.reconciled === "R" ? "reconciled" : t.reconciled === "C" ? "cleared" : "uncleared";
        const hay = [
          t.date,
          fmtDate(t.date || ""),
          t.payee, t.memo, t.vendor, t.customer, t.category, t.account,
          t.chartAccount,
          t.jobNo,
          t.expenseIncome,
          (t.tags || []).join(" "),
          String(t.amount),
          t.type,
          reconLabel,
          t.hours != null ? String(t.hours) : ""
        ].map(x => (x || "").toLowerCase()).join(" ");
        if (!hay.includes(qAll)) return false;
      }
      if (hideReconciled && t.reconciled === "R") return false;
      return true;
    })
    .sort((a, b) => {
      if (txSortByJobNo) {
        const ja = (a.jobNo || "").trim();
        const jb = (b.jobNo || "").trim();
        const cmp = ja.localeCompare(jb);
        if (cmp !== 0) return cmp;
        // Same job → newest first
      }
      return b.date.localeCompare(a.date);
    });

  // Running balance — respects current filters
  let rbIn = 0, rbOut = 0;
  list.forEach(t => {
    if (t.type === "income") rbIn += t.amount;
    else rbOut += t.amount;
  });
  const rbBal = rbIn - rbOut;
  const balEl = document.getElementById("rb-balance");
  balEl.textContent = fmtMoney(rbBal);
  balEl.style.color = rbBal >= 0 ? "var(--income)" : "var(--expense)";

  // Toggle the select-mode class on the table — controls visibility of the checkbox column
  document.getElementById("tx-table").classList.toggle("select-mode", txSelectMode);

  // Prune selected IDs that are no longer in the filtered list
  const visibleIds = new Set(list.map(t => t.id));
  [...txSelectedIds].forEach(id => { if (!visibleIds.has(id)) txSelectedIds.delete(id); });

  // Selection summary
  const selEl = document.getElementById("rb-selection");
  if (txSelectMode && txSelectedIds.size > 0) {
    let selTotal = 0;
    state.transactions.forEach(t => {
      if (!txSelectedIds.has(t.id)) return;
      selTotal += (t.type === "income" ? 1 : -1) * t.amount;
    });
    document.getElementById("rb-sel-count").textContent = txSelectedIds.size;
    const selTotalEl = document.getElementById("rb-sel-total");
    selTotalEl.textContent = fmtMoney(selTotal);
    selTotalEl.style.color = selTotal >= 0 ? "var(--income)" : "var(--expense)";
    selEl.hidden = false;
  } else {
    selEl.hidden = true;
    // Reset displayed values so a stale total never lingers if the panel ever
    // becomes visible again before the next selection re-renders it.
    document.getElementById("rb-sel-count").textContent = "0";
    const selTotalEl = document.getElementById("rb-sel-total");
    if (selTotalEl) {
      selTotalEl.textContent = fmtMoney(0);
      selTotalEl.style.color = "";
    }
  }

  const body = document.querySelector("#tx-table tbody");

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="13" class="empty">No transactions found. Click "New Transaction" to get started.</td></tr>`;
    return;
  }

  // Build txId -> customer (Bill To first line) map from invoice links
  const txCustomerMap = new Map();
  (state.invoices || []).forEach(inv => {
    const name = (inv.billTo || "").split("\n")[0].trim();
    if (!name) return;
    (inv.linkedTransactionIds || []).forEach(txId => {
      if (!txCustomerMap.has(txId)) txCustomerMap.set(txId, name);
    });
  });

  // Build set of jobNos that have at least one invoice — used to show a
  // small invoice icon next to the JobNo on income rows that fall under a
  // billed job (the matching logic mirrors renderInvoiceLinkedTransactions).
  const invoicedJobNos = new Set();
  (state.invoices || []).forEach(inv => {
    const jn = (inv.jobNo || "").trim()
      || (inv.number || "").trim().replace(/-\d+$/, "");
    if (jn) invoicedJobNos.add(jn);
  });

  // Per-job color map for the optional "Color rows by Job No." setting.
  // Sorted unique jobNos so the color ↔ jobNo mapping is stable across renders.
  const txJobColorMap = new Map();
  if (state.txJobColorRows) {
    const uniqueJobs = Array.from(new Set(
      list.map(t => (t.jobNo || "").trim()).filter(Boolean)
    )).sort();
    uniqueJobs.forEach((jn, i) => {
      txJobColorMap.set(jn, DONUT_PALETTE[i % DONUT_PALETTE.length]);
    });
  }
  // Convert a hex like "#4a8fe0" → "rgba(74, 143, 224, 0.18)" so the row tint
  // is subtle and text remains readable on top.
  function hexToRowTint(hex) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r}, ${g}, ${b}, 0.42)`;
  }

  body.innerHTML = list.map(t => {
    const rState = t.reconciled || "";
    const rClass = rState === "C" ? "cleared" : rState === "R" ? "reconciled" : "";
    const rTitle = rState === "C" ? "Cleared (click to mark Reconciled)" : rState === "R" ? "Reconciled (click to clear)" : "Uncleared (click to mark Cleared)";
    const checkboxCell = `<td class="tx-select-col"><input type="checkbox" class="tx-select-box" ${txSelectedIds.has(t.id) ? "checked" : ""} /></td>`;
    const isNonJob = NON_JOB_CATEGORIES.includes(t.category);
    const expincMatchesCat = !!(t.expenseIncome && t.category &&
      t.expenseIncome.trim().toLowerCase() === t.category.trim().toLowerCase());
    const isSalesChart = !!(t.chartAccount && /(^|:)\s*sales\s*$/i.test(t.chartAccount));
    const rowCls = "tx-row" +
      (isNonJob ? " nonjob" : "") +
      (expincMatchesCat ? " expinc-cat-match" : "") +
      (isSalesChart ? " chart-sales" : "");
    const tintColor = (t.jobNo && txJobColorMap.get(t.jobNo)) || "";
    const rowStyle = tintColor ? ` style="--row-tint: ${hexToRowTint(tintColor)}"` : "";
    return `
    <tr data-id="${t.id}" class="${rowCls}"${rowStyle}>
      ${checkboxCell}
      <td data-col="date">${fmtDate(t.date)}</td>
      <td data-col="vendor">${t.vendor ? escapeHtml(t.vendor) : "&nbsp;"}</td>
      <td data-col="jobno">${escapeHtml(t.jobNo || "")}${
        t.jobNo && t.type === "income" && invoicedJobNos.has(t.jobNo)
          ? ` <span class="tx-invoice-icon" title="Linked to invoice for ${escapeHtml(t.jobNo)}" aria-label="Invoiced"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg></span>`
          : ""
      }</td>
      <td data-col="customer">${escapeHtml(t.customer || txCustomerMap.get(t.id) || "")}</td>
      <td data-col="payee">${escapeHtml(t.payee)}</td>
      <td data-col="category">${escapeHtml(t.category)}</td>
      <td data-col="expinc">${escapeHtml(t.expenseIncome || "")}</td>
      <td data-col="chart">${escapeHtml(t.chartAccount || "")}</td>
      <td data-col="amount" class="amount ${t.type}">${t.type === "expense" ? "-" : ""}${fmtMoney(t.amount)}</td>
      <td data-col="memo">${escapeHtml(t.memo || "")}</td>
      <td data-col="recon" class="recon-cell" title="${rTitle}">
        <span class="recon-lock ${rClass}">
          ${rState === "R"
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`
          }
        </span>
      </td>
      <td data-col="tags" class="tag-cell">
        <span class="tag-icon ${(t.tags || []).length ? "has-tags" : ""}" title="${(t.tags || []).length ? escapeHtml((t.tags || []).join(", ")) : "No tags"}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>
        </span>
      </td>
    </tr>
  `;
  }).join("");

  // Update the visible-ids list (in displayed order) for range selection
  txVisibleIds = list.map(t => t.id);

  const applyTxToggle = (id, setTo) => {
    if (setTo === undefined) {
      if (txSelectedIds.has(id)) txSelectedIds.delete(id);
      else txSelectedIds.add(id);
    } else if (setTo) {
      txSelectedIds.add(id);
    } else {
      txSelectedIds.delete(id);
    }
  };

  const handleTxCheckboxClick = (id, shift) => {
    if (shift && txLastClickedId && txLastClickedId !== id) {
      const a = txVisibleIds.indexOf(txLastClickedId);
      const b = txVisibleIds.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        // Range takes the target state of the anchor row: if the clicked row ends up checked,
        // the entire range is checked; if it ends up unchecked, the range is unchecked.
        const targetChecked = !txSelectedIds.has(id);
        for (let i = lo; i <= hi; i++) {
          applyTxToggle(txVisibleIds[i], targetChecked);
        }
        txLastClickedId = id;
        renderTransactions();
        return;
      }
    }
    applyTxToggle(id);
    txLastClickedId = id;
    renderTransactions();
  };

  // Wire up checkbox handlers (cells always exist but are hidden via CSS when not in select mode)
  body.querySelectorAll(".tx-select-box").forEach(cb => {
    cb.addEventListener("click", e => {
      e.stopPropagation();
      const id = cb.closest("tr").dataset.id;
      handleTxCheckboxClick(id, e.shiftKey);
    });
    cb.addEventListener("dblclick", e => e.stopPropagation());
  });
  if (txSelectMode) {
    const master = document.getElementById("tx-select-all");
    const allChecked = list.length > 0 && list.every(t => txSelectedIds.has(t.id));
    master.checked = allChecked;
    master.indeterminate = !allChecked && list.some(t => txSelectedIds.has(t.id));
    master.onchange = () => {
      if (master.checked) list.forEach(t => txSelectedIds.add(t.id));
      else list.forEach(t => txSelectedIds.delete(t.id));
      txLastClickedId = null;
      renderTransactions();
    };
  }

  body.querySelectorAll(".tx-row").forEach(row => {
    let holdTimer = null;
    let didHold = false;

    row.addEventListener("dblclick", e => {
      // Ignore double-clicks on the reconciliation circle (it has its own click)
      if (e.target.closest(".recon-circle")) return;
      const id = row.dataset.id;
      const tx = state.transactions.find(t => t.id === id);
      if (tx) openTxModal(tx);
    });

    row.addEventListener("mousedown", e => {
      if (e.button !== 0) return;
      if (e.target.closest(".recon-circle")) return;
      didHold = false;
      row.classList.add("pressing");
      holdTimer = setTimeout(() => {
        holdTimer = null;
        didHold = true;
        row.classList.remove("pressing");
        const id = row.dataset.id;
        const tx = state.transactions.find(t => t.id === id);
        if (!tx) return;
        const dupe = {
          ...tx,
          tags: [...(tx.tags || [])],
          id: "",
          date: new Date().toISOString().slice(0, 10),
          reconciled: ""
        };
        openTxModal(dupe);
      }, 600);
    });

    const cancelHold = () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      row.classList.remove("pressing");
    };
    row.addEventListener("mouseup", cancelHold);
    row.addEventListener("mouseleave", cancelHold);

    // Prevent accidental clicks after a hold-triggered duplicate
    row.addEventListener("click", e => {
      if (didHold) { e.stopPropagation(); didHold = false; }
    });
  });

  body.querySelectorAll(".recon-circle").forEach(c => c.addEventListener("click", e => {
    const id = e.target.closest("tr").dataset.id;
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;
    if (typeof isLockedDate === "function" && isLockedDate(tx.date)) {
      blockedToast(tx.date.slice(0, 4));
      return;
    }
    const cur = tx.reconciled || "";
    tx.reconciled = cur === "" ? "C" : cur === "C" ? "R" : "";
    saveState();
    renderTransactions();
  }));
}

const SAVINGS_CATEGORIES = ["Wealthfront", "CiT Bank", "Savings"];
const NON_JOB_CATEGORIES = ["Roll Over", "Correction"];

// Chart of accounts types (the standard accounting bucket categories)
const CHART_ACCOUNT_TYPES = [
  "Bank",
  "Accounts Receivable",
  "Other Current Asset",
  "Fixed Asset",
  "Other Asset",
  "Accounts Payable",
  "Credit Card",
  "Other Current Liability",
  "Long Term Liability",
  "Equity",
  "Income",
  "Cost of Goods Sold",
  "Expense",
  "Other Income",
  "Other Expense"
];

// Default chart of accounts to seed on first run (based on user-provided screenshot)
const DEFAULT_CHART_ACCOUNTS = [
  { name: "Furniture and Equipment", type: "Fixed Asset" },
  { name: "Accounts Payable", type: "Accounts Payable" },
  { name: "Advance Customer Payments", type: "Other Current Liability" },
  { name: "Gift Certificates", type: "Other Current Liability" },
  { name: "Payroll Liabilities", type: "Other Current Liability" },
  { name: "Sales Tax Payable", type: "Other Current Liability" },
  { name: "Opening Balance Equity", type: "Equity" },
  { name: "Owners Draw", type: "Equity" },
  { name: "Owners Equity", type: "Equity" },
  { name: "Sales", type: "Income" },
  { name: "Contra-Sales", type: "Income", parent: "Sales" },
  { name: "Cost of Goods Sold", type: "Cost of Goods Sold" },
  { name: "Merchant Account Fees", type: "Cost of Goods Sold" },
  { name: "Production and Supplies Costs", type: "Cost of Goods Sold" },
  { name: "Show and Exhibitor Fees Expense", type: "Cost of Goods Sold" },
  { name: "Subcontracted Services", type: "Cost of Goods Sold" },
  { name: "2010 Sales Tax", type: "Expense" },
  { name: "Advertising and Promotion", type: "Expense" },
  { name: "Automobile Expense", type: "Expense" },
  { name: "Bank Service Charges", type: "Expense" },
  { name: "Business Licenses and Permits", type: "Expense" },
  { name: "Charitable Contributions", type: "Expense" },
  { name: "Computer and Internet Expenses", type: "Expense" },
  { name: "Credit Card Processing", type: "Expense" },
  { name: "Depreciation Expense", type: "Expense" },
  { name: "Donation", type: "Expense" },
  { name: "Dues and Subscriptions", type: "Expense" },
  { name: "Equipment Purchase - Non Asset", type: "Expense" },
  { name: "Equipment Rental", type: "Expense" },
  { name: "Insurance Expense", type: "Expense" },
  { name: "General Liability Insurance", type: "Expense", parent: "Insurance Expense" },
  { name: "Interest Expense", type: "Expense" },
  { name: "Meals and Entertainment", type: "Expense" },
  { name: "Miscellaneous Expense", type: "Expense" },
  { name: "Office Supplies", type: "Expense" },
  { name: "Other Expenses", type: "Expense" },
  { name: "Payroll Expenses", type: "Expense" },
  { name: "Postage and Delivery", type: "Expense" },
  { name: "Professional Development", type: "Expense" },
  { name: "Professional Fees", type: "Expense" },
  { name: "Reconciliation Discrepancies", type: "Expense" },
  { name: "Rent Expense", type: "Expense" },
  { name: "Repairs and Maintenance", type: "Expense" },
  { name: "Software", type: "Expense" },
  { name: "Actions", type: "Expense", parent: "Software" },
  { name: "Applications", type: "Expense", parent: "Software" },
  { name: "Songs", type: "Expense", parent: "Software" },
  { name: "Templates", type: "Expense", parent: "Software" },
  { name: "Telephone Expense", type: "Expense" },
  { name: "Travel Expense", type: "Expense" },
  { name: "Utilities", type: "Expense" },
  { name: "Ask My Accountant", type: "Other Expense" },
  { name: "Bad Debt", type: "Other Expense" }
];

// Seed the chart of accounts. Runs on every load — only adds entries that don't already
// exist (matched by name+type), so user-added accounts are preserved and newly-added
// defaults from the code get merged in for existing installs.
(function seedChartAccounts() {
  if (!Array.isArray(state.chartAccounts)) state.chartAccounts = [];
  let added = 0;
  DEFAULT_CHART_ACCOUNTS.forEach(a => {
    const exists = state.chartAccounts.some(x =>
      x.name === a.name && x.type === a.type && (x.parent || "") === (a.parent || "")
    );
    if (!exists) {
      state.chartAccounts.push({
        id: uid(),
        name: a.name,
        type: a.type,
        parent: a.parent || ""
      });
      added++;
    }
  });
  if (added > 0) saveState();
})();

// Preferred left-to-right order for job pills (any job not listed falls to the end, alphabetical).
const JOB_ORDER = [
  "Spring Sports", "Softball", "Baseball", "Tee Ball",
  "Fall Sports", "Soccer", "Preschool", "Winter Sports",
  "Banners", "Dry Mount Prints", "Framed Prints", "Buy Sell"
];

// Chart palettes — three options offered in Settings.
const PALETTE_VIBRANT = [
  "#7c5ce6", "#b168e8", "#e167e0", "#ff6aa6", "#ff8057",
  "#ffb041", "#ffd150", "#a0d850", "#4ad896", "#3bc6c3",
  "#4aa6ff", "#5478ff", "#9e91ff", "#ff78b8", "#ff5a57",
  "#ff9c47", "#ffc947", "#c8e65a", "#5de0b0", "#5dbde0"
];
const PALETTE_PASTEL = [
  "#b8a3e8", "#d4a3ea", "#ecb1e8", "#f8b8cf", "#f8c3a9",
  "#f9d39c", "#f9e1a4", "#cce4a3", "#abe6c8", "#a4dcdb",
  "#a3cbed", "#aeb9ed", "#ccc4ed", "#f8b8d4", "#f4a8a8",
  "#f8c896", "#fadc94", "#dde8a3", "#a8e3c9", "#a8d2e3"
];
const PALETTE_BOLD = [
  "#5b30c4", "#9430c4", "#c42fc1", "#e6286f", "#e6402a",
  "#e69020", "#e6b820", "#7fc230", "#1fc678", "#0d9b9b",
  "#1a7fd1", "#2447d1", "#5f4fc7", "#d650a0", "#d63a37",
  "#e08020", "#e6b020", "#a8c63a", "#28b87d", "#268bb8"
];
const CHART_PALETTES = { vibrant: PALETTE_VIBRANT, pastel: PALETTE_PASTEL, bold: PALETTE_BOLD };
let DONUT_PALETTE = PALETTE_VIBRANT.slice();
function applyChartPalette(name) {
  const p = CHART_PALETTES[name] || PALETTE_VIBRANT;
  DONUT_PALETTE = p.slice();
}
// Apply persisted choice on load.
applyChartPalette(state.chartPalette);

function openYearPickerSheet(years, current, onPick) {
  // Remove any existing sheet
  document.querySelectorAll(".year-sheet-backdrop").forEach(el => el.remove());

  const lockedSet = new Set(state.lockedYears || []);
  const backdrop = document.createElement("div");
  backdrop.className = "year-sheet-backdrop";
  backdrop.innerHTML = `
    <div class="year-sheet" role="dialog" aria-label="Choose year">
      <div class="year-sheet-handle"></div>
      <div class="year-sheet-title">Choose year</div>
      <div class="year-sheet-grid">
        <button class="year-sheet-item ${current === "" ? "active" : ""}" data-year="">All</button>
        ${years.map(y => {
          const lockedCls = lockedSet.has(y) ? " is-locked" : "";
          return `<button class="year-sheet-item ${current === y ? "active" : ""}${lockedCls}" data-year="${y}">${y}</button>`;
        }).join("")}
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  // Force reflow then add visible class for transition
  requestAnimationFrame(() => backdrop.classList.add("visible"));

  const close = () => {
    backdrop.classList.remove("visible");
    setTimeout(() => backdrop.remove(), 200);
  };

  backdrop.addEventListener("click", e => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelectorAll(".year-sheet-item").forEach(btn => {
    btn.addEventListener("click", () => {
      onPick(btn.dataset.year);
      close();
    });
  });
}

function renderYearPills(containerId, selectEl, years, onChange) {
  const el = document.getElementById(containerId);
  const current = selectEl.value;
  const allActive = current === "" ? "active" : "";
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const RECENT = 3;

  let visibleYears = years;
  let moreHTML = "";

  if (isMobile && years.length > RECENT) {
    visibleYears = years.slice(0, RECENT);
    // If the currently-selected year is outside the recent window,
    // swap it in (replacing the oldest of the recent slots) so the
    // row keeps a fixed footprint: All + 3 year pills + More.
    if (current && !visibleYears.includes(current) && years.includes(current)) {
      visibleYears = [...visibleYears.slice(0, RECENT - 1), current]
        .sort((a, b) => b.localeCompare(a));
    }
    moreHTML = `<button class="year-pill year-pill-more" data-nav="more" aria-label="More years">More ▾</button>`;
  }

  const lockedSet = new Set(state.lockedYears || []);
  el.innerHTML =
    `<button class="year-pill ${allActive}" data-year="">All</button>` +
    visibleYears.map(y => {
      const lockedCls = lockedSet.has(y) ? " is-locked" : "";
      return `<button class="year-pill ${current === y ? "active" : ""}${lockedCls}" data-year="${y}">${y}</button>`;
    }).join("") +
    moreHTML;

  el.querySelectorAll(".year-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.nav === "more") {
        openYearPickerSheet(years, selectEl.value, (picked) => {
          selectEl.value = picked;
          onChange();
        });
        return;
      }
      selectEl.value = btn.dataset.year;
      onChange();
    });
  });
}

// Map from category name to its donut slice color, so cards can match colors.
const donutColorMap = new Map();

function renderDonut(containerId, items, centerLabel, opts = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;

  // Auto-mirror into the mobile-twin slot (e.g. "donut-jobs" -> "donut-jobs-m")
  // so Analytics mobile donuts always stay in sync even if a caller forgets.
  if (!containerId.endsWith("-m")) {
    const mobileId = containerId + "-m";
    if (document.getElementById(mobileId)) {
      renderDonut(mobileId, items, centerLabel, opts);
    }
  }

  const total = items.reduce((s, i) => s + i.value, 0);

  if (!items.length || total <= 0) {
    el.innerHTML = `<div class="donut-empty">No data for this selection.</div>`;
    return;
  }

  const showLabels = !!opts.showLabels;
  const CX = 21, CY = 21, R = 15.9155;

  const STROKE = 10;
  let cumPct = 0;
  const slices = items.map((item, idx) => {
    const pct = total > 0 ? (item.value / total) * 100 : 0;
    const color = item.color || DONUT_PALETTE[idx % DONUT_PALETTE.length];
    donutColorMap.set(item.label, color);
    const dash = `${pct} ${100 - pct}`;
    const startPct = cumPct;
    cumPct += pct;
    return { item, pct, color, dash, dashOffset: -startPct, startPct };
  });

  // Thin black radial dividers between slices — straight lines from the
  // inner edge of the ring to the outer edge at each slice boundary.
  const INNER_R = R - STROKE / 2;
  const OUTER_R = R + STROKE / 2;
  const dividers = slices.length > 1 ? slices.map(s => {
    const deg = s.startPct * 3.6 - 90;
    const rad = deg * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return `<line x1="${CX + cos * INNER_R}" y1="${CY + sin * INNER_R}" x2="${CX + cos * OUTER_R}" y2="${CY + sin * OUTER_R}" stroke="#000" stroke-width="0.25" shape-rendering="geometricPrecision"></line>`;
  }).join("") : "";

  // Square viewBox centered on donut so the donut fills more of the card.
  const viewBox = showLabels ? "-21 -21 84 84" : "0 0 42 42";

  const labelEls = !showLabels ? "" : (() => {
    const LABEL_R = 28;
    const SLICE_EDGE = R + STROKE / 2;
    const MIN_GAP = 11; // vertical breathing room per 2-line label, in viewBox units
    const visibleSlices = slices.filter(s => s.pct >= 1.5);

    const prepared = visibleSlices.map(s => {
      const midDeg = (s.startPct + s.pct / 2) * 3.6 - 90;
      const rad = midDeg * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const sliceX = CX + cos * SLICE_EDGE;
      const sliceY = CY + sin * SLICE_EDGE;
      const side = cos < 0 ? "left" : "right";
      // Snap labels to a fixed column on each side so they always stay outside the donut
      // even after overlap resolution pushes their Y down.
      const lx = side === "left" ? CX - LABEL_R : CX + LABEL_R;
      return {
        s,
        sliceX,
        sliceY,
        lx,
        ly: CY + sin * LABEL_R,
        side,
        anchor: side === "left" ? "end" : "start",
        textPadX: side === "left" ? -1.5 : 1.5,
      };
    });

    // Resolve vertical overlap: sort each side by Y, enforce MIN_GAP downward.
    const resolve = arr => {
      arr.sort((a, b) => a.ly - b.ly);
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].ly - arr[i - 1].ly < MIN_GAP) {
          arr[i].ly = arr[i - 1].ly + MIN_GAP;
        }
      }
    };
    resolve(prepared.filter(p => p.side === "left"));
    resolve(prepared.filter(p => p.side === "right"));

    return prepared.map(({ s, sliceX, sliceY, lx, ly, anchor, textPadX }) => `
      <line x1="${sliceX}" y1="${sliceY}" x2="${lx}" y2="${ly}" stroke="${s.color}" stroke-width="0.4" opacity="0.85"></line>
      <circle cx="${sliceX}" cy="${sliceY}" r="0.5" fill="${s.color}"></circle>
      <text x="${lx + textPadX}" y="${ly}" text-anchor="${anchor}" class="donut-label" dominant-baseline="middle">
        <tspan font-weight="700">${escapeHtml(s.item.label)}</tspan>
        <tspan x="${lx + textPadX}" dy="5.5" class="donut-label-sub">${s.pct.toFixed(1)}% · ${fmtMoneyCompact(s.item.value)}</tspan>
      </text>
    `).join("");
  })();

  // Draw each slice as an explicit arc <path>. Using the same angle math as
  // the dividers guarantees they align exactly — no dash/circumference drift.
  const polar = (deg) => {
    const rad = deg * Math.PI / 180;
    return { x: CX + Math.cos(rad) * R, y: CY + Math.sin(rad) * R };
  };
  const slicePath = (startPct, pct) => {
    if (pct <= 0) return "";
    const startDeg = startPct * 3.6 - 90;
    const endDeg = (startPct + pct) * 3.6 - 90;
    if (pct >= 99.999) {
      // Full ring: two arcs to close the circle (single arc can't span 360°)
      const top = polar(-90);
      const bot = polar(90);
      return `M ${top.x} ${top.y} A ${R} ${R} 0 0 1 ${bot.x} ${bot.y} A ${R} ${R} 0 0 1 ${top.x} ${top.y}`;
    }
    const start = polar(startDeg);
    const end = polar(endDeg);
    const largeArc = pct > 50 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };
  el.innerHTML = `
    <svg class="donut-svg" viewBox="${viewBox}">
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="transparent" stroke="var(--bg)" stroke-width="${STROKE}"></circle>
      ${slices.map(s => `
        <path class="donut-slice" data-cat="${escapeHtml(s.item.label)}"
          data-value="${s.item.value}" data-pct="${s.pct.toFixed(2)}"
          d="${slicePath(s.startPct, s.pct)}"
          fill="none"
          stroke="${s.color}" stroke-width="${STROKE}">
          <title>${escapeHtml(s.item.label)}: ${s.pct.toFixed(1)}% (${fmtMoney(s.item.value)})</title>
        </path>
      `).join("")}
      ${dividers}
      <text class="donut-center" x="${CX}" y="${CY - 0.5}">${fmtMoney(total)}</text>
      <text class="donut-center-sub" x="${CX}" y="${CY + 3.5}">${escapeHtml(centerLabel)}</text>
      ${labelEls}
    </svg>
  `;
}

let jobsYearInitialized = false;
let jobsViewMode = "gross"; // "net" or "gross"
let jobsGroupMode = "job";  // "job" (group by jobNo) or "category" (legacy)

// No-op placeholder; the mobile donuts now live in their own DOM slots
// inside each jobs-section (donut-*-m) and are rendered alongside the
// desktop ones. CSS show/hide handles which set is visible.
function arrangeAnalyticsLayoutForViewport() { /* kept for call-site compat */ }

function renderJobs() {
  const posGrid = document.getElementById("jobs-grid-positive");
  const savGrid = document.getElementById("jobs-grid-savings");
  const negGrid = document.getElementById("jobs-grid-negative");

  // The dedicated year-pill row was removed — By Category is now driven entirely
  // by the universal Analytics filters dropdown (Date Range / Customer / Payee).
  // The hidden #jobs-year <select> is kept around so legacy code paths that still
  // read it (e.g. drill-into-transactions) keep working.
  const yearSel = document.getElementById("jobs-year");

  // Keep #jobs-year in sync with date-range when exactly one year is picked,
  // so the "drill into transactions" handler still narrows correctly.
  const _years = selectedYears();
  if (yearSel) yearSel.value = (_years && _years.length === 1) ? _years[0] : "";
  const yearFilter = yearSel ? yearSel.value : "";

  const filteredTxs = state.transactions.filter(t => {
    if (!filterPasses("date-range", (t.date || "").slice(0, 4))) return false;
    if (!filterPasses("customer", t.customer || "")) return false;
    if (!filterPassesCategory(t.category)) return false;
    if (!filterPasses("payees",   t.payee || "")) return false;
    return true;
  });

  // Total income across all filtered transactions — used for % of income on each card.
  // Roll Over / Correction entries are carry-forward adjustments, not real income, so they're
  // excluded from the denominator for a more meaningful percentage.
  const totalIncome = filteredTxs
    .filter(t => t.type === "income" && !NON_JOB_CATEGORIES.includes(t.category))
    .reduce((sum, t) => sum + t.amount, 0);

  // Build the (cat, txs) pairs for each section. Each section can group
  // differently based on the active jobsGroupMode:
  //   "job"      → Jobs section by jobNo, Expenses section by Expense (tx.expenseIncome)
  //   "customer" → both sections grouped by customer
  //   "category" → both sections grouped by category (legacy)
  // Savings always groups by category (SAVINGS_CATEGORIES is category-keyed).
  function buildGroupSpecs(mode, scope) {
    if (mode === "job" && scope === "jobs") {
      const jobMap = new Map((state.jobs || []).map(j => [j.jobNo, j]));
      const out = [];
      (state.jobs || []).forEach(j => {
        const txs = filteredTxs.filter(t => t.jobNo === j.jobNo);
        if (!txs.length) return;
        out.push({ cat: `${j.jobNo} - ${j.category || j.customer || "Job"}`, txs });
      });
      return out;
    }
    if (mode === "job" && scope === "expenses") {
      // Group expenses by tx.expenseIncome (the Expense column). Income
      // transactions don't belong here. Anything missing falls into "Uncategorized".
      const buckets = new Map();
      filteredTxs.forEach(t => {
        if (t.type !== "expense") return;
        if (NON_JOB_CATEGORIES.includes(t.category)) return;
        if (SAVINGS_CATEGORIES.includes(t.category)) return;
        const key = (t.expenseIncome || "").trim() || "Uncategorized";
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(t);
      });
      return [...buckets.entries()].map(([cat, txs]) => ({ cat, txs }));
    }
    if (mode === "customer" && scope === "jobs") {
      const buckets = new Map();
      filteredTxs.forEach(t => {
        if (NON_JOB_CATEGORIES.includes(t.category)) return;
        if (SAVINGS_CATEGORIES.includes(t.category)) return;
        const key = (t.customer || "").trim();
        if (!key) return;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(t);
      });
      return [...buckets.entries()].map(([cat, txs]) => ({ cat, txs }));
    }
    if (mode === "customer" && scope === "expenses") {
      // Per request: in Customer mode, the Expenses section stays grouped by category.
      return state.categories
        .filter(cat => !NON_JOB_CATEGORIES.includes(cat))
        .map(cat => ({ cat, txs: filteredTxs.filter(t => t.category === cat && t.type === "expense") }));
    }
    // "category" → legacy
    return state.categories
      .filter(cat => !NON_JOB_CATEGORIES.includes(cat))
      .map(cat => ({ cat, txs: filteredTxs.filter(t => t.category === cat) }));
  }

  const jobsSpecs = buildGroupSpecs(jobsGroupMode, "jobs");
  const expensesSpecs = buildGroupSpecs(jobsGroupMode, "expenses");

  // Mark each spec with its "side" so the positive/negative split below can
  // honor the source (e.g. an income-side card with net 0 should still appear
  // in Jobs, not vanish into nothing).
  jobsSpecs.forEach(s => s.__side = "jobs");
  expensesSpecs.forEach(s => s.__side = "expenses");

  // For category mode, both sides are the same union — dedupe to avoid double cards.
  let groupSpecs;
  if (jobsGroupMode === "category") {
    groupSpecs = jobsSpecs;
  } else {
    groupSpecs = [...jobsSpecs, ...expensesSpecs];
  }

  const cards = groupSpecs.map(({ cat, txs, __side }) => {
    let inc = 0, exp = 0;
    let hourlyHours = 0;
    txs.forEach(t => {
      if (t.type === "income") {
        inc += t.amount;
        if (t.hours && t.hours > 0) hourlyHours += t.hours;
      } else {
        exp += t.amount;
      }
    });
    // In By Job No. mode, prefer the job record's `hours` value when no per-tx
    // hours are logged. Lets the wage line keep working when hours are tracked
    // on the Job rather than on each income transaction.
    if (jobsGroupMode === "job" && hourlyHours === 0) {
      const jobNoMatch = (cat || "").match(/^(\S+)\s+[—-]/);
      if (jobNoMatch) {
        const j = (state.jobs || []).find(j => j.jobNo === jobNoMatch[1]);
        if (j && j.hours && j.hours > 0) hourlyHours = j.hours;
      }
    }
    const net = inc - exp;
    // Wage uses NET income (income - expenses) over total hours, and only
    // shows when the Net mode toggle is active.
    const hourlyIncome = net;

    // The large "value" displayed on Jobs cards depends on the Net / Gross toggle.
    // Expenses and Savings cards always show Net (gross doesn't really apply there).
    const isJobCard = !SAVINGS_CATEGORIES.includes(cat) && (
      jobsGroupMode === "category" ? net >= 0 : __side === "jobs"
    );
    const useGross = jobsViewMode === "gross" && isJobCard;
    const displayValue = useGross ? inc : net;

    const pct = totalIncome > 0 ? (Math.abs(displayValue) / totalIncome) * 100 : 0;
    const pctLabel = totalIncome > 0 ? `${pct.toFixed(1)}% of income` : "—";
    const pctDisplay = totalIncome > 0 ? `${pct.toFixed(1)}%` : "—";
    // Hourly rate: only render the line when (a) the job has hours logged and
    // (b) the Net mode toggle is active. Wage = net / hours.
    const rateHtml = (hourlyHours > 0 && jobsViewMode === "net")
      ? `<div class="hourly" title="${fmtMoney(hourlyIncome)} net over ${hourlyHours} hr">${fmtMoney(hourlyIncome / hourlyHours)}/hr · ${hourlyHours} hr</div>`
      : "";
    const html = `<div class="job-card" data-cat="${escapeHtml(cat)}" data-side="${escapeHtml(__side || "")}">
      <h3><span class="card-swatch" data-cat-swatch="${escapeHtml(cat)}"></span>${escapeHtml(cat)}</h3>
      <div class="net-row">
        <div class="net ${displayValue >= 0 ? "positive" : "negative"}">${fmtMoney(displayValue)}</div>
        <div class="pct" title="${pctLabel}">${pctDisplay}</div>
      </div>
      ${rateHtml}
      <div class="stats">
        <span>${txs.length} tx</span>
        <span>In: ${fmtMoney(inc)}</span>
        <span>Out: ${fmtMoney(exp)}</span>
      </div>
    </div>`;
    return { cat, net, inc, exp, count: txs.length, html, side: __side };
  });

  // Hide categories with no activity in the current filter window — applies to
  // every Date Range, not just single-year picks.
  const visible = cards.filter(c => c.count > 0);
  const savings = visible.filter(c => SAVINGS_CATEGORIES.includes(c.cat)).sort((a, b) => b.net - a.net);
  const rest = visible.filter(c => !SAVINGS_CATEGORIES.includes(c.cat));
  let positives, negatives;
  if (jobsGroupMode === "category") {
    // Legacy split — by sign of net.
    positives = rest.filter(c => c.net >= 0).sort((a, b) => b.net - a.net);
    negatives = rest.filter(c => c.net < 0).sort((a, b) => a.net - b.net);
  } else {
    // Job and Customer modes: split by which spec the card came from.
    // Jobs side: sort by gross income desc (or net for net-mode).
    positives = rest.filter(c => c.side === "jobs")
      .sort((a, b) => (jobsViewMode === "gross" ? b.inc - a.inc : b.net - a.net));
    negatives = rest.filter(c => c.side === "expenses")
      .sort((a, b) => b.exp - a.exp);
  }

  posGrid.innerHTML = positives.length
    ? positives.map(c => c.html).join("")
    : `<p class="muted" style="grid-column:1/-1">No jobs with income yet.</p>`;

  savGrid.innerHTML = savings.length
    ? savings.map(c => c.html).join("")
    : `<p class="muted" style="grid-column:1/-1">No savings categories yet.</p>`;

  negGrid.innerHTML = negatives.length
    ? negatives.map(c => c.html).join("")
    : `<p class="muted" style="grid-column:1/-1">No expense-only categories yet.</p>`;

  // Donut data: each slice = category.
  // Jobs donut respects the Net / Gross toggle. Expenses and Savings always use abs(net).
  const useGrossJobs = jobsViewMode === "gross";
  const jobsItems = positives
    .filter(c => (useGrossJobs ? c.inc : c.net) > 0)
    .map(c => ({ label: c.cat, value: useGrossJobs ? c.inc : c.net }));
  const expensesItems = negatives
    .map(c => ({ label: c.cat, value: Math.abs(c.net) }));
  const savingsItems = savings
    .filter(c => c.net !== 0)
    .map(c => ({ label: c.cat, value: Math.abs(c.net) }));

  renderDonut("donut-jobs", jobsItems, "Total");
  renderDonut("donut-expenses", expensesItems, "Total");
  renderDonut("donut-savings", savingsItems, "Total");
  // Duplicate render for the mobile donut slots (hidden on desktop via CSS)
  renderDonut("donut-jobs-m", jobsItems, "Total");
  renderDonut("donut-expenses-m", expensesItems, "Total");
  renderDonut("donut-savings-m", savingsItems, "Total");

  // Hide the parent card(s) entirely when a donut has no data
  const toggleDonutCard = (donutId, hasData) => {
    const el = document.getElementById(donutId);
    if (!el) return;
    const card = el.closest(".donut-card, .donut-card-mobile");
    if (card) card.style.display = hasData ? "" : "none";
  };
  toggleDonutCard("donut-jobs",      jobsItems.length > 0);
  toggleDonutCard("donut-expenses",  expensesItems.length > 0);
  toggleDonutCard("donut-savings",   savingsItems.length > 0);
  toggleDonutCard("donut-jobs-m",    jobsItems.length > 0);
  toggleDonutCard("donut-expenses-m",expensesItems.length > 0);
  toggleDonutCard("donut-savings-m", savingsItems.length > 0);

  // Hide the entire Breakdown section (donut-card-mobile + header + grid)
  // when there is no data for that category type.
  const toggleJobsSection = (section, hasData) => {
    const el = document.querySelector(`#jobs .jobs-section[data-section="${section}"]`);
    if (el) el.style.display = hasData ? "" : "none";
  };
  toggleJobsSection("jobs",     jobsItems.length > 0);
  toggleJobsSection("expenses", expensesItems.length > 0);
  toggleJobsSection("savings",  savingsItems.length > 0);

  // Color each card's swatch to match its donut slice
  document.querySelectorAll("#jobs [data-cat-swatch]").forEach(sw => {
    const c = donutColorMap.get(sw.dataset.catSwatch);
    if (c) sw.style.background = c;
  });

  // Hover (desktop) / tap (mobile) -> highlight the matching donut slice.
  // On mobile, a second tap on the same card within 500ms navigates to
  // the Transactions tab (filtered to that category) with a Back arrow.
  // Each entry lists BOTH donut containers (desktop + mobile twin) so
  // highlighting works regardless of which set is currently visible.
  const cardToDonut = {
    "jobs-grid-positive": { donuts: ["donut-jobs", "donut-jobs-m"], infos: ["info-jobs", "info-jobs-m"] },
    "jobs-grid-negative": { donuts: ["donut-expenses", "donut-expenses-m"], infos: ["info-expenses", "info-expenses-m"] },
    "jobs-grid-savings": { donuts: ["donut-savings", "donut-savings-m"], infos: ["info-savings", "info-savings-m"] },
  };

  const isMobileViewport = () => window.matchMedia("(max-width: 768px)").matches
    || ("ontouchstart" in window && window.innerWidth < 1024);

  const navigateToTxForCategory = (cat, side) => {
    // Decode the synthetic card label into a structured filter, depending
    // on the active group mode and which side (jobs vs expenses) it came from.
    const jobMatch = cat && cat.match(/^(\S+)\s+[—-]/);
    const drillJobNo = jobsGroupMode === "job" && side === "jobs" && jobMatch ? jobMatch[1] : null;
    const drillUnlinked = jobsGroupMode === "job" && side === "jobs" && cat === "Unlinked";
    const drillExpense = (jobsGroupMode === "job" && side === "expenses") ? cat : null;
    // In Customer mode only the Jobs side groups by customer; Expenses side stays category-keyed.
    const drillCustomer = (jobsGroupMode === "customer" && side === "jobs") ? cat : null;

    __txDrillFilter = (t) => {
      if (!filterPasses("date-range", (t.date || "").slice(0, 4))) return false;
      if (!filterPasses("customer",   t.customer || "")) return false;
      if (!filterPasses("payees",     t.payee || "")) return false;
      if (drillJobNo) return t.jobNo === drillJobNo;
      if (drillUnlinked) {
        if (NON_JOB_CATEGORIES.includes(t.category)) return false;
        return !t.jobNo;
      }
      if (drillExpense) {
        if (t.type !== "expense") return false;
        if (NON_JOB_CATEGORIES.includes(t.category)) return false;
        if (SAVINGS_CATEGORIES.includes(t.category)) return false;
        const ei = (t.expenseIncome || "").trim() || "Uncategorized";
        return ei === drillExpense;
      }
      if (drillCustomer) {
        if (NON_JOB_CATEGORIES.includes(t.category)) return false;
        if (SAVINGS_CATEGORIES.includes(t.category)) return false;
        const c = (t.customer || "").trim() || "(no customer)";
        return c === drillCustomer;
      }
      return true;
    };
    // Set a human-readable label for the drill chip on the Transactions toolbar.
    if (typeof __txDrillLabel !== "undefined") {
      if (drillJobNo)        __txDrillLabel = `Job ${drillJobNo}`;
      else if (drillUnlinked) __txDrillLabel = "Unlinked";
      else if (drillExpense)  __txDrillLabel = `Expense: ${drillExpense}`;
      else if (drillCustomer) __txDrillLabel = `Customer: ${drillCustomer}`;
      else                    __txDrillLabel = cat || "filtered subset";
    }
    if (typeof refreshTxDrillChip === "function") setTimeout(refreshTxDrillChip, 0);

    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    document.querySelector('.tab-btn[data-tab="transactions"]').classList.add("active");
    document.getElementById("transactions").classList.add("active");
    const searchAll = document.getElementById("tx-search-all");
    if (searchAll) searchAll.value = "";
    document.getElementById("tx-filter-type").value = "";
    // In any synthetic-grouping mode we drill via __txDrillFilter, so don't
    // pre-fill the visible category filter with the synthetic label.
    const usingDrill = drillJobNo || drillUnlinked || drillExpense || drillCustomer;
    document.getElementById("tx-filter-category").value = usingDrill ? "" : cat;
    document.getElementById("tx-filter-year").value = "";
    // Remember we came from Analytics so the Back arrow appears
    window.__txBackToAnalytics = true;
    const backBtn = document.getElementById("btn-tx-back");
    if (backBtn) backBtn.hidden = false;
    renderTransactions();
  };

  const highlightSliceForCard = (card, donutIds, infoIds) => {
    const cat = card.dataset.cat;
    let matchedVal = 0;
    let matchedPct = 0;
    let foundMatch = false;
    donutIds.forEach(id => {
      const donutWrap = document.getElementById(id);
      if (!donutWrap) return;
      donutWrap.classList.add("dim");
      donutWrap.querySelectorAll(".donut-slice").forEach(sl => {
        const match = sl.dataset.cat === cat;
        sl.classList.toggle("highlight", match);
        if (match) {
          foundMatch = true;
          matchedVal = parseFloat(sl.dataset.value) || 0;
          matchedPct = parseFloat(sl.dataset.pct) || 0;
        }
      });
    });
    if (foundMatch) {
      infoIds.forEach(id => {
        const infoEl = document.getElementById(id);
        if (!infoEl) return;
        infoEl.innerHTML = `
          <div class="label">${escapeHtml(cat)}</div>
          <div class="amount">${fmtMoney(matchedVal)}</div>
          <div class="pct">${matchedPct.toFixed(1)}%</div>
        `;
        infoEl.classList.add("visible");
      });
    }
  };

  const clearSliceHighlight = (donutIds, infoIds) => {
    donutIds.forEach(id => {
      const donutWrap = document.getElementById(id);
      if (!donutWrap) return;
      donutWrap.classList.remove("dim");
      donutWrap.querySelectorAll(".donut-slice.highlight").forEach(sl => sl.classList.remove("highlight"));
    });
    infoIds.forEach(id => {
      const infoEl = document.getElementById(id);
      if (infoEl) infoEl.classList.remove("visible");
    });
  };

  // Tracking for the single-tap / double-tap flow on mobile
  let lastTappedCard = null;
  let lastTapAt = 0;

  document.querySelectorAll("#jobs .job-card").forEach(card => {
    const gridId = card.parentElement.id;
    const mapping = cardToDonut[gridId];
    if (!mapping) return;

    // Desktop hover — only on non-touch-primary devices
    card.addEventListener("mouseenter", () => {
      if (isMobileViewport()) return;
      highlightSliceForCard(card, mapping.donuts, mapping.infos);
    });
    card.addEventListener("mouseleave", () => {
      if (isMobileViewport()) return;
      clearSliceHighlight(mapping.donuts, mapping.infos);
    });

    // First tap/click highlights the card and its donut slice; a second tap
    // on the same card within 500ms drills into Transactions for that
    // category. Same flow on mobile and desktop.
    card.addEventListener("click", () => {
      const now = Date.now();
      const isDoubleTap = lastTappedCard === card && (now - lastTapAt) < 500;
      if (isDoubleTap) {
        navigateToTxForCategory(card.dataset.cat, card.dataset.side);
        lastTappedCard = null;
        lastTapAt = 0;
        card.classList.remove("selected");
        return;
      }
      // First tap: clear any prior highlight then mark this one.
      document.querySelectorAll("#jobs .job-card.selected").forEach(c => c.classList.remove("selected"));
      ["donut-jobs", "donut-jobs-m", "donut-expenses", "donut-expenses-m", "donut-savings", "donut-savings-m"].forEach(id => {
        const dw = document.getElementById(id);
        if (dw) {
          dw.classList.remove("dim");
          dw.querySelectorAll(".donut-slice.highlight").forEach(sl => sl.classList.remove("highlight"));
        }
      });
      ["info-jobs", "info-jobs-m", "info-expenses", "info-expenses-m", "info-savings", "info-savings-m"].forEach(id => {
        const ie = document.getElementById(id);
        if (ie) ie.classList.remove("visible");
      });
      card.classList.add("selected");
      highlightSliceForCard(card, mapping.donuts, mapping.infos);
      lastTappedCard = card;
      lastTapAt = now;
    });
  });
}

function renderSettings() {
  renderEditableList("cat-list", "categories");
  renderEditableList("acct-list", "accounts");
  renderEditableList("payee-list", "payees");
  renderEditableList("customer-list", "customers");
  renderEditableList("invoice-items-list", "invoiceItems");
  renderEditableList("invoice-descs-list", "invoiceDescs");
  renderChartAccounts();

  // Keep the Settings savings-goal field in sync (but don't clobber the user while typing)
  const goalInput = document.getElementById("settings-savings-goal");
  if (goalInput && document.activeElement !== goalInput) {
    goalInput.value = state.savingsGoal ?? 12000;
  }

  // Keep Startup preference selects in sync
  const startupViewSel = document.getElementById("settings-startup-view");
  const startupYearSel = document.getElementById("settings-startup-year");
  const startupYearField = document.getElementById("settings-startup-year-field");
  const mobileNavSel = document.getElementById("settings-mobile-nav");
  if (startupViewSel) startupViewSel.value = state.startupView || "dashboard";
  if (startupYearSel) startupYearSel.value = state.startupDashboardYear || "current";
  if (mobileNavSel) mobileNavSel.value = state.mobileNavStyle || "sidebar";
  if (startupYearField) {
    startupYearField.style.display = (state.startupView === "dashboard") ? "" : "none";
  }
}

function renderChartAccounts() {
  const listEl = document.getElementById("chart-accounts-list");
  if (!listEl) return;
  if (!Array.isArray(state.chartAccounts)) state.chartAccounts = [];

  const byType = {};
  state.chartAccounts.forEach(a => {
    if (!byType[a.type]) byType[a.type] = [];
    byType[a.type].push(a);
  });

  let html = "";
  CHART_ACCOUNT_TYPES.forEach(type => {
    const list = byType[type];
    if (!list || !list.length) return;
    html += `<div class="chart-type-group"><div class="chart-type-header">${escapeHtml(type)}</div>`;
    const parents = list.filter(a => !a.parent);
    const children = list.filter(a => a.parent);
    parents.forEach(p => {
      html += `
        <div class="chart-account-row">
          <span>${escapeHtml(p.name)}</span>
          <button class="del-btn" data-id="${p.id}" title="Remove">&times;</button>
        </div>`;
      children.filter(c => c.parent === p.name).forEach(c => {
        html += `
          <div class="chart-account-row sub">
            <span>↳ ${escapeHtml(c.name)}</span>
            <button class="del-btn" data-id="${c.id}" title="Remove">&times;</button>
          </div>`;
      });
    });
    // Orphans (parent not found in same type)
    children.filter(c => !parents.some(p => p.name === c.parent)).forEach(c => {
      html += `
        <div class="chart-account-row sub">
          <span>↳ ${escapeHtml(c.parent)}:${escapeHtml(c.name)}</span>
          <button class="del-btn" data-id="${c.id}" title="Remove">&times;</button>
        </div>`;
    });
    html += `</div>`;
  });

  if (!html) {
    html = `<div class="chart-account-row sub">No accounts yet.</div>`;
  }
  listEl.innerHTML = html;

  listEl.querySelectorAll(".del-btn").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      const acct = state.chartAccounts.find(a => a.id === id);
      if (!acct) return;
      const hasChildren = state.chartAccounts.some(c => c.parent === acct.name);
      if (hasChildren) {
        if (!confirm(`"${acct.name}" has sub-accounts. Remove it anyway? (Sub-accounts will become orphans.)`)) return;
      } else if (!confirm(`Remove "${acct.name}"?`)) return;
      state.chartAccounts = state.chartAccounts.filter(a => a.id !== id);
      saveState();
      renderChartAccounts();
      refreshChartAccountSelectors();
    });
  });

  // Populate the Type dropdown in the add row
  const typeSel = document.getElementById("new-chart-type");
  if (typeSel) {
    const currentType = typeSel.value;
    typeSel.innerHTML = CHART_ACCOUNT_TYPES
      .map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
      .join("");
    if (currentType && CHART_ACCOUNT_TYPES.includes(currentType)) typeSel.value = currentType;
  }

  // Populate the Parent dropdown (only accounts within the selected type can be parents)
  refreshParentSelect();
}

function refreshParentSelect() {
  const parentSel = document.getElementById("new-chart-parent");
  const typeSel = document.getElementById("new-chart-type");
  if (!parentSel || !typeSel) return;
  const selectedType = typeSel.value;
  const parents = (state.chartAccounts || []).filter(a => a.type === selectedType && !a.parent);
  const current = parentSel.value;
  parentSel.innerHTML = `<option value="">— No parent —</option>` +
    parents.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join("");
  if (parents.some(p => p.name === current)) parentSel.value = current;
}

function refreshChartAccountSelectors() {
  // Refresh transaction-form dropdown if it's open
  const sel = document.getElementById("tx-chart-account");
  if (sel) {
    const cur = sel.value;
    populateChartAccountSelect("tx-chart-account");
    sel.value = cur;
  }
}

function renderEditableList(elId, key) {
  const el = document.getElementById(elId);
  if (!el) return; // settings card may have been removed
  const items = state[key];
  if (!items.length) {
    el.innerHTML = `<li class="muted" style="justify-content:center">None yet</li>`;
    return;
  }
  el.innerHTML = items.map(v => `
    <li>
      <span>${escapeHtml(v)}</span>
      <button class="del-btn" data-val="${escapeHtml(v)}" title="Remove">&times;</button>
    </li>
  `).join("");

  el.querySelectorAll(".del-btn").forEach(b => b.addEventListener("click", e => {
    const v = e.target.dataset.val;
    const inUse = state.transactions.some(t => (
      (key === "categories" && t.category === v) ||
      (key === "accounts" && t.account === v) ||
      (key === "payees" && t.payee === v)
    ));
    if (inUse) {
      if (!confirm(`"${v}" is used in existing transactions. Remove from list anyway? (Transactions will keep their current value.)`)) return;
    }
    state[key] = state[key].filter(x => x !== v);
    saveState();
    render();
  }));
}

// --------- Initial Render ---------
// Honor the user's Startup View preference (set in Settings → Data).
(function applyStartupTab() {
  const targetTab = state.startupView === "transactions" ? "transactions" : "dashboard";
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  syncTabActive(targetTab);
  const panel = document.getElementById(targetTab);
  if (panel) panel.classList.add("active");
})();

render();
// Initialize the Analytics filter default selections (current year for Date
// Range) and refresh the filter-count badge before the user opens the panel.
if (typeof populateAnalyticsFilters === "function") populateAnalyticsFilters();

// ============================================================
// NEW-SPEC MODULE — Jobs, Customer-Category pairs, Expenses table
// Layered on top of the existing app: existing state/forms/analytics
// remain untouched; this adds first-class Job records (YY001), a
// New Job page, conditional New-Transaction extensions, and analytics
// keyed off Job No.
// ============================================================
(function njModule() {
  // ---- Seeds ----
  const SEED_CUSTOMER_CATS = [
    ["Montpelier Schools", "Spring Sports"],
    ["Montpelier Schools", "Fall Sports"],
    ["Montpelier Schools", "Winter Sports"],
    ["Montpelier Schools", "Banners"],
    ["Montpelier Schools", "Framed Prints"],
    ["Montpelier Schools", "Mounted Prints"],
    ["Montpelier Music Boosters", "Banners"],
    ["Montpelier Parks & Rec", "Tee Ball"],
    ["Montpelier Parks & Rec", "Soccer"],
    ["Montpelier Softball", "Softball"],
    ["Montpelier Softball", "Banners"],
    ["Montpelier Baseball", "Baseball"],
    ["Montpelier Baseball", "Banners"],
    ["Montpelier Preschool", "Preschool"],
    ["Meagan Willis", "Buy Sell"],
  ];
  const SEED_EXPENSES = [
    ["Pictures", "CoGS", "Y"],
    ["Frames", "CoGS", "Y"],
    ["Banners", "CoGS", "Y"],
    ["Helper", "Misc Exp", "Y"],
    ["Give Back", "Donation", "Y"],
    ["Memory Mates", "CoGS", "N"],
    ["Envelopes", "CoGS", "N"],
  ];

  // ---- Job status pipeline ----
  const JOB_STATUSES = ["Shot", "Edited", "Ordered", "Delivered", "Invoiced", "Paid"];
  function getJobStatus(j) {
    if (!j) return "";
    if (j.status) return j.status;
    if (j.complete) return "Paid";
    return "";
  }
  function setJobStatus(j, status) {
    j.status = status || "";
    j.complete = (status === "Paid");
  }
  function statusPillHtml(status) {
    const s = status || "";
    if (!s) return `<span class="nj-status-pill nj-status-open">Open</span>`;
    const slug = s.toLowerCase().replace(/\s+/g, "-");
    return `<span class="nj-status-pill nj-status-${slug}">${escapeHtml(s)}</span>`;
  }

  // ---- State init ----
  if (!Array.isArray(state.jobs)) state.jobs = [];
  // Backfill status on jobs that predate the pipeline.
  state.jobs.forEach(j => {
    if (typeof j.status !== "string") j.status = j.complete ? "Paid" : "";
  });
  if (!Array.isArray(state.customerCategories) || state.customerCategories.length === 0) {
    state.customerCategories = SEED_CUSTOMER_CATS.map(([name, category]) => ({ name, category }));
  }
  if (!Array.isArray(state.expensesTable) || state.expensesTable.length === 0) {
    state.expensesTable = SEED_EXPENSES.map(([entry, chartOfAccounts, jobRelated]) =>
      ({ entry, chartOfAccounts, jobRelated })
    );
  }
  saveState();

  // ---- Helpers ----
  const $ = (id) => document.getElementById(id);
  const yyPrefix = (d) => String((d ? new Date(d + "T00:00:00") : new Date()).getFullYear()).slice(-2);

  function lowestAvailableJobNo(dateStr) {
    const yy = yyPrefix(dateStr);
    const used = new Set(
      (state.jobs || [])
        .map(j => j.jobNo || "")
        .filter(n => n.startsWith(yy))
        .map(n => parseInt(n.slice(2), 10))
        .filter(n => Number.isFinite(n) && n > 0)
    );
    let n = 1;
    while (used.has(n)) n++;
    return yy + String(n).padStart(3, "0");
  }

  function uniqueCustomers() {
    const seen = new Set();
    const out = [];
    (state.customerCategories || []).forEach(p => {
      if (p.name && !seen.has(p.name)) { seen.add(p.name); out.push(p.name); }
    });
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }
  function categoriesForCustomer(name) {
    return (state.customerCategories || [])
      .filter(p => p.name === name)
      .map(p => p.category)
      .filter(Boolean);
  }
  function jobsForCustomer(name) {
    return (state.jobs || []).filter(j => j.customer === name);
  }

  function renderOptions(sel, items, opts = {}) {
    const cur = sel.value;
    const placeholder = opts.placeholder !== undefined ? opts.placeholder : "— Select —";
    const allowAdd = opts.allowAdd !== false;
    sel.innerHTML =
      `<option value="">${placeholder}</option>` +
      items.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("") +
      (allowAdd ? `<option value="__new__">+ Add new…</option>` : "");
    if (items.includes(cur)) sel.value = cur;
  }

  // ============================================================
  // NEW JOB FORM
  // ============================================================
  const njForm = $("nj-form");
  const njDate = $("nj-date");
  const njJobNo = $("nj-jobno");
  const njCustomer = $("nj-customer");
  const njCategory = $("nj-category");
  const njHours = $("nj-hours");

  function njResetForm() {
    if (!njForm) return;
    njForm.reset();
    njDate.value = new Date().toISOString().slice(0, 10);
    njJobNo.value = lowestAvailableJobNo(njDate.value);
    renderOptions(njCustomer, uniqueCustomers());
    renderOptions(njCategory, []);
    const cb = document.getElementById("nj-complete-toggle");
    if (cb) cb.checked = false;
    syncNjCompletePills();
  }

  function syncNjCompletePills() {
    const cb = document.getElementById("nj-complete-toggle");
    const isY = !!(cb && cb.checked);
    document.querySelectorAll("#nj-complete-pill .year-pill").forEach(b => {
      b.classList.toggle("active", b.dataset.val === (isY ? "Y" : "N"));
    });
  }
  document.querySelectorAll("#nj-complete-pill .year-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      const cb = document.getElementById("nj-complete-toggle");
      if (!cb) return;
      cb.checked = btn.dataset.val === "Y";
      syncNjCompletePills();
    });
  });

  if (njDate) njDate.addEventListener("change", () => {
    njJobNo.value = lowestAvailableJobNo(njDate.value);
  });

  if (njCustomer) njCustomer.addEventListener("change", () => {
    if (njCustomer.value === "__new__") {
      const name = (prompt("New customer name:") || "").trim();
      if (!name) { njCustomer.value = ""; return; }
      // Add a placeholder pair (no category) so the customer appears in the list
      if (!uniqueCustomers().includes(name)) {
        state.customerCategories.push({ name, category: "" });
        saveState();
      }
      renderOptions(njCustomer, uniqueCustomers());
      njCustomer.value = name;
    }
    renderOptions(njCategory, categoriesForCustomer(njCustomer.value));
  });

  if (njCategory) njCategory.addEventListener("change", () => {
    if (njCategory.value === "__new__") {
      const cat = (prompt("New category for " + (njCustomer.value || "this customer") + ":") || "").trim();
      if (!cat) { njCategory.value = ""; return; }
      if (njCustomer.value) {
        const exists = (state.customerCategories || []).some(
          p => p.name === njCustomer.value && p.category === cat
        );
        if (!exists) {
          state.customerCategories.push({ name: njCustomer.value, category: cat });
          saveState();
        }
      }
      renderOptions(njCategory, categoriesForCustomer(njCustomer.value));
      njCategory.value = cat;
    }
  });

  if (njForm) njForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = njDate.value;
    if (isLockedDate(date)) { blockedToast(date.slice(0, 4)); return; }
    let jobNo = (njJobNo.value || "").trim();
    const customer = njCustomer.value;
    const category = njCategory.value;
    const hours = parseFloat(njHours.value) || 0;
    // Add-Job form no longer carries the Complete toggle — new jobs default to open.
    const complete = false;

    if (!date || !customer || customer === "__new__" || !category || category === "__new__") {
      alert("Date, Customer, and Category are required.");
      return;
    }
    if (!jobNo) jobNo = lowestAvailableJobNo(date);
    if ((state.jobs || []).some(j => j.jobNo === jobNo)) {
      alert(`Job No. ${jobNo} already exists. Pick a different number.`);
      return;
    }
    // Persist customer/category pair if new
    const exists = (state.customerCategories || []).some(p => p.name === customer && p.category === category);
    if (!exists) state.customerCategories.push({ name: customer, category });

    state.jobs.push({ date, jobNo, customer, category, hours, complete });

    // Auto-create a paired invoice for this job. Number is INV-<jobNo> (with
    // -N suffix if that's already taken). Bill To = customer, Job = category.
    if (!Array.isArray(state.invoices)) state.invoices = [];
    const usedInvNums = new Set(state.invoices.map(i => (i.number || "").trim()).filter(Boolean));
    const baseInvNum = `INV-${jobNo}`;
    let invNum = baseInvNum;
    if (usedInvNums.has(invNum)) {
      let n = 2;
      while (usedInvNums.has(`${baseInvNum}-${n}`)) n++;
      invNum = `${baseInvNum}-${n}`;
    }
    state.invoices.push({
      id: uid(),
      number: invNum,
      date,
      billTo: customer,
      job: category,
      jobNo,
      lineItems: [{ item: "", qty: "", description: "", price: "" }],
      taxMode: "nontax",
      taxLabel: "Ohio Sales Tax",
      taxRate: 7.25
    });

    saveState();
    njResetForm();
    renderNjJobsTable();
    renderNjAnalytics();
    if (typeof renderInvoicesList === "function") renderInvoicesList();
    if (window.toast) toast(`Job ${jobNo} saved (invoice ${invNum} created)`, { kind: "success" });
  });

  // ============================================================
  // NEW-TX FORM EXTENSIONS — conditional logic + jobNo persistence
  // ============================================================
  const txOutflow = $("tx-outflow");
  const txInflow = $("tx-inflow");
  const txVendor = $("tx-vendor");
  const txCustomer = $("tx-customer");
  const txCategory = $("tx-category");
  const txExistingToggle = $("tx-existing-job-toggle");
  // Pill buttons (Gross/Net look) drive the hidden checkbox.
  const __existingPills = document.querySelectorAll("#tx-existing-pill .year-pill");
  function syncExistingPills() {
    const isY = !!(txExistingToggle && txExistingToggle.checked);
    __existingPills.forEach(b => b.classList.toggle("active", b.dataset.val === (isY ? "Y" : "N")));
  }
  __existingPills.forEach(btn => btn.addEventListener("click", () => {
    if (!txExistingToggle) return;
    const want = btn.dataset.val === "Y";
    if (txExistingToggle.checked === want) return;
    txExistingToggle.checked = want;
    syncExistingPills();
    txExistingToggle.dispatchEvent(new Event("change", { bubbles: true }));
  }));
  if (txExistingToggle) txExistingToggle.addEventListener("change", syncExistingPills);
  syncExistingPills();
  // Back-compat shims so the rest of this module can keep using Y/N references.
  const txExistingY = { get checked() { return !!(txExistingToggle && txExistingToggle.checked); }, set checked(v) { if (txExistingToggle) txExistingToggle.checked = !!v; } };
  const txExistingN = { get checked() { return !!(txExistingToggle && !txExistingToggle.checked); }, set checked(v) { if (txExistingToggle) txExistingToggle.checked = !v; } };
  const txJobLink = $("tx-job-link");
  const txExpInc = $("tx-expense-income");
  const txChartAcc = $("tx-chart-account");

  function isInflow() {
    return (parseFloat(txInflow?.value) || 0) > 0;
  }
  function isExistingJob() {
    return !!(txExistingY && txExistingY.checked);
  }

  function refreshJobLinkOptions() {
    if (!txJobLink) return;
    const cur = txJobLink.value;
    // Hide completed jobs — but keep the currently-linked one visible so an
    // existing transaction's link doesn't silently disappear from the picker.
    const jobs = (state.jobs || [])
      .filter(j => getJobStatus(j) !== "Paid" || j.jobNo === cur)
      .slice()
      .sort((a, b) => (b.jobNo || "").localeCompare(a.jobNo || ""));
    txJobLink.innerHTML = `<option value="">— Select job —</option>` +
      jobs.map(j => {
        const st = getJobStatus(j);
        const tag = st ? ` (${st})` : "";
        return `<option value="${escapeHtml(j.jobNo)}">${escapeHtml(j.jobNo)} - ${escapeHtml(j.customer)} (${escapeHtml(j.category)})${tag}</option>`;
      }).join("");
    if (jobs.some(j => j.jobNo === cur)) txJobLink.value = cur;
  }

  function refreshExpenseIncomeOptions() {
    if (!txExpInc) return;
    const cur = txExpInc.value;
    const wantJobRel = isExistingJob() ? "Y" : "N";
    const items = (state.expensesTable || []).filter(e => e.jobRelated === wantJobRel);
    txExpInc.innerHTML =
      `<option value="">— None —</option>` +
      items.map(e => `<option value="${escapeHtml(e.entry)}" data-coa="${escapeHtml(e.chartOfAccounts)}">${escapeHtml(e.entry)}</option>`).join("") +
      `<option value="__new__">+ Add new…</option>`;
    if ([...txExpInc.options].some(o => o.value === cur)) txExpInc.value = cur;
  }

  function repopulateTxCustomer() {
    if (!txCustomer) return;
    const cur = txCustomer.value;
    const existing = isExistingJob();
    // Y → customers from Jobs table; N → general state.customers list
    const customers = existing
      ? Array.from(new Set((state.jobs || []).map(j => j.customer).filter(Boolean))).sort((a, b) => a.localeCompare(b))
      : (Array.isArray(state.customers) ? state.customers : []);
    txCustomer.innerHTML =
      `<option value="">— None —</option>` +
      customers.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("") +
      `<option value="__new__">+ Add new…</option>`;
    // Preserve current selection by adding it if missing
    if (cur && cur !== "__new__" && ![...txCustomer.options].some(o => o.value === cur)) {
      const opt = document.createElement("option");
      opt.value = cur; opt.textContent = cur;
      txCustomer.insertBefore(opt, txCustomer.querySelector('option[value="__new__"]'));
    }
    txCustomer.value = cur;
  }

  function refreshCategoryDatalistForCustomer() {
    // tx-category is now a real <select>. Populate it with the right option set
    // based on Existing Job + Customer, and preserve the current value.
    const sel = document.getElementById("tx-category");
    if (!sel) return;
    const cur = sel.value;
    const existing = isExistingJob();
    const cust = txCustomer?.value || "";
    let opts;
    if (existing && cust) {
      const fromJobs = (state.jobs || []).filter(j => j.customer === cust).map(j => j.category);
      const fromPairs = (state.customerCategories || []).filter(p => p.name === cust).map(p => p.category);
      opts = Array.from(new Set([...fromJobs, ...fromPairs].filter(Boolean))).sort((a, b) => a.localeCompare(b));
    } else {
      opts = Array.isArray(state.categories) ? state.categories : [];
    }
    sel.innerHTML =
      `<option value="">— None —</option>` +
      opts.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("") +
      `<option value="__new__">+ Add new…</option>`;
    // Preserve the saved/current value, inserting it if it isn't in the option set.
    if (cur && cur !== "__new__" && !opts.includes(cur)) {
      const opt = document.createElement("option");
      opt.value = cur; opt.textContent = cur;
      sel.insertBefore(opt, sel.querySelector('option[value="__new__"]'));
    }
    sel.value = cur;
  }

  function refreshTxVendorOptions() {
    const sel = document.getElementById("tx-vendor");
    if (!sel) return;
    const cur = sel.value;
    const vendors = Array.isArray(state.vendors) ? state.vendors : [];
    sel.innerHTML =
      `<option value="">— None —</option>` +
      vendors.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("") +
      `<option value="__new__">+ Add new…</option>`;
    if (cur && cur !== "__new__" && !vendors.includes(cur)) {
      const opt = document.createElement("option");
      opt.value = cur; opt.textContent = cur;
      sel.insertBefore(opt, sel.querySelector('option[value="__new__"]'));
    }
    sel.value = cur;
  }

  if (document.getElementById("tx-vendor")) {
    document.getElementById("tx-vendor").addEventListener("change", e => {
      if (e.target.value !== "__new__") return;
      const name = (prompt("New vendor name:") || "").trim();
      if (!name) { e.target.value = ""; return; }
      if (!state.vendors.includes(name)) {
        state.vendors.push(name);
        state.vendors.sort();
        saveState();
      }
      refreshTxVendorOptions();
      e.target.value = name;
    });
  }

  // "+ Add new…" handler
  if (document.getElementById("tx-category")) {
    document.getElementById("tx-category").addEventListener("change", e => {
      if (e.target.value !== "__new__") return;
      const name = (prompt("New category name:") || "").trim();
      if (!name) { e.target.value = ""; return; }
      if (!state.categories.includes(name)) {
        state.categories.push(name);
        state.categories.sort();
        saveState();
      }
      // Persist customer/category pair when in Existing Job mode
      if (isExistingJob() && txCustomer && txCustomer.value) {
        const cust = txCustomer.value;
        if (!(state.customerCategories || []).some(p => p.name === cust && p.category === name)) {
          (state.customerCategories || (state.customerCategories = [])).push({ name: cust, category: name });
          saveState();
        }
      }
      refreshCategoryDatalistForCustomer();
      e.target.value = name;
    });
  }

  function applyTxConditionalUI() {
    const inflow = isInflow();
    const existing = isExistingJob();
    // Payee is never required (user request). Strip the attribute if present.
    const payeeEl = document.getElementById("tx-payee");
    if (payeeEl) payeeEl.removeAttribute("required");
    // Per spec: disable Vendor and Expense/Income on inflow.
    if (txVendor) txVendor.disabled = inflow;
    if (txExpInc) txExpInc.disabled = inflow;
    // Job picker only meaningful when Existing Job = Y
    if (txJobLink) txJobLink.disabled = !existing;
    // Customer is meaningless when Existing Job = N (job hasn't been picked yet)
    if (txCustomer) txCustomer.disabled = !existing;
    if (txCategory) txCategory.disabled = false;
    if (txChartAcc) txChartAcc.disabled = false;
    repopulateTxCustomer();
    refreshCategoryDatalistForCustomer();
    refreshExpenseIncomeOptions();
    if (existing && inflow && txChartAcc) {
      setChartAccountTo("Sales");
    }
  }

  // Cascade Category options when Customer changes (Existing Job = Y)
  if (txCustomer) txCustomer.addEventListener("change", () => {
    refreshCategoryDatalistForCustomer();
  });

  // Wire conditional triggers
  [txOutflow, txInflow].forEach(el => el && el.addEventListener("input", applyTxConditionalUI));
  [txExistingToggle].forEach(el => el && el.addEventListener("change", () => {
    refreshJobLinkOptions();
    applyTxConditionalUI();
    if (isExistingJob() && txJobLink && txJobLink.value) {
      // Pre-fill customer/category from selected job
      autofillFromJob(txJobLink.value);
    } else if (!isExistingJob()) {
      // Optional: clear customer/category when toggling off
    }
  }));

  function autofillFromJob(jobNo) {
    const job = (state.jobs || []).find(j => j.jobNo === jobNo);
    if (!job) return;
    if (txCustomer) {
      // Existing customer dropdown uses options; insert + select if missing
      if (![...txCustomer.options].some(o => o.value === job.customer)) {
        const opt = document.createElement("option");
        opt.value = job.customer; opt.textContent = job.customer;
        const newOpt = txCustomer.querySelector('option[value="__new__"]');
        if (newOpt) txCustomer.insertBefore(opt, newOpt);
        else txCustomer.appendChild(opt);
      }
      txCustomer.value = job.customer;
    }
    if (txCategory) txCategory.value = job.category;
  }

  if (txJobLink) txJobLink.addEventListener("change", () => {
    if (txJobLink.value) autofillFromJob(txJobLink.value);
  });

  function setChartAccountTo(coa) {
    if (!coa || !txChartAcc) return;
    const target = coa.trim().toLowerCase();
    // 1) Exact match on value
    let match = [...txChartAcc.options].find(o => o.value.trim().toLowerCase() === target);
    // 2) Exact match on visible text
    if (!match) match = [...txChartAcc.options].find(o => (o.textContent || "").trim().toLowerCase() === target);
    // 3) After a colon (parent:child) — match the child segment
    if (!match) match = [...txChartAcc.options].find(o => {
      const v = o.value.includes(":") ? o.value.split(":").pop() : o.value;
      return v.trim().toLowerCase() === target;
    });
    // 4) Substring match in text
    if (!match) match = [...txChartAcc.options].find(o => (o.textContent || "").trim().toLowerCase().includes(target));
    // 5) No match — inject a transient option so the value persists on save
    if (!match) {
      const opt = document.createElement("option");
      opt.value = coa;
      opt.textContent = coa + " (auto)";
      opt.dataset.njAuto = "1";
      txChartAcc.appendChild(opt);
      match = opt;
    }
    txChartAcc.value = match.value;
  }

  if (txExpInc) txExpInc.addEventListener("change", () => {
    if (txExpInc.value === "__new__") {
      const entry = (prompt("New Expense entry name:") || "").trim();
      if (!entry) { txExpInc.value = ""; return; }
      const coa = (prompt("Chart of Accounts for \"" + entry + "\":") || "").trim();
      const jobRel = isExistingJob() ? "Y" : "N";
      state.expensesTable.push({ entry, chartOfAccounts: coa, jobRelated: jobRel });
      saveState();
      refreshExpenseIncomeOptions();
      txExpInc.value = entry;
    }
    // Auto-set Chart of Accounts to the entry's COA
    const sel = txExpInc.options[txExpInc.selectedIndex];
    const coa = sel?.getAttribute("data-coa");
    setChartAccountTo(coa);
  });

  // Hook into the modal opening — populate new fields each time it opens.
  // We can't intercept openTxModal directly without breaking refs, but we can
  // observe modal visibility via MutationObserver.
  const txModal = $("tx-modal");
  if (txModal) {
    const obs = new MutationObserver(() => {
      if (!txModal.classList.contains("hidden")) {
        // Modal just opened — populate
        const editingId = $("tx-id").value;
        const tx = editingId ? (state.transactions || []).find(t => t.id === editingId) : null;
        // Drop Payee/Category required when editing so legacy transactions can
        // be re-tagged with the new logic without being forced to fill them.
        const payeeEl = document.getElementById("tx-payee");
        const catEl = document.getElementById("tx-category");
        if (editingId) {
          payeeEl?.removeAttribute("required");
          catEl?.removeAttribute("required");
        } else {
          payeeEl?.setAttribute("required", "");
          catEl?.setAttribute("required", "");
        }
        const linkedJobNo = tx?.jobNo || "";
        if (linkedJobNo) {
          if (txExistingY) txExistingY.checked = true;
        } else {
          if (txExistingN) txExistingN.checked = true;
        }
        if (typeof syncExistingPills === "function") syncExistingPills();
        refreshJobLinkOptions();
        if (txJobLink) txJobLink.value = linkedJobNo;
        applyTxConditionalUI();
        // Re-apply the saved vendor onto the now-populated select.
        refreshTxVendorOptions();
        const venSel = document.getElementById("tx-vendor");
        if (venSel) {
          const savedV = tx?.vendor || "";
          if (savedV && savedV !== "__new__" && ![...venSel.options].some(o => o.value === savedV)) {
            const opt = document.createElement("option");
            opt.value = savedV; opt.textContent = savedV;
            venSel.insertBefore(opt, venSel.querySelector('option[value="__new__"]'));
          }
          venSel.value = savedV;
        }
        // Re-apply the saved category onto the now-populated select. If the
        // saved value isn't in the option set yet (e.g. legacy category not
        // in state.categories), inject it so it stays selected.
        const catSel = document.getElementById("tx-category");
        if (catSel) {
          const saved = tx?.category || "";
          if (saved && saved !== "__new__" && ![...catSel.options].some(o => o.value === saved)) {
            const opt = document.createElement("option");
            opt.value = saved; opt.textContent = saved;
            catSel.insertBefore(opt, catSel.querySelector('option[value="__new__"]'));
          }
          catSel.value = saved;
        }
        if (txExpInc) txExpInc.value = tx?.expenseIncome || "";
        const markCb = document.getElementById("tx-nj-marked");
        if (markCb) markCb.checked = !!(tx?.njMarked);
      }
    });
    obs.observe(txModal, { attributes: true, attributeFilter: ["class"] });
  }

  // Capture-phase submit: stash new-spec fields BEFORE original handler resets the form
  let __pendingNjLink = null;
  if (txForm) {
    txForm.addEventListener("submit", () => {
      __pendingNjLink = {
        editingId: $("tx-id").value || null,
        txCountBefore: (state.transactions || []).length,
        jobNo: isExistingJob() ? (txJobLink?.value || "") : "",
        expenseIncome: txExpInc?.value && txExpInc.value !== "__new__" ? txExpInc.value : "",
        njMarked: !!document.getElementById("tx-nj-marked")?.checked,
      };
    }, true);
    // Bubble-phase: run AFTER the original handler — patch the saved tx (only if it actually saved)
    txForm.addEventListener("submit", () => {
      if (!__pendingNjLink) return;
      const link = __pendingNjLink; __pendingNjLink = null;
      let tx = null;
      if (link.editingId) {
        // Edit succeeded only if modal closed (original handler calls closeTxModal on success)
        if (txModal && txModal.classList.contains("hidden")) {
          tx = (state.transactions || []).find(t => t.id === link.editingId);
        }
      } else {
        // New only if count increased
        if ((state.transactions || []).length > link.txCountBefore) {
          tx = (state.transactions || [])[state.transactions.length - 1];
        }
      }
      if (tx) {
        if (link.jobNo) tx.jobNo = link.jobNo; else delete tx.jobNo;
        if (link.expenseIncome) tx.expenseIncome = link.expenseIncome; else delete tx.expenseIncome;
        if (link.njMarked) tx.njMarked = true; else delete tx.njMarked;
        saveState();
        renderNjAnalytics();
        // The original submit handler already called render() before our patch
        // — re-render the transactions table so the new Job No. / Expense
        // cells (and the green badge) reflect the just-saved values.
        if (typeof renderTransactions === "function") renderTransactions();
        stampTxNjBadges();
      }
    });
  }

  // ============================================================
  // SETTINGS PANELS
  // ============================================================
  function renderNjJobsTable() {
    const tbody = document.querySelector("#nj-jobs-table tbody");
    if (!tbody) return;
    const jobs = (state.jobs || []).slice().sort((a, b) =>
      (b.jobNo || "").localeCompare(a.jobNo || "")
    );
    if (jobs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted" style="text-align:center;padding:14px">No jobs yet. Create one on the New Job page.</td></tr>`;
      return;
    }
    tbody.innerHTML = jobs.map(j => `
      <tr data-jobno="${escapeHtml(j.jobNo)}" class="nj-row-edit">
        <td>${escapeHtml(j.date || "")}</td>
        <td><strong>${escapeHtml(j.jobNo)}</strong></td>
        <td>${escapeHtml(j.customer || "")}</td>
        <td>${escapeHtml(j.category || "")}</td>
        <td style="text-align:right">${j.hours ? j.hours : ""}</td>
        <td>${statusPillHtml(getJobStatus(j))}</td>
      </tr>
    `).join("");
  }

  function renderNjCcTable() {
    const tbody = document.querySelector("#nj-cc-table tbody");
    if (!tbody) return;
    const pairs = (state.customerCategories || []).slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || "") || (a.category || "").localeCompare(b.category || ""));
    tbody.innerHTML = pairs.length === 0
      ? `<tr><td colspan="2" class="muted" style="text-align:center;padding:14px">No pairs.</td></tr>`
      : pairs.map((p, i) => `
        <tr data-idx="${i}" class="nj-row-clickable" data-action="del-cc" title="Click to delete">
          <td>${escapeHtml(p.name || "")}</td>
          <td>${escapeHtml(p.category || "")}</td>
        </tr>
      `).join("");
  }

  function renderNjExTable() {
    const tbody = document.querySelector("#nj-ex-table tbody");
    if (!tbody) return;
    const items = (state.expensesTable || []);
    tbody.innerHTML = items.length === 0
      ? `<tr><td colspan="3" class="muted" style="text-align:center;padding:14px">No entries.</td></tr>`
      : items.map((e, i) => `
        <tr data-idx="${i}" class="nj-row-clickable" data-action="del-ex" title="Click to delete">
          <td>${escapeHtml(e.entry || "")}</td>
          <td>${escapeHtml(e.chartOfAccounts || "")}</td>
          <td>${escapeHtml(e.jobRelated || "")}</td>
        </tr>
      `).join("");
  }

  // ============================================================
  // EDIT JOB MODAL
  // ============================================================
  const njEditModal = $("nj-edit-modal");
  const njEditForm = $("nj-edit-form");

  function openJobEditModal(jobNo) {
    const job = (state.jobs || []).find(j => j.jobNo === jobNo);
    if (!job) return;
    $("nj-edit-orig-jobno").value = job.jobNo;
    $("nj-edit-date").value = job.date || "";
    $("nj-edit-jobno").value = job.jobNo;
    renderOptions($("nj-edit-customer"), uniqueCustomers());
    if (job.customer && ![...$("nj-edit-customer").options].some(o => o.value === job.customer)) {
      const opt = document.createElement("option");
      opt.value = job.customer; opt.textContent = job.customer;
      const newOpt = $("nj-edit-customer").querySelector('option[value="__new__"]');
      $("nj-edit-customer").insertBefore(opt, newOpt);
    }
    $("nj-edit-customer").value = job.customer || "";
    renderOptions($("nj-edit-category"), categoriesForCustomer(job.customer));
    if (job.category && ![...$("nj-edit-category").options].some(o => o.value === job.category)) {
      const opt = document.createElement("option");
      opt.value = job.category; opt.textContent = job.category;
      const newOpt = $("nj-edit-category").querySelector('option[value="__new__"]');
      $("nj-edit-category").insertBefore(opt, newOpt);
    }
    $("nj-edit-category").value = job.category || "";
    $("nj-edit-hours").value = (job.hours || job.hours === 0) ? Number(job.hours).toFixed(2) : "";
    $("nj-edit-status-sel").value = getJobStatus(job);
    njEditModal.classList.remove("hidden");
  }

  function closeJobEditModal() {
    njEditModal.classList.add("hidden");
  }

  if ($("nj-edit-customer")) $("nj-edit-customer").addEventListener("change", () => {
    const sel = $("nj-edit-customer");
    if (sel.value === "__new__") {
      const name = (prompt("New customer name:") || "").trim();
      if (!name) { sel.value = ""; return; }
      if (!uniqueCustomers().includes(name)) {
        state.customerCategories.push({ name, category: "" });
        saveState();
      }
      renderOptions(sel, uniqueCustomers());
      sel.value = name;
    }
    renderOptions($("nj-edit-category"), categoriesForCustomer(sel.value));
  });

  if ($("nj-edit-category")) $("nj-edit-category").addEventListener("change", () => {
    const sel = $("nj-edit-category");
    if (sel.value === "__new__") {
      const cat = (prompt("New category:") || "").trim();
      if (!cat) { sel.value = ""; return; }
      const cust = $("nj-edit-customer").value;
      if (cust && !categoriesForCustomer(cust).includes(cat)) {
        state.customerCategories.push({ name: cust, category: cat });
        saveState();
      }
      renderOptions(sel, categoriesForCustomer(cust));
      sel.value = cat;
    }
  });

  if ($("nj-edit-cancel")) $("nj-edit-cancel").addEventListener("click", closeJobEditModal);
  if (njEditModal) njEditModal.addEventListener("click", e => {
    if (e.target === njEditModal) closeJobEditModal();
  });

  if ($("nj-edit-delete")) $("nj-edit-delete").addEventListener("click", () => {
    const orig = $("nj-edit-orig-jobno").value;
    if (!orig) return;
    const job = (state.jobs || []).find(j => j.jobNo === orig);
    if (job && isLockedDate(job.date)) { blockedToast(job.date.slice(0, 4)); return; }
    if (!confirm(`Delete job ${orig}? (Job number ${orig} will become reusable.)`)) return;
    state.jobs = (state.jobs || []).filter(j => j.jobNo !== orig);
    (state.transactions || []).forEach(t => { if (t.jobNo === orig) delete t.jobNo; });
    saveState();
    closeJobEditModal();
    renderNjJobsTable();
    renderNjAnalytics();
  });

  if (njEditForm) njEditForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const orig = $("nj-edit-orig-jobno").value;
    const job = (state.jobs || []).find(j => j.jobNo === orig);
    if (!job) { closeJobEditModal(); return; }
    const newDate = $("nj-edit-date").value;
    if (isLockedDate(job.date)) { blockedToast(job.date.slice(0, 4)); return; }
    if (isLockedDate(newDate)) { blockedToast((newDate || "").slice(0, 4)); return; }
    const newJobNo = ($("nj-edit-jobno").value || "").trim();
    if (!newJobNo) { alert("Job Number is required."); return; }
    if (newJobNo !== orig && (state.jobs || []).some(j => j.jobNo === newJobNo)) {
      alert(`Job No. ${newJobNo} already exists.`); return;
    }
    const customer = $("nj-edit-customer").value;
    const category = $("nj-edit-category").value;
    if (!customer || customer === "__new__" || !category || category === "__new__") {
      alert("Customer and Category are required."); return;
    }
    // Re-link transactions if Job No. changed
    if (newJobNo !== orig) {
      (state.transactions || []).forEach(t => { if (t.jobNo === orig) t.jobNo = newJobNo; });
    }
    job.date = $("nj-edit-date").value;
    job.jobNo = newJobNo;
    job.customer = customer;
    job.category = category;
    const h = parseFloat($("nj-edit-hours").value);
    job.hours = Number.isFinite(h) && h > 0 ? h : 0;
    setJobStatus(job, $("nj-edit-status-sel").value);
    // Persist customer/category pair
    if (!(state.customerCategories || []).some(p => p.name === customer && p.category === category)) {
      state.customerCategories.push({ name: customer, category });
    }
    saveState();
    closeJobEditModal();
    renderNjJobsTable();
    renderNjAnalytics();
    if (window.toast) toast(`Job ${newJobNo} updated`, { kind: "success" });
  });

  // Job Analytics — inline status select changes the job's status without
  // opening the Edit Job modal.
  document.addEventListener("click", (e) => {
    if (e.target.closest("select.nj-status-select")) e.stopPropagation();
  }, true);
  document.addEventListener("change", (e) => {
    const sel = e.target.closest("select.nj-status-select");
    if (!sel) return;
    e.stopPropagation();
    const jobNo = sel.dataset.jobno;
    const job = (state.jobs || []).find(j => j.jobNo === jobNo);
    if (!job) return;
    if (isLockedDate(job.date)) {
      blockedToast(job.date.slice(0, 4));
      sel.value = sel.dataset.status || ""; // revert UI
      return;
    }
    setJobStatus(job, sel.value);
    sel.dataset.status = sel.value || ""; // re-tint immediately before re-render
    saveState();
    renderNjJobsTable();
    renderNjAnalytics();
  });

  // Row-click to open edit modal (on either jobs table). The "+ Invoice"
  // button and the expand caret are sibling clicks that should NOT open the
  // edit modal — both handled below first.
  document.addEventListener("click", (e) => {
    // Expand caret on the Job Analytics row
    const expBtn = e.target.closest(".nj-job-expand-btn");
    if (expBtn) {
      e.stopPropagation();
      const row = expBtn.closest("tr");
      if (!row) return;
      const jobNo = row.dataset.jobno;
      const expRow = row.parentElement.querySelector(`.nj-job-expand-row[data-for="${jobNo}"]`);
      if (!expRow) return;
      const open = expRow.hidden;
      expRow.hidden = !open;
      expBtn.textContent = open ? "▾" : "▸";
      return;
    }
    const invBtn = e.target.closest(".nj-invoice-btn");
    if (invBtn) {
      e.stopPropagation();
      const jobNo = invBtn.dataset.jobno;
      if (!jobNo) return;
      // Switch to Invoices tab.
      document.querySelectorAll('.tab-btn[data-tab="invoices"]').forEach(b => b.click());
      // Then open a new invoice and pre-select the job in the dropdown.
      setTimeout(() => {
        const newBtn = document.getElementById("btn-new-invoice");
        if (newBtn) newBtn.click();
        // The invoice editor populates the job select via a MutationObserver
        // — wait one more tick before picking the option so it exists.
        setTimeout(() => {
          const sel = document.getElementById("invoice-job");
          if (!sel) return;
          const opt = [...sel.options].find(o => o.value === "nj:" + jobNo);
          if (opt) {
            sel.value = "nj:" + jobNo;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, 50);
      }, 0);
      return;
    }
    const row = e.target.closest("tr.nj-row-edit");
    if (!row) return;
    const jobNo = row.dataset.jobno;
    if (jobNo) openJobEditModal(jobNo);
  });

  // Settings table click handlers (delete buttons for cc / ex)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "del-cc") {
      const idx = parseInt(btn.closest("tr")?.dataset.idx, 10);
      if (!Number.isFinite(idx)) return;
      const sorted = (state.customerCategories || []).slice()
        .sort((a, b) => (a.name || "").localeCompare(b.name || "") || (a.category || "").localeCompare(b.category || ""));
      const target = sorted[idx];
      if (!target) return;
      if (!confirm(`Remove pair "${target.name} — ${target.category}"?`)) return;
      state.customerCategories = (state.customerCategories || []).filter(p => p !== target);
      saveState();
      renderNjCcTable();
    } else if (action === "del-ex") {
      const idx = parseInt(btn.closest("tr")?.dataset.idx, 10);
      if (!Number.isFinite(idx)) return;
      const target = state.expensesTable[idx];
      if (!target) return;
      if (!confirm(`Remove entry "${target.entry}"?`)) return;
      state.expensesTable.splice(idx, 1);
      saveState();
      renderNjExTable();
    }
  });

  // Add-pair / add-expense
  if ($("nj-cc-add")) $("nj-cc-add").addEventListener("click", () => {
    const name = $("nj-cc-name").value.trim();
    const category = $("nj-cc-category").value.trim();
    if (!name || !category) { alert("Customer and Category are required."); return; }
    const exists = (state.customerCategories || []).some(p => p.name === name && p.category === category);
    if (!exists) state.customerCategories.push({ name, category });
    saveState();
    $("nj-cc-name").value = "";
    $("nj-cc-category").value = "";
    renderNjCcTable();
  });
  if ($("nj-ex-add")) $("nj-ex-add").addEventListener("click", () => {
    const entry = $("nj-ex-entry").value.trim();
    const coa = $("nj-ex-coa").value.trim();
    const jobRelated = $("nj-ex-jobrel").value;
    if (!entry || !coa) { alert("Entry and Chart of Accounts are required."); return; }
    state.expensesTable.push({ entry, chartOfAccounts: coa, jobRelated });
    saveState();
    $("nj-ex-entry").value = "";
    $("nj-ex-coa").value = "";
    renderNjExTable();
  });

  // ============================================================
  // ANALYTICS — profit per Job No.
  // ============================================================
  function njAnalyticsPopulateFilters() {
    const allJobs = state.jobs || [];
    const yearSel = $("nj-analytics-year");
    if (yearSel) {
      const cur = yearSel.value;
      const years = [...new Set(allJobs.map(j => (j.date || "").slice(0, 4)).filter(y => /^\d{4}$/.test(y)))]
        .sort((a, b) => b.localeCompare(a));
      yearSel.innerHTML = `<option value="">All</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
      if (years.includes(cur)) yearSel.value = cur;
    }
    const custSel = $("nj-analytics-customer");
    if (custSel) {
      const cur = custSel.value;
      const customers = [...new Set(allJobs.map(j => (j.customer || "").trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
      custSel.innerHTML = `<option value="">All</option>` + customers.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
      if (customers.includes(cur)) custSel.value = cur;
    }
    const catSel = $("nj-analytics-category");
    if (catSel) {
      const cur = catSel.value;
      const cats = [...new Set(allJobs.map(j => (j.category || "").trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
      catSel.innerHTML = `<option value="">All</option>` + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
      if (cats.includes(cur)) catSel.value = cur;
    }
  }

  function renderNjAnalytics() {
    const tbody = document.querySelector("#nj-analytics-table tbody");
    njAnalyticsPopulateFilters();
    const fYear = $("nj-analytics-year")?.value || "";
    const fCust = $("nj-analytics-customer")?.value || "";
    const fCat  = $("nj-analytics-category")?.value || "";
    const allJobs = state.jobs || [];
    const jobs = allJobs.slice()
      .filter(j => !fYear || (j.date || "").startsWith(fYear))
      .filter(j => !fCust || (j.customer || "").trim() === fCust)
      .filter(j => !fCat  || (j.category || "").trim() === fCat)
      .sort((a, b) => (b.jobNo || "").localeCompare(a.jobNo || ""));
    const openEl = $("nj-open-count");
    const completeEl = $("nj-complete-count");
    if (openEl) openEl.textContent = jobs.filter(j => getJobStatus(j) !== "Paid").length;
    if (completeEl) completeEl.textContent = jobs.filter(j => getJobStatus(j) === "Paid").length;
    if (!tbody) return;
    if (jobs.length === 0) {
      const empty = (fYear || fCust || fCat)
        ? "No jobs match the current filters."
        : "No jobs yet — add one above.";
      tbody.innerHTML = `<tr><td colspan="10" class="muted" style="text-align:center;padding:14px">${empty}</td></tr>`;
      return;
    }
    const txs = state.transactions || [];
    tbody.innerHTML = jobs.map(j => {
      const linked = txs.filter(t => t.jobNo === j.jobNo)
        .slice()
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      const income = linked.filter(t => t.type === "income").reduce((s, t) => s + (+t.amount || 0), 0);
      const expense = linked.filter(t => t.type === "expense").reduce((s, t) => s + (+t.amount || 0), 0);
      const profit = income - expense;
      const fmt = (n) => "$" + n.toFixed(2);
      const linkedRowsHtml = linked.length
        ? `<table class="nj-job-tx-mini">
             <thead><tr>
               <th>Date</th><th>Type</th><th>Vendor / Customer</th><th>Category</th><th>Expense</th><th>Memo</th><th style="text-align:right">Amount</th>
             </tr></thead>
             <tbody>${linked.map(t => {
               const partyLabel = t.type === "expense"
                 ? (t.vendor || t.customer || "")
                 : (t.customer || t.vendor || "");
               const cls = t.type === "income" ? "income" : "expense";
               const sign = t.type === "expense" ? "-" : "";
               return `<tr>
                 <td>${escapeHtml(t.date || "")}</td>
                 <td>${t.type === "income" ? "Inflow" : "Outflow"}</td>
                 <td>${escapeHtml(partyLabel)}</td>
                 <td>${escapeHtml(t.category || "")}</td>
                 <td>${escapeHtml(t.expenseIncome || "")}</td>
                 <td>${escapeHtml(t.memo || "")}</td>
                 <td style="text-align:right;color:${t.type === "income" ? "#27ae60" : "#c0392b"};font-weight:600">${sign}${fmt(Math.abs(+t.amount || 0))}</td>
               </tr>`;
             }).join("")}</tbody>
           </table>`
        : `<div class="muted" style="padding:8px 4px">No transactions linked to this job yet.</div>`;
      return `
        <tr data-jobno="${escapeHtml(j.jobNo)}" class="nj-row-edit">
          <td data-col="jobno"><button type="button" class="nj-job-expand-btn" aria-label="Expand transactions">▸</button> <strong>${escapeHtml(j.jobNo)}</strong></td>
          <td data-col="customer">${escapeHtml(j.customer || "")}</td>
          <td data-col="category">${escapeHtml(j.category || "")}</td>
          <td data-col="hours" style="text-align:right">${j.hours || ""}</td>
          <td data-col="income" style="text-align:right">${fmt(income)}</td>
          <td data-col="expense" style="text-align:right">${fmt(expense)}</td>
          <td data-col="profit" style="text-align:right; color:${profit >= 0 ? "#27ae60" : "#c0392b"}">${fmt(profit)}</td>
          <td data-col="status" style="text-align:center">
            <select class="nj-status-select" data-jobno="${escapeHtml(j.jobNo)}" data-status="${escapeHtml(getJobStatus(j) || "")}">
              ${["", ...JOB_STATUSES].map(s => {
                const cur = getJobStatus(j);
                const label = s === "" ? "Open" : s;
                return `<option value="${escapeHtml(s)}"${s === cur ? " selected" : ""}>${escapeHtml(label)}</option>`;
              }).join("")}
            </select>
          </td>
          <td data-col="invoice"><button type="button" class="btn nj-invoice-btn" data-jobno="${escapeHtml(j.jobNo)}" title="Create an invoice for this job">+ Invoice</button></td>
        </tr>
        <tr class="nj-job-expand-row" data-for="${escapeHtml(j.jobNo)}" hidden>
          <td colspan="9" class="nj-job-expand-cell">${linkedRowsHtml}</td>
        </tr>
      `;
    }).join("");
  }

  // ============================================================
  // Tab activation hook — render on tab switch
  // ============================================================
  document.querySelectorAll('.tab-btn[data-tab="newjob"]').forEach(b => {
    b.addEventListener("click", () => {
      njResetForm();
      renderNjAnalytics();
    });
  });
  document.querySelectorAll('.tab-btn[data-tab="settings"]').forEach(b => {
    b.addEventListener("click", () => {
      renderNjJobsTable();
      renderNjCcTable();
      renderNjExTable();
      // Mirror the main Chart of Accounts list into the new-spec COA picker
      if (typeof populateChartAccountSelect === "function") populateChartAccountSelect("nj-ex-coa");
    });
  });

  // ============================================================
  // Job/Category Report — By Job No. ↔ By Category toggle
  // ============================================================
  window.jobsReportGroupMode = window.jobsReportGroupMode || "job";
  document.querySelectorAll("#jobs-report-group-toggle .year-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      window.jobsReportGroupMode = btn.dataset.group;
      document.querySelectorAll("#jobs-report-group-toggle .year-pill").forEach(b => {
        b.classList.toggle("active", b === btn);
      });
      if (typeof renderJobsReport === "function") renderJobsReport();
    });
  });

  // ============================================================
  // BACKFILL JOB NO. — scan unlinked transactions and bulk-tag them
  // with their best-matching job (Customer + Category + date proximity).
  // ============================================================
  function njBackfillUnlinkedCount() {
    return (state.transactions || []).filter(t => !t.jobNo).length;
  }
  function njBackfillUpdateStat() {
    const el = document.getElementById("nj-backfill-stat");
    if (el) el.textContent = `${njBackfillUnlinkedCount()} transactions without Job No.`;
    const undoBtn = document.getElementById("nj-backfill-undo");
    if (undoBtn) {
      const snap = state.lastBackfillUndo;
      if (snap && Array.isArray(snap.changes) && snap.changes.length > 0) {
        undoBtn.hidden = false;
        const when = snap.at ? new Date(snap.at).toLocaleString() : "";
        undoBtn.textContent = `Undo last backfill (${snap.changes.length} tx${when ? " · " + when : ""})`;
      } else {
        undoBtn.hidden = true;
      }
    }
  }

  // Score a candidate job for a given tx. Returns { score, job }.
  function njBackfillScore(t, j) {
    let score = 0;
    const tCust = (t.customer || "").trim().toLowerCase();
    const jCust = (j.customer || "").trim().toLowerCase();
    if (tCust && jCust && tCust === jCust) score += 50;
    const tCat = (t.category || "").trim().toLowerCase();
    const jCat = (j.category || "").trim().toLowerCase();
    if (tCat && jCat && tCat === jCat) score += 30;
    // Date proximity: 0 days → 20; ±90 → 0; linear in between.
    if (t.date && j.date) {
      const d1 = Date.parse(t.date + "T00:00:00");
      const d2 = Date.parse(j.date + "T00:00:00");
      if (!isNaN(d1) && !isNaN(d2)) {
        const days = Math.abs(d1 - d2) / 86400000;
        const prox = Math.max(0, 20 - (days / 90) * 20);
        score += Math.round(prox);
      }
    }
    return score;
  }

  function njBackfillBestMatch(t) {
    let best = null;
    let bestScore = 0;
    (state.jobs || []).forEach(j => {
      const s = njBackfillScore(t, j);
      if (s > bestScore) { best = j; bestScore = s; }
    });
    return best ? { job: best, score: bestScore } : null;
  }

  // Build the suggestions list, filtered by toolbar settings.
  function njBackfillBuildRows() {
    const minScore = parseInt(document.getElementById("nj-backfill-threshold")?.value, 10) || 0;
    const fType    = document.getElementById("nj-backfill-type")?.value || "";
    const fCust    = document.getElementById("nj-backfill-customer")?.value || "";
    const fYear    = document.getElementById("nj-backfill-year")?.value || "";
    const txs = (state.transactions || []).filter(t => {
      if (t.jobNo) return false;
      if (fType && t.type !== fType) return false;
      if (fCust && (t.customer || "").trim() !== fCust) return false;
      if (fYear && (t.date || "").slice(0, 4) !== fYear) return false;
      return true;
    });
    return txs.map(t => {
      const m = njBackfillBestMatch(t);
      return { tx: t, match: m, score: m ? m.score : 0 };
    })
    .filter(r => r.score >= minScore || (minScore === 0))
    .sort((a, b) => b.score - a.score || (a.tx.date || "").localeCompare(b.tx.date || ""));
  }

  function njBackfillRender() {
    const tbody = document.getElementById("nj-backfill-tbody");
    const summary = document.getElementById("nj-backfill-summary");
    if (!tbody) return;
    const rows = njBackfillBuildRows();
    const minScore = parseInt(document.getElementById("nj-backfill-threshold")?.value, 10) || 0;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted" style="text-align:center;padding:18px">No matching unlinked transactions.</td></tr>`;
    } else {
      tbody.innerHTML = rows.map(r => {
        const t = r.tx;
        const m = r.match;
        const scoreClass = r.score >= 80 ? "score-high" : r.score >= 50 ? "score-med" : "score-low";
        const matchLabel = m
          ? `${escapeHtml(m.job.jobNo)} — ${escapeHtml(m.job.customer || "")} (${escapeHtml(m.job.category || "")})`
          : `<span class="muted">— no match —</span>`;
        const checked = (m && r.score >= minScore) ? "checked" : "";
        const noMatchCls = m ? "" : " no-match";
        return `<tr class="${noMatchCls}" data-tx-id="${escapeHtml(t.id)}" data-job-no="${m ? escapeHtml(m.job.jobNo) : ""}">
          <td><input type="checkbox" class="nj-backfill-check" ${checked} ${m ? "" : "disabled"} /></td>
          <td>${escapeHtml(t.date || "")}</td>
          <td>${escapeHtml(t.customer || "")}</td>
          <td>${escapeHtml(t.category || "")}</td>
          <td style="text-align:right">${(t.type === "expense" ? "-" : "") + "$" + (Math.abs(+t.amount || 0)).toFixed(2)}</td>
          <td>${matchLabel}</td>
          <td class="nj-backfill-score ${scoreClass}">${r.score}</td>
        </tr>`;
      }).join("");
    }
    if (summary) {
      const matched = rows.filter(r => r.match).length;
      summary.textContent = `${rows.length} unlinked · ${matched} with a match`;
    }
  }

  function njBackfillPopulateCustomerFilter() {
    const sel = document.getElementById("nj-backfill-customer");
    if (!sel) return;
    const cur = sel.value;
    const customers = [...new Set((state.transactions || [])
      .filter(t => !t.jobNo)
      .map(t => (t.customer || "").trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    sel.innerHTML = `<option value="">All</option>` +
      customers.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    if (customers.includes(cur)) sel.value = cur;
  }
  function njBackfillPopulateYearFilter() {
    const sel = document.getElementById("nj-backfill-year");
    if (!sel) return;
    const cur = sel.value;
    const years = [...new Set((state.transactions || [])
      .filter(t => !t.jobNo)
      .map(t => (t.date || "").slice(0, 4))
      .filter(y => /^\d{4}$/.test(y)))]
      .sort((a, b) => b.localeCompare(a)); // newest first
    sel.innerHTML = `<option value="">All</option>` +
      years.map(y => `<option value="${y}">${y}</option>`).join("");
    if (years.includes(cur)) sel.value = cur;
  }

  function openBackfillModal() {
    const modal = document.getElementById("nj-backfill-modal");
    if (!modal) return;
    njBackfillPopulateCustomerFilter();
    njBackfillPopulateYearFilter();
    njBackfillRender();
    modal.classList.remove("hidden");
  }
  function closeBackfillModal() {
    const modal = document.getElementById("nj-backfill-modal");
    if (modal) modal.classList.add("hidden");
  }

  // Wire toolbar/listeners.
  ["nj-backfill-threshold", "nj-backfill-type", "nj-backfill-customer", "nj-backfill-year"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", njBackfillRender);
    document.getElementById(id)?.addEventListener("change", njBackfillRender);
  });
  document.getElementById("nj-backfill-select-all")?.addEventListener("change", (e) => {
    const on = !!e.target.checked;
    document.querySelectorAll("#nj-backfill-tbody .nj-backfill-check:not([disabled])").forEach(cb => { cb.checked = on; });
  });
  document.getElementById("nj-backfill-cancel")?.addEventListener("click", closeBackfillModal);
  document.getElementById("nj-backfill-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "nj-backfill-modal") closeBackfillModal();
  });
  document.getElementById("nj-backfill-scan")?.addEventListener("click", openBackfillModal);
  document.getElementById("nj-backfill-apply")?.addEventListener("click", () => {
    const rows = document.querySelectorAll("#nj-backfill-tbody tr");
    const changes = []; // { txId, prevJobNo, newJobNo }
    const lockedHits = new Set();
    rows.forEach(row => {
      const cb = row.querySelector(".nj-backfill-check");
      if (!cb || !cb.checked) return;
      const txId  = row.dataset.txId;
      const jobNo = row.dataset.jobNo;
      if (!txId || !jobNo) return;
      const tx = (state.transactions || []).find(t => t.id === txId);
      if (!tx) return;
      if (isLockedDate(tx.date)) { lockedHits.add(tx.date.slice(0, 4)); return; }
      // Snapshot the prior value so undo can restore it (most are undefined,
      // but on re-apply some may already have a different jobNo).
      changes.push({ txId, prevJobNo: tx.jobNo || null, newJobNo: jobNo });
      tx.jobNo = jobNo;
    });
    if (lockedHits.size) {
      alert(`Skipped checked rows in locked year${lockedHits.size === 1 ? "" : "s"} (${[...lockedHits].sort().join(", ")}). Unlock the year(s) in Settings to backfill those.`);
    }
    if (changes.length === 0) { alert("No rows selected."); return; }
    state.lastBackfillUndo = { at: Date.now(), changes };
    saveState();
    if (typeof renderTransactions === "function") renderTransactions();
    if (typeof renderNjAnalytics === "function") renderNjAnalytics();
    if (typeof stampTxNjBadges === "function") stampTxNjBadges();
    njBackfillUpdateStat();
    closeBackfillModal();
    alert(`Tagged ${changes.length} transaction(s) with their suggested Job No.\n\nUndo is available on the Settings card if needed.`);
  });

  // Undo handler
  document.getElementById("nj-backfill-undo")?.addEventListener("click", () => {
    const snap = state.lastBackfillUndo;
    if (!snap || !Array.isArray(snap.changes) || snap.changes.length === 0) return;
    if (!confirm(`Undo backfill of ${snap.changes.length} transaction(s)?`)) return;
    let reverted = 0;
    const undoLockedHits = new Set();
    snap.changes.forEach(c => {
      const tx = (state.transactions || []).find(t => t.id === c.txId);
      if (!tx) return;
      if (isLockedDate(tx.date)) { undoLockedHits.add(tx.date.slice(0, 4)); return; }
      // Only revert if the current value still matches what we set — don't
      // clobber edits the user may have made since the backfill.
      if (tx.jobNo === c.newJobNo) {
        if (c.prevJobNo) tx.jobNo = c.prevJobNo;
        else delete tx.jobNo;
        reverted++;
      }
    });
    if (undoLockedHits.size) {
      alert(`Skipped undo for transactions in locked year${undoLockedHits.size === 1 ? "" : "s"} (${[...undoLockedHits].sort().join(", ")}).`);
    }
    delete state.lastBackfillUndo;
    saveState();
    if (typeof renderTransactions === "function") renderTransactions();
    if (typeof renderNjAnalytics === "function") renderNjAnalytics();
    if (typeof stampTxNjBadges === "function") stampTxNjBadges();
    njBackfillUpdateStat();
    alert(`Reverted ${reverted} transaction(s). ${snap.changes.length - reverted ? `(${snap.changes.length - reverted} were skipped because they had been changed since.)` : ""}`);
  });
  // Initial stat refresh whenever Settings opens.
  document.querySelectorAll('.tab-btn[data-tab="settings"]').forEach(b => {
    b.addEventListener("click", () => setTimeout(njBackfillUpdateStat, 0));
  });
  njBackfillUpdateStat();

  // ============================================================
  // CLEAR button — wipes all New Transaction form entries.
  // ============================================================
  const btnTxClear = document.getElementById("btn-tx-clear");
  if (btnTxClear) {
    btnTxClear.addEventListener("click", () => {
      const form = document.getElementById("tx-form");
      if (!form) return;
      form.reset();
      // Reset selects with synthetic options to their placeholder
      ["tx-vendor", "tx-customer", "tx-category", "tx-chart-account", "tx-expense-income", "tx-job-link"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      // Reset Existing Job toggle to No
      if (txExistingToggle) {
        txExistingToggle.checked = false;
        if (typeof syncExistingPills === "function") syncExistingPills();
      }
      // Reset Mark-as-edited
      const mark = document.getElementById("tx-nj-marked");
      if (mark) mark.checked = false;
      // Date back to today
      const dateEl = document.getElementById("tx-date");
      if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
      // Re-apply conditional UI so disabled states update
      if (typeof applyTxConditionalUI === "function") applyTxConditionalUI();
    });
  }

  // ============================================================
  // ALL TRANSACTIONS — inline edit (double-click any cell to edit in place)
  // Supports: date, vendor, customer, jobno, payee, category, expinc, chart,
  // amount, memo. Save on Enter or blur; cancel on Escape.
  // ============================================================
  const NJ_INLINE_FIELDS = {
    date:     { type: "input", inputType: "date" },
    vendor:   { type: "select", optionsFrom: () => state.vendors || [], addToList: "vendors" },
    customer: { type: "select", optionsFrom: () => state.customers || [], addToList: "customers" },
    jobno: {
      type: "select",
      optionsFrom: () => {
        // Respect the All Transactions table's year filter when populating
        // suggestions — pick only jobs whose date falls in the chosen year.
        const yearF = (document.getElementById("tx-filter-year")?.value || "").trim();
        return (state.jobs || [])
          .filter(j => !yearF || (j.date || "").startsWith(yearF))
          .slice()
          .sort((a, b) => (b.jobNo || "").localeCompare(a.jobNo || ""))
          .map(j => ({
            value: j.jobNo,
            label: `${j.jobNo} - ${j.customer || ""}${j.category ? " / " + j.category : ""}`,
          }));
      },
    },
    payee:    { type: "input", inputType: "text", listFrom: () => state.payees || [] },
    category: { type: "select", optionsFrom: () => state.categories || [], addToList: "categories" },
    expinc:   { type: "select", optionsFrom: () => (state.expensesTable || []).map(e => e.entry).filter(Boolean) },
    chart:    { type: "coa" }, // populated from full chart accounts via populateChartAccountSelect
    amount:   { type: "input", inputType: "number", step: "0.01", min: "0" },
    memo:     { type: "input", inputType: "text" },
  };
  const NJ_FIELD_TO_TX = {
    date: "date", vendor: "vendor", customer: "customer", jobno: "jobNo",
    payee: "payee", category: "category", expinc: "expenseIncome",
    chart: "chartAccount", amount: "amount", memo: "memo",
  };

  function njInlineEdit(cell) {
    if (cell.dataset.editing === "1") return;
    const colKey = cell.dataset.col;
    const cfg = NJ_INLINE_FIELDS[colKey];
    if (!cfg) return;
    const txProp = NJ_FIELD_TO_TX[colKey];
    if (!txProp) return;
    const row = cell.closest("tr");
    const txId = row && row.dataset.id;
    const tx = (state.transactions || []).find(t => t.id === txId);
    if (!tx) return;
    if (typeof isLockedDate === "function" && isLockedDate(tx.date)) {
      blockedToast(tx.date.slice(0, 4));
      return;
    }

    const oldHtml = cell.innerHTML;
    cell.dataset.editing = "1";
    let editor;
    let saveValue;

    if (cfg.type === "input") {
      editor = document.createElement("input");
      editor.type = cfg.inputType || "text";
      if (cfg.step) editor.step = cfg.step;
      if (cfg.min)  editor.min  = cfg.min;
      editor.value = (colKey === "amount" ? tx.amount : (tx[txProp] ?? "")) || "";
      if (cfg.listFrom) {
        const dlId = "nj-inline-list-" + colKey;
        let dl = document.getElementById(dlId);
        if (!dl) { dl = document.createElement("datalist"); dl.id = dlId; document.body.appendChild(dl); }
        dl.innerHTML = (cfg.listFrom() || []).map(v => `<option value="${escapeHtml(v)}"></option>`).join("");
        editor.setAttribute("list", dlId);
      }
      saveValue = () => editor.value;
    } else if (cfg.type === "select") {
      editor = document.createElement("select");
      const cur = tx[txProp] || "";
      // Options can be plain strings OR { value, label } objects.
      const rawOpts = (cfg.optionsFrom() || []);
      const isObjOpts = rawOpts.length && typeof rawOpts[0] === "object";
      const opts = isObjOpts
        ? rawOpts // already in desired order from cfg
        : rawOpts.slice().sort((a, b) => String(a).localeCompare(String(b)));
      const values = isObjOpts ? opts.map(o => o.value) : opts;
      const allowAdd = !!cfg.addToList; // when set, append "+ Add new…" option
      const html = [`<option value="">—</option>`]
        .concat(opts.map(o => {
          const v = isObjOpts ? o.value : o;
          const l = isObjOpts ? o.label : o;
          return `<option value="${escapeHtml(v)}"${v === cur ? " selected" : ""}>${escapeHtml(l)}</option>`;
        }));
      if (cur && !values.includes(cur)) html.splice(1, 0, `<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)}</option>`);
      if (allowAdd) html.push(`<option value="__new__">+ Add new…</option>`);
      editor.innerHTML = html.join("");
      // "+ Add new…" handler — prompt, persist to state list, assign to tx.
      if (allowAdd) {
        editor.addEventListener("change", () => {
          if (editor.value !== "__new__") return;
          const name = (prompt(`New ${colKey}:`) || "").trim();
          if (!name) { editor.value = cur; return; }
          if (!Array.isArray(state[cfg.addToList])) state[cfg.addToList] = [];
          if (!state[cfg.addToList].includes(name)) {
            state[cfg.addToList].push(name);
            state[cfg.addToList].sort();
            saveState();
          }
          // Re-render options with the new value present, then select it.
          const newOpts = (cfg.optionsFrom() || []);
          const newIsObj = newOpts.length && typeof newOpts[0] === "object";
          const newSorted = newIsObj ? newOpts : newOpts.slice().sort((a, b) => String(a).localeCompare(String(b)));
          const newHtml = [`<option value="">—</option>`]
            .concat(newSorted.map(o => {
              const v = newIsObj ? o.value : o;
              const l = newIsObj ? o.label : o;
              return `<option value="${escapeHtml(v)}"${v === name ? " selected" : ""}>${escapeHtml(l)}</option>`;
            }))
            .concat([`<option value="__new__">+ Add new…</option>`]);
          editor.innerHTML = newHtml.join("");
          editor.value = name;
        });
      }
      saveValue = () => (editor.value === "__new__" ? cur : editor.value);
    } else if (cfg.type === "coa") {
      editor = document.createElement("select");
      editor.id = "nj-inline-coa-temp";
      cell.innerHTML = "";
      cell.appendChild(editor);
      // populateChartAccountSelect targets by element id
      if (typeof populateChartAccountSelect === "function") populateChartAccountSelect("nj-inline-coa-temp");
      const cur = tx.chartAccount || "";
      if (cur && ![...editor.options].some(o => o.value === cur)) {
        const opt = document.createElement("option"); opt.value = cur; opt.textContent = cur;
        editor.appendChild(opt);
      }
      editor.value = cur;
      editor.removeAttribute("id");
      saveValue = () => editor.value;
    }
    if (cfg.type !== "coa") {
      cell.innerHTML = "";
      cell.appendChild(editor);
    }
    editor.classList.add("nj-inline-edit-input");

    let cancelled = false;
    const commit = () => {
      // Suppress the row's hold-to-duplicate from firing on the tap that
      // dismissed the inline editor (especially noticeable on touch).
      window.__txInlineEditCooldownUntil = Date.now() + 800;
      if (cancelled) { cell.innerHTML = oldHtml; cell.dataset.editing = ""; return; }
      let v = saveValue();
      if (colKey === "amount") {
        const n = parseFloat(v);
        if (!isFinite(n) || n <= 0) { cell.innerHTML = oldHtml; cell.dataset.editing = ""; return; }
        tx.amount = n;
      } else if (colKey === "jobno") {
        if (v) tx.jobNo = v; else delete tx.jobNo;
      } else if (colKey === "expinc") {
        if (v) tx.expenseIncome = v; else delete tx.expenseIncome;
      } else {
        tx[txProp] = v;
      }
      saveState();
      cell.dataset.editing = "";
      if (typeof renderTransactions === "function") renderTransactions();
      stampTxNjBadges();
    };
    editor.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); editor.blur(); }
      else if (e.key === "Escape") { e.preventDefault(); cancelled = true; editor.blur(); }
    });
    editor.addEventListener("blur", commit);
    // Auto-focus and select where possible
    setTimeout(() => {
      try { editor.focus(); if (editor.select) editor.select(); } catch {}
    }, 0);
  }

  // Wire double-click on body cells in the All Transactions table.
  const _txTable = document.getElementById("tx-table");
  if (_txTable) {
    // Capture-phase so we can preempt the row's own dblclick (which opens the
    // Edit Transaction modal) when the click was on an editable cell.
    // Shift + dblclick bypasses inline-edit and opens the full modal.
    _txTable.addEventListener("dblclick", (e) => {
      const cell = e.target.closest("td[data-col]");
      if (!cell) return;
      const colKey = cell.dataset.col;
      if (!NJ_INLINE_FIELDS[colKey]) return;
      if (e.shiftKey) return; // let the row's dblclick → openTxModal run
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      njInlineEdit(cell);
    }, true);
    // Capture-phase mousedown — the row's hold-to-duplicate timer also fires
    // on the first mousedown of a dblclick on an editable cell, occasionally
    // popping the duplicate modal mid-edit. Block the row's mousedown when
    // the press lands on an editable cell or on an active inline editor.
    _txTable.addEventListener("mousedown", (e) => {
      // Cooldown right after an inline-edit commit — block the row's
      // hold-to-duplicate timer entirely for a short window.
      if (window.__txInlineEditCooldownUntil && Date.now() < window.__txInlineEditCooldownUntil) {
        e.stopImmediatePropagation();
        return;
      }
      const cell = e.target.closest("td[data-col]");
      if (!cell) return;
      if (cell.dataset.editing === "1" || NJ_INLINE_FIELDS[cell.dataset.col]) {
        e.stopImmediatePropagation();
      }
    }, true);
    // Same cooldown for touch (mobile)
    _txTable.addEventListener("touchstart", (e) => {
      if (window.__txInlineEditCooldownUntil && Date.now() < window.__txInlineEditCooldownUntil) {
        e.stopImmediatePropagation();
      }
    }, true);
    _txTable.addEventListener("click", (e) => {
      if (window.__txInlineEditCooldownUntil && Date.now() < window.__txInlineEditCooldownUntil) {
        e.stopImmediatePropagation();
      }
    }, true);
    // Belt-and-suspenders: if a row's dblclick still fires (e.g. browser quirk),
    // bail out early when the click was on an editable cell.
    _txTable.addEventListener("dblclick", (e) => {
      const cell = e.target.closest("td[data-col]");
      if (cell && NJ_INLINE_FIELDS[cell.dataset.col]) {
        e.stopImmediatePropagation();
      }
    });
  }

  // ============================================================
  // ALL TRANSACTIONS — swipe-left for Edit / Delete (mobile, 3-line mode)
  // ============================================================
  (function setupTxSwipe() {
    const tbl = document.getElementById("tx-table");
    if (!tbl) return;

    let activeRow = null;
    let panel = null;
    let startX = 0, startY = 0, dx = 0, dy = 0, isSwiping = false, locked = false;
    const REVEAL = 160; // total width of the action panel
    const TRIGGER = 60; // px swipe distance to lock open

    function isMobile3Line() {
      return document.body.classList.contains("tx-mobile-3line") &&
             window.matchMedia("(max-width: 768px)").matches;
    }

    function closeSwipe() {
      if (activeRow) {
        activeRow.style.transform = "";
        activeRow.classList.remove("tx-row-swiped");
      }
      if (panel) panel.remove();
      panel = null;
      activeRow = null;
      locked = false;
    }

    function openActions(row) {
      if (panel) panel.remove();
      panel = document.createElement("div");
      panel.className = "tx-row-actions";
      panel.innerHTML = `
        <button type="button" class="tx-action-edit">Edit</button>
        <button type="button" class="tx-action-delete">Delete</button>
      `;
      row.appendChild(panel);
      panel.querySelector(".tx-action-edit").addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = row.dataset.id;
        const tx = (state.transactions || []).find(t => t.id === id);
        closeSwipe();
        if (tx && typeof openTxModal === "function") openTxModal(tx);
      });
      panel.querySelector(".tx-action-delete").addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = row.dataset.id;
        const tx = (state.transactions || []).find(t => t.id === id);
        if (tx && typeof isLockedDate === "function" && isLockedDate(tx.date)) {
          if (typeof blockedToast === "function") blockedToast(tx.date.slice(0, 4));
          closeSwipe();
          return;
        }
        if (!confirm("Delete this transaction?")) { closeSwipe(); return; }
        state.transactions = (state.transactions || []).filter(t => t.id !== id);
        saveState();
        if (typeof renderTransactions === "function") renderTransactions();
        closeSwipe();
      });
    }

    tbl.addEventListener("touchstart", (e) => {
      if (!isMobile3Line()) return;
      const row = e.target.closest("tr.tx-row");
      if (!row) { if (activeRow) closeSwipe(); return; }
      // Don't start a swipe on interactive bits inside the row
      if (e.target.closest(".tx-select-col, .recon-circle, button, input, select, .tx-row-actions")) return;
      if (locked && activeRow !== row) { closeSwipe(); return; }
      if (activeRow && activeRow !== row) closeSwipe();
      activeRow = row;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0; dy = 0;
      isSwiping = false;
    }, { passive: true });

    tbl.addEventListener("touchmove", (e) => {
      if (!activeRow) return;
      dx = e.touches[0].clientX - startX;
      dy = e.touches[0].clientY - startY;
      if (!isSwiping) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          isSwiping = true;
        } else if (Math.abs(dy) > 10) {
          // vertical scroll wins — abandon swipe
          activeRow = null;
          return;
        }
      }
      if (isSwiping) {
        if (e.cancelable) e.preventDefault();
        const base = locked ? -REVEAL : 0;
        const tx = Math.min(0, Math.max(-REVEAL, base + dx));
        activeRow.style.transform = `translateX(${tx}px)`;
      }
    }, { passive: false });

    tbl.addEventListener("touchend", () => {
      if (!activeRow) return;
      if (isSwiping) {
        const base = locked ? -REVEAL : 0;
        const finalX = base + dx;
        if (finalX < -TRIGGER) {
          activeRow.style.transform = `translateX(-${REVEAL}px)`;
          activeRow.classList.add("tx-row-swiped");
          if (!panel) openActions(activeRow);
          locked = true;
        } else {
          closeSwipe();
        }
      }
      isSwiping = false;
    });

    // Close when tapping anywhere outside the active row
    document.addEventListener("touchstart", (e) => {
      if (!activeRow || !locked) return;
      if (e.target.closest("tr.tx-row") === activeRow) return;
      closeSwipe();
    }, true);

    // Close on render / scroll outside table
    document.addEventListener("scroll", () => {
      if (locked) closeSwipe();
    }, true);
  })();

  // ============================================================
  // ALL TRANSACTIONS — "edited with new logic" indicator
  // Watches the tx table for re-renders and stamps a green dot onto
  // rows whose tx has either a jobNo or expenseIncome field.
  // ============================================================
  function stampTxNjBadges() {
    const txMap = new Map((state.transactions || []).map(t => [t.id, t]));
    document.querySelectorAll("#tx-table tbody tr.tx-row").forEach(row => {
      const t = txMap.get(row.dataset.id);
      if (!t) return;
      const tagged = !!(t.jobNo || t.expenseIncome || t.njMarked);
      row.classList.toggle("nj-tagged", tagged);
      const dateCell = row.querySelector('td[data-col="date"]');
      if (!dateCell) return;
      let badge = dateCell.querySelector(".nj-badge");
      if (tagged) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "nj-badge";
          const tip = [
            t.jobNo ? `Job ${t.jobNo}` : null,
            t.expenseIncome ? `Entry: ${t.expenseIncome}` : null,
          ].filter(Boolean).join(" · ");
          badge.title = "Edited with new logic — " + tip;
          dateCell.prepend(badge);
        }
      } else if (badge) {
        badge.remove();
      }
    });
  }
  const txTbody = document.querySelector("#tx-table tbody");
  if (txTbody) {
    const txObs = new MutationObserver(() => stampTxNjBadges());
    txObs.observe(txTbody, { childList: true, subtree: false });
    stampTxNjBadges();
  }

  // Wire Job Analytics filters (year / customer / category)
  ["nj-analytics-year", "nj-analytics-customer", "nj-analytics-category"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderNjAnalytics);
  });
  document.getElementById("nj-analytics-clear")?.addEventListener("click", () => {
    ["nj-analytics-year", "nj-analytics-customer", "nj-analytics-category"].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = "";
    });
    renderNjAnalytics();
  });

  // Initial render of all new-spec tables
  renderNjJobsTable();
  renderNjCcTable();
  renderNjExTable();
  renderNjAnalytics();
  njResetForm();
  if (typeof populateChartAccountSelect === "function") populateChartAccountSelect("nj-ex-coa");
  // Re-mirror whenever the user adds a Chart of Accounts entry in the existing settings
  const addCoaBtn = document.getElementById("btn-add-chart-account");
  if (addCoaBtn) addCoaBtn.addEventListener("click", () => {
    setTimeout(() => populateChartAccountSelect("nj-ex-coa"), 0);
  });

  // ============================================================
  // INVOICE SAVE → auto-advance the linked Job to "Invoiced".
  // Only bumps an Open / Shot / Edited / Ordered / Delivered job;
  // never downgrades from Paid.
  // ============================================================
  const ORDERED = ["", "Shot", "Edited", "Ordered", "Delivered", "Invoiced", "Paid"];
  const btnInvoiceSave = document.getElementById("btn-invoice-save");
  if (btnInvoiceSave) {
    btnInvoiceSave.addEventListener("click", () => {
      if (!editingInvoice || !editingInvoice.data) return;
      const baseJobNo = (editingInvoice.data.jobNo || "").trim()
        || (editingInvoice.data.number || "").trim().replace(/-\d+$/, "");
      if (!baseJobNo) return;
      const job = (state.jobs || []).find(j => j.jobNo === baseJobNo);
      if (!job) return;
      const cur = getJobStatus(job);
      if (ORDERED.indexOf(cur) < ORDERED.indexOf("Invoiced")) {
        setJobStatus(job, "Invoiced");
        saveState();
        renderNjJobsTable();
        renderNjAnalytics();
      }
    });
  }

  // (Marking an invoice paid no longer touches the linked Job's status —
  // the user manages job status independently from invoice status.)

  // ============================================================
  // INVOICE EDITOR — tie new-spec Jobs into the Job picker.
  // Picking a job auto-fills the invoice number and Bill To.
  // ============================================================
  const invJobSel = document.getElementById("invoice-job");
  if (invJobSel) {
    const NJ_OPTGROUP_LABEL = "Jobs (new-spec)";

    let __ensuringOptgroup = false;
    function ensureNjJobOptgroup() {
      if (__ensuringOptgroup) return;
      __ensuringOptgroup = true;
      try {
        // Strip every existing option/optgroup, then rebuild from scratch:
        // a single "— None —" placeholder + only the new-spec jobs optgroup.
        invJobSel.innerHTML = `<option value="">— None —</option>`;
        // Show every job — multiple invoices can share a job (deposit + balance).
        // Each new invoice auto-suffixes its number (e.g. 26002 → 26002-2) when
        // the base jobNo is already used.
        const jobs = (state.jobs || [])
          .slice()
          .sort((a, b) => (b.jobNo || "").localeCompare(a.jobNo || ""));
        if (!jobs.length) return;
        const og = document.createElement("optgroup");
        og.label = NJ_OPTGROUP_LABEL;
        og.innerHTML = jobs.map(j => {
          const st = getJobStatus(j);
          const tag = st ? ` (${st})` : "";
          const label = `${j.jobNo} - ${j.customer || ""}${j.category ? " / " + j.category : ""}${tag}`;
          return `<option value="nj:${escapeHtml(j.jobNo)}">${escapeHtml(label)}</option>`;
        }).join("");
        invJobSel.appendChild(og);
        // Re-select the previously saved job. Prefer the explicit
        // editingInvoice.data.jobNo (set by the change handler); fall back
        // to matching the legacy editingInvoice.data.job (a category) string.
        if (typeof editingInvoice !== "undefined" && editingInvoice && editingInvoice.data) {
          const savedJobNo = (editingInvoice.data.jobNo || "").trim();
          if (savedJobNo) {
            const m = jobs.find(j => j.jobNo === savedJobNo);
            if (m) invJobSel.value = "nj:" + m.jobNo;
          } else {
            const cur = (editingInvoice.data.job || "").trim();
            if (cur) {
              const match = jobs.find(j => j.category === cur || j.jobNo === cur);
              if (match) invJobSel.value = "nj:" + match.jobNo;
            }
          }
        }
      } finally {
        // Defer the flag reset past the observer's microtask so our own
        // mutations don't re-trigger this function.
        setTimeout(() => { __ensuringOptgroup = false; }, 0);
      }
    }

    // The existing renderer rewrites this select's innerHTML each time the
    // editor opens. Watch for that and re-inject our optgroup.
    const invObs = new MutationObserver(() => {
      if (__ensuringOptgroup) return;
      ensureNjJobOptgroup();
    });
    invObs.observe(invJobSel, { childList: true });
    ensureNjJobOptgroup();

    // Capture-phase change: detect "nj:JOBNO" picks and autofill the form.
    // We stop the legacy handler so the select can stay on the nj: value
    // (which is the only kind of option in this select now).
    invJobSel.addEventListener("change", (e) => {
      const val = e.target.value || "";
      if (!val.startsWith("nj:")) {
        // "— None —" / cleared selection — let the legacy handler clear data.job.
        return;
      }
      const jobNo = val.slice(3);
      const job = (state.jobs || []).find(j => j.jobNo === jobNo);
      if (!job) return;
      e.stopImmediatePropagation();

      // Auto-prefix invoice numbers with "INV-" so they're distinct from
      // raw job numbers while the invoice still links back to the job via
      // editingInvoice.data.jobNo (set below). Auto-suffix when this job
      // already has invoice(s): INV-26002 → INV-26002-2 → INV-26002-3 ...
      const myId = editingInvoice && editingInvoice.data ? editingInvoice.data.id : null;
      const usedNums = new Set(
        (state.invoices || [])
          .filter(i => i.id !== myId)
          .map(i => (i.number || "").trim())
          .filter(Boolean)
      );
      const base = `INV-${job.jobNo}`;
      let nextNum = base;
      if (usedNums.has(nextNum)) {
        let n = 2;
        while (usedNums.has(`${base}-${n}`)) n++;
        nextNum = `${base}-${n}`;
      }
      const numEl = document.getElementById("invoice-number");
      if (numEl) {
        numEl.value = nextNum;
        numEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const billtoEl = document.getElementById("invoice-billto");
      if (billtoEl) {
        billtoEl.value = job.customer || "";
        billtoEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      // Store the job's category on the invoice so the existing job-filter
      // dropdown / report code keeps working. Also stamp the base jobNo so
      // multi-invoice-per-job lookups don't have to parse the suffix.
      if (editingInvoice) {
        editingInvoice.data.job = job.category || "";
        editingInvoice.data.jobNo = job.jobNo;
      }
    }, true);
  }

  // ============================================================
  // SCHEDULE C TAX REPORT
  // Maps each Category to an IRS Schedule C line and produces a printable
  // worksheet. Mileage rolls into Line 9. Meals on Line 24b are halved
  // per IRS 50% rule. The mapping table is editable in Settings.
  // ============================================================
  const SC_LINES = [
    { id: "L8",   label: "Line 8 — Advertising" },
    { id: "L9",   label: "Line 9 — Car and truck expenses" },
    { id: "L10",  label: "Line 10 — Commissions and fees" },
    { id: "L11",  label: "Line 11 — Contract labor" },
    { id: "L13",  label: "Line 13 — Depreciation and section 179" },
    { id: "L14",  label: "Line 14 — Employee benefit programs" },
    { id: "L15",  label: "Line 15 — Insurance (other than health)" },
    { id: "L16",  label: "Line 16 — Interest" },
    { id: "L17",  label: "Line 17 — Legal and professional services" },
    { id: "L18",  label: "Line 18 — Office expense" },
    { id: "L20",  label: "Line 20 — Rent or lease" },
    { id: "L21",  label: "Line 21 — Repairs and maintenance" },
    { id: "L22",  label: "Line 22 — Supplies" },
    { id: "L23",  label: "Line 23 — Taxes and licenses" },
    { id: "L24a", label: "Line 24a — Travel" },
    { id: "L24b", label: "Line 24b — Deductible meals (50%)" },
    { id: "L25",  label: "Line 25 — Utilities" },
    { id: "L26",  label: "Line 26 — Wages" },
    { id: "L27",  label: "Line 27a — Other expenses" },
    { id: "L4",   label: "Line 4 — Cost of goods sold" },
    { id: "",     label: "— Skip / Not deductible —" },
  ];
  // Reasonable defaults seeded from common photography categories.
  const SC_DEFAULT_MAP = {
    "Pictures": "L22", "Memory Mates": "L22", "Frames": "L22", "Envelopes": "L22",
    "Banners": "L22", "Mounted Prints": "L22", "Framed Prints": "L22",
    "Dry Mount Prints": "L22", "Invitations": "L22", "Cost of Goods": "L4",
    "Helper": "L11", "Subcontracted Services": "L11", "Diane": "L11", "Tristen": "L11",
    "Subs/Apps": "L18", "Software": "L18", "Office": "L18",
    "Sales Tax": "L23", "Taxes": "L23",
    "Dining Out": "L24b", "Meals": "L24b", "Meals and Entertainment": "L24b",
    "Insurance": "L15",
    "Advertising": "L8", "Give Back": "L27",
    "Travel": "L24a",
    "Repairs": "L21", "Repairs and Maintenance": "L21",
    "Utilities": "L25",
    "Rent": "L20",
  };
  if (!state.scheduleCMap || typeof state.scheduleCMap !== "object") {
    state.scheduleCMap = { ...SC_DEFAULT_MAP };
    saveState();
  }

  function applySCReportPreset(preset) {
    const today = new Date();
    const fromEl = document.getElementById("sc-report-from");
    const toEl   = document.getElementById("sc-report-to");
    if (!fromEl || !toEl) return;
    const iso = (d) => d.toISOString().slice(0, 10);
    // Specific year preset (e.g. "2025") → that year Jan 1 – Dec 31.
    if (/^\d{4}$/.test(preset)) {
      const yr = parseInt(preset, 10);
      fromEl.value = iso(new Date(yr, 0, 1));
      toEl.value   = iso(new Date(yr, 11, 31));
      return;
    }
    if (preset === "ytd") {
      fromEl.value = iso(new Date(today.getFullYear(), 0, 1));
      toEl.value   = iso(today);
    } else if (preset === "last-year") {
      fromEl.value = iso(new Date(today.getFullYear() - 1, 0, 1));
      toEl.value   = iso(new Date(today.getFullYear() - 1, 11, 31));
    }
  }

  function renderSCReport() {
    const fromEl = document.getElementById("sc-report-from");
    const toEl   = document.getElementById("sc-report-to");
    if (!fromEl || !toEl) return;
    const from = fromEl.value, to = toEl.value;
    const fmtDateLabel = s => s ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
    const rangeEl = document.getElementById("sc-report-range");
    if (rangeEl) rangeEl.textContent = (from || to) ? `${fmtDateLabel(from)} — ${fmtDateLabel(to)}` : "All dates";

    const inRange = t => {
      const d = t.date || "";
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };

    // Income (Line 1 / Gross receipts) — sum every income tx in window,
    // skipping savings transfers and carry-forward (Roll Over / Correction).
    let grossReceipts = 0;
    let cogs = 0;
    const lineTotals = {};
    // Per-line per-category breakdown for the expand-rows.
    // Shape: { L22: { "Pictures": { count, sum }, "Frames": {..} }, ... }
    const lineBreakdown = {};
    // Income breakdown — per-category totals for Line 1 expansion.
    const incomeBreakdown = {}; // { catName: { count, sum } }
    // Cost-of-goods breakdown for Line 4 expansion.
    const cogsBreakdown = {};   // { catName: { count, sum } }
    SC_LINES.forEach(l => { if (l.id) { lineTotals[l.id] = 0; lineBreakdown[l.id] = {}; } });

    (state.transactions || []).filter(inRange).forEach(t => {
      const cat = (t.category || "").trim() || "(uncategorized)";
      if (NON_JOB_CATEGORIES.includes(cat)) return;
      if (SAVINGS_CATEGORIES.includes(cat)) return;
      const amt = +t.amount || 0;
      if (t.type === "income") {
        grossReceipts += amt;
        const b = incomeBreakdown[cat] || (incomeBreakdown[cat] = { count: 0, sum: 0 });
        b.count++; b.sum += amt;
      } else {
        const line = state.scheduleCMap[cat] !== undefined ? state.scheduleCMap[cat] : "L27";
        if (!line) return;
        if (line === "L4") {
          cogs += amt;
          const b = cogsBreakdown[cat] || (cogsBreakdown[cat] = { count: 0, sum: 0 });
          b.count++; b.sum += amt;
        } else {
          lineTotals[line] = (lineTotals[line] || 0) + amt;
          const b = lineBreakdown[line][cat] || (lineBreakdown[line][cat] = { count: 0, sum: 0 });
          b.count++; b.sum += amt;
        }
      }
    });
    // Halve Meals at 50% — apply to both the total and the per-category breakdown.
    lineTotals["L24b"] = (lineTotals["L24b"] || 0) * 0.5;
    Object.keys(lineBreakdown["L24b"] || {}).forEach(k => {
      lineBreakdown["L24b"][k].sum *= 0.5;
    });

    // Mileage → Line 9 (auto-rolled). Sum trip miles in date range × rate.
    const rate = +state.mileageRate || 0;
    const milesTotal = (state.trips || []).filter(inRange).reduce((s, t) => s + (+t.miles || 0), 0);
    const tripCount = (state.trips || []).filter(inRange).length;
    lineTotals["L9"] = (lineTotals["L9"] || 0) + (milesTotal * rate);
    if (milesTotal > 0) {
      lineBreakdown["L9"]["Mileage trips"] = { count: tripCount, sum: milesTotal * rate, _meta: `${milesTotal.toFixed(1)} mi × $${rate.toFixed(3)}` };
    }

    // Helper: render an expand row body for a given breakdown map.
    const buildDrillRows = (drillId, breakdown) => {
      const cats = Object.entries(breakdown).sort((a, b) => b[1].sum - a[1].sum);
      if (!cats.length) return "";
      return cats.map(([cat, info]) => `
        <tr class="sc-drill-row" data-drill-id="${drillId}" hidden>
          <td></td>
          <td><span style="display:inline-block;width:14px"></span>${escapeHtml(cat)}${info._meta ? ` <span class="muted" style="font-size:11px">(${escapeHtml(info._meta)})</span>` : ""} <span class="muted" style="font-size:11px">· ${info.count} tx</span></td>
          <td style="text-align:right">${fmtMoney(info.sum)}</td>
        </tr>
      `).join("");
    };

    // Render Income table
    const incBody = document.getElementById("sc-report-income-body");
    if (incBody) {
      const grossIncome = grossReceipts - cogs;
      incBody.innerHTML = `
        <tr class="sc-drillable" data-drill-target="sc-inc-l1" style="cursor:pointer">
          <td>1</td><td><span class="sc-caret">▸</span> Gross receipts or sales</td>
          <td style="text-align:right">${fmtMoney(grossReceipts)}</td>
        </tr>
        ${buildDrillRows("sc-inc-l1", incomeBreakdown)}
        <tr class="sc-drillable" data-drill-target="sc-inc-l4" style="cursor:pointer">
          <td>4</td><td><span class="sc-caret">▸</span> Cost of goods sold</td>
          <td style="text-align:right">${fmtMoney(cogs)}</td>
        </tr>
        ${buildDrillRows("sc-inc-l4", cogsBreakdown)}
        <tr><td>7</td><td style="font-weight:700">Gross income (Line 1 − Line 4)</td><td style="text-align:right;font-weight:700">${fmtMoney(grossIncome)}</td></tr>
      `;
    }

    // Render Expenses table — only show lines with non-zero values plus L27 always.
    const expBody = document.getElementById("sc-report-expense-body");
    if (expBody) {
      const linesToShow = SC_LINES.filter(l => l.id && l.id !== "L4" && (lineTotals[l.id] || 0) > 0);
      let totalExp = 0;
      expBody.innerHTML = linesToShow.map(l => {
        const v = lineTotals[l.id] || 0;
        totalExp += v;
        const lineNum = l.label.match(/Line\s+(\S+)/);
        const num = lineNum ? lineNum[1] : "";
        const desc = l.label.replace(/^Line\s+\S+\s+—\s+/, "");
        const drillId = `sc-exp-${l.id}`;
        return `
          <tr class="sc-drillable" data-drill-target="${drillId}" style="cursor:pointer">
            <td>${num}</td><td><span class="sc-caret">▸</span> ${escapeHtml(desc)}</td>
            <td style="text-align:right">${fmtMoney(v)}</td>
          </tr>
          ${buildDrillRows(drillId, lineBreakdown[l.id] || {})}
        `;
      }).join("") || `<tr><td colspan="3" class="muted" style="text-align:center;padding:20px">No deductible expenses in this range.</td></tr>`;
      const grossIncome = grossReceipts - cogs;
      const netProfit = grossIncome - totalExp;
      const l28 = document.getElementById("sc-report-line28");
      const l31 = document.getElementById("sc-report-line31");
      if (l28) l28.textContent = fmtMoney(totalExp);
      if (l31) {
        l31.textContent = fmtMoney(netProfit);
        l31.style.color = netProfit >= 0 ? "var(--income)" : "var(--expense)";
      }
    }

    // Wire row click → toggle the drill rows visibility.
    document.querySelectorAll("#sc-report-container .sc-drillable").forEach(row => {
      row.addEventListener("click", () => {
        const id = row.dataset.drillTarget;
        const expanded = row.classList.toggle("expanded");
        const caret = row.querySelector(".sc-caret");
        if (caret) caret.textContent = expanded ? "▾" : "▸";
        document.querySelectorAll(`.sc-drill-row[data-drill-id="${id}"]`).forEach(r => {
          r.hidden = !expanded;
        });
      });
    });
  }

  function renderSCMappingTable() {
    const tbody = document.querySelector("#sc-map-table tbody");
    if (!tbody) return;
    // Show every category that's in state.categories OR currently has a mapping.
    const cats = Array.from(new Set([
      ...(state.categories || []),
      ...Object.keys(state.scheduleCMap || {}),
    ]))
      .filter(c => c && !NON_JOB_CATEGORIES.includes(c) && !SAVINGS_CATEGORIES.includes(c))
      .sort((a, b) => a.localeCompare(b));
    if (!cats.length) {
      tbody.innerHTML = `<tr><td colspan="2" class="muted" style="text-align:center;padding:14px">No categories yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = cats.map(cat => {
      const cur = state.scheduleCMap[cat] !== undefined ? state.scheduleCMap[cat] : "L27";
      const opts = SC_LINES.map(l => `<option value="${escapeHtml(l.id)}"${l.id === cur ? " selected" : ""}>${escapeHtml(l.label || "— Skip —")}</option>`).join("");
      return `<tr><td>${escapeHtml(cat)}</td><td><select class="sc-map-select" data-cat="${escapeHtml(cat)}">${opts}</select></td></tr>`;
    }).join("");
    tbody.querySelectorAll(".sc-map-select").forEach(sel => {
      sel.addEventListener("change", () => {
        const cat = sel.dataset.cat;
        state.scheduleCMap[cat] = sel.value;
        saveState();
      });
    });
  }
  // Refresh the mapping table whenever Settings tab opens.
  document.querySelectorAll('.tab-btn[data-tab="settings"]').forEach(b => {
    b.addEventListener("click", () => setTimeout(renderSCMappingTable, 0));
  });
  renderSCMappingTable();

  // Wire toolbar
  document.getElementById("sc-report-from")?.addEventListener("change", () => {
    document.getElementById("sc-report-preset").value = "custom";
    renderSCReport();
  });
  document.getElementById("sc-report-to")?.addEventListener("change", () => {
    document.getElementById("sc-report-preset").value = "custom";
    renderSCReport();
  });
  document.getElementById("sc-report-preset")?.addEventListener("change", e => {
    if (e.target.value !== "custom") {
      applySCReportPreset(e.target.value);
      renderSCReport();
    }
  });
  document.getElementById("btn-sc-report-print")?.addEventListener("click", () => window.print());

  // Expose to debugger + showReport
  window.renderSCReport = renderSCReport;
  window.applySCReportPreset = applySCReportPreset;
  window.SC_LINES = SC_LINES;

  // Expose for debugging
  window.__nj = { state, renderNjJobsTable, renderNjCcTable, renderNjExTable, renderNjAnalytics, lowestAvailableJobNo };
  // Expose for the top-level swipe handler (which lives outside this IIFE)
  window.openJobEditModal = openJobEditModal;
  window.renderNjJobsTable = renderNjJobsTable;
  window.renderNjAnalytics = renderNjAnalytics;
})();
