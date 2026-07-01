/* ============================================================
   STATEMENT PARSERS — Amex, Chase, Citi PDFs + generic CSV
   ============================================================ */
const TXN_LINE = /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\*?\s+(?:(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\*?\s+)?(.+?)\s+(-?)\$?\s?([\d,]+\.\d{2})\s*(CR)?$/;

/* Classify a single reconstructed PDF line. Shared by the parser and the
   debug viewer so the two never disagree about what got skipped and why. */
function classifyLine(raw){
  const line = raw.trim();
  if (line.length < 8) return {status:"other", reason:"too short to be a transaction line"};
  const m = line.match(TXN_LINE);
  if (!m) return {status:"other", reason:"doesn't match a date … description … amount pattern"};
  let desc = m[3].trim();
  if (NOISE_RE.test(desc) || NOISE_RE.test(line)) return {status:"filtered", reason:"looks like a total/balance/summary line"};
  if (PAYMENT_RE.test(desc)) return {status:"filtered", reason:"looks like a payment or autopay line"};
  if (desc.replace(/[^A-Za-z]/g,"").length < 2) return {status:"filtered", reason:"description has no readable text"};
  let amount = parseFloat(m[5].replace(/,/g,""));
  if (m[4] === "-" || m[6] === "CR") amount = -amount;
  if (!isFinite(amount) || Math.abs(amount) > 100000 || amount === 0) return {status:"filtered", reason:"amount is zero or out of range"};
  return {status:"txn", reason:"", m, desc, amount};
}
/* For the on-device debug viewer: classify every line, with category guess for matches */
function debugClassifyLines(lines){
  return lines.map(raw=>{
    const c = classifyLine(raw);
    if (c.status === "txn") return {line: raw, status:"txn", reason:"", note: categorize(c.desc).cat + " · " + fmtC(c.amount)};
    return {line: raw, status:c.status, reason:c.reason, note:""};
  });
}

/* Helper: Amex statements embed metadata as second/third lines per transaction.
   These should be SKIPPED during the multi-line lookahead, not used as descriptions. */
function isAmexCatLabel(s){
  return /^(merchandise|goods[\/\s&]|audio\s*books?|fast\s*food|grocery\s*store|drug\s*store|pharmacy|cable\s*svcs?|book\s*stores?|large\s*digital|digital\s*goods|computer\s*(store|programming)|seller|weight\s*loss|record\s*store|clothing|utilit|passenger\s*ticket|bakery|artist\s*supply|photographic|service\s*works?|apparel|entertainment|fast\s*food\s*rest)/i.test(s.trim());
}
function isAmexMetaLine(s){
  /* Phone numbers, URLs, account numbers, receipt detail lines, email addresses */
  return /^(\+?[\d\s().\/\-]{6,}$|www\.|https?:|.*@.*\.|invoice\s*#|store\s*#\s*\d|tax:|carrier:|class:|from:|to:|ticket\s*(num|#)|passenger|document\s*type|date\s*of\s*dep|box\s+\d|po\s*#|squareup\.com|thrive\/|romaine|cfondren|billing|owners@)/i.test(s.trim());
}

function parseStatementLines(lines, card){
  const years = inferYears(lines);
  const primaryYear = years[0];
  const txns = [];
  const monthsSeen = new Set();

  /* ---- Pass 1: standard single-line matching (works for Chase, Citi, some Amex) ---- */
  for (const raw of lines){
    const c = classifyLine(raw);
    if (c.status !== "txn") continue;
    const m = c.m, desc = c.desc; let amount = c.amount;
    const dparts = m[1].split("/");
    let mo = +dparts[0], da = +dparts[1];
    if (mo < 1 || mo > 12 || da < 1 || da > 31) continue;
    let yr;
    if (dparts[2]){ yr = +dparts[2]; if (yr < 100) yr += 2000; }
    else yr = primaryYear;
    monthsSeen.add(mo);
    txns.push({ rawDate:{mo,da,yr,hadYear:!!dparts[2]}, desc, amount });
  }

  /* ---- Pass 2: multi-line lookahead for Amex table format ----
     Amex PDFs put date, description, and amount in separate table columns.
     pdf.js often extracts these as separate lines because the columns sit at
     slightly different Y-positions. We scan for date-starting lines then look
     ahead up to 8 lines to assemble date + description + amount.

     Lines to skip during lookahead:
       • Amex category labels  (MERCHANDISE, FAST FOOD RESTAURANT, etc.)
       • Phone/URL/receipt detail lines
       • NOISE / PAYMENT lines (already filtered)                          */
  const seenP1 = new Set(txns.map(t=>`${t.rawDate.mo}/${t.rawDate.da}/${t.rawDate.yr}|${t.amount.toFixed(2)}`));

  for (let i = 0; i < lines.length; i++){
    const line = lines[i].trim();
    if (!line || line.length < 6) continue;
    if (NOISE_RE.test(line) || PAYMENT_RE.test(line)) continue;

    /* Only process lines that start with a date (Amex always includes year: MM/DD/YY) */
    const dm = line.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\*?\s*/);
    if (!dm) continue;

    const dp = dm[1].split("/");
    let mo = +dp[0], da = +dp[1], yr = dp[2] ? +dp[2] : primaryYear;
    if (yr < 100) yr += 2000;
    if (mo < 1 || mo > 12 || da < 1 || da > 31) continue;

    const after = line.slice(dm[0].length).trim();
    let desc = null, amount = null;

    /* Parse what's on the same line as the date */
    if (after){
      const amtOnly = after.match(/^(-?)\$?([\d,]+\.\d{2})\s*(CR)?$/);
      const withDesc = after.match(/^(.+?)\s+(-?)\$?\s*([\d,]+\.\d{2})\s*(CR)?$/);
      if (amtOnly){
        amount = parseFloat(amtOnly[2].replace(/,/g,""));
        if (amtOnly[1]==="-" || amtOnly[3]==="CR") amount = -amount;
      } else if (withDesc && withDesc[1].replace(/[^A-Za-z]/g,"").length > 2
                 && !PAYMENT_RE.test(withDesc[1]) && !NOISE_RE.test(withDesc[1])){
        desc = withDesc[1].trim();
        amount = parseFloat(withDesc[3].replace(/,/g,""));
        if (withDesc[2]==="-" || withDesc[4]==="CR") amount = -amount;
      } else if (after.replace(/[^A-Za-z]/g,"").length > 2
                 && !PAYMENT_RE.test(after) && !NOISE_RE.test(after)){
        desc = after;
      }
    }

    /* Lookahead for missing desc and/or amount (up to 8 lines ahead) */
    for (let j = i+1; j < Math.min(i+9, lines.length) && (!desc || !amount); j++){
      const next = lines[j].trim();
      if (!next) continue;
      if (/^(\d{1,2}\/\d{1,2}\/\d{2,4})/.test(next)) break; // next transaction

      /* Check TOTAL: FIRST — receipt lines like "TAX: 9.72 TOTAL: 102.26" contain the
         word TOTAL which NOISE_RE would block. Extract the amount before any filtering. */
      const totM = !amount && next.match(/TOTAL:?\s*\$?([\d,]+\.\d{2})/i);
      if (totM){ amount = parseFloat(totM[1].replace(/,/g,"")); continue; }

      if (NOISE_RE.test(next) || PAYMENT_RE.test(next)) continue;
      if (isAmexCatLabel(next) || isAmexMetaLine(next)) continue;

      /* Plain amount line: "42.99" or "$42.99" or "42.99 CR" */
      const amtM = next.match(/^(-?)\$?([\d,]+\.\d{2})\s*(CR)?$/);
      if (amtM && !amount){
        amount = parseFloat(amtM[2].replace(/,/g,""));
        if (amtM[1]==="-" || amtM[3]==="CR") amount = -amount;
      } else if (!desc && next.replace(/[^A-Za-z]/g,"").length > 3 && !PAYMENT_RE.test(next)){
        desc = next;
      }
    }

    if (!desc || !amount || !isFinite(amount) || Math.abs(amount) > 100000 || amount === 0) continue;
    desc = desc.trim();
    if (PAYMENT_RE.test(desc) || NOISE_RE.test(desc) || desc.replace(/[^A-Za-z]/g,"").length < 2) continue;

    /* Deduplicate against pass 1 */
    const key = `${mo}/${da}/${yr}|${amount.toFixed(2)}`;
    if (seenP1.has(key)) continue;
    seenP1.add(key);
    monthsSeen.add(mo);
    txns.push({ rawDate:{mo,da,yr,hadYear:!!dp[2]}, desc, amount });
  }

  /* Year-wrap fix for MM/DD statements spanning Dec→Jan */
  if (monthsSeen.has(12) && monthsSeen.has(1)){
    for (const t of txns) if (!t.rawDate.hadYear && t.rawDate.mo === 12) t.rawDate.yr = primaryYear - 1;
  }
  return txns.map(t => ({
    date: `${t.rawDate.yr}-${String(t.rawDate.mo).padStart(2,"0")}-${String(t.rawDate.da).padStart(2,"0")}`,
    desc: t.desc, amount: t.amount, card
  }));
}

/* ---------- CSV parsing with column auto-detection ---------- */
function parseDateLoose(s){
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m){ let y=+m[3]; if (y<100) y+=2000; return `${y}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`; }
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0,10);
  return null;
}
function parseCsv(text, filename){
  const res = Papa.parse(text.trim(), {header:true, skipEmptyLines:true});
  if (!res.data || !res.data.length) return {txns:[], card:"CARD"};
  const headers = res.meta.fields || [];
  const lower = headers.map(h => h.toLowerCase());
  const find = (...keys) => { for (const k of keys){ const i = lower.findIndex(h=>h.includes(k)); if (i>=0) return headers[i]; } return null; };
  const dateCol = find("transaction date","trans. date","posting date","post date","date");
  const descCol = find("description","merchant","details","payee","name");
  const amtCol  = find("amount");
  const debitCol = find("debit");
  const creditCol = find("credit");
  const fname = filename.toUpperCase();
  let card = /AMEX|AMERICAN/.test(fname) ? "AMEX" : /CHASE/.test(fname) ? "VISA" : /CITI/.test(fname) ? "CITI" : "CARD";
  const rows = [];
  for (const r of res.data){
    const date = parseDateLoose(dateCol ? r[dateCol] : Object.values(r).find(v=>parseDateLoose(v)));
    if (!date) continue;
    let desc = descCol ? r[descCol] : "";
    if (!desc){ desc = Object.values(r).filter(v=>typeof v==="string" && v.replace(/[^A-Za-z]/g,"").length>3).sort((a,b)=>b.length-a.length)[0] || ""; }
    desc = String(desc).trim();
    if (!desc || PAYMENT_RE.test(desc)) continue;
    let amount = null;
    if (amtCol && r[amtCol] !== "" && r[amtCol] != null) amount = parseFloat(String(r[amtCol]).replace(/[$,()]/g, m=>m==="("?"-":""));
    else if (debitCol || creditCol){
      const d = parseFloat(String(r[debitCol]||"").replace(/[$,]/g,"")) || 0;
      const c = parseFloat(String(r[creditCol]||"").replace(/[$,]/g,"")) || 0;
      amount = d > 0 ? d : -c;
    }
    if (amount == null || !isFinite(amount) || amount === 0) continue;
    rows.push({date, desc, amount, card});
  }
  /* sign convention: most banks export purchases as negative; if so, flip */
  const neg = rows.filter(r=>r.amount<0).length;
  if (neg > rows.length/2) rows.forEach(r=>r.amount = -r.amount);
  return {txns: rows, card};
}

/* ---------- Import pipeline ---------- */
function txnKey(t){ return t.date + "|" + t.amount.toFixed(2) + "|" + normMerchant(t.desc) + "|" + t.card; }
const PDF_DEBUG = {};   // cardId -> {filename, card, lines:[{line,status,reason,note}]}

async function importFiles(files){
  alert("importFiles start, count=" + files.length);
  if (files.length) snapshot();
  const resultsEl = document.getElementById("importresults");
  alert("resultsEl=" + (resultsEl ? "found" : "NULL"));
  for (const file of files){
    const cardId = "imp_" + Math.random().toString(36).slice(2,8);
    resultsEl.insertAdjacentHTML("afterbegin",
      `<div class="importcard" id="${cardId}"><h3>Reading ${escapeHtml(file.name)}…</h3><p>Parsing locally in your browser.</p></div>`);
    alert("card inserted, parsing...");
    try {
      let parsed, debugBtn = "";
      if (/\.csv$/i.test(file.name)){
        parsed = parseCsv(await file.text(), file.name);
      } else if (/\.pdf$/i.test(file.name)){
        const buf = await file.arrayBuffer();
        alert("arrayBuffer done, calling pdfToLines...");
        const lines = await pdfToLines(buf);
        const card = detectIssuer(lines, file.name);
        parsed = {txns: parseStatementLines(lines, card), card};
        PDF_DEBUG[cardId] = {filename: file.name, card, lines: debugClassifyLines(lines)};
        debugBtn = `<button class="btn viewlines" data-id="${cardId}" style="margin-top:8px">VIEW RAW LINES (${lines.length})</button>`;
      } else throw new Error("Unsupported file type — use PDF or CSV.");

      const existing = new Set(TXNS.map(txnKey));
      let added = 0, dupes = 0;
      for (const t of parsed.txns){
        const full = { id: Math.random().toString(36).slice(2,10), date: t.date, amount: t.amount,
          desc: t.desc, merchant: normMerchant(t.desc), card: t.card, ...categorize(t.desc), fv: "V" };
        const k = txnKey(full);
        if (existing.has(k)){ dupes++; continue; }
        existing.add(k); TXNS.push(full); added++;
      }
      if (added === 0 && dupes === 0 && !debugBtn) throw new Error("No transactions found. If this is a scanned/image PDF, try your bank's CSV export instead.");
      if (added === 0 && dupes === 0){
        document.getElementById(cardId).className = "importcard err";
        document.getElementById(cardId).innerHTML =
          `<h3>✕ ${escapeHtml(file.name)} — ${parsed.card}</h3>
           <p>No transactions found. If this is a scanned/image PDF, try your bank's CSV export instead. You can check what was extracted below.</p>${debugBtn}`;
        continue;
      }
      TXNS.sort((a,b)=>a.date<b.date?-1:1);
      applyRules(); buildQueueFromNew(); saveTxns(); saveQueue();
      const range = added ? `${TXNS[0].date.slice(0,7)} → ${TXNS[TXNS.length-1].date.slice(0,7)}` : "";
      document.getElementById(cardId).innerHTML =
        `<h3>✓ ${escapeHtml(file.name)} — ${parsed.card}</h3>
         <p>${added} transaction${added!==1?"s":""} added${dupes?` · ${dupes} duplicate${dupes!==1?"s":""} skipped`:""}${range?` · data now covers ${range}`:""}</p>${debugBtn}`;
      refreshAll();
    } catch (err){
      document.getElementById(cardId).className = "importcard err";
      document.getElementById(cardId).innerHTML =
        `<h3>✕ ${escapeHtml(file.name)}</h3><p>${escapeHtml(err.message || "Could not parse this file.")}</p>`;
    }
  }
}
document.getElementById("importresults").addEventListener("click", e=>{
  const b = e.target.closest(".viewlines");
  if (b) openDebug(b.dataset.id);
});

/* New merchants → review queue (recurring or material spend) */
function buildQueueFromNew(){
  const byM = {};
  for (const t of TXNS){
    if (RULES[t.merchant]) continue;
    const e = byM[t.merchant] = byM[t.merchant] || {merchant:t.merchant, sampleDesc:t.desc, total:0, count:0, months:new Set(), cat:t.cat, sub:t.sub, fv:t.fv};
    e.total += Math.max(t.amount,0); e.count++; e.months.add(ym(t.date));
  }
  const queued = new Set(QUEUE.map(q=>q.merchant));
  for (const e of Object.values(byM)){
    if (queued.has(e.merchant)) continue;
    if (e.months.size >= 2 || e.total >= 50)
      QUEUE.push({merchant:e.merchant, sampleDesc:e.sampleDesc, guessCat:e.cat, guessSub:e.sub, guessFv:e.fv, total:e.total, count:e.count});
  }
  QUEUE.sort((a,b)=>b.total-a.total);
  if (QUEUE.length > 25) QUEUE = QUEUE.slice(0,25);
}
</script>
<script>
/* ============================================================
   FILTERS, AGGREGATION & RENDERING
   ============================================================ */
const F = { year: null, cats: new Set(CATS), card: "all", fv: "all" };
const CARD_LABEL = c => c==="VISA" ? "Chase Visa" : c==="CITI" ? "Citi" : c==="AMEX" ? "Amex" : c;
let charts = {};
function killChart(id){ if (charts[id]){ charts[id].destroy(); delete charts[id]; } }

const yearsInData = () => [...new Set(TXNS.map(t=>+t.date.slice(0,4)))].sort();
const cardsInData = () => [...new Set(TXNS.map(t=>t.card))].sort();
function ensureYear(){
  const ys = yearsInData();
  if (!ys.length){ F.year = null; return; }
  if (!ys.includes(F.year)) F.year = ys[ys.length-1];
}
const passes = t =>
  (+t.date.slice(0,4) === F.year) && F.cats.has(t.cat) &&
  (F.card === "all" || t.card === F.card) && (F.fv === "all" || t.fv === F.fv);
const filtered = () => TXNS.filter(passes);
const monthKeys = () => [...new Set(TXNS.filter(t=>+t.date.slice(0,4)===F.year).map(t=>ym(t.date)))].sort();
const allMonthKeys = () => [...new Set(TXNS.map(t=>ym(t.date)))].sort();

function aggByCatMonth(txns, keys){
  const idx = Object.fromEntries(keys.map((k,i)=>[k,i]));
  const out = {};
  for (const t of txns){
    const i = idx[ym(t.date)]; if (i === undefined) continue;
    (out[t.cat] = out[t.cat] || Array(keys.length).fill(0))[i] += t.amount;
  }
  return out;
}
