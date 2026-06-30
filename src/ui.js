/* ---------- Filter chips ---------- */
const chips = document.querySelectorAll(".fchip");
function buildPops(){
  const ys = yearsInData();
  document.getElementById("pop-year").innerHTML = ys.length
    ? ys.map(y=>`<label><input type="radio" name="yr" value="${y}" ${F.year===y?"checked":""}>${y}</label>`).join("")
    : `<label style="color:var(--graphite)">No data yet</label>`;
  document.getElementById("pop-cat").innerHTML =
    `<label><input type="checkbox" id="catall" ${F.cats.size===CATS.length?"checked":""}><b>All categories</b></label>` +
    CATS.map(c=>`<label><input type="checkbox" class="catbox" value="${escapeHtml(c)}" ${F.cats.has(c)?"checked":""}><span class="catdot" style="background:${CAT_META[c].color}"></span>${escapeHtml(c)}</label>`).join("") +
    `<button class="popdone">DONE</button>`;
  const cds = cardsInData();
  document.getElementById("pop-card").innerHTML =
    `<label><input type="radio" name="cd" value="all" ${F.card==="all"?"checked":""}>All cards</label>` +
    cds.map(k=>`<label><input type="radio" name="cd" value="${k}" ${F.card===k?"checked":""}>${CARD_LABEL(k)}</label>`).join("");
  document.getElementById("pop-fv").innerHTML =
    [["all","All types"],["F","Fixed only"],["V","Variable only"]].map(([v,l])=>
    `<label><input type="radio" name="fv" value="${v}" ${F.fv===v?"checked":""}>${l}</label>`).join("");
}
function chipLabels(){
  chips[0].textContent = (F.year || "Year") + " ▾";
  chips[0].classList.toggle("on", yearsInData().length>1 && F.year !== yearsInData().slice(-1)[0]);
  chips[1].textContent = (F.cats.size===CATS.length ? "All categories" : F.cats.size + " categor" + (F.cats.size===1?"y":"ies")) + " ▾";
  chips[1].classList.toggle("on", F.cats.size !== CATS.length);
  chips[2].textContent = (F.card==="all" ? "All cards" : CARD_LABEL(F.card)) + " ▾";
  chips[2].classList.toggle("on", F.card !== "all");
  chips[3].textContent = (F.fv==="all" ? "All types" : F.fv==="F" ? "Fixed" : "Variable") + " ▾";
  chips[3].classList.toggle("on", F.fv !== "all");
}
function closePops(){ document.querySelectorAll(".pop").forEach(p=>p.classList.remove("open")); }
function openPop(id, chipEl){
  const p = document.getElementById(id);
  const r = chipEl.getBoundingClientRect();
  p.style.top  = (r.bottom + 4) + 'px';
  p.style.left = Math.min(r.left, window.innerWidth - 215) + 'px';
  p.classList.add('open');
}
document.getElementById("filters").addEventListener("click", e=>{
  const chip = e.target.closest(".fchip");
  if (chip){ const id = "pop-"+chip.dataset.pop;
    const was = document.getElementById(id).classList.contains("open");
    closePops(); if(!was) openPop(id, chip); return; }
  if (e.target.classList.contains("popdone")) closePops();
});
document.addEventListener("change", e=>{
  if (e.target.name==="yr"){ F.year = +e.target.value; closePops(); refreshAll(); }
  if (e.target.name==="cd"){ F.card = e.target.value; closePops(); refreshAll(); }
  if (e.target.name==="fv"){ F.fv = e.target.value; closePops(); refreshAll(); }
  if (e.target.id==="catall"){
    if (e.target.checked) CATS.forEach(c=>F.cats.add(c)); else F.cats.clear();
    buildPops(); refreshAll(false); }
  if (e.target.classList && e.target.classList.contains("catbox")){
    e.target.checked ? F.cats.add(e.target.value) : F.cats.delete(e.target.value); refreshAll(false); }
});
document.addEventListener("click", e=>{ if (!e.target.closest(".filters") && !e.target.closest(".pop")) closePops(); });

/* ---------- Tabs ---------- */
function go(t){
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.getElementById("tab-"+t).classList.add("active");
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active", b.dataset.t===t));
  window.scrollTo({top:0});
}
document.getElementById("nav").addEventListener("click", e=>{
  const b = e.target.closest("button"); if (b) go(b.dataset.t); });
window.go = go;
document.getElementById("summarybody").addEventListener("click", e=>{
  if (e.target.id==="setbudgetsbtn" || e.target.id==="editbudgetslink") openSheet("budgetsheet");
});

/* ---------- Summary ---------- */
function renderSummary(){
  const el = document.getElementById("summarybody");
  if (!TXNS.length){
    el.innerHTML = `<div class="empty"><h3>No statements yet</h3>
      Drop a PDF or CSV statement above to get started — it never leaves this device.<br><br>
      <button class="btn" onclick="loadSample()">LOAD SAMPLE DATA TO EXPLORE</button></div>`;
    return;
  }
  const keys = monthKeys();
  const tx = filtered();
  if (!keys.length || !tx.length){ el.innerHTML = `<div class="empty">Nothing matches the current filters.</div>`; return; }
  const agg = aggByCatMonth(tx, keys);
  const li = keys.length - 1;
  const tot = i => Object.values(agg).reduce((s,a)=>s+a[i],0);
  const cur = tot(li), prev = li>0 ? tot(li-1) : 0;
  const avg = keys.reduce((s,_,i)=>s+tot(i),0)/keys.length;
  const latestTx = tx.filter(t=>ym(t.date)===keys[li]);
  const fx = latestTx.filter(t=>t.fv==="F").reduce((s,t)=>s+t.amount,0);
  const all = latestTx.reduce((s,t)=>s+t.amount,0);
  const proj = forecastTotals().forecast[0] || cur;
  const p = prev ? (cur-prev)/prev*100 : 0;
  let html = `<div class="stats">
   <div class="stat"><div class="label">Spent · ${ymLabel(keys[li])}</div><div class="value">${fmt$(cur)}</div>
     ${li>0?`<div class="delta ${p>=0?"up":"down"}">${p>=0?"▲":"▼"} ${Math.abs(p).toFixed(1)}% vs prior mo</div>`:""}</div>
   <div class="stat"><div class="label">Monthly avg · ${F.year}</div><div class="value">${fmt$(avg)}</div><div class="delta">&nbsp;</div></div>
   <div class="stat"><div class="label">Fixed / Variable</div><div class="value" style="font-size:15px;">${fmt$(fx)} / ${fmt$(all-fx)}</div>
     <div class="delta">${all?Math.round(fx/all*100):0}% fixed</div></div>
   <div class="stat"><div class="label">Projected · next mo</div><div class="value">${fmt$(proj)}</div><div class="delta">est.</div></div>
  </div>
  <section><div class="pies">
    <div class="panel pie"><h3>${ymLabel(keys[li])}</h3><div class="cv"><canvas id="pieLatest"></canvas></div></div>
    <div class="panel pie"><h3>${ymLabel(keys[0])} – ${ymLabel(keys[li])}</h3><div class="cv"><canvas id="pieYtd"></canvas></div></div>
  </div></section>`;
  /* Budgets */
  const budgetCats = CATS.filter(c=>BUDGETS[c]!=null && F.cats.has(c));
  if (!budgetCats.length){
    html += `<section><h2>Monthly budgets</h2><div class="h2sub">${ymLabel(keys[li])}</div>
      <div class="panel" style="text-align:center; color:var(--graphite); font-size:13.5px;">
        Set a monthly target per category to track spending against it.
        <div class="btnrow" style="margin-top:10px"><button class="btn" id="setbudgetsbtn">SET BUDGETS</button></div>
      </div></section>`;
  } else {
    const spend = {};
    for (const t of latestTx) spend[t.cat] = (spend[t.cat]||0) + t.amount;
    html += `<section><h2>Monthly budgets</h2>
      <div class="h2sub">${ymLabel(keys[li])} · <span class="seeall-inline" id="editbudgetslink">edit targets</span></div>
      <div class="panel">${budgetCats.map(c=>{
        const s = spend[c]||0, b = BUDGETS[c];
        const pct = Math.min(100, Math.round(s/b*100));
        const cls = s>b ? "over" : pct>=80 ? "near" : "under";
        return `<div class="budgetrow">
          <div class="budgetlabel"><span><span class="catdot" style="background:${CAT_META[c].color}"></span>${escapeHtml(c)}</span>
            <span class="budgetamt">${fmt$(s)} / ${fmt$(b)}</span></div>
          <div class="budgetbar"><div class="budgetfill ${cls}" style="width:${pct}%"></div></div>
        </div>`;
      }).join("")}</div></section>`;
  }
  const ins = computeInsights().slice(0,2);
  if (ins.length){
    html += `<section><h2>Top opportunities</h2><div class="ledger">` +
      ins.map(insightHtml).join("") +
      `<span class="seeall" onclick="go('cuts')">See all opportunities →</span></div></section>`;
  }
  el.innerHTML = html;
  const pieOpt = {maintainAspectRatio:false, cutout:"55%",
    plugins:{legend:{position:"bottom",labels:{boxWidth:9,boxHeight:9,font:{size:10}}},
    tooltip:{callbacks:{label:x=>` ${x.label}: ${fmt$(x.parsed)} (${Math.round(x.parsed/x.dataset.data.reduce((a,b)=>a+b,0)*100)}%)`}}}};
  const mkPie = (id, vals) => {
    killChart(id);
    const rows = Object.entries(vals).filter(([,v])=>v>0.5).sort((a,b)=>b[1]-a[1]);
    charts[id] = new Chart(document.getElementById(id), {type:"doughnut",
      data:{labels:rows.map(r=>r[0]),datasets:[{data:rows.map(r=>r[1]),
        backgroundColor:rows.map(r=>CAT_META[r[0]].color),borderWidth:2,borderColor:"#fff"}]}, options:pieOpt});
  };
  mkPie("pieLatest", Object.fromEntries(Object.entries(agg).map(([c,a])=>[c,a[li]])));
  mkPie("pieYtd",    Object.fromEntries(Object.entries(agg).map(([c,a])=>[c,a.reduce((x,y)=>x+y,0)])));
}

/* ---------- Trends ---------- */
function renderTrends(){
  const el = document.getElementById("trendsbody");
  const keys = monthKeys();
  if (!TXNS.length || !keys.length){ el.innerHTML = `<div class="empty">Import a statement to see trends.</div>`; return; }
  el.innerHTML = `
   <section><h2>Spending over time</h2><div class="h2sub">Monthly totals by category · ${F.year}</div>
     <div class="panel chartbox"><canvas id="stacked"></canvas></div></section>
   <section><h2>Monthly series — table</h2><div class="h2sub">Scroll sideways on phone</div>
     <div class="tablewrap"><table id="mtable"></table></div>
     <div class="note"><span class="fvtag tagF">FIXED</span> recurring · <span class="fvtag tagM">MIXED</span> both · <span class="fvtag tagV">VAR</span> discretionary</div></section>`;
  const agg = aggByCatMonth(filtered(), keys);
  killChart("stacked");
  charts["stacked"] = new Chart(document.getElementById("stacked"), {type:"bar",
    data:{labels:keys.map(k=>MONTH_NAMES[+k.slice(5,7)-1]),
      datasets:Object.entries(agg).sort((a,b)=>CATS.indexOf(a[0])-CATS.indexOf(b[0]))
        .map(([c,a])=>({label:c,data:a,backgroundColor:CAT_META[c].color,borderRadius:2,stack:"s"}))},
    options:{maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{boxWidth:10,boxHeight:10,font:{size:10.5}}}},
      scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,ticks:{callback:v=>"$"+v.toLocaleString()},grid:{color:"#EDEFE8"}}}}});
  /* table: F/V subtotals computed within year+cat+card filters (independent of fv filter) */
  const yearTx = TXNS.filter(t=>+t.date.slice(0,4)===F.year && F.cats.has(t.cat) && (F.card==="all"||t.card===F.card));
  const fvTag = c => {
    const ct = yearTx.filter(t=>t.cat===c), f = ct.filter(t=>t.fv==="F").reduce((s,t)=>s+t.amount,0),
          tt = ct.reduce((s,t)=>s+t.amount,0), r = tt?f/tt:0;
    return r>=0.99?'<span class="fvtag tagF">FIXED</span>':r<=0.01?'<span class="fvtag tagV">VAR</span>':'<span class="fvtag tagM">MIXED</span>'; };
  const idx = Object.fromEntries(keys.map((k,i)=>[k,i]));
  const fRow = Array(keys.length).fill(0), vRow = Array(keys.length).fill(0);
  for (const t of yearTx){ const i = idx[ym(t.date)]; if (i===undefined) continue; (t.fv==="F"?fRow:vRow)[i] += t.amount; }
  const n = keys.length;
  let html = `<thead><tr><th>Category</th>${keys.map(k=>`<th>${MONTH_NAMES[+k.slice(5,7)-1]}</th>`).join("")}<th>Total</th><th>Avg/mo</th></tr></thead><tbody>`;
  Object.entries(agg).sort((a,b)=>b[1][n-1]-a[1][n-1]).forEach(([c,vals])=>{
    const t = vals.reduce((a,b)=>a+b,0);
    html += `<tr><td><span class="catdot" style="background:${CAT_META[c].color}"></span>${escapeHtml(c)}${fvTag(c)}</td>` +
      vals.map(v=>`<td>${Math.abs(v)>0.5?fmt$(v):"—"}</td>`).join("") + `<td><b>${fmt$(t)}</b></td><td>${fmt$(t/n)}</td></tr>`; });
  const row = (label,arr,cls)=>`<tr class="${cls}"><td>${label}</td>${arr.map(v=>`<td>${fmt$(v)}</td>`).join("")}<td>${fmt$(arr.reduce((a,b)=>a+b,0))}</td><td>${fmt$(arr.reduce((a,b)=>a+b,0)/n)}</td></tr>`;
  if (F.fv==="all") html += row("Fixed subtotal",fRow,"subtotal") + row("Variable subtotal",vRow,"subtotal") + row("Total",fRow.map((v,i)=>v+vRow[i]),"grand");
  else html += row(F.fv==="F"?"Fixed total":"Variable total", F.fv==="F"?fRow:vRow, "grand");
  document.getElementById("mtable").innerHTML = html + "</tbody>";
}

/* ---------- Ledger ---------- */
let ledgerMonth = null;
let ledgerSearch = "";
function renderLedger(){
  const el = document.getElementById("ledgerbody");
  if (!TXNS.length){ el.innerHTML = `<div class="empty">Import a statement to browse the ledger.</div>`; return; }
  el.innerHTML = `
   <section><h2>Category ledger</h2>
   <div class="h2sub">Search across everything, or drill into a month below</div>
   <input type="text" class="searchinput" id="ledgersearch" placeholder="Search by merchant or description…" value="${escapeHtml(ledgerSearch)}">
   <div id="ledgersection"></div></section>`;
  document.getElementById("ledgersearch").addEventListener("input", e=>{
    ledgerSearch = e.target.value; renderLedgerBody(); });
  renderLedgerBody();
}
function renderLedgerBody(){
  const sec = document.getElementById("ledgersection");
  if (!sec) return;
  if (ledgerSearch.trim()) renderLedgerSearch(sec);
  else renderLedgerMonth(sec);
}
function renderLedgerSearch(sec){
  const q = ledgerSearch.trim().toLowerCase();
  const matches = TXNS.filter(t =>
      F.cats.has(t.cat) && (F.card==="all"||t.card===F.card) && (F.fv==="all"||t.fv===F.fv) &&
      (t.desc.toLowerCase().includes(q) || t.merchant.toLowerCase().includes(q)))
    .sort((a,b)=>b.date.localeCompare(a.date));
  if (!matches.length){ sec.innerHTML = `<div class="empty">No transactions match "${escapeHtml(ledgerSearch)}".</div>`; return; }
  const shown = matches.slice(0,150);
  sec.innerHTML = `<div class="searchmeta">${matches.length} match${matches.length!==1?"es":""}${matches.length>shown.length?` · showing first ${shown.length}`:""}</div>
   <div class="ledger" id="ledgerlist">${shown.map(t=>`
     <div class="txn" data-id="${t.id}"><span class="d">${t.date}</span>
     <span class="m">${escapeHtml(t.desc)}
       <span class="src"><span class="catdot" style="background:${CAT_META[t.cat].color}"></span>${escapeHtml(t.sub)}</span>
       <span class="src">${escapeHtml(t.card)}</span>${t.manual?'<span class="manualtag">MANUAL</span>':''}</span>
     <span class="a">${fmtC(t.amount)}</span>
     <button class="txnedit" data-id="${t.id}" aria-label="Edit transaction">✎</button></div>`).join("")}</div>`;
}
function renderLedgerMonth(sec){
  const keys = monthKeys();
  if (!keys.length){ sec.innerHTML = `<div class="empty">No data for ${F.year}. Try a different year filter, or search above.</div>`; return; }
  if (!keys.includes(ledgerMonth)) ledgerMonth = keys[keys.length-1];
  sec.innerHTML = `
   <div class="h2sub" style="margin-top:4px">Tap a category for sub-categories, tap again for every transaction</div>
   <select class="mselect" id="msel">${keys.map(k=>`<option value="${k}" ${k===ledgerMonth?"selected":""}>${ymLabel(k)}</option>`).join("")}</select>
   <div class="ledger" id="ledgerlist"></div>
   <div class="note">Tags show the source card. Negative amounts are refunds.</div>`;
  document.getElementById("msel").addEventListener("change", e=>{ ledgerMonth = e.target.value; renderLedgerMonth(sec); });
  const tx = filtered().filter(t=>ym(t.date)===ledgerMonth);
  const byCat = {};
  for (const t of tx){
    const c = byCat[t.cat] = byCat[t.cat] || {amt:0, subs:{}};
    c.amt += t.amount;
    const s = c.subs[t.sub] = c.subs[t.sub] || {amt:0, fvF:0, fvV:0, t:[]};
    s.amt += t.amount; (t.fv==="F"? (s.fvF+=t.amount) : (s.fvV+=t.amount)); s.t.push(t);
  }
  const total = Object.values(byCat).reduce((s,c)=>s+c.amt,0) || 1;
  document.getElementById("ledgerlist").innerHTML =
    Object.entries(byCat).filter(([,c])=>Math.abs(c.amt)>0.005).sort((a,b)=>b[1].amt-a[1].amt).map(([cat,c],i)=>`
    <div class="cat" id="lcat${i}">
     <div class="lrow" onclick="document.getElementById('lcat${i}').classList.toggle('open')">
      <span class="lname"><span class="dot" style="background:${CAT_META[cat].color}"></span>${escapeHtml(cat)}<span class="caret">▶</span></span>
      <span><span class="lamt">${fmt$(c.amt)}</span><span class="lpct">${Math.round(c.amt/total*100)}%</span></span>
     </div>
     <div class="nest">${Object.entries(c.subs).sort((a,b)=>b[1].amt-a[1].amt).map(([sub,s])=>{
        const fv = s.fvF >= s.amt-0.005 ? "F" : s.fvV >= s.amt-0.005 ? "V" : "M";
        return `<div class="srow" onclick="this.classList.toggle('sopen');event.stopPropagation()">
          <span>${escapeHtml(sub)}<span class="fvtag ${fv==="F"?"tagF":fv==="V"?"tagV":"tagM"}">${fv==="F"?"FIXED":fv==="V"?"VAR":"MIXED"}</span></span>
          <span class="lamt">${fmt$(s.amt)}</span></div>
        <div class="txns">${s.t.sort((a,b)=>a.date<b.date?-1:1).map(t=>`
          <div class="txn" data-id="${t.id}"><span class="d">${t.date.slice(5).replace("-","/")}</span>
          <span class="m">${escapeHtml(t.desc)}<span class="src">${escapeHtml(t.card)}</span>${t.manual?'<span class="manualtag">MANUAL</span>':''}</span>
          <span class="a">${fmtC(t.amount)}</span>
          <button class="txnedit" data-id="${t.id}" aria-label="Edit transaction">✎</button></div>`).join("")}</div>`;}).join("")}
     </div></div>`).join("") || `<div class="empty">No transactions match the filters this month.</div>`;
}
document.getElementById("ledgerbody").addEventListener("click", e=>{
  const btn = e.target.closest(".txnedit");
  if (btn){ e.stopPropagation(); openEditTxn(btn.dataset.id); }
});

/* ---------- Insights ---------- */
function computeInsights(){
  if (!TXNS.length) return [];
  const out = [];
  const keysAll = [...new Set(TXNS.map(t=>ym(t.date)))].sort();
  const latest = keysAll[keysAll.length-1];
  const latestTx = TXNS.filter(t=>ym(t.date)===latest);
  const priorKeys = keysAll.slice(Math.max(0,keysAll.length-7), keysAll.length-1);
  /* recurring fixed merchants */
  const recM = {};
  for (const t of TXNS.filter(t=>t.fv==="F" && t.amount>0)){
    const e = recM[t.merchant] = recM[t.merchant] || {months:{}, cat:t.cat, sub:t.sub, desc:t.desc};
    e.months[ym(t.date)] = (e.months[ym(t.date)]||0) + t.amount;
  }
  /* 1 — streaming stack */
  const streams = Object.entries(recM).filter(([,e])=>e.sub==="Streaming" && e.months[latest]);
  if (streams.length >= 2){
    const totalS = streams.reduce((s,[,e])=>s+e.months[latest],0);
    const cheapest = Math.min(...streams.map(([,e])=>e.months[latest]));
    out.push({tag:"Subscription", cls:"t-sub", save:cheapest,
      html:`<b>${streams.length} streaming services</b> bill monthly — ${fmtC(totalS)} combined. Dropping one saves up to ${fmt$(cheapest*12)}/yr.`});
  }
  /* 2 — large fixed costs to sanity-check */
  Object.entries(recM)
    .filter(([,e])=>e.sub!=="Streaming" && e.months[latest] >= 30 && Object.keys(e.months).length >= 3)
    .sort((a,b)=>b[1].months[latest]-a[1].months[latest]).slice(0,2)
    .forEach(([m,e])=>{
      const n = Object.keys(e.months).length;
      out.push({tag:"Fixed cost", cls:"t-sub", save:e.months[latest],
        html:`<b>${escapeHtml(titleCase(m))}</b> (${fmtC(e.months[latest])}/mo, ${escapeHtml(e.sub)}) has billed ${n} months running — cancel or renegotiate if it's not earning its keep.`});
    });
  /* 3 — category spikes vs trailing average */
  if (priorKeys.length >= 2){
    const catMonth = {};
    for (const t of TXNS){ const k = ym(t.date);
      if (k!==latest && !priorKeys.includes(k)) continue;
      ((catMonth[t.cat] = catMonth[t.cat] || {})[k] = (catMonth[t.cat]?.[k]||0) + t.amount); }
    for (const [cat,mm] of Object.entries(catMonth)){
      const cur = mm[latest]||0;
      const priors = priorKeys.map(k=>mm[k]||0);
      const avg = priors.reduce((a,b)=>a+b,0)/priors.length;
      if (avg > 30 && cur > avg*1.2 && cur-avg > 40 && cat!=="Travel")
        out.push({tag:"Spike", cls:"t-spike", save:(cur-avg),
          html:`<b>${escapeHtml(cat)}</b> ran ${Math.round((cur/avg-1)*100)}% above your ${priors.length}-month average in ${ymLabel(latest)} (${fmt$(cur)} vs ${fmt$(avg)} typical).`});
    }
  }
  /* 4 — habit spending: frequent small charges */
  const freq = {};
  for (const t of latestTx.filter(t=>t.amount>0 && t.amount<=25)){
    const e = freq[t.merchant] = freq[t.merchant] || {n:0, tot:0, cat:t.cat};
    e.n++; e.tot += t.amount; }
  Object.entries(freq).filter(([,e])=>e.n>=8).sort((a,b)=>b[1].tot-a[1].tot).slice(0,2)
    .forEach(([m,e])=>out.push({tag:"Habit", cls:"t-habit", save:e.tot*0.5,
      html:`<b>${escapeHtml(titleCase(m))}</b>: ${e.n} charges in ${ymLabel(latest)} averaging ${fmtC(e.tot/e.n)} (${fmt$(e.tot)} total). Halving the habit saves ~${fmt$(e.tot*0.5)}/mo.`}));
  /* 5 — possible duplicate charges */
  const seen = {};
  for (const t of latestTx.filter(t=>t.amount>15)){
    const k = t.date+"|"+t.merchant+"|"+t.amount.toFixed(2);
    if (seen[k]) out.push({tag:"Duplicate?", cls:"t-dup", save:t.amount,
      html:`<b>${escapeHtml(titleCase(t.merchant))}</b> charged ${fmtC(t.amount)} twice on ${t.date} — verify it isn't a duplicate.`});
    seen[k] = true; }
  /* 6 — fixed-cost creep */
  for (const [m,e] of Object.entries(recM)){
    const ks = Object.keys(e.months).sort();
    if (ks.length >= 3){
      const first = e.months[ks[0]], last = e.months[ks[ks.length-1]];
      if (last > first*1.12 && last-first > 5)
        out.push({tag:"Price creep", cls:"t-spike", save:last-first,
          html:`<b>${escapeHtml(titleCase(m))}</b> has risen from ${fmtC(first)} to ${fmtC(last)}/mo since ${ymLabel(ks[0])} — check for a cheaper plan.`});
    }
  }
  out.sort((a,b)=>b.save-a.save);
  return out.slice(0,8);
}
function titleCase(s){ return s.toLowerCase().replace(/\b\w/g, c=>c.toUpperCase()); }
function insightHtml(i){
  return `<div class="insight"><span class="tag ${i.cls}">${i.tag}</span><p>${i.html}</p><span class="save">${fmt$(i.save)}/mo</span></div>`;
}
function renderCuts(){
  const el = document.getElementById("cutsbody");
  if (!TXNS.length){ el.innerHTML = `<div class="empty">Import a statement to see savings opportunities.</div>`; return; }
  const ins = computeInsights();
  if (!ins.length){ el.innerHTML = `<div class="empty"><h3>Nothing to flag</h3>With more months of data, spikes, habits, and subscription stacking will surface here.</div>`; return; }
  const tot = ins.reduce((s,i)=>s+i.save,0);
  el.innerHTML = `<section><h2>Where you could cut</h2>
    <div class="h2sub">Ranked by estimated monthly savings · computed from all your data</div>
    <div class="ledger">${ins.map(insightHtml).join("")}</div>
    <div class="note">Potential total: <b style="color:var(--green)">${fmt$(tot)}/mo (~${fmt$(tot*12)}/yr)</b>. Estimates, not promises — you know your life best.</div></section>`;
}

/* ---------- Forecast ---------- */
function lastNMonthKeys(n){
  const keys = [...new Set(TXNS.filter(t=>F.cats.has(t.cat) && (F.card==="all"||t.card===F.card) && (F.fv==="all"||t.fv===F.fv))
    .map(t=>ym(t.date)))].sort();
  return keys.slice(-n);
}
function forecastTotals(){
  const keys = lastNMonthKeys(9);
  if (!keys.length) return {keys:[], actual:[], forecast:[], next:[]};
  const tx = TXNS.filter(t=>keys.includes(ym(t.date)) && F.cats.has(t.cat) && (F.card==="all"||t.card===F.card) && (F.fv==="all"||t.fv===F.fv));
  const idx = Object.fromEntries(keys.map((k,i)=>[k,i]));
  const actual = Array(keys.length).fill(0);
  const fixedLatest = {};
  for (const t of tx){ actual[idx[ym(t.date)]] += t.amount;
    if (t.fv==="F" && ym(t.date)===keys[keys.length-1]) fixedLatest[t.merchant]=(fixedLatest[t.merchant]||0)+t.amount; }
  const fixedNow = Object.values(fixedLatest).reduce((a,b)=>a+b,0);
  const varSeries = keys.map((k,i)=>{
    const f = tx.filter(t=>ym(t.date)===k && t.fv==="F").reduce((s,t)=>s+t.amount,0);
    return actual[i]-f; });
  const lastV = varSeries.slice(-3);
  const w = lastV.length===3 ? (lastV[0]+2*lastV[1]+3*lastV[2])/6 : lastV.reduce((a,b)=>a+b,0)/Math.max(lastV.length,1);
  const slope = lastV.length>=2 ? (lastV[lastV.length-1]-lastV[0])/(lastV.length-1)*0.4 : 0;
  const forecast = [1,2,3].map(i=>Math.max(0, fixedNow + w + slope*i));
  /* next-month label keys */
  const [ly,lm] = keys[keys.length-1].split("-").map(Number);
  const next = [1,2,3].map(i=>{ const m=(lm-1+i)%12, y=ly+Math.floor((lm-1+i)/12); return `${y}-${String(m+1).padStart(2,"0")}`; });
  return {keys, actual, forecast, next, fixedNow};
}
function renderForecast(){
  const el = document.getElementById("forecastbody");
  const fc = forecastTotals();
  if (fc.keys.length < 2){ el.innerHTML = `<div class="empty"><h3>Need more history</h3>Import at least two months of statements to project ahead.</div>`; return; }
  el.innerHTML = `
   <section><h2>Next 3 months</h2>
   <div class="h2sub">Fixed costs carried at current amounts · variable from a weighted 3-month trend · dashed = forecast</div>
   <div class="panel chartbox"><canvas id="fchart"></canvas></div>
   <div class="note">${fc.next.map((k,i)=>`${ymLabel(k)} ${fmt$(fc.forecast[i])}`).join(" · ")} (±10% band). Respects the category, card &amp; type filters.</div></section>
   <section><h2>Projection by category</h2><div class="tablewrap"><table id="ptable"></table></div></section>`;
  const labels = [...fc.keys, ...fc.next].map(ymLabel);
  const nA = fc.keys.length;
  const pad = Array(nA-1).fill(null);
  killChart("fchart");
  charts["fchart"] = new Chart(document.getElementById("fchart"), {type:"line",
   data:{labels, datasets:[
    {label:"Actual",  data:[...fc.actual, null, null, null], borderColor:"#141B2A", backgroundColor:"#141B2A", pointRadius:3, tension:.3},
    {label:"Forecast",data:[...pad, fc.actual[nA-1], ...fc.forecast], borderColor:"#1E6E52", borderDash:[6,5], pointStyle:"rectRot", pointRadius:4, tension:.3},
    {label:"U", data:[...pad, fc.actual[nA-1], ...fc.forecast.map(v=>v*1.10)], borderColor:"rgba(30,110,82,0)", backgroundColor:"rgba(30,110,82,.10)", fill:"+1", pointRadius:0},
    {label:"L", data:[...pad, fc.actual[nA-1], ...fc.forecast.map(v=>v*0.90)], borderColor:"rgba(30,110,82,0)", pointRadius:0}]},
   options:{maintainAspectRatio:false,
    plugins:{legend:{labels:{filter:i=>["Actual","Forecast"].includes(i.text),boxWidth:10,font:{size:11}},position:"bottom"}},
    scales:{y:{ticks:{callback:v=>"$"+v.toLocaleString()},grid:{color:"#EDEFE8"}},x:{grid:{display:false},ticks:{font:{size:10}}}}}});
  /* per-category projection */
  const keys = fc.keys;
  const tx = TXNS.filter(t=>keys.includes(ym(t.date)) && F.cats.has(t.cat) && (F.card==="all"||t.card===F.card) && (F.fv==="all"||t.fv===F.fv));
  let rows = "", tots = [0,0,0];
  for (const cat of CATS){
    const ct = tx.filter(t=>t.cat===cat);
    if (!ct.length) continue;
    const fixedNow = ct.filter(t=>t.fv==="F" && ym(t.date)===keys[keys.length-1]).reduce((s,t)=>s+t.amount,0);
    const vS = keys.map(k=>ct.filter(t=>ym(t.date)===k && t.fv==="V").reduce((s,t)=>s+t.amount,0));
    const lv = vS.slice(-3);
    const w = lv.length===3 ? (lv[0]+2*lv[1]+3*lv[2])/6 : lv.reduce((a,b)=>a+b,0)/Math.max(lv.length,1);
    const proj = [1,2,3].map(()=>Math.max(0, fixedNow + w));
    proj.forEach((v,i)=>tots[i]+=v);
    const fr = ct.filter(t=>t.fv==="F").reduce((s,t)=>s+t.amount,0)/ct.reduce((s,t)=>s+t.amount,0);
    const basis = fr>=0.99?"Known fixed":fr>0.01?"Fixed + trend":"Weighted trend";
    rows += `<tr><td><span class="catdot" style="background:${CAT_META[cat].color}"></span>${escapeHtml(cat)}</td>` +
      proj.map(v=>`<td>${fmt$(v)}</td>`).join("") + `<td style="font-size:11px;color:var(--graphite)">${basis}</td></tr>`;
  }
  document.getElementById("ptable").innerHTML =
   `<thead><tr><th>Category</th>${fc.next.map(k=>`<th>${MONTH_NAMES[+k.slice(5,7)-1]}</th>`).join("")}<th>Basis</th></tr></thead>
    <tbody>${rows}<tr class="grand"><td>Total</td>${tots.map(v=>`<td>${fmt$(v)}</td>`).join("")}<td></td></tr></tbody>`;
}

/* ---------- Review queue ---------- */
function renderReview(){
  const el = document.getElementById("reviewbox");
  if (!QUEUE.length){ el.innerHTML = ""; return; }
  const shown = QUEUE.slice(0,6);
  el.innerHTML = `<div class="review"><h3>${QUEUE.length} merchant${QUEUE.length!==1?"s":""} to review</h3>
   <p>Confirm the guesses (or fix them) and they'll apply to every statement from now on. Skipping just keeps the guesses.</p>
   ${shown.map((q,i)=>`<div class="rv" data-i="${i}">
     <span class="m">${escapeHtml(q.merchant)} · ${q.count}× · ${fmt$(q.total)}</span>
     <select class="rvcat">${catOptionsHtml(q.guessCat, q.guessSub)}</select>
     <div class="pill"><button class="${q.guessFv==="F"?"on":""}" data-fv="F">FIXED</button><button class="${q.guessFv==="V"?"on":""}" data-fv="V">VAR</button></div>
   </div>`).join("")}
   <div class="btnrow" style="margin:12px 0 0;justify-content:flex-start">
     <button class="btn primary" id="confirmrules">CONFIRM ${shown.length}</button>
     <button class="btn" id="skiprules">SKIP FOR NOW</button>
   </div></div>`;
  el.querySelectorAll(".pill").forEach(p=>p.addEventListener("click", e=>{
    if (e.target.tagName!=="BUTTON") return;
    p.querySelectorAll("button").forEach(b=>b.classList.remove("on"));
    e.target.classList.add("on"); }));
  document.getElementById("confirmrules").addEventListener("click", ()=>{
    snapshot();
    el.querySelectorAll(".rv").forEach(rv=>{
      const q = shown[+rv.dataset.i];
      const [cat, sub] = rv.querySelector(".rvcat").value.split("||");
      const fv = rv.querySelector(".pill button.on")?.dataset.fv || q.guessFv;
      RULES[q.merchant] = {cat, sub, fv};
    });
    QUEUE = QUEUE.filter(q=>!shown.includes(q));
    saveRules(); saveQueue(); applyRules(); saveTxns(); refreshAll();
    toast("Rules saved — they'll auto-apply from now on");
  });
  document.getElementById("skiprules").addEventListener("click", ()=>{
    QUEUE = QUEUE.filter(q=>!shown.includes(q)); saveQueue(); renderReview(); });
}

/* ---------- Sheets (settings / add expense / edit transaction / budgets) ---------- */
const sheetbg = document.getElementById("sheetbg");
const ALL_SHEETS = ["sheet","addsheet","editsheet","budgetsheet","debugsheet"];
function openSheet(id){
  closeSheets();
  if (id==="sheet") renderRulesList();
  if (id==="budgetsheet") renderBudgetForm();
  document.getElementById(id).classList.add("open");
  sheetbg.classList.add("open");
}
function closeSheets(){
  ALL_SHEETS.forEach(id=>document.getElementById(id).classList.remove("open"));
  sheetbg.classList.remove("open");
}
document.getElementById("gearbtn").addEventListener("click", ()=>openSheet("sheet"));
sheetbg.addEventListener("click", closeSheets);
function renderRulesList(){
  const el = document.getElementById("ruleslist");
  const entries = Object.entries(RULES);
  el.innerHTML = entries.length ? entries.map(([m,r])=>
    `<div class="row"><span class="rulesmall">${escapeHtml(m)} → ${escapeHtml(r.sub)} · ${r.fv==="F"?"FIXED":"VAR"}</span>
     <button class="ruledel" data-m="${escapeHtml(m)}">×</button></div>`).join("")
    : `<div class="row" style="color:var(--graphite)">No rules saved yet.</div>`;
  el.querySelectorAll(".ruledel").forEach(b=>b.addEventListener("click", ()=>{
    snapshot();
    delete RULES[b.dataset.m]; saveRules(); applyRules(); saveTxns(); renderRulesList(); refreshAll(); }));
  document.getElementById("undonote").textContent = historyInfo();
}
document.getElementById("undobtn").addEventListener("click", ()=>{ undoLast(); renderRulesList(); });
document.getElementById("exportbtn").addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify({version:1, exported:new Date().toISOString(), txns:TXNS, rules:RULES, budgets:BUDGETS}, null, 1)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "bank-for-a-buck-backup.json"; a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById("importbtn").addEventListener("click", ()=>document.getElementById("backupinput").click());
document.getElementById("backupinput").addEventListener("change", async e=>{
  const f = e.target.files[0]; if (!f) return;
  try { const data = JSON.parse(await f.text());
    if (!Array.isArray(data.txns)) throw new Error();
    snapshot();
    TXNS = data.txns; RULES = data.rules || {}; QUEUE = []; BUDGETS = data.budgets || {};
    applyRules(); saveTxns(); saveRules(); saveQueue(); saveBudgets(); refreshAll(); closeSheets(); toast("Backup restored");
  } catch(_){ toast("Couldn't read that backup file"); }
  e.target.value = "";
});
document.getElementById("clearbtn").addEventListener("click", ()=>{
  if (!confirm("Erase all transactions and rules from this device? This cannot be undone.")) return;
  snapshot();
  TXNS = []; RULES = {}; QUEUE = [];
  store.del("bfb_txns"); store.del("bfb_rules"); store.del("bfb_queue");
  refreshAll(); closeSheets(); toast("All data erased — use Undo to bring it back");
});
document.getElementById("samplebtn").addEventListener("click", ()=>{ loadSample(); closeSheets(); });

/* ---------- Raw PDF line debug viewer ---------- */
function openDebug(cardId){
  const d = PDF_DEBUG[cardId];
  if (!d) return;
  const counts = {txn:0, filtered:0, other:0};
  d.lines.forEach(l=>counts[l.status]++);
  document.getElementById("debugsummary").innerHTML =
    `${escapeHtml(d.filename)} — ${d.card} · ${d.lines.length} lines extracted<br>
     <div class="dbglegend">
       <span><i style="background:var(--green)"></i>${counts.txn} became transactions</span>
       <span><i style="background:var(--amber)"></i>${counts.filtered} filtered (payments/totals)</span>
       <span><i style="background:#C7CBC1"></i>${counts.other} other (no date+amount pattern)</span>
     </div>
     If a transaction is missing, look in <b>other</b> first — often a description that wrapped onto its own line.`;
  document.getElementById("debuglist").innerHTML = d.lines.map(l=>
    `<div class="dbgline dbg-${l.status}"><span class="dbgtag">${l.status==="txn"?"TXN":l.status==="filtered"?"SKIP":"—"}</span>
     <span class="dbgtext">${escapeHtml(l.line)}</span>
     <span class="dbgnote">${escapeHtml(l.note||l.reason)}</span></div>`).join("");
  document.getElementById("debugcopy").dataset.id = cardId;
  openSheet("debugsheet");
}
document.getElementById("debug-cancel").addEventListener("click", closeSheets);
document.getElementById("debugcopy").addEventListener("click", async e=>{
  const d = PDF_DEBUG[e.target.dataset.id];
  if (!d) return;
  const text = d.lines.map(l=>l.line).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied — paste it wherever you'd like");
  } catch(_){
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("Copied — paste it wherever you'd like"); }
    catch(_){ toast("Couldn't copy automatically — select the lines manually"); }
    document.body.removeChild(ta);
  }
});
function renderBudgetForm(){
  document.getElementById("budgetform").innerHTML = CATS.map(c=>
    `<div class="formrow"><label><span class="catdot" style="background:${CAT_META[c].color}"></span>${escapeHtml(c)}</label>
     <input type="number" min="0" step="1" class="budgetinput" data-cat="${escapeHtml(c)}" placeholder="No target" value="${BUDGETS[c]!=null?BUDGETS[c]:""}"></div>`).join("");
}
document.getElementById("budget-cancel").addEventListener("click", closeSheets);
document.getElementById("budget-save").addEventListener("click", ()=>{
  document.querySelectorAll(".budgetinput").forEach(inp=>{
    const v = parseFloat(inp.value);
    if (!inp.value || !isFinite(v) || v<=0) delete BUDGETS[inp.dataset.cat];
    else BUDGETS[inp.dataset.cat] = v;
  });
  saveBudgets(); refreshAll(); closeSheets(); toast("Budgets saved");
});

let toastTimer;
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove("show"), 2600);
}

/* ---------- Shared pill (Fixed/Variable) helpers ---------- */
function wirePill(id){
  const p = document.getElementById(id);
  p.addEventListener("click", e=>{
    if (e.target.tagName!=="BUTTON") return;
    p.querySelectorAll("button").forEach(b=>b.classList.remove("on"));
    e.target.classList.add("on");
  });
}
function pillValue(id){ return document.querySelector(`#${id} button.on`)?.dataset.fv || "V"; }
function setPill(id, fv){
  document.querySelectorAll(`#${id} button`).forEach(b=>b.classList.toggle("on", b.dataset.fv===fv));
}
wirePill("ae-fv"); wirePill("et-fv");

/* ---------- Add manual expense ---------- */
document.getElementById("addexpensebtn").addEventListener("click", ()=>{
  document.getElementById("ae-desc").value = "";
  document.getElementById("ae-amount").value = "";
  document.getElementById("ae-date").value = new Date().toISOString().slice(0,10);
  document.getElementById("ae-cat").innerHTML = catOptionsHtml("Home & Utilities","Rent & mortgage");
  setPill("ae-fv","F");
  document.getElementById("ae-card").value = "Bank autopay";
  document.getElementById("ae-repeat").checked = false;
  document.getElementById("ae-range").style.display = "none";
  const mk = allMonthKeys();
  const now = new Date(), cur = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  document.getElementById("ae-from").value = mk[0] || cur;
  document.getElementById("ae-to").value = mk[mk.length-1] || cur;
  openSheet("addsheet");
});
document.getElementById("ae-repeat").addEventListener("change", e=>{
  document.getElementById("ae-range").style.display = e.target.checked ? "flex" : "none";
});
document.getElementById("ae-cancel").addEventListener("click", closeSheets);
document.getElementById("ae-save").addEventListener("click", ()=>{
  const desc = document.getElementById("ae-desc").value.trim();
  const amount = parseFloat(document.getElementById("ae-amount").value);
  const date = document.getElementById("ae-date").value;
  const [cat, sub] = document.getElementById("ae-cat").value.split("||");
  const fv = pillValue("ae-fv");
  const card = document.getElementById("ae-card").value.trim() || "Bank autopay";
  const repeat = document.getElementById("ae-repeat").checked;
  if (!desc){ toast("Add a description"); return; }
  if (!isFinite(amount) || amount<=0){ toast("Enter an amount greater than 0"); return; }
  if (!date){ toast("Pick a date"); return; }
  let from, to;
  if (repeat){
    from = document.getElementById("ae-from").value; to = document.getElementById("ae-to").value;
    if (!from || !to || from > to){ toast("Check the From/To months"); return; }
  }
  snapshot();
  const baseDay = +date.slice(8,10);
  const make = d => ({ id: Math.random().toString(36).slice(2,10), date:d, amount, desc,
    merchant: normMerchant(desc), card, cat, sub, fv, manual:true, locked:true });
  const newTxns = [];
  if (!repeat){
    newTxns.push(make(date));
  } else {
    let [y,m] = from.split("-").map(Number); const [ey,em] = to.split("-").map(Number);
    while (y<ey || (y===ey && m<=em)){
      const lastDay = new Date(y,m,0).getDate();
      newTxns.push(make(`${y}-${String(m).padStart(2,"0")}-${String(Math.min(baseDay,lastDay)).padStart(2,"0")}`));
      m++; if (m>12){ m=1; y++; }
    }
  }
  TXNS.push(...newTxns);
  TXNS.sort((a,b)=>a.date<b.date?-1:1);
  applyFV(); saveTxns(); refreshAll(); closeSheets();
  toast(`Added ${newTxns.length} transaction${newTxns.length!==1?"s":""}`);
});

/* ---------- Edit / delete transaction ---------- */
let editingTxnId = null;
function openEditTxn(id){
  const t = TXNS.find(x=>x.id===id);
  if (!t) return;
  editingTxnId = id;
  document.getElementById("et-desc").value = t.desc;
  document.getElementById("et-amount").value = t.amount;
  document.getElementById("et-date").value = t.date;
  document.getElementById("et-cat").innerHTML = catOptionsHtml(t.cat, t.sub);
  setPill("et-fv", t.fv);
  document.getElementById("et-merchant").textContent = t.merchant;
  document.getElementById("et-rule").checked = false;
  openSheet("editsheet");
}
document.getElementById("et-cancel").addEventListener("click", closeSheets);
document.getElementById("et-delete").addEventListener("click", ()=>{
  if (!editingTxnId) return;
  if (!confirm("Delete this transaction? You can undo this from settings.")) return;
  snapshot();
  TXNS = TXNS.filter(t=>t.id!==editingTxnId);
  saveTxns(); refreshAll(); closeSheets();
  toast("Transaction deleted");
});
document.getElementById("et-save").addEventListener("click", ()=>{
  const t = TXNS.find(x=>x.id===editingTxnId);
  if (!t) return;
  const desc = document.getElementById("et-desc").value.trim();
  const amount = parseFloat(document.getElementById("et-amount").value);
  const date = document.getElementById("et-date").value;
  const [cat, sub] = document.getElementById("et-cat").value.split("||");
  const fv = pillValue("et-fv");
  const applyToAll = document.getElementById("et-rule").checked;
  if (!desc){ toast("Add a description"); return; }
  if (!isFinite(amount)){ toast("Enter a valid amount"); return; }
  if (!date){ toast("Pick a date"); return; }
  snapshot();
  const origMerchant = t.merchant;
  t.date = date; t.desc = desc; t.amount = amount; t.merchant = normMerchant(desc);
  if (applyToAll){
    RULES[origMerchant] = {cat, sub, fv};
    t.cat = cat; t.sub = sub; t.fv = fv; t.locked = false;
    saveRules(); applyRules();
  } else {
    t.cat = cat; t.sub = sub; t.fv = fv; t.locked = true;
  }
  saveTxns(); refreshAll(); closeSheets();
  toast(applyToAll ? "Saved — rule applied to matching transactions" : "Transaction updated");
});

/* ---------- File input wiring ---------- */
const dz = document.getElementById("dropzone"), fi = document.getElementById("fileinput");
fi.addEventListener("change", e=>{ if (e.target.files.length) importFiles([...e.target.files]); e.target.value=""; });
["dragover","dragenter"].forEach(ev=>dz.addEventListener(ev, e=>{ e.preventDefault(); dz.classList.add("drag"); }));
["dragleave","drop"].forEach(ev=>dz.addEventListener(ev, e=>{ e.preventDefault(); dz.classList.remove("drag"); }));
dz.addEventListener("drop", e=>{ if (e.dataTransfer.files.length) importFiles([...e.dataTransfer.files]); });

/* ---------- Sample data ---------- */
function loadSample(){
  if (TXNS.length) snapshot();
  const gen = [];
  const push = (y,m,d,desc,card,amt)=>gen.push({date:`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`,desc,card,amount:amt});
  const span = []; for (let y=2025;y<=2026;y++) for (let m=1;m<=12;m++){ if (y===2026&&m>5) break; span.push([y,m]); }
  const jig = (base,p)=>Math.round((base*(1+(Math.sin(base+p*2.7)*0.5)*0.18))*100)/100;
  span.forEach(([y,m],i)=>{
    push(y,m,1,"CHASE EPAY GREENHILL APARTMENTS LLC","VISA", y===2025?1800:1850);
    push(y,m,6,"PG&E WEBPAY CA","CITI", jig(118,i)); push(y,m,3,"COMCAST XFINITY INTERNET","CITI",80);
    push(y,m,10,"CITY UTILITIES WATER SVC","VISA",60);
    push(y,m,2,"KUMON LEARNING CTR 1182","AMEX",160); push(y,m,5,"AQUATECH SWIM SCHOOL","VISA",80);
    if (m===7||m===8||m===3) push(y,m,15,"BRIGHT HORIZONS DAYCAMP","AMEX",240);
    if (m%3===1) push(y,m,22,"TARGET 00001144 TOYS","CITI",jig(55,i));
    push(y,m,8,"CHEWY.COM PET SUPPLIES","CITI",66);
    if (m===5||m===11) push(y,m,19,"VCA ANIMAL HOSPITAL","VISA",jig(180,i));
    if (m%2===0) push(y,m,19,"PAWS & CLAWS GROOMING","VISA",65);
    [4,11,18,25].forEach((d,j)=>push(y,m,d,["WHOLE FOODS MKT 10447","TRADER JOES 553","SAFEWAY STORE 1107","WHOLE FOODS MKT 10447"][j], ["AMEX","VISA","CITI","AMEX"][j], jig(120+j*15,i+j)));
    if (m%2===1) push(y,m,15,"99 RANCH MARKET 1772","VISA",jig(70,i));
    [3,17].forEach((d,j)=>push(y,m,d,["SUSHI HANA SAN MATEO","EL CAMINO TAQUERIA"][j],"AMEX",jig(60+j*20,i+j)));
    push(y,m,24,"TST* BRASSERIE NINETEEN","AMEX",jig(95,i));
    [2,12,22].forEach((d,j)=>push(y,m,d,["DOORDASH*PHO HOUSE","DOORDASH*THAI SPICE","UBER EATS"][j],["CITI","CITI","AMEX"][j],jig(32+j*4,i+j)));
    for (let d=1; d<=27; d+=Math.ceil(1.5+((i+d)%2))) push(y,m,d,"STARBUCKS STORE 02241","AMEX",jig(7,d));
    [5,14,27].forEach((d,j)=>push(y,m,d,"AMZN MKTP US*2K4","CITI",jig(60+j*25,i+j)));
    if (m%3===2) push(y,m,16,"UNIQLO USA LLC","AMEX",jig(140,i));
    [3,17,30].forEach((d,j)=>push(y,m,d,j===1?"LYFT *RIDE":"UBER *TRIP","AMEX",jig(20+j*4,i+j)));
    [7,23].forEach((d,j)=>push(y,m,d,["CHEVRON 00231","SHELL OIL 5744"][j],"CITI",jig(68,i+j)));
    push(y,m,12,"FASTRAK CSC TOLL","VISA",jig(38,i));
    push(y,m,1,"NETFLIX.COM","CITI", y===2025&&m<7?13.99:15.49);
    push(y,m,6,"HULU 8884"," CITI".trim(),17.99); push(y,m,15,"MAX.COM SUBSCRIPTION","VISA",13.49);
    push(y,m,2,"EQUINOX MO DUES","AMEX",89);
    push(y,m,5,"APPLE.COM/BILL ICLOUD","AMEX",9.99); push(y,m,9,"SPOTIFY USA","VISA",11.99); push(y,m,20,"ADOBE CREATIVE CLOUD","CITI",37.99);
    push(y,m,8,"CVS/PHARMACY 09322","VISA",jig(28,i));
    if (m%4===2) push(y,m,14,"SMILE DENTAL GROUP","AMEX",jig(90,i));
    if ([2,6,10].includes(m)){ push(y,m,20,"UNITED AIRLINES 0162345","AMEX",jig(300,i)); push(y,m,21,"MARRIOTT HOTELS NAPA","AMEX",jig(190,i)); }
  });
  TXNS = gen.map(t=>({ id:Math.random().toString(36).slice(2,10), date:t.date, amount:t.amount,
    desc:t.desc, merchant:normMerchant(t.desc), card:t.card, ...categorize(t.desc), fv:"V" }));
  TXNS.sort((a,b)=>a.date<b.date?-1:1);
  QUEUE = [];
  applyRules(); buildQueueFromNew(); saveTxns(); saveQueue();
  refreshAll(); toast("Sample data loaded — erase it anytime in settings");
}
window.loadSample = loadSample;

/* ---------- Master refresh ---------- */
function refreshAll(rebuildPops = true){
  ensureYear();
  chipLabels();
  if (rebuildPops) buildPops();
  renderReview(); renderSummary(); renderTrends(); renderLedger(); renderCuts(); renderForecast();
}
window.refreshAll = refreshAll;
applyRules();
refreshAll();
if (!store.persistent) toast("Heads up: storage is blocked here — data won't persist. Open this file in Safari/Chrome.");
