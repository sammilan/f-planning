"use strict";
/* ============================================================
   BANK FOR A BUCK — all processing happens in this browser.
   ============================================================ */

/* ---------- Category taxonomy ---------- */
const CAT_META = {
  "Home & Utilities": {color:"#3D5A80", subs:["Rent & mortgage","Energy","Internet & phone","Water & trash","Maintenance"]},
  "Kids":             {color:"#C2543F", subs:["Classes","Childcare","Activities & camps","Toys & gear"]},
  "Pets":             {color:"#8A6F46", subs:["Food & supplies","Vet","Grooming & care"]},
  "Groceries":        {color:"#5F7A4E", subs:["Supermarket","Warehouse club","Specialty","Grocery delivery"]},
  "Dining":           {color:"#C06B3E", subs:["Restaurants","Delivery","Coffee & tea","Fast food","Bars"]},
  "Shopping":         {color:"#B98A2F", subs:["Online","Big box","Clothing","Electronics","Home goods"]},
  "Transport":        {color:"#4E7D8C", subs:["Rideshare","Gas","Parking & tolls","Transit","Auto service"]},
  "Subscriptions":    {color:"#7B5283", subs:["Streaming","Music & audio","Fitness","Software & cloud","News & media"]},
  "Health":           {color:"#A85D6E", subs:["Pharmacy","Medical","Dental","Vision"]},
  "Travel":           {color:"#2E7E7B", subs:["Flights","Hotels & stays","Car rental","Activities"]},
  "Personal Care":    {color:"#9C7BA0", subs:["Salon & beauty"]},
  "Insurance":        {color:"#5E7066", subs:["Insurance"]},
  "Education":        {color:"#2F6690", subs:["Education"]},
  "Fees & Interest":  {color:"#99504F", subs:["Fees & interest"]},
  "Other":            {color:"#8A8F98", subs:["Uncategorized"]}
};
const CATS = Object.keys(CAT_META);
const FIXED_SUBS = new Set(["Rent & mortgage","Energy","Internet & phone","Water & trash","Insurance",
  "Childcare","Classes","Streaming","Music & audio","Fitness","Software & cloud","News & media"]);

/* ---------- Keyword rules (first match wins) ---------- */
const KEYWORD_RULES = [
  [/INSTACART/, "Groceries","Grocery delivery"],
  [/DOORDASH|UBER\s*EATS|UBEREATS|GRUBHUB|POSTMATES|SEAMLESS|CAVIAR|DELIVEROO/, "Dining","Delivery"],
  [/STARBUCKS|PEET'?S|BLUE BOTTLE|PHILZ|DUNKIN|COFFEE|CAFFE|ESPRESSO|BOBA|TEAHOUSE|TEA HOUSE|MATCHA/, "Dining","Coffee & tea"],
  [/MCDONALD|BURGER KING|WENDY'?S|TACO BELL|CHIPOTLE|CHICK-?FIL|KFC|POPEYES|SUBWAY|IN-?N-?OUT|FIVE GUYS|SHAKE SHACK|PANDA EXPRESS|JACK IN THE BOX|DOMINO'?S|PIZZA HUT|LITTLE CAESARS|PANERA|WINGSTOP|RAISING CANE/, "Dining","Fast food"],
  [/BREWERY|BREWING|TAPROOM|WINE BAR|COCKTAIL|\bPUB\b|\bBAR\b/, "Dining","Bars"],
  [/RESTAURANT|RISTORANTE|GRILL|BISTRO|TRATTORIA|SUSHI|RAMEN|THAI|\bPHO\b|TAQUERIA|CANTINA|KITCHEN|DINER|STEAK|BBQ|BARBECUE|EATERY|OSTERIA|BRASSERIE|IZAKAYA|CURRY|KEBAB|NOODLE|DUMPLING|POKE|MEDITERRAN/, "Dining","Restaurants"],
  [/WHOLE\s*FOODS|TRADER JOE|SAFEWAY|KROGER|ALBERTSONS|PUBLIX|WEGMANS|\bALDI\b|\bLIDL\b|SPROUTS|FOOD LION|STOP & SHOP|H-?E-?B\b|RALPHS|VONS|FRED MEYER|WINCO|MARKET BASKET|SMART & FINAL|GROCERY OUTLET|PIGGLY|MEIJER|GIANT EAGLE|SHOPRITE|FOODS? CO|LUCKY SUPERMARKET|GROCER/, "Groceries","Supermarket"],
  [/COSTCO|SAM'?S CLUB|BJ'?S WHOLESALE/, "Groceries","Warehouse club"],
  [/99 RANCH|H ?MART|MITSUWA|SEAFOOD CITY|FARMERS MARKET|BUTCHER|BAKERY|PATISSERIE|FISH MARKET/, "Groceries","Specialty"],
  [/RENT\b|APARTMENT|PROPERTY (MGMT|MANAGEMENT)|MORTGAGE|\bHOA\b|LANDLORD/, "Home & Utilities","Rent & mortgage"],
  [/PG&E|PGANDE|SO ?CAL EDISON|CON ?ED|DUKE ENERGY|NATIONAL GRID|XCEL|PSE&?G|DOMINION ENERGY|ELECTRIC|POWER & LIGHT|GAS COMPANY|SDG&E|SEATTLE CITY LIGHT|UTILITY PAYMENT/, "Home & Utilities","Energy"],
  [/COMCAST|XFINITY|SPECTRUM|VERIZON|AT&T|T-?MOBILE|CENTURYLINK|FRONTIER COMM|SONIC\.NET|GOOGLE FIBER|COX COMM|MINT MOBILE|VISIBLE/, "Home & Utilities","Internet & phone"],
  [/RECOLOGY|WASTE MGMT|WASTE MANAGEMENT|TRASH|SANITATION|CITY UTILIT|WATER DIST|WATER DEPT|MUNICIPAL WATER|EBMUD/, "Home & Utilities","Water & trash"],
  [/HOME DEPOT|LOWE'?S|ACE H(ARD)?W|TRUE VALUE|HANDYMAN|PLUMB|HVAC|ROOFING|PEST CONTROL|TERMINIX|ORKIN/, "Home & Utilities","Maintenance"],
  [/KUMON|MATHNASIUM|TUTOR|SWIM SCHOOL|AQUATECH|DANCE STUDIO|BALLET|KARATE|TAEKWONDO|MUSIC LESSON|PIANO|VIOLIN|SOCCER CLUB|LITTLE LEAGUE|GYMNASTICS|CODE NINJAS/, "Kids","Classes"],
  [/DAYCARE|DAY CARE|CHILDCARE|CHILD CARE|PRESCHOOL|MONTESSORI|BRIGHT HORIZONS|KINDERCARE|NANNY|BABYSIT|SITTERCITY|CARE\.COM/, "Kids","Childcare"],
  [/\bCAMP\b|DAYCAMP|\bZOO\b|CHILDREN'?S MUSEUM|AQUARIUM|CHUCK E|KIDZ|TRAMPOLINE|BOUNCE|PUMP IT UP|EXPLORATORIUM/, "Kids","Activities & camps"],
  [/LEGO|TOYS ?R ?US|\bTOY\b|CARTER'?S|GYMBOREE|BUYBUY BABY|MELISSA (&|AND) DOUG|POTTERY BARN KIDS/, "Kids","Toys & gear"],
  [/CHEWY|PETCO|PETSMART|PET FOOD|PET SUPPL|PET CLUB/, "Pets","Food & supplies"],
  [/\bVET\b|VETERINAR|\bVCA\b|BANFIELD|ANIMAL HOSPITAL|ANIMAL CLINIC|ANIMAL MEDICAL/, "Pets","Vet"],
  [/GROOM|PAWS|DOGGIE|PET SPA|ROVER\.COM|\bROVER\b|WAG LABS|\bWAG\b|PET HOTEL|DOG WALK/, "Pets","Grooming & care"],
  [/NETFLIX|HULU|MAX\.COM|HBO ?MAX|DISNEY ?(PLUS|\+)|PARAMOUNT|PEACOCK|APPLE TV|YOUTUBE ?(TV|PREMIUM)|CRUNCHYROLL|PLEX|CURIOSITY/, "Subscriptions","Streaming"],
  [/SPOTIFY|APPLE MUSIC|PANDORA|AUDIBLE|TIDAL|SIRIUS ?XM/, "Subscriptions","Music & audio"],
  [/EQUINOX|24 HOUR FITNESS|PLANET FITNESS|CRUNCH FIT|ORANGETHEORY|PELOTON|CLASSPASS|YMCA|CROSSFIT|BARRY'?S|SOULCYCLE|\bGYM\b|FITNESS|YOGA|PILATES/, "Subscriptions","Fitness"],
  [/ICLOUD|APPLE\.COM.BILL|GOOGLE (ONE|STORAGE)|DROPBOX|ADOBE|MICROSOFT|OPENAI|CHATGPT|ANTHROPIC|CLAUDE\.AI|GITHUB|NOTION|CANVA|1PASSWORD|NORDVPN|EXPRESSVPN|ZOOM\.US|EVERNOTE|LINKEDIN PREM/, "Subscriptions","Software & cloud"],
  [/NYTIMES|NY ?TIMES|WSJ|WALL ST|WASHINGTON POST|ECONOMIST|SUBSTACK|MEDIUM\.COM|PATREON|KINDLE UNLIMITED|THE ATLANTIC|NEW YORKER/, "Subscriptions","News & media"],
  [/CVS|WALGREENS|RITE AID|DUANE READE|PHARMACY|RX\b/, "Health","Pharmacy"],
  [/DENTAL|DENTIST|ORTHODON/, "Health","Dental"],
  [/OPTOMETR|LENSCRAFTERS|WARBY|EYE CARE|VISION CENTER/, "Health","Vision"],
  [/MEDICAL|CLINIC|HOSPITAL|LABCORP|QUEST DIAG|URGENT CARE|KAISER|SUTTER|ONE MEDICAL|THERAPY|THERAPIST|PSYCH|DERMATOL|PEDIATRIC|PHYSICIAN/, "Health","Medical"],
  [/UNITED AIR|UNITED\s*\d|DELTA AIR|AMERICAN AIR|ALASKA AIR|SOUTHWES|JETBLUE|FRONTIER AIR|SPIRIT AIR|HAWAIIAN AIR|LUFTHANSA|EMIRATES|BRITISH AIR|AIR FRANCE|QANTAS|AIR CANADA|EXPEDIA|PRICELINE|KAYAK|ORBITZ/, "Travel","Flights"],
  [/MARRIOTT|HILTON|HYATT|WESTIN|SHERATON|HOLIDAY INN|AIRBNB|VRBO|BOOKING\.COM|HOTELS?\.COM|HOTEL|MOTEL|RESORT|FOUR SEASONS|RITZ|HAMPTON INN|BEST WESTERN/, "Travel","Hotels & stays"],
  [/HERTZ|AVIS|ENTERPRISE RENT|BUDGET RENT|NATIONAL CAR|TURO|ZIPCAR|ALAMO|SIXT/, "Travel","Car rental"],
  [/UBER|LYFT|\bTAXI\b|CURB\b/, "Transport","Rideshare"],
  [/CHEVRON|SHELL|EXXON|MOBIL|ARCO|\b76\b|VALERO|\bBP\b|SUNOCO|MARATHON PETRO|PHILLIPS 66|SPEEDWAY|TEXACO|GAS STATION|FUEL|COSTCO GAS/, "Transport","Gas"],
  [/FASTRAK|E-?Z ?PASS|TOLL|PARKING|PARKMOBILE|SPOTHERO|IMPARK|LAZ PARK|PAYBYPHONE|METER/, "Transport","Parking & tolls"],
  [/\bBART\b|\bMUNI\b|\bMTA\b|METRO(?!PCS)|TRANSIT|CALTRAIN|AMTRAK|CLIPPER|SEPTA|WMATA|CTA\b/, "Transport","Transit"],
  [/JIFFY LUBE|AUTOZONE|O'?REILLY|PEP BOYS|FIRESTONE|TIRE|SMOG|CAR WASH|\bDMV\b|AUTO (REPAIR|BODY|PARTS|SERVICE)|VALVOLINE|MIDAS/, "Transport","Auto service"],
  [/AMZN|AMAZON(?!.*PRIME VIDEO)|EBAY|ETSY|ALIEXPRESS|TEMU|SHEIN|WAYFAIR|OVERSTOCK|SHOPIFY|SHOP\.APP/, "Shopping","Online"],
  [/TARGET|WAL-?MART/, "Shopping","Big box"],
  [/UNIQLO|ZARA|H&M|GAP\b|OLD NAVY|NORDSTROM|MACY'?S|NIKE|ADIDAS|LULULEMON|ROSS STORES|ROSS DRESS|TJ ?MAXX|MARSHALLS|BURLINGTON|BANANA REPUBLIC|J\.? ?CREW|\bREI\b|FOOT LOCKER|ANTHROPOLOGIE|URBAN OUTFIT|LEVI'?S/, "Shopping","Clothing"],
  [/BEST BUY|B&H PHOTO|MICRO CENTER|GAMESTOP|NEWEGG|APPLE STORE/, "Shopping","Electronics"],
  [/IKEA|CRATE ?& ?BARREL|POTTERY BARN|WEST ELM|BED BATH|HOMEGOODS|WILLIAMS-?SONOMA|CONTAINER STORE|MICHAELS|JOANN|HOBBY LOBBY/, "Shopping","Home goods"],
  [/SALON|BARBER|NAILS|\bSPA\b|SEPHORA|ULTA|MASSAGE|DRYBAR|WAXING|HAIRCUT|GREAT CLIPS|SPORT CLIPS|COST CUTTER|WELDON BARBER|SPEAKEASY BARBER|THE SPEAKEASY BARB/, "Personal Care","Salon & beauty"],
  [/GEICO|STATE FARM|PROGRESSIVE|ALLSTATE|FARMERS INS|USAA|INSURANCE|AETNA|CIGNA|ANTHEM|BLUE SHIELD|BLUE CROSS|METLIFE|LEMONADE INS|RENTERS INS/, "Insurance","Insurance"],
  /* Regional grocery & specialty food */
  [/\bQFC\b|QUALITY FOOD CENTER/, "Groceries","Supermarket"],
  [/APNA BAZAR|MAYURI FOOD|MAYURI BAKERY|PATEL BROS|INDIAN GROCERY/, "Groceries","Specialty"],
  /* Local restaurants & cafes spotted in statements */
  [/ANJAPPAR|ANJAPPA[A-Z]/, "Dining","Restaurants"],
  [/\bMTR\b|TST\s*\*\s*MTR|MERCURYS COFFEE|ILLY\s*CAFF?E|SUMMIT CAFE|SEA\d+.*CAFE|THRIVE.*CAFE|CTLP.*CANTEEN|CANTEEN VENDING|BIG FISH SUSHI/, "Dining","Coffee & tea"],
  /* Water utility — Chase/Citi statements */
  [/SAMMAMISH PLATEAU WATER|PLATEAU WATER/, "Home & Utilities","Water & trash"],
  /* Parks & recreation */
  [/KING COUNTY PARKS|LAKE SAMMAMISH ST PK|SAMMAMISH ST PK/, "Kids","Activities & camps"],
  /* Car wash */
  [/WASH SPOT/, "Transport","Auto service"],
  /* Kids: craft + digital purchases — user asked Google Tasty Travels grouped with Cricut */
  [/CRICUT|TASTY TRAVELS|GOOGLE.*TOWNSHIP|GOOGLE.*TASTY/, "Shopping","Online"],
  /* School of Rock = kids music lessons; Issaquah SD / MSB = school district fees */
  [/SCHOOL OF ROCK/, "Kids","Classes"],
  [/ISSAQUAH S[DC]\b|MSB ISSAQUAH|ISSAQUAH SCHOOL DISTR/, "Education","Education"],
  /* Pets */
  [/THEFARMERSDOG|FARMERS\s*DOG/, "Pets","Food & supplies"],
  /* Utilities */
  [/PUGET SOUND ENERGY|PSE&?G\b/, "Home & Utilities","Energy"],
  /* Health */
  [/ONE MEDICAL|ONEMEDICAL|MED\s*\*\s*SWEDISH|SWEDISH MEDICAL|SWEDISH HEALTH/, "Health","Medical"],
  /* Transport */
  [/SPOTHERO|DIAMOND PARKING/, "Transport","Parking & tolls"],
  [/BROWN BEAR|BROWNBEAR/, "Transport","Auto service"],
  /* Shopping */
  [/DICK'?S?\s*SPORTING|DICK\b.*SPORTING GOODS/, "Shopping","Big box"],
  [/\bSTEAM\b.*PURCHASE|WL\s*\*\s*STEAM/, "Shopping","Online"],
  [/GLOBALE\s*\*|MARKS AND SPE/, "Shopping","Online"],
  /* Dining */
  [/NESPRESSO/, "Dining","Coffee & tea"],
  /* Education */
  [/TUITION|UNIVERSITY|COLLEGE|UDEMY|COURSERA|SKILLSHARE|MASTERCLASS|DUOLINGO|KHAN ACADEMY/, "Education","Education"],
  [/INTEREST CHARGE|ANNUAL FEE|LATE FEE|MEMBERSHIP FEE|FOREIGN TRANSACTION|ATM FEE|FINANCE CHARGE|OVERLIMIT|RETURNED PAYMENT FEE/, "Fees & Interest","Fees & interest"]
];
const PAYMENT_RE = /PAYMENT|AUTOPAY|AUTO-?PAY|ONLINE PMT|E-?PAYMENT|THANK YOU|DIRECTPAY|MOBILE PMT|BALANCE TRANSFER|ACH (PYMT|PAYMENT|DEPOSIT)|BILL PAY(?!.*MERCHANT)|CARDMEMBER SERV|AMEX SEND|ADD MONEY|CITI FLEX PAY/i;
const NOISE_RE = /TOTAL|SUBTOTAL|BALANCE|MINIMUM (PAYMENT|DUE)|FEES CHARGED|INTEREST CHARGED FOR|PREVIOUS BALANCE|NEW BALANCE|CREDIT (LIMIT|LINE)|AVAILABLE (CREDIT|CASH)|PAYMENT DUE|DUE DATE|ACCOUNT (SUMMARY|NUMBER|ENDING)|STATEMENT (DATE|PERIOD)|CLOSING DATE|REWARDS? (BALANCE|EARNED|SUMMARY)|POINTS|CASH ?BACK|YEAR.TO.DATE|PURCHASES\b.*\$|CUSTOMER SERVICE|PAGE \d|CONTINUED|APR\b|ANNUAL PERCENTAGE/i;

/* ---------- Storage (device-local; degrades to memory if blocked) ---------- */
const store = (() => {
  let mem = {};
  let ok = false;
  try { localStorage.setItem("__bfb_t","1"); localStorage.removeItem("__bfb_t"); ok = true; } catch(e){ ok = false; }
  return {
    persistent: ok,
    get(k, d){ try { const v = ok ? localStorage.getItem(k) : mem[k]; return v ? JSON.parse(v) : d; } catch(e){ return d; } },
    set(k, v){ try { const s = JSON.stringify(v); if (ok) localStorage.setItem(k, s); else mem[k] = s; } catch(e){ toast("Storage full — export a backup"); } },
    del(k){ try { if (ok) localStorage.removeItem(k); else delete mem[k]; } catch(e){} }
  };
})();

let TXNS    = store.get("bfb_txns", []);          // [{id,date,amount,desc,merchant,card,cat,sub,fv}]
let RULES   = store.get("bfb_rules", {});          // {merchantKey: {cat, sub, fv}}
let QUEUE   = store.get("bfb_queue", []);          // [{merchant, sampleDesc, guessCat, guessSub, guessFv, total, count}]
let BUDGETS = store.get("bfb_budgets", {});        // {categoryName: monthlyTargetNumber}
const saveTxns    = () => store.set("bfb_txns", TXNS);
const saveRules   = () => store.set("bfb_rules", RULES);
const saveQueue   = () => store.set("bfb_queue", QUEUE);
const saveBudgets = () => store.set("bfb_budgets", BUDGETS);

/* ---------- Helpers ---------- */
const fmt$ = n => (n<0?"-":"") + "$" + Math.abs(Math.round(n)).toLocaleString();
const fmtC = n => (n<0?"-":"") + "$" + Math.abs(n).toFixed(2);
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ym = d => d.slice(0,7);                       // "2026-05"
const ymLabel = k => MONTH_NAMES[+k.slice(5,7)-1] + " " + k.slice(0,4);

function normMerchant(desc){
  let s = desc.toUpperCase()
    /* Strip Amex payment-method prefixes that appear at the START of descriptions:
       AplPay = Apple Pay tap, DD* = DoorDash relay, BT*DD* = another DD variant,
       IC* = Instacart, GDP= = photography aggregator, WL* = Steam/gaming */
    .replace(/^(APLPAY|BT\s*\*\s*DD|DD\s*\*|IC\s*\*|GDP\s*=|WL\s*\*)\s*/g, "")
    /* Strip card-reader prefixes (SQ*=Square, TST*=Toast, etc.) — note GOOGLE removed
       so "GOOGLE *TASTY TRAVELS" keeps "GOOGLE" in the merchant key */
    .replace(/\b(SQ|TST|SP|PY|PAYPAL|PP|APL|CKE)\s*\*\s*/g, "")
    .replace(/#\s?\d+/g, " ").replace(/\*/g, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/[^A-Z& ]/g, " ")
    .replace(/\b(LLC|INC|CORP|CO|LTD|USA|US|COM|NET|WWW)\b/g, " ")
    .replace(/\s+/g, " ").trim();
  return s.split(" ").slice(0, 3).join(" ") || desc.toUpperCase().slice(0, 18);
}

function categorize(desc){
  const u = " " + desc.toUpperCase() + " ";
  for (const [re, cat, sub] of KEYWORD_RULES) if (re.test(u)) return {cat, sub};
  return {cat:"Other", sub:"Uncategorized"};
}

/* ---------- Fixed/variable resolution ----------
   Priority: merchant rule > recurrence detection > sub default */
function detectRecurring(){
  const byM = {};
  for (const t of TXNS) (byM[t.merchant] = byM[t.merchant] || []).push(t);
  const recurring = new Set();
  for (const [m, list] of Object.entries(byM)){
    const monthsMap = {};
    for (const t of list) monthsMap[ym(t.date)] = (monthsMap[ym(t.date)]||0) + t.amount;
    const vals = Object.values(monthsMap);
    if (vals.length < 2) continue;
    const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
    if (mean <= 0) continue;
    const cv = Math.sqrt(vals.reduce((a,b)=>a+(b-mean)*(b-mean),0)/vals.length)/mean;
    const keys = Object.keys(monthsMap).sort();
    let consecutive = 0, best = 0;
    for (let i=1;i<keys.length;i++){
      const [y1,m1]=keys[i-1].split("-").map(Number), [y2,m2]=keys[i].split("-").map(Number);
      if ((y2*12+m2)-(y1*12+m1)===1){ consecutive++; best=Math.max(best,consecutive); } else consecutive=0;
    }
    if (best >= 1 && cv <= 0.18) recurring.add(m);
  }
  return recurring;
}
function applyFV(){
  const rec = detectRecurring();
  for (const t of TXNS){
    if (t.locked) continue;                 // user manually set this transaction — leave it
    const rule = RULES[t.merchant];
    if (rule && rule.fv) t.fv = rule.fv;
    else if (rec.has(t.merchant)) t.fv = "F";
    else t.fv = FIXED_SUBS.has(t.sub) ? "F" : "V";
  }
}
function applyRules(){
  for (const t of TXNS){
    if (t.locked) continue;                  // user manually set this transaction — leave it
    const rule = RULES[t.merchant];
    if (rule){ if (rule.cat) t.cat = rule.cat; if (rule.sub) t.sub = rule.sub; }
  }
  applyFV();
}

/* ---------- Misc helpers shared across modules ---------- */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

/* Category/sub-category <option> list, grouped, for select dropdowns */
function catOptionsHtml(selCat, selSub){
  return CATS.map(c=>`<optgroup label="${escapeHtml(c)}">${CAT_META[c].subs.map(s=>
    `<option value="${escapeHtml(c)}||${escapeHtml(s)}" ${c===selCat&&s===selSub?"selected":""}>${escapeHtml(s)}</option>`).join("")}</optgroup>`).join("");
}

/* ---------- Undo history ----------
   Snapshots are taken before any data-mutating action (import, edits, rule
   changes, restores). Kept small (last 5) and entirely local. */
const HISTORY_LIMIT = 5;
function snapshot(){
  let hist = store.get("bfb_history", []);
  hist.push({ts: Date.now(), txns: TXNS, rules: RULES, queue: QUEUE});
  if (hist.length > HISTORY_LIMIT) hist = hist.slice(-HISTORY_LIMIT);
  store.set("bfb_history", hist);
}
function undoLast(){
  let hist = store.get("bfb_history", []);
  if (!hist.length) { toast("Nothing to undo yet"); return; }
  const last = hist.pop();
  store.set("bfb_history", hist);
  TXNS = last.txns; RULES = last.rules; QUEUE = last.queue || [];
  saveTxns(); saveRules(); saveQueue();
  refreshAll();
  toast("Restored previous version");
}
function historyInfo(){
  const hist = store.get("bfb_history", []);
  if (!hist.length) return "No changes to undo yet.";
  const ts = new Date(hist[hist.length-1].ts);
  return `${hist.length} change${hist.length!==1?"s":""} can be undone · most recent saved ${ts.toLocaleString()}`;
}
