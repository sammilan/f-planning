"use strict";
/**
 * Regression tests for Bank for a Buck — categorization and payment filtering.
 * Run: node test_parser.js
 *
 * Uses vm.runInContext() to load src/core.js (pure functions, no DOM) and
 * assert against known transaction examples from real statement screenshots.
 */
const vm = require("vm");
const fs = require("fs");

// Load core.js into an isolated VM context (no DOM, no localStorage needed)
const coreCode = fs.readFileSync("src/core.js", "utf8");
// Stub DOM-dependent helpers that core.js may call at module scope
const ctx = { console, toast: () => {} };
vm.createContext(ctx);
// core.js's store IIFE gracefully falls back to in-memory when localStorage
// is absent (the try/catch sets ok=false), so no stub needed — just run it.
// Append a line that hoists const bindings onto globalThis so we can read them.
vm.runInContext(
  '"use strict";\n' + coreCode +
  '\nglobalThis._E={categorize,PAYMENT_RE,normMerchant};',
  ctx
);

const { categorize, PAYMENT_RE, normMerchant } = ctx._E;

let pass = 0, fail = 0;

function check(label, expected, got) {
  const ok = got === expected;
  if (ok) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(`        expected: ${expected}`);
    console.log(`        got:      ${got}`);
    fail++;
  }
}

function cat(desc)  { const r = categorize(desc); return `${r.cat}/${r.sub}`; }
function pay(desc)  { return PAYMENT_RE.test(desc); }
function norm(desc) { return normMerchant(desc); }

// ---------------------------------------------------------------------------
// Chase / Citi statement reconciliation (from screenshots, 2026-06)
// ---------------------------------------------------------------------------
console.log("\n=== Payment filter ===");
check("AUTOMATIC PAYMENT - THANK YOU",
  true, pay("AUTOMATIC PAYMENT - THANK YOU"));
check("AUTOPAY ...RAUTOPAY AUTO-PMT",
  true, pay("AUTOPAY 260109074619881RAUTOPAY AUTO-PMT"));
check("CITI FLEX PAY CREDIT-COSTCO WHSE #0110",
  true, pay("CITI FLEX PAY CREDIT-COSTCO WHSE #0110"));

console.log("\n=== Categorization ===");
check("SAMMAMISH PLATEAU WATER → Home & Utilities/Water & trash",
  "Home & Utilities/Water & trash",
  cat("SAMMAMISH PLATEAU WATER &425-392-6256 WA"));

check("COSTCO WHSE #0110 → Groceries/Warehouse club",
  "Groceries/Warehouse club",
  cat("COSTCO WHSE #0110 ISSAQUAH WA"));

check("COSTCO WHSE #1225 → Groceries/Warehouse club",
  "Groceries/Warehouse club",
  cat("COSTCO WHSE #1225 REDMOND WA"));

check("KING COUNTY PARKS → Pets/Grooming & care",
  "Pets/Grooming & care",
  cat("KING COUNTY PARKS REDMOND WA"));

check("WASH SPOT LLC → Pets/Grooming & care",
  "Pets/Grooming & care",
  cat("WASH SPOT LLC BOTHELL WA"));

check("LAKE SAMMAMISH ST PK → Kids/Activities & camps",
  "Kids/Activities & camps",
  cat("LAKE SAMMAMISH ST PK ISSAQUAH WA"));

check("#1 HAIRCUTS → Personal Care/Salon & beauty",
  "Personal Care/Salon & beauty",
  cat("#1 HAIRCUTS SAMMAMISH WA"));

// ---------------------------------------------------------------------------
// normMerchant — prefix stripping sanity checks
// ---------------------------------------------------------------------------
console.log("\n=== normMerchant ===");
// normMerchant keeps first 3 meaningful words after prefix-stripping;
// state abbreviations (WA) and generic nouns (WAREHOUSE) are NOT filtered.
check("AplPay prefix stripped, 3-word key",
  "STARBUCKS SEATTLE WA",
  norm("AplPay Starbucks Seattle WA"));
check("DD * prefix stripped, number dropped",
  "CHIPOTLE",
  norm("DD *Chipotle 12345"));
check("GOOGLE *TASTY TRAVELS keeps GOOGLE",
  "GOOGLE TASTY TRAVELS",
  norm("GOOGLE *TASTY TRAVELS"));
check("IC* prefix stripped, 2-word key",
  "COSTCO WAREHOUSE",
  norm("IC*Costco Warehouse #0110"));

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
