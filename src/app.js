// ---------- calendar: Gregorian budget year (?year=2025 shows an earlier year) ----------
const THIS_YEAR=new Date().getFullYear();
const YEAR=(()=>{const y=+new URLSearchParams(location.search||"").get("year");return y>=2000&&y<=THIS_YEAR+1?y:THIS_YEAR})();
const MONTHS=["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"].map(n=>[n]);
const NM=MONTHS.length;
const YEAR_START=new Date(YEAR,0,1),YEAR_END=new Date(YEAR+1,0,1);
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const TODAY=new Date();
function monthIndex(s){return +s.slice(0,4)===YEAR?+s.slice(5,7)-1:-1}
const CUR=TODAY.getFullYear()===YEAR?TODAY.getMonth():(TODAY<YEAR_START?0:NM-1);
const PACE=Math.min(1,Math.max(0,(TODAY-YEAR_START)/(YEAR_END-YEAR_START)));
const DONE=TODAY<YEAR_END?CUR:NM; // months that are over
const grDate=s=>s?s.split("-").reverse().join("."):"";

// Hebrew dates written in letters: י׳ בחשוון תשפ״ז
function gem(n){let s="",h=Math.floor(n/100);while(h>4){s+="ת";h-=4}s+=["","ק","ר","ש","ת"][h];const r=n%100;if(r===15)s+="טו";else if(r===16)s+="טז";else s+=["","י","כ","ל","מ","נ","ס","ע","פ","צ"][Math.floor(r/10)]+["","א","ב","ג","ד","ה","ו","ז","ח","ט"][r%10];return s.length>1?s.slice(0,-1)+"״"+s.slice(-1):s+"׳"}
let heFmt;try{heFmt=new Intl.DateTimeFormat("he-IL-u-ca-hebrew",{day:"numeric",month:"long",year:"numeric"})}catch(e){}
function heDate(s,withYear){
  try{const p=heFmt.formatToParts(typeof s==="string"?new Date(s+"T12:00:00"):s),g=t=>(p.find(x=>x.type===t)||{}).value;
    const d=parseInt(g("day")),y=parseInt(g("year"));
    return `${isNaN(d)?g("day"):gem(d)} ב${g("month")}`+(withYear?" "+(isNaN(y)?g("year"):gem(y%1000)):"")}catch(e){return ""}
}

// ---------- helpers ----------
const ils=n=>(n<0?"−":"")+"₪"+Math.abs(Math.round(n)).toLocaleString("he-IL");
const compact=n=>{try{return new Intl.NumberFormat("he-IL",{notation:"compact",maximumFractionDigits:1}).format(n)}catch(e){return Math.round(n/1000)+"K"}};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const annual=it=>it.monthly!=null&&it.monthly!==""?(+it.monthly||0)*(+it.months||0):(+it.annual||0);
const DEBT="debt";         // גמ״חים – separate fund, never counted as income or expense
const MEOROT="meorot";     // old: bank transfers with המשכיר (now kept only in the המשכיר screen)
const BUILDING="building"; // קרן הבניין – separate fund
const OUTSIDE=new Set([DEBT,MEOROT,BUILDING]);
const URG={high:["דחוף","bad"],mid:["בינוני","warn"],low:["רגיל","neutral"]};
const METHODS=["הוראת קבע","העברה בנקאית","שיק","מזומן","אשראי"];
const SOURCES=["בנק לדוגמה","בנק שני","מזומן","אחר"];
const TUITION_GROUPE="שכר לימוד";

// small icon buttons
const SVG={
  note:"M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z",
  edit:"M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z",
  del:"M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z",
  clip:"M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6z",
  paper:"M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8zm-1 7V3.5L18.5 9zM9.5 17.2 6.8 14.5l1.06-1.06L9.5 15.08l4.64-4.64 1.06 1.06z",
  apply:"M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z"
};
const ico=(name,attrs,label,cls)=>`<button type="button" class="ico${cls?" "+cls:""}" ${attrs} aria-label="${esc(label)}" title="${esc(label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${SVG[name]}"/></svg></button>`;

const it=(id,name,monthly,months,annualAmt)=>({id,name,monthly,months,annual:annualAmt??null,note:""});
const DEFAULT_RULES=[{kw:"· שכר לימוד",cat:"i_parents"},{kw:"· תרומה",cat:"i_don"}];
// settings kept per year in meta/<year>; a new year starts from last year's settings – only the budget needs writing
function newYearMeta(prev,start){
  if(prev){const {prev:_old,...rest}=prev;return {...rest,meorot:{rent:prev.meorot.rent,fixed:prev.meorot.fixed,bills:{}}}}
  return {
    accounts:[{id:"poalim",name:"בנק לדוגמה",note:"חשבון עיקרי",balance:0},{id:"pagi",name:"בנק שני",note:"חשבון משני",balance:0}],
    bankAsOf:iso(TODAY),
    budget:start.budget,
    meorot:{rent:15000,fixed:{elec:4500,water:4500},bills:{}},
    buildingGoal:0,
    rules:[{kw:"חשמל",cat:"m_elec"},{kw:"מים",cat:"m_water"},...(start.rules||[]),{kw:"גמ״ח",cat:DEBT},...DEFAULT_RULES],
    nedarimNamesCat:"i_purim",v:3
  };
}
// brings an older year document up to date; returns true when something changed and should be saved
function migrateMeta(m){
  if(!m||m.v>=3)return false;
  if(m.v===2){toV3(m);return true}
  m.budget.expenses.forEach(g=>{const k=String(g.group).match(/^כולל\s*\((\d+)\s*אברכים\)$/);if(k){g.group="כולל";g.heads=+k[1]}});
  [...m.budget.expenses.flatMap(g=>g.items),...m.budget.income].forEach(i=>{i.note=""}); // the notes were mine, from reading the budget file
  m.rules=m.rules||[];DEFAULT_RULES.forEach(r=>{if(!m.rules.some(x=>x.kw===r.kw))m.rules.push(r)});
  if(m.nedarimNamesCat==null)m.nedarimNamesCat="i_purim";
  delete m.prev;toV3(m);return true;
}
function toV3(m){
  m.budget.expenses.forEach(g=>{if(g.heads==null)return;g.items.forEach(i=>{if(i.unit==null){const v=i.monthly!=null?+i.monthly||0:+i.annual||0;i.unit=g.heads?Math.round(v/g.heads):v}i.per=true;
    const t=Math.round(i.unit*g.heads);if(i.monthly!=null)i.monthly=t;else i.annual=t})});
  m.v=3;
}
// tuition is due on the 14th of every month
const DUE_DAY=14,DUE_MONTHS=Math.min(NM,CUR+(TODAY.getDate()>=DUE_DAY||TODAY>=YEAR_END?1:0));

// ---------- state: S mirrors the database; W writes to it ----------
let S=null,role=null,me=null;
let W=null; // set by main.js once signed in
// view state (not saved)
const TF={month:String(CUR),src:"all",type:"all",cat:"all",q:"",from:"",to:""};
const BF={q:"",group:"all"};
let debtUrg="all",openDebts=new Set(),editDebt=null,noteEdit=null,focusAfter=null,editTx=null,txShown=100;
const selTx=new Set(),selDonors=new Set();
const openAdd=new Set(); // "add" boxes the user opened, kept open across redraws
// groups the user folded (budget, report, comparison) – remembered on this device only
const closed=new Set((()=>{try{return JSON.parse(localStorage.getItem("tt-closed"))||[]}catch(e){return []}})());
const saveClosed=()=>{try{localStorage.setItem("tt-closed",JSON.stringify([...closed]))}catch(e){}};
const grpHead=(k,label,total,count,cols,locked,extra)=>{const open=locked||!closed.has(k);
  return `<tr class="group"><td colspan="${cols}"><div class="grprow"><button class="grp" type="button" data-grp="${esc(k)}" aria-expanded="${open}"${locked?" disabled":""}><span class="caret" aria-hidden="true">◀</span><span class="gname">${esc(label)}</span><span class="gsum"><span class="num">${ils(total)}</span> · ${count} סעיפים</span></button>${extra||""}</div></td></tr>`};
const SF={q:"",f:"all",shiur:"all"},DF={q:"",f:"all"};let openStu=new Set(),openDonor=new Set(),showUnlinked=true;
const RF={from:`${YEAR}-01-01`,to:TODAY<YEAR_END?iso(TODAY):`${YEAR}-12-31`};
const CMP={sel:null,mode:"same"};

// the organisation's details – set by main.js (the real yeshiva) or demo.js
export const BRAND={name:"",org:"",logo:"/logo.jpg",nedarim:"",owner:""};
export function setBrand(b){Object.assign(BRAND,b);OWNER=b.owner||OWNER}
const ROLES={rosh:{edit:true,views:"all"},menahel:{edit:true,views:"all"},mazkir:{edit:true,views:"all"},dev:{edit:true,views:"all"},roeh:{edit:false,views:"all"}};
const ROLE_NAMES={rosh:"ראש הישיבה",menahel:"מנהל הישיבה",mazkir:"מזכיר",dev:"מתכנת",roeh:"רואה חשבון"};
const can=()=>ROLES[role];
const VIEWS=[["dashboard","לוח בקרה"],["budget","תקציב"],["transactions","תנועות"],["students","שכר לימוד"],["donors","תורמים"],["debts","חובות וגמ״חים"],["meorot","המשכיר"],["building","קרן הבניין"],["reports","דוחות והשוואות"],["settings","הגדרות והרשאות"]];

function allItems(){const m={};S.budget.expenses.forEach(g=>g.items.forEach(i=>m[i.id]={...i,kind:"expense",group:g.group}));S.budget.income.forEach(i=>m[i.id]={...i,kind:"income",group:"הכנסות"});return m}
function catName(c,items){return c===DEBT?"גמ״חים – קופה נפרדת":c===BUILDING?"קרן הבניין – קופה נפרדת":c===MEOROT?"התחשבנות המשכיר":((items||allItems())[c]||{}).name||""}
// kind: "income" / "expense" limits the list; plain: budget lines only
function catOptions(sel,kind,plain){
  let h=`<option value="">— לא מסווג —</option>`;const ok=i=>plain||!VIA_MEOROT.has(i.id)||i.id===sel;
  if(kind!=="expense")h+=`<optgroup label="הכנסות">`+S.budget.income.filter(ok).map(i=>`<option value="${i.id}"${sel===i.id?" selected":""}>${esc(i.name)}</option>`).join("")+`</optgroup>`;
  if(kind!=="income")S.budget.expenses.forEach(g=>{h+=`<optgroup label="${esc(g.group)}">`+g.items.filter(ok).map(i=>`<option value="${i.id}"${sel===i.id?" selected":""}>${esc(i.name)}</option>`).join("")+`</optgroup>`});
  if(!plain)h+=`<optgroup label="קופות נפרדות"><option value="${DEBT}"${sel===DEBT?" selected":""}>גמ״חים – קופה נפרדת</option><option value="${BUILDING}"${sel===BUILDING?" selected":""}>קרן הבניין – קופה נפרדת</option></optgroup>`;
  return h;
}
function totals(){
  const exp=S.budget.expenses.reduce((s,g)=>s+g.items.reduce((a,i)=>a+annual(i),0),0);
  const inc=S.budget.income.reduce((a,i)=>a+annual(i),0);
  return {exp,inc};
}
// what came in and went out this year; inRange(date) limits it. A refund lowers its own line.
function actuals(inRange){
  const items=allItems(),ok=d=>monthIndex(d)>=0&&(!inRange||inRange(d));
  const byCat={},byCM={},byMonth=MONTHS.map(()=>({inc:0,exp:0}));let inc=0,exp=0,unc=0;
  const add=(m,c,v,isInc)=>{if(isInc){inc+=v;byMonth[m].inc+=v}else{exp+=v;byMonth[m].exp+=v}
    if(c){byCat[c]=(byCat[c]||0)+v;(byCM[c]||(byCM[c]=Array(NM).fill(0)))[m]+=v}};
  S.tx.forEach(x=>{if(!ok(x.date)||OUTSIDE.has(x.cat))return;if(!x.cat)unc++;
    const kind=x.cat&&items[x.cat]?items[x.cat].kind:(x.amount>=0?"income":"expense");
    add(monthIndex(x.date),x.cat,kind==="income"?x.amount:-x.amount,kind==="income")});
  // המשכיר wallet: counted as income/expense although it never passes through the bank
  for(let i=0;i<=CUR;i++){const d=`${YEAR}-${String(i+1).padStart(2,"0")}-01`;if(ok(d))add(i,"c_rent",S.meorot.rent,false)}
  S.meorot.entries.forEach(e=>{if(!ok(e.date))return;const m=monthIndex(e.date);if(e.type==="received")add(m,e.cat,e.amount,true);else if(e.type==="charge")add(m,e.cat,e.amount,false)});
  return {byCat,byCM,byMonth,inc,exp,unc};
}
const M_TYPES={rent:["שכירות","warn",-1],received:["קיבלו עבורנו","good",1],charge:["חיוב נוסף","warn",-1],paid_to:["שילמנו להם","neutral",1],paid_from:["העבירו לנו","neutral",-1],bank:["העברה בבנק","neutral",0]};
function meorotLedger(){
  const rows=[];
  for(let i=0;i<=CUR;i++)rows.push({date:`${YEAR}-${String(i+1).padStart(2,"0")}-01`,desc:`שכירות – ${MONTHS[i][0]}`,kind:"rent",eff:-S.meorot.rent});
  S.meorot.entries.forEach(e=>rows.push({date:e.date,desc:e.desc,kind:e.type,eff:M_TYPES[e.type][2]*e.amount,cat:e.cat,id:e.id,note:e.note}));
  S.tx.filter(x=>x.cat===MEOROT).forEach(x=>rows.push({date:x.date,desc:x.desc,kind:"bank",eff:-x.amount,src:x.source}));
  rows.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  let bal=0;rows.forEach(r=>{bal+=r.eff;r.bal=bal});
  return {rows,bal};
}
function utilStats(k){
  const fixed=+S.meorot.fixed[k]||0,rows=[];let pay=0,bill=0;
  for(let i=0;i<=CUR;i++){const b=(S.meorot.bills[i]||{})[k],has=b!=null&&b!=="";if(has){pay+=fixed;bill+=+b}rows.push({i,b:has?+b:null,diff:has?fixed-b:null,cum:has?pay-bill:null})}
  const filled=rows.filter(r=>r.b!=null);
  return {fixed,rows,last:filled[filled.length-1],pay,bill,n:filled.length,avg:filled.length?bill/filled.length:0};
}
const diffText=d=>d>=0?`<span style="color:var(--good)">עודף <span class="num">${ils(d)}</span></span>`:`<span style="color:var(--bad)">חסר <span class="num">${ils(-d)}</span></span>`;
// a debt is paid off by repayments entered on it, and by transactions linked to it
const debtTx=d=>S.tx.filter(x=>x.debtId===d.id&&x.amount<0);
const debtPaid=d=>d.repayments.reduce((s,r)=>s+r.amount,0)+debtTx(d).reduce((s,x)=>s-x.amount,0);
// tuition: payments entered by hand, and transactions linked to the student
const stuTx=s=>S.tx.filter(x=>x.studentId===s.id&&monthIndex(x.date)>=0);
const stuPaid=s=>s.payments.filter(p=>monthIndex(p.date)>=0).reduce((a,p)=>a+p.amount,0)+stuTx(s).reduce((a,x)=>a+x.amount,0);
function stuRows(){return S.students.map(s=>{const due=s.fee*DUE_MONTHS,paid=stuPaid(s),bal=due-paid;return {s,due,paid,bal,late:s.fee?Math.floor(bal/s.fee+1e-9):0}})}
const isTuition=x=>x.amount>0&&(x.cat==="i_parents"||(x.nedarim&&x.nedarim.groupe===TUITION_GROUPE));
const payerOf=x=>(x.nedarim&&x.nedarim.client)||"";
const buildingEntries=()=>[...S.building.entries,...S.tx.filter(x=>x.cat===BUILDING).map(x=>({id:x.id,date:x.date,desc:x.desc,amount:x.amount,src:x.source,fromTx:true}))];

// ---------- earlier years (years/<year>: what was spent and received, kept automatically) ----------
function yearSummary(){
  const A=actuals(),items=allItems(),budget={},names={},groups={};
  Object.values(items).forEach(i=>{budget[i.id]=annual(i);names[i.id]=i.name;groups[i.id]=i.group});
  return {year:YEAR,byCatMonth:A.byCM,budget,names,groups,inc:A.inc,exp:A.exp,byMonth:A.byMonth};
}
const pastYears=()=>Object.keys(S.years||{}).map(Number).filter(y=>y<YEAR).sort((a,b)=>b-a);
// a year's total for a budget line: "same" = only the months that are over this year
function yearValue(y,c,mode){
  const Y=(S.years||{})[y];if(!Y)return null;
  if(Y.byCatMonth&&!Y.manual){const a=Y.byCatMonth[c];if(!a)return 0;return (mode==="same"?a.slice(0,DONE||1):a).reduce((s,x)=>s+(+x||0),0)}
  const v=(Y.byCat||{})[c];if(v==null||v==="")return null;return mode==="same"?v*(DONE||1)/NM:+v;
}
// suggestion for next year's budget: the average of the earlier years that have this line (a year with nothing on it says nothing)
function suggestion(c){const vals=pastYears().map(y=>yearValue(y,c,"full")).filter(v=>v);return vals.length?{avg:vals.reduce((s,v)=>s+v,0)/vals.length,n:vals.length}:null}

// ---------- cash-flow forecast ----------
const VIA_MEOROT=new Set(["c_rent","i_dat_b","i_dat_k"]); // offset in the המשכיר wallet, never pass through the bank
function activeIn(i,m){ // same month pattern as the budget: 10 = no Av/Elul, 11 = no December, 6 = every other month
  if(i.monthly==null||!i.months)return false;
  if(i.months===10&&(m===7||m===8))return false;
  if(i.months===11&&m===11)return false;
  if(i.months===6&&m%2===1)return false;
  return true;
}
function forecast(n){
  const now=actuals(d=>monthIndex(d)===CUR),ytd=actuals(),out=[];
  let bal=S.accounts.reduce((s,a)=>s+a.balance,0);
  const debts=S.debts.map(d=>({left:d.amount-debtPaid(d),per:d.amount/d.payments,next:d.next}));
  const lines=[...S.budget.income.map(i=>[i,1]),...S.budget.expenses.flatMap(g=>g.items.map(i=>[i,-1]))];
  const oneOffLeft=S.budget.expenses.flatMap(g=>g.items).filter(i=>i.monthly==null).reduce((s,i)=>s+Math.max(0,annual(i)-(ytd.byCat[i.id]||0)),0);
  for(let k=0;k<n;k++){
    const mi=(CUR+k)%NM,yr=YEAR+Math.floor((CUR+k)/NM),end=iso(new Date(yr,mi+1,0));
    let inc=0,exp=0,debt=0;
    lines.forEach(([i,s])=>{if(VIA_MEOROT.has(i.id)||!activeIn(i,mi))return;
      let a=+i.monthly||0;if(k===0)a=Math.max(0,a-(now.byCat[i.id]||0)); // this month: only what hasn't come in / gone out yet
      if(s>0)inc+=a;else exp+=a});
    if(yr===YEAR)exp+=oneOffLeft/(NM-CUR);
    debts.forEach(d=>{while(d.left>0&&d.next<=end){const p=Math.min(d.per,d.left);debt+=p;d.left-=p;const nd=new Date(d.next+"T12:00:00");nd.setMonth(nd.getMonth()+1);d.next=iso(nd)}});
    bal+=inc-exp-debt;
    out.push({label:MONTHS[mi][0]+(yr!==YEAR?" "+yr:""),inc,exp,debt,end:bal});
  }
  return out;
}

// ---------- alerts ----------
function alerts(){
  const out=[],todayS=iso(TODAY),week=iso(new Date(TODAY.getTime()+7*864e5));
  S.debts.forEach(d=>{const left=d.amount-debtPaid(d);if(left<=0)return;const amt=Math.min(left,d.amount/d.payments);
    if(d.next<todayS)out.push(["bad",`תשלום באיחור: ${esc(d.name)} – <span class="num">${ils(amt)}</span>, היה אמור לצאת ב־${grDate(d.next)}`,"#debts"]);
    else if(d.next<=week)out.push(["warn",`תשלום קרוב: ${esc(d.name)} – <span class="num">${ils(amt)}</span> ב־${grDate(d.next)} (${heDate(d.next)})`,"#debts"])});
  if(YEAR===THIS_YEAR){const f=forecast(3).find(r=>r.end<0);if(f)out.push(["bad",`לפי התחזית, בסוף ${f.label} היתרה בבנק תהיה <span class="num">${ils(f.end)}</span>`,"#dashboard"])}
  const unc=S.tx.filter(x=>!x.cat).length;
  if(unc)out.push(["warn",`${unc} תנועות מחכות לסיווג`,"#transactions","unc"]);
  ["elec","water"].forEach(k=>{const miss=[];for(let i=0;i<CUR;i++){const b=(S.meorot.bills[i]||{})[k];if(b==null||b==="")miss.push(MONTHS[i][0])}
    if(miss.length)out.push(["warn",`לא הוזן חשבון ${k==="elec"?"חשמל":"מים"} ל${miss.length>3?`${miss.length} חודשים (${miss[0]} עד ${miss[miss.length-1]})`:miss.join(", ")}`,"#meorot"])});
  const failed=S.donors.filter(d=>d.status==="failed"&&!d.handled);
  if(failed.length)out.push(["warn",`${failed.length===1?"הוראת קבע של תורם נכשלה":failed.length+" הוראות קבע של תורמים נכשלו"}`,"#donors"]);
  const late=stuRows().filter(r=>r.late>=2);
  if(late.length)out.push(["warn",`${late.length} בחורים בפיגור של חודשיים ומעלה בשכר הלימוד`,"#students"]);
  const unl=S.students.length?S.tx.filter(x=>isTuition(x)&&!x.studentId&&monthIndex(x.date)>=0).length:0;
  if(unl)out.push(["warn",`${unl} תשלומי שכר לימוד עוד לא שויכו לבחור`,"#students"]);
  return out.sort((a,b)=>(a[0]==="bad"?0:1)-(b[0]==="bad"?0:1));
}

// ---------- notes: a small icon next to anything; the note shows under it with edit / delete ----------
function noteTarget(key){
  const i=key.indexOf(":"),k=key.slice(0,i),id=key.slice(i+1);
  if(k==="item"){const o=findItem(id);return o&&{o,f:"note",ch:"meta",label:o.name}}
  if(k==="tx"){const o=S.tx.find(x=>x.id===id);return o&&{o,f:"note",ch:["tx",o],label:o.desc}}
  if(k==="debt"){const o=S.debts.find(x=>x.id===id);return o&&{o,f:"note",ch:["debts",o],label:o.name}}
  if(k==="stu"){const o=S.students.find(x=>x.id===id);return o&&{o,f:"note",ch:["students",o],label:o.name}}
  if(k==="meo"){const o=S.meorot.entries.find(x=>x.id===id);return o&&{o,f:"note",ch:["meorot",o],label:o.desc}}
  if(k==="bld"){const o=S.building.entries.find(x=>x.id===id);return o&&{o,f:"note",ch:["building",o],label:o.desc}}
  if(k==="donor"){const o=S.donors.find(x=>x.id===id);return o&&{o,f:"myNote",ch:["donors",o],label:o.name}}
}
const noteBtn=(kind,id,note)=>can().edit&&!note&&noteEdit!==kind+":"+id?ico("note",`data-editnote="${esc(kind+":"+id)}"`,"הוספת הערה","faint"):"";
function noteUI(kind,id,note){
  const key=kind+":"+id;
  if(noteEdit===key)return `<div class="nline"><input id="note-edit" data-notekey="${esc(key)}" value="${esc(note||"")}" placeholder="הערה · Enter לשמירה · Esc לביטול" aria-label="הערה"></div>`;
  if(!note)return "";
  return `<div class="nline"><span class="ntext">${esc(note)}</span>${can().edit?ico("edit",`data-editnote="${esc(key)}"`,"עריכת הערה")+ico("del",`data-delnote="${esc(key)}"`,"מחיקת הערה"):""}</div>`;
}

// ---------- small dashboards: totals, by month, by budget line ----------
const kindOf=(x,items)=>x.cat&&items[x.cat]?items[x.cat].kind:(x.amount>=0?"income":"expense");
function bars(obj,color,items){
  const rows=Object.entries(obj).filter(([,v])=>Math.abs(v)>=1).sort((a,b)=>b[1]-a[1]);if(!rows.length)return '<p class="muted" style="margin:0">אין</p>';
  const top=rows.slice(0,7),rest=rows.slice(7).reduce((s,[,v])=>s+v,0);if(rest)top.push(["__rest",rest]);
  const max=Math.max(...top.map(([,v])=>v),1);
  return top.map(([c,v])=>`<div class="hbar"><span class="hl">${c==="__rest"?"שאר הסעיפים":c?esc(catName(c,items)):"לא מסווג"}</span><span class="ht"><i style="width:${Math.max(1,v/max*100).toFixed(1)}%;background:${color}"></i></span><span class="hv num">${ils(v)}</span></div>`).join("");
}
function miniDash(list,withChart){
  const items=allItems(),bi={},be={},byMonth=MONTHS.map(()=>({inc:0,exp:0}));let inc=0,exp=0;
  list.forEach(x=>{const k=kindOf(x,items),v=k==="income"?x.amount:-x.amount,o=k==="income"?bi:be;o[x.cat||""]=(o[x.cat||""]||0)+v;
    if(k==="income")inc+=v;else exp+=v;const m=monthIndex(x.date);if(m>=0)byMonth[m][k==="income"?"inc":"exp"]+=v});
  return `<div class="kpis mini">
      <div class="kpi"><div class="label">הכנסות</div><div class="value num" style="color:var(--income)">${ils(inc)}</div></div>
      <div class="kpi"><div class="label">הוצאות</div><div class="value num" style="color:var(--expense)">${ils(exp)}</div></div>
      <div class="kpi"><div class="label">הפרש</div><div class="value num" style="color:${inc-exp<0?"var(--bad)":"var(--good)"}">${ils(inc-exp)}</div></div>
      <div class="kpi"><div class="label">מספר תנועות</div><div class="value num">${list.length.toLocaleString("he-IL")}</div></div></div>
    ${withChart?`<div class="chart-box">${chartSVG(byMonth,{inc:0,exp:0})}</div>`:""}
    <div class="two dashbars"><div><h3>הכנסות לפי סעיף</h3>${bars(bi,"var(--income)",items)}</div><div><h3>הוצאות לפי סעיף</h3>${bars(be,"var(--expense)",items)}</div></div>`;
}

// ---------- views ----------
function viewDashboard(){
  const A=actuals(),B=totals();
  const open=S.debts.filter(d=>d.amount>debtPaid(d));
  const debtLeft=open.reduce((s,d)=>s+d.amount-debtPaid(d),0),urgent=open.filter(d=>d.urgency==="high").length;
  const nextDebt=[...open].sort((a,b)=>a.next<b.next?-1:1)[0];
  const net=A.inc-A.exp;
  const abroadYtd=A.byCat.i_abroad||0,abroadMonth=actuals(d=>monthIndex(d)===CUR).byCat.i_abroad||0;
  const abroadBud=annual(S.budget.income.find(i=>i.id==="i_abroad")||{});
  const groupRows=S.budget.expenses.map(g=>{
    const bud=g.items.reduce((a,i)=>a+annual(i),0),act=g.items.reduce((a,i)=>a+(A.byCat[i.id]||0),0);
    const ratio=bud?act/bud:0,over=bud&&act>bud*PACE*1.1;
    return `<div class="bva-row"><div class="name">${esc(g.group)}</div>
      <div class="track" title="קו = איפה צריך להיות לפי הזמן שעבר"><div class="fill" style="width:${Math.min(100,ratio*100).toFixed(1)}%;background:var(--expense)"></div><div class="pace" style="right:${(PACE*100).toFixed(1)}%"></div></div>
      <div class="fig"><span class="num">${ils(act)}</span> מתוך <span class="num">${ils(bud)}</span> ${over?'<span class="chip warn">▲ מעל הקצב</span>':'<span class="chip good">✓ בקצב</span>'}</div></div>`}).join("");
  const incRows=S.budget.income.map(i=>{
    const bud=annual(i),act=A.byCat[i.id]||0,ratio=bud?act/bud:0,low=bud&&act<bud*PACE*0.8;
    return `<div class="bva-row"><div class="name">${esc(i.name)}</div>
      <div class="track"><div class="fill" style="width:${Math.min(100,ratio*100).toFixed(1)}%;background:var(--income)"></div><div class="pace" style="right:${(PACE*100).toFixed(1)}%"></div></div>
      <div class="fig"><span class="num">${ils(act)}</span> מתוך <span class="num">${ils(bud)}</span> ${low?'<span class="chip warn">▼ מתחת לקצב</span>':'<span class="chip good">✓ בקצב</span>'}</div></div>`}).join("");
  const al=alerts(),fc=YEAR===THIS_YEAR?forecast(3):[];
  const items=allItems(),bi={},be={};Object.entries(A.byCat).forEach(([c,v])=>{(items[c]&&items[c].kind==="income"?bi:be)[c]=v});
  return `<div class="kpis">
    <div class="kpi"><div class="label">יתרה בבנקים</div><div class="value num">${ils(S.accounts.reduce((s,a)=>s+a.balance,0))}</div><div class="foot">${S.accounts.map(a=>`${esc(a.name)} <span class="num">${ils(a.balance)}</span>`).join(" · ")}<br>עודכן ב־${grDate(S.bankAsOf)} · <a href="#settings">לעדכון</a></div></div>
    <div class="kpi"><div class="label">מתחילת השנה: הכנסות מול הוצאות</div><div class="value num" style="color:${net<0?"var(--bad)":"var(--good)"}">${ils(net)}</div><div class="foot">נכנסו <span class="num">${ils(A.inc)}</span> · יצאו <span class="num">${ils(A.exp)}</span></div></div>
    <div class="kpi"><div class="label">תרומות מחו״ל</div><div class="value num">${ils(abroadYtd)}</div><div class="foot">החודש <span class="num">${ils(abroadMonth)}</span> · תקציב שנתי <span class="num">${ils(abroadBud)}</span><br><a href="#transactions" data-jump="i_abroad">לכל התרומות מחו״ל</a></div></div>
    <div class="kpi"><div class="label">תחזית שנתית לפי התקציב</div><div class="value num" style="color:${B.inc-B.exp<0?"var(--bad)":"var(--good)"}">${ils(B.inc-B.exp)}</div><div class="foot">${A.unc?`<a href="#transactions" data-jump="unc">${A.unc} תנועות מחכות לסיווג</a>`:"כל התנועות מסווגות"}</div></div>
    ${(()=>{const b=meorotLedger().bal;return `<div class="kpi separate"><div class="label">המשכיר · ארנק נפרד</div><div class="value num" style="color:${b<0?"var(--bad)":"var(--good)"}">${ils(Math.abs(b))}</div><div class="foot">${b>=0?"המשכיר חייב לנו":"אנחנו חייבים למשכיר"}<br><a href="#meorot">לפירוט ההתחשבנות</a></div></div>`})()}
    <div class="kpi separate"><div class="label">חובות וגמ״חים · קופה נפרדת</div><div class="value num">${ils(debtLeft)}</div><div class="foot">${urgent?`<span class="chip bad">${urgent} דחופים</span> `:""}${nextDebt?`הבא: ${esc(nextDebt.name)}, ${grDate(nextDebt.next)}`:"אין חובות פתוחים"}<br>לא נכלל בהכנסות ובהוצאות</div></div>
  </div>
  <section class="sheet"><div class="sheet-head"><h2>דורש תשומת לב</h2>${al.length?`<span class="chip warn">${al.length}</span>`:""}</div>
    ${al.length?`<ul class="alerts">${al.map(([lvl,t,href,jump])=>`<li class="${lvl}"><span>${t}</span><a href="${href}"${jump?` data-jump="${jump}"`:""}>לטיפול ←</a></li>`).join("")}</ul>`:`<p class="muted" style="margin:0">✓ הכול תקין, אין מה לטפל כרגע.</p>`}</section>
  <section class="sheet">
    <div class="sheet-head"><h2>הכנסות והוצאות לפי חודש – ${YEAR}</h2>
      <div class="legend"><span><i class="sw" style="background:var(--income)"></i>הכנסות</span><span><i class="sw" style="background:var(--expense)"></i>הוצאות</span><span><i class="sw dash"></i>תקציב לחודשים הבאים</span></div></div>
    <div class="chart-box" id="chartBox">${chartSVG(A.byMonth,B)}</div>
    <details class="table-view"><summary>הצג כטבלה</summary><div class="tbl-wrap"><table><thead><tr><th>חודש</th><th class="n">הכנסות</th><th class="n">הוצאות</th><th class="n">הפרש</th></tr></thead><tbody>
      ${MONTHS.map((m,i)=>i<=CUR?`<tr><td>${m[0]}${i===CUR&&YEAR===THIS_YEAR?" (עד היום)":""}</td><td class="n num">${ils(A.byMonth[i].inc)}</td><td class="n num">${ils(A.byMonth[i].exp)}</td><td class="n num">${ils(A.byMonth[i].inc-A.byMonth[i].exp)}</td></tr>`:"").join("")}
    </tbody></table></div></details>
  </section>
  <section class="sheet"><div class="sheet-head"><h2>לאן הולך הכסף ומאיפה הוא מגיע</h2><span class="hint">מתחילת השנה</span></div>
    <div class="two dashbars"><div><h3>הכנסות לפי סעיף</h3>${bars(bi,"var(--income)",items)}</div><div><h3>הוצאות לפי סעיף</h3>${bars(be,"var(--expense)",items)}</div></div></section>
  ${fc.length?`<section class="sheet"><div class="sheet-head"><h2>תחזית תזרים – 3 חודשים קדימה</h2><span class="hint">כמה כסף צפוי להיות בבנק</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>חודש</th><th class="n">צפוי להיכנס</th><th class="n">צפוי לצאת</th><th class="n">החזרי חובות</th><th class="n">יתרה צפויה בסוף החודש</th></tr></thead><tbody>
      <tr><td class="muted">היום</td><td></td><td></td><td></td><td class="n num">${ils(S.accounts.reduce((s,a)=>s+a.balance,0))}</td></tr>
      ${fc.map((r,k)=>`<tr><td>${r.label}${k===0?" (מה שנשאר)":""}</td><td class="n num">${ils(r.inc)}</td><td class="n num">${ils(r.exp)}</td><td class="n num">${ils(r.debt)}</td>
        <td class="n"><span class="num" style="font-weight:700;color:${r.end<0?"var(--bad)":"var(--good)"}">${ils(r.end)}</span>${r.end<0?' <span class="chip bad">חוסר</span>':""}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="hint">היתרה בבנק היום, ועוד ההכנסות החודשיות לפי התקציב, פחות ההוצאות החודשיות ותשלומי החובות. הוצאות חד פעמיות שעוד לא יצאו מתחלקות על החודשים שנשארו. שכירות ודתות לא נכללות, כי הן מתקזזות מול המשכיר.</p>
  </section>`:""}
  <div class="two">
    <section class="sheet"><div class="sheet-head"><h2>הוצאות: תקציב מול ביצוע</h2><span class="hint">הקו = כמה מהשנה עבר (${Math.round(PACE*100)}%)</span></div><div class="bva">${groupRows}</div></section>
    <section class="sheet"><div class="sheet-head"><h2>הכנסות: תקציב מול ביצוע</h2></div><div class="bva">${incRows}</div></section>
  </div>`;
}

const SHORT_MONTHS=["ינו׳","פבר׳","מרץ","אפר׳","מאי","יוני","יולי","אוג׳","ספט׳","אוק׳","נוב׳","דצמ׳"];
const isPhone=()=>typeof innerWidth==="number"&&innerWidth<=700;
function chartSVG(byMonth,B){
  // on a phone the chart is drawn at phone size, so the text stays readable and nothing scrolls sideways
  const ph_=isPhone(),W=ph_?360:780,H=ph_?220:270,top=14,bottom=ph_?28:34,left=ph_?2:10,right=ph_?40:58,pw=W-left-right,ph=H-top-bottom;
  const fs=ph_?' style="font-size:10.5px"':"";
  const monthBudInc=B.inc/NM,monthBudExp=B.exp/NM;
  const vals=byMonth.flatMap(m=>[m.inc,m.exp]).concat([monthBudInc,monthBudExp]);
  const step=Math.pow(10,Math.floor(Math.log10(Math.max(...vals,1))));
  const yMax=Math.ceil(Math.max(...vals,1)/step)*step;
  const y=v=>top+ph-(v/yMax)*ph,gw=pw/NM,bw=Math.min(16,gw*0.3);
  const bar=(x,v,cls)=>{const h=Math.max(0,(v/yMax)*ph);if(h<1)return"";const r=Math.min(4,h,bw/2),yy=y(v),b=top+ph;
    return `<path d="M${x},${b}V${yy+r}Q${x},${yy} ${x+r},${yy}H${x+bw-r}Q${x+bw},${yy} ${x+bw},${yy+r}V${b}Z" ${cls}/>`};
  let g="";
  for(let k=0;k<=4;k++){const v=yMax*k/4,yy=y(v);g+=`<line x1="${left}" x2="${left+pw}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-width="1"/><text x="${left+pw+8}" y="${yy+4}" text-anchor="start"${fs}>₪${compact(v)}</text>`}
  MONTHS.forEach((m,i)=>{
    const gx=left+pw-(i+1)*gw,cx=gx+gw/2;
    if(i<=CUR){
      g+=bar(cx+1,byMonth[i].inc,'fill="var(--income)"')+bar(cx-1-bw,byMonth[i].exp,'fill="var(--expense)"');
      if(i===CUR&&TODAY<YEAR_END)g+=bar(cx+1,monthBudInc,'fill="none" stroke="var(--income)" stroke-dasharray="3 3" stroke-width="1.5"')+bar(cx-1-bw,monthBudExp,'fill="none" stroke="var(--expense)" stroke-dasharray="3 3" stroke-width="1.5"');
    }else{
      g+=bar(cx+1,monthBudInc,'fill="none" stroke="var(--muted)" stroke-dasharray="3 3" stroke-width="1.2"')+bar(cx-1-bw,monthBudExp,'fill="none" stroke="var(--muted)" stroke-dasharray="3 3" stroke-width="1.2"');
    }
    g+=`<text x="${cx}" y="${H-(ph_?9:12)}" text-anchor="middle" style="${ph_?"font-size:10px;":""}${i===CUR?"fill:var(--ink);font-weight:700":""}">${ph_?SHORT_MONTHS[i]:m[0]}</text>`;
    g+=`<rect class="hit" data-m="${i}" data-inc="${Math.round(byMonth[i].inc)}" data-exp="${Math.round(byMonth[i].exp)}" x="${gx}" y="${top}" width="${gw}" height="${ph}" fill="transparent"/>`;
  });
  g+=`<line x1="${left}" x2="${left+pw}" y1="${top+ph}" y2="${top+ph}" stroke="var(--muted)" stroke-width="1"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="גרף הכנסות והוצאות לפי חודש">${g}</svg>`;
}

// ---------- budget ----------
function applyHeads(g){if(!g||g.heads==null)return;g.items.forEach(i=>{if(i.unit!=null){const v=Math.round((+i.unit||0)*(+g.heads||0));if(i.monthly!=null)i.monthly=v;else i.annual=v}})}
function viewBudget(){
  const ed=can().edit,B=totals(),past=pastYears(),hasSug=past.length>0;
  const q=BF.q.trim(),qn=q.replace(/[,₪\s]/g,"");
  const match=(i,group)=>!q||i.name.includes(q)||group.includes(q)||(qn&&/^\d+$/.test(qn)&&(String(i.monthly??"").includes(qn)||String(annual(i)).includes(qn)));
  const cols=4+(hasSug?1:0)+(ed?1:0);
  const subhead=(g)=>`<tr class="subhead"><th>סעיף</th><th class="n">${g&&g.heads!=null?"לאברך לחודש":"חודשי"}</th><th class="n">חודשים</th><th class="n">${g&&g.heads!=null?"שנתי – כל האברכים":"שנתי"}</th>${hasSug?`<th class="n">הצעה לפי ${past.length===1?"שנה קודמת":past.length+" שנים קודמות"}</th>`:""}${ed?"<th></th>":""}</tr>`;
  const row=(i,list,g)=>{const per=g&&g.heads!=null,sug=hasSug?suggestion(i.id):null;
    const monthlyCell=i.monthly==null?'<span class="muted">—</span>':per
      ?(ed?`<input class="small num" data-item="${i.id}" data-f="unit" type="number" value="${i.unit??""}" aria-label="לאברך לחודש">`:`<span class="num">${ils(i.unit||0)}</span>`)+`<div class="tot">סה״כ ל־${g.heads} אברכים: <b class="num">${ils(i.monthly)}</b></div>`
      :(ed?`<input class="small num" data-item="${i.id}" data-f="monthly" type="number" inputmode="numeric" value="${i.monthly??""}" placeholder="—" aria-label="חודשי">`:`<span class="num">${ils(i.monthly)}</span>`);
    const annualCell=i.monthly==null&&ed&&!per?`<input class="small num" data-item="${i.id}" data-f="annual" type="number" value="${i.annual??""}" aria-label="שנתי">`
      :i.monthly==null&&per?(ed?`<input class="small num" data-item="${i.id}" data-f="unit" type="number" value="${i.unit??""}" aria-label="לאברך לשנה">`:`<span class="num">${ils(i.unit||0)}</span>`)+`<div class="tot">סה״כ ל־${g.heads} אברכים: <b class="num">${ils(annual(i))}</b></div>`
      :per?`<b class="num">${ils(annual(i))}</b><div class="hint">לאברך <span class="num">${ils((+i.unit||0)*(+i.months||0))}</span></div>`
      :`<span class="num">${ils(annual(i))}</span>`;
    return `<tr><td class="c-name"><div class="namerow">${ed?`<input class="name" id="nm-${i.id}" data-item="${i.id}" data-f="name" value="${esc(i.name)}" aria-label="שם הסעיף">`:esc(i.name)}${noteBtn("item",i.id,i.note)}</div>${noteUI("item",i.id,i.note)}</td>
    <td class="n c-mon">${monthlyCell}</td>
    <td class="n c-months">${i.monthly!=null?(ed?`<input class="tiny num" data-item="${i.id}" data-f="months" type="number" value="${i.months}" aria-label="חודשים">`:`<span class="num">${i.months}</span>`):'<span class="muted">חד פעמי</span>'}</td>
    <td class="n c-annual">${annualCell}</td>
    ${hasSug?`<td class="n c-sug">${sug?`<span class="num">${ils(sug.avg)}</span>${ed&&Math.round(sug.avg)!==Math.round(annual(i))?ico("apply",`data-applysug="${i.id}"`,"להחיל את ההצעה"):""}`:'<span class="muted">—</span>'}</td>`:""}
    ${ed?`<td class="c-del">${ico("del",`data-delitem="${i.id}" data-list="${list}"`,"מחיקת הסעיף")}</td>`:""}</tr>`};
  const addRow=list=>ed&&!q?`<tr class="addrow"><td colspan="${cols}"><button class="btn ghost small" data-additem="${list}">+ הוספת סעיף</button></td></tr>`:"";
  const isOpen=k=>!!q||!closed.has(k); // while searching every group stays open
  const totalRow=(label,sum)=>`<tr class="total"><td>${label}</td><td></td><td></td><td class="n num">${ils(sum)}</td>${hasSug?"<td></td>":""}${ed?"<td></td>":""}</tr>`;
  const groups=S.budget.expenses.map((g,gi)=>{
    if(BF.group!=="all"&&BF.group!=="g"+gi)return"";
    const rows=g.items.filter(i=>match(i,g.group));if(q&&!rows.length)return"";
    const sum=g.items.reduce((a,i)=>a+annual(i),0),k="b:"+g.group;
    const heads=g.heads!=null?`<label class="heads">מספר אברכים ${ed?`<input class="tiny num" data-heads="${gi}" type="number" min="0" value="${g.heads}" aria-label="מספר אברכים">`:`<b class="num">${g.heads}</b>`}</label>`:"";
    return grpHead(k,g.group,sum,g.items.length,cols,!!q,heads)+(isOpen(k)?subhead(g)+rows.map(i=>row(i,"g"+gi,g)).join("")+addRow("g"+gi)+totalRow("סה״כ "+esc(g.group),sum):"")}).join("");
  const showInc=BF.group==="all"||BF.group==="inc",showExp=BF.group!=="inc";
  const incRows=showInc?S.budget.income.filter(i=>match(i,"הכנסות")):[];
  const allKeys=[...S.budget.expenses.map(g=>"b:"+g.group),"b:inc"];
  const head=`<thead class="vh"><tr><th>סעיף</th><th class="n">חודשי</th><th class="n">חודשים</th><th class="n">שנתי</th>${hasSug?`<th class="n">הצעה</th>`:""}${ed?"<th></th>":""}</tr></thead>`;
  return `${ed?"":`<div class="readonly-banner">צפייה בלבד.</div>`}
  <section class="sheet"><div class="sheet-head"><h2>סיכום תקציב שנתי – ${YEAR}</h2></div>
    <div class="summary"><div><div class="label">סה״כ הכנסות מתוכננות</div><div class="value num" style="color:var(--income)">${ils(B.inc)}</div></div><div><div class="label">סה״כ הוצאות מתוכננות</div><div class="value num" style="color:var(--expense)">${ils(B.exp)}</div></div><div><div class="label">יתרה / גירעון צפוי</div><div class="value num" style="color:${B.inc-B.exp<0?"var(--bad)":"var(--good)"}">${ils(B.inc-B.exp)}</div></div></div></section>
  ${hasSug&&ed?`<div class="sepnote">בעמודה <b>"הצעה"</b> מופיע הממוצע של מה שהוצא או התקבל בפועל בכל סעיף בשנים הקודמות (${past.join(", ")}). לוחצים על החץ כדי להעתיק את ההצעה לתקציב. <button class="linkbtn" data-applyall>להחיל את כל ההצעות</button></div>`:""}
  <div class="filters">
    <input type="search" id="bq" placeholder="חיפוש לפי שם סעיף, קטגוריה או סכום" value="${esc(BF.q)}" aria-label="חיפוש בתקציב">
    <select id="bgroup" aria-label="קטגוריה"><option value="all">כל הקטגוריות</option><option value="inc"${BF.group==="inc"?" selected":""}>הכנסות</option>${S.budget.expenses.map((g,gi)=>`<option value="g${gi}"${BF.group==="g"+gi?" selected":""}>${esc(g.group)}</option>`).join("")}</select>
    <button data-grpall="close" data-keys="${esc(allKeys.join("|"))}">▴ לסגור הכול</button><button data-grpall="open" data-keys="${esc(allKeys.join("|"))}">▾ לפתוח הכול</button>
  </div>
  <div class="budcols">
    ${showExp?`<section class="sheet"><div class="coltop"><div class="label">סה״כ הוצאות מתוכננות</div><div class="value num" style="color:var(--expense)">${ils(B.exp)}</div></div>
      <div class="sheet-head"><h2>הוצאות</h2></div><div class="tbl-wrap"><table class="bud-table">${head}<tbody>${groups||`<tr><td colspan="${cols}" class="muted">לא נמצאו סעיפים</td></tr>`}</tbody></table></div></section>`:""}
    ${showInc?`<section class="sheet"><div class="coltop"><div class="label">סה״כ הכנסות מתוכננות</div><div class="value num" style="color:var(--income)">${ils(B.inc)}</div></div>
      <div class="sheet-head"><h2>הכנסות</h2></div><div class="tbl-wrap"><table class="bud-table">${head}<tbody>${grpHead("b:inc","כל ההכנסות",B.inc,S.budget.income.length,cols,!!q)}${isOpen("b:inc")?subhead(null)+(incRows.map(i=>row(i,"inc",null)).join("")||`<tr><td colspan="${cols}" class="muted">לא נמצאו סעיפים</td></tr>`)+addRow("inc")+totalRow("סה״כ הכנסות",B.inc):""}</tbody></table></div></section>`:""}
  </div>`;
}

// ---------- transactions ----------
function txMatches(x,items){
  if(TF.month==="range"){if(TF.from&&x.date<TF.from)return false;if(TF.to&&x.date>TF.to)return false}
  else if(TF.month!=="all"&&monthIndex(x.date)!==+TF.month)return false;
  if(TF.src==="unc"&&x.cat)return false;
  if(TF.src!=="all"&&TF.src!=="unc"&&x.source!==TF.src)return false;
  const k=kindOf(x,items);
  if(TF.type==="in"&&k!=="income")return false;
  if((TF.type==="out"||TF.type==="norc")&&k!=="expense")return false;
  if(TF.type==="norc"&&(x.rcpt||x.rcptPaper))return false;
  if(TF.cat!=="all"){
    if(OUTSIDE.has(TF.cat))return x.cat===TF.cat;
    if(TF.cat==="inc")return !!x.cat&&(items[x.cat]||{}).kind==="income";
    if(TF.cat.startsWith("g:"))return !!x.cat&&(items[x.cat]||{}).group===TF.cat.slice(2);
    if(x.cat!==TF.cat)return false;
  }
  if(TF.q){const q=TF.q.trim(),qn=q.replace(/[,₪\s]/g,"");if(q&&!(x.desc||"").includes(q)&&!(x.note||"").includes(q)&&!(qn&&/^\d+$/.test(qn)&&String(Math.abs(Math.round(x.amount))).includes(qn)))return false}
  return true;
}
function txCatFilter(){
  const t=TF.type,inc=t!=="out"&&t!=="norc",exp=t!=="in",o=(v,l)=>`<option value="${esc(v)}"${TF.cat===v?" selected":""}>${esc(l)}</option>`;
  return o("all","כל הסעיפים")
    +(inc?`<optgroup label="הכנסות">${o("inc","כל ההכנסות")}${S.budget.income.filter(i=>!VIA_MEOROT.has(i.id)).map(i=>o(i.id,i.name)).join("")}</optgroup>`:"")
    +(exp?S.budget.expenses.map(g=>`<optgroup label="${esc(g.group)}">${o("g:"+g.group,g.group+" – הכול")}${g.items.filter(i=>!VIA_MEOROT.has(i.id)).map(i=>o(i.id,i.name)).join("")}</optgroup>`).join(""):"")
    +`<optgroup label="קופות נפרדות">${o(DEBT,"גמ״חים – קופה נפרדת")}${o(BUILDING,"קרן הבניין – קופה נפרדת")}</optgroup>`;
}
function viewTransactions(){
  const ed=can().edit,items=allItems();
  const list=[...S.tx].filter(x=>txMatches(x,items)).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  const unc=S.tx.filter(x=>!x.cat).length,shown=list.slice(0,txShown);
  const sources=[...new Set(S.tx.map(x=>x.source).filter(Boolean))].sort();
  const allSel=list.length&&list.every(x=>selTx.has(x.id));
  const rcptCell=x=>x.rcpt?`<span class="tag">${ico("clip",`data-viewrc="${x.id}"`,"צפייה בקבלה")}<button class="linkbtn" data-viewrc="${x.id}">${esc(x.rcpt.name)}</button>${ed?ico("del",`data-delrc="${x.id}"`,"הסרת הקבלה"):""}</span>`
    :x.rcptPaper?`<span class="tag ok">✓ יש קבלה (לא סרוקה)${ed?ico("del",`data-paper="${x.id}"`,"ביטול הסימון"):""}</span>`
    :(ed&&kindOf(x,items)==="expense"?`<label class="ico faint" title="צירוף קבלה (צילום או קובץ)" aria-label="צירוף קבלה"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${SVG.clip}"/></svg><input type="file" data-rcpt="${x.id}" accept="image/*,application/pdf" hidden></label>${ico("paper",`data-paper="${x.id}"`,"יש קבלה בנייר (בלי לסרוק)","faint")}`:"");
  const links=x=>{let h="";
    if(x.cat===DEBT&&x.amount<0&&S.debts.length)h+=`<select class="linksel" data-txdebt="${x.id}" aria-label="איזה חוב"${ed?"":" disabled"}><option value="">— לאיזה חוב? —</option>${S.debts.map(d=>`<option value="${d.id}"${x.debtId===d.id?" selected":""}>${esc(d.name)}</option>`).join("")}</select>`;
    if(isTuition(x)&&S.students.length)h+=`<select class="linksel" data-txstu="${x.id}" aria-label="איזה בחור"${ed?"":" disabled"}><option value="">— של איזה בחור? —</option>${[...S.students].sort((a,b)=>a.name.localeCompare(b.name,"he")).map(s=>`<option value="${s.id}"${x.studentId===s.id?" selected":""}>${esc(s.name)}</option>`).join("")}</select>`;
    if(x.cat===BUILDING)h+='<div class="hint" style="font-size:.75rem">נכנס לקרן הבניין</div>';
    if(x.cat===DEBT)h+='<div class="hint" style="font-size:.75rem">לא נספר בהכנסות ובהוצאות</div>';
    return h};
  const editRow=x=>{const k=kindOf(x,items);return `<tr class="panel"><td colspan="7"><form class="form" data-edittx="${x.id}">
    <label for="etDate">תאריך<input id="etDate" type="date" value="${x.date}" required></label>
    <label for="etDesc">תיאור<input id="etDesc" value="${esc(x.desc)}" required></label>
    <label for="etKind">סוג<select id="etKind"><option value="in"${k==="income"?" selected":""}>הכנסה</option><option value="out"${k!=="income"?" selected":""}>הוצאה</option></select></label>
    <label for="etAmt">סכום (₪)<input id="etAmt" type="number" step="0.01" min="0" value="${Math.abs(x.amount)}" required></label>
    <label for="etSrc">מקור<select id="etSrc">${[...new Set([x.source,...SOURCES,"נדרים פלוס"])].filter(Boolean).map(s=>`<option${s===x.source?" selected":""}>${esc(s)}</option>`).join("")}</select></label>
    <button class="btn" type="submit">שמירה</button><button class="btn ghost" type="button" data-canceltx>ביטול</button></form></td></tr>`};
  const row=x=>editTx===x.id?editRow(x):`<tr class="${x.cat?"":"unclassified"}${selTx.has(x.id)?" picked":""}">
    <td class="c-chk">${ed?`<input type="checkbox" data-seltx="${x.id}"${selTx.has(x.id)?" checked":""} aria-label="בחירה">`:""}</td>
    <td class="c-date"><div class="num">${grDate(x.date)}</div><div class="muted" style="font-size:.78rem">${heDate(x.date)}</div></td>
    <td class="c-desc"><div class="namerow"><span class="txdesc">${esc(x.desc)}</span>${noteBtn("tx",x.id,x.note)}${rcptCell(x)}</div>${noteUI("tx",x.id,x.note)}</td>
    <td class="c-src"><span class="src">${esc(x.source)}</span></td>
    <td class="c-cat">${ed?`<select data-cat="${x.id}" aria-label="סעיף">${catOptions(x.cat,x.amount>=0?"income":"expense")}</select>`:(x.cat?esc(catName(x.cat,items)):'<span class="chip warn">לא מסווג</span>')}${links(x)}</td>
    <td class="n c-amt num">${x.amount>=0?"+":""}${ils(x.amount)}</td>
    <td class="c-act">${ed?ico("edit",`data-edittx="${x.id}"`,"עריכת התנועה")+ico("del",`data-deltx="${x.id}"`,"מחיקת התנועה"):""}</td></tr>`;
  return `${!ed?`<div class="readonly-banner">צפייה בלבד.</div>`:""}
  ${ed?`<details class="sheet addbox" data-open="tx"${openAdd.has("tx")?" open":""}><summary><span class="plus">+</span> הוספת תנועה</summary>
  <form class="form" id="txForm">
    <label for="fDate">תאריך<input id="fDate" type="date" required value="${iso(TODAY<YEAR_END?TODAY:new Date(YEAR,11,31))}"></label>
    <label for="fDesc">תיאור<input id="fDesc" required></label>
    <label for="fKind">סוג<select id="fKind"><option value="out">הוצאה</option><option value="in">הכנסה</option></select></label>
    <label for="fAmt">סכום (₪)<input id="fAmt" type="number" step="0.01" min="0.01" required inputmode="decimal"></label>
    <label for="fSrc">מקור<select id="fSrc">${SOURCES.map(s=>`<option>${s}</option>`).join("")}</select></label>
    <label for="fCat">סעיף<select id="fCat">${catOptions("","expense")}</select></label>
    <label for="fNote">הערה<input id="fNote"></label>
    <button class="btn" type="submit">הוספה</button>
  </form></details>`:""}
  <section class="sheet"><div class="sheet-head"><h2>תנועות</h2>${ed&&unc?`<button class="btn ghost" data-act="rules">סיווג אוטומטי לפי הכללים</button>`:""}</div>
  <div class="filters">
    <input type="search" id="tq" placeholder="חיפוש לפי תיאור, הערה או סכום" value="${esc(TF.q)}" aria-label="חיפוש בתנועות">
    <select id="tfMonth" aria-label="תקופה"><option value="all">כל השנה</option>${MONTHS.map((m,i)=>i<=CUR?`<option value="${i}"${TF.month===String(i)?" selected":""}>${m[0]} ${YEAR}</option>`:"").join("")}<option value="range"${TF.month==="range"?" selected":""}>בין תאריכים…</option></select>
    ${TF.month==="range"?`<label class="rng">מ־<input type="date" id="tfFrom" value="${TF.from}" min="${YEAR}-01-01" max="${YEAR}-12-31"></label><label class="rng">עד <input type="date" id="tfTo" value="${TF.to}" min="${YEAR}-01-01" max="${YEAR}-12-31"></label>`:""}
    <select id="tfType" aria-label="סוג"><option value="all">הכנסות והוצאות</option><option value="in"${TF.type==="in"?" selected":""}>הכנסות בלבד</option><option value="out"${TF.type==="out"?" selected":""}>הוצאות בלבד</option><option value="norc"${TF.type==="norc"?" selected":""}>הוצאות בלי קבלה</option></select>
    <select id="tfCat" aria-label="סעיף בתקציב">${txCatFilter()}</select>
  </div>
  <div class="filters">
    ${[["all","כל המקורות"],["unc",`לא מסווג (${unc})`],...sources.map(s=>[s,s])].map(([k,l])=>`<button data-src="${esc(k)}" aria-pressed="${TF.src===k}">${esc(l)}</button>`).join("")}
  </div>
  ${miniDash(list,TF.month==="all"||TF.month==="range")}
  <p class="hint" style="margin:10px 0">שכירות והכנסות שעוברות דרך המשכיר נמצאות בלשונית <a href="#meorot" style="color:var(--gold)">המשכיר</a>.${TF.type==="norc"?" \"הוצאות בלי קבלה\" = הוצאות שלא צורפה להן קבלה ולא סומן שיש קבלה בנייר.":""}</p>
  ${ed&&selTx.size?`<div class="bulkbar"><b>${selTx.size} נבחרו</b>
    <select id="bulkCat" aria-label="סעיף לכל הנבחרות">${catOptions("",TF.type==="in"?"income":TF.type==="out"||TF.type==="norc"?"expense":null)}</select><button class="btn small" data-bulk="cat">לסווג את כולן</button>
    <button class="btn ghost small" data-bulk="paper">סימון "יש קבלה"</button><button class="btn danger small" data-bulk="del">מחיקה</button><button class="linkbtn" data-bulk="none">ביטול הבחירה</button></div>`:""}
  <div class="tbl-wrap"><table class="tx-table"><thead><tr><th class="c-chk">${ed?`<input type="checkbox" data-selall${allSel?" checked":""} aria-label="בחירת כל ${list.length} התנועות">`:""}</th><th>תאריך</th><th>תיאור</th><th>מקור</th><th>סעיף</th><th class="n">סכום</th><th></th></tr></thead><tbody>
  ${shown.map(row).join("")||`<tr><td colspan="7" class="muted">אין תנועות להצגה</td></tr>`}
  </tbody></table></div>
  ${list.length>shown.length?`<p style="text-align:center"><button class="btn ghost" data-moretx>הצגת עוד ${Math.min(100,list.length-shown.length)} (מתוך ${list.length})</button></p>`:""}
  </section>`;
}

// ---------- debts ----------
function viewDebts(){
  const ed=can().edit;
  const total=S.debts.reduce((s,d)=>s+d.amount,0),paid=S.debts.reduce((s,d)=>s+debtPaid(d),0);
  const order={high:0,mid:1,low:2};
  const list=S.debts.filter(d=>debtUrg==="all"||d.urgency===debtUrg).sort((a,b)=>{const ra=a.amount<=debtPaid(a),rb=b.amount<=debtPaid(b);return ra-rb||order[a.urgency]-order[b.urgency]||(a.next<b.next?-1:1)});
  const cols=ed?9:8;
  const urgSel=(id,v)=>`<select id="${id}">${Object.entries(URG).map(([k,[l]])=>`<option value="${k}"${v===k?" selected":""}>${l}</option>`).join("")}</select>`;
  const panel=d=>{
    const per=d.amount/d.payments,txs=debtTx(d);
    const rows=[...d.repayments.map(r=>({...r,kind:"manual"})),...txs.map(x=>({id:x.id,date:x.date,amount:-x.amount,method:"מהתנועות · "+x.source,note:x.desc,kind:"tx"}))].sort((a,b)=>a.date<b.date?1:-1);
    return `<tr class="panel"><td colspan="${cols}">
      ${editDebt===d.id?`<h3>עריכת פרטי החוב</h3><form class="form" data-editdebt="${d.id}">
        <label for="eName">שם<input id="eName" value="${esc(d.name)}" required></label>
        <label for="eAmt">סכום החוב<input id="eAmt" type="number" min="1" value="${d.amount}" required></label>
        <label for="ePay">מספר תשלומים<input id="ePay" type="number" min="1" value="${d.payments}" required></label>
        <label for="eUrg">דחיפות${urgSel("eUrg",d.urgency)}</label>
        <label for="eNext">תשלום הבא<input id="eNext" type="date" value="${d.next}"></label>
        <button class="btn" type="submit">שמירה</button>
        <button class="btn ghost" type="button" data-canceledit>ביטול</button>
        <button class="btn danger" type="button" data-deldebt="${d.id}">מחיקת החוב</button></form>`:""}
      <h3>החזרים</h3>
      <table><thead><tr><th>תאריך</th><th class="n">סכום</th><th>איך שולם</th><th>הערה</th>${ed?"<th></th>":""}</tr></thead><tbody>
      ${rows.map(r=>`<tr><td><span class="num">${grDate(r.date)}</span> <span class="muted" style="font-size:.8rem">${heDate(r.date)}</span></td><td class="n num">${ils(r.amount)}</td><td>${esc(r.method)}</td><td class="muted">${esc(r.note)}</td>${ed?`<td>${r.kind==="manual"?ico("del",`data-delrp="${d.id}:${r.id}"`,"מחיקת ההחזר"):ico("del",`data-unlinkdebt="${r.id}"`,"ניתוק מהחוב")}</td>`:""}</tr>`).join("")||`<tr><td colspan="5" class="muted">עדיין לא נרשמו החזרים</td></tr>`}
      </tbody></table>
      <p class="hint">החזר שיוצא מהבנק נרשם בתנועות: מסווגים אותו כ״גמ״חים – קופה נפרדת״ ובוחרים את החוב, והוא מופיע כאן לבד.</p>
      ${ed&&d.amount>debtPaid(d)?`<form class="form" data-addrp="${d.id}">
        <label for="rpDate-${d.id}">תאריך<input id="rpDate-${d.id}" type="date" value="${iso(TODAY)}" required></label>
        <label for="rpAmt-${d.id}">סכום<input id="rpAmt-${d.id}" type="number" min="1" value="${Math.round(Math.min(per,d.amount-debtPaid(d)))}" required></label>
        <label for="rpMeth-${d.id}">איך שולם<select id="rpMeth-${d.id}">${METHODS.map(m=>`<option>${m}</option>`).join("")}</select></label>
        <label for="rpNote-${d.id}">הערה<input id="rpNote-${d.id}"></label>
        <button class="btn" type="submit">הוספת החזר</button></form>`:""}
    </td></tr>`};
  return `${ed?"":`<div class="readonly-banner">צפייה בלבד.</div>`}
  <div class="sepnote"><b>קופה נפרדת.</b> חובות וגמ״חים לא נספרים בהכנסות ובהוצאות של התקציב השוטף.</div>
  <section class="sheet"><div class="sheet-head"><h2>חובות עבר וגמ״חים</h2></div>
  <div class="summary"><div><div class="label">סה״כ חובות</div><div class="value num">${ils(total)}</div></div><div><div class="label">הוחזר עד כה</div><div class="value num">${ils(paid)}</div></div><div><div class="label">נשאר להחזיר</div><div class="value num" style="color:var(--bad)">${ils(total-paid)}</div></div></div></section>
  <section class="sheet">
  ${ed?`<details class="addbox inner" data-open="debt"${openAdd.has("debt")?" open":""}><summary><span class="plus">+</span> הוספת חוב</summary><form class="form" id="debtForm">
    <label for="dName">שם<input id="dName" required placeholder="שם הגמ״ח / המלווה"></label>
    <label for="dAmt">סכום<input id="dAmt" type="number" min="1" required></label>
    <label for="dPay">מספר תשלומים<input id="dPay" type="number" min="1" value="10" required></label>
    <label for="dUrg">דחיפות${urgSel("dUrg","mid")}</label>
    <label for="dNext">תשלום הבא<input id="dNext" type="date" value="${iso(TODAY)}"></label>
    <button class="btn" type="submit">הוספת חוב</button></form></details>`:""}
  <div class="filters"><span class="hint">דחיפות:</span>${[["all","הכול"],["high","דחוף"],["mid","בינוני"],["low","רגיל"]].map(([k,l])=>`<button data-urg="${k}" aria-pressed="${debtUrg===k}">${l}</button>`).join("")}</div>
  <div class="tbl-wrap"><table><thead><tr><th></th><th>שם</th><th>דחיפות</th><th class="n">סכום</th><th class="n">תשלומים</th><th class="n">הוחזר</th><th class="n">נשאר</th><th>תשלום הבא</th>${ed?"<th></th>":""}</tr></thead><tbody>
  ${list.map(d=>{const p=debtPaid(d),rem=d.amount-p,open=openDebts.has(d.id),pct=Math.min(100,p/d.amount*100);
    return `<tr><td><button class="tog" data-tog="${d.id}" aria-expanded="${open}" aria-label="הצגת החזרים"><span>◀</span></button></td>
    <td><div class="namerow">${esc(d.name)}${noteBtn("debt",d.id,d.note)}</div>${noteUI("debt",d.id,d.note)}<div class="prog" style="margin-top:5px;max-width:160px"><i style="width:${pct.toFixed(0)}%"></i></div></td>
    <td><span class="chip ${URG[d.urgency][1]}">${URG[d.urgency][0]}</span></td>
    <td class="n num">${ils(d.amount)}</td><td class="n num">${d.repayments.length+debtTx(d).length}/${d.payments}</td><td class="n num">${ils(p)}</td><td class="n num">${ils(rem)}</td>
    <td>${rem>0?`<span class="num">${grDate(d.next)}</span><div class="muted" style="font-size:.78rem">${heDate(d.next)}</div>`:'<span class="chip good">✓ נסגר</span>'}</td>
    ${ed?`<td>${ico("edit",`data-edit="${d.id}"`,"עריכת החוב")}</td>`:""}</tr>${open?panel(d):""}`}).join("")||`<tr><td colspan="${cols}" class="muted">אין חובות ברמת הדחיפות הזו</td></tr>`}
  </tbody></table></div></section>`;
}

// ---------- המשכיר ----------
function viewMeorot(){
  const ed=can().edit,items=allItems(),L=meorotLedger();
  const sum=k=>L.rows.filter(r=>r.kind===k).reduce((s,r)=>s+r.eff,0);
  const received=sum("received"),rent=-sum("rent")-sum("charge");
  const inp=(attr,v,label)=>`<input class="small num inline" ${attr} type="number" value="${v}" aria-label="${label}">`;
  const util=(k,label)=>{const u=utilStats(k);
    return `<section class="sheet"><div class="sheet-head"><h2>${label}</h2>
      <span class="hint">תשלום קבוע לחודש ${ed?inp(`data-fixed="${k}"`,u.fixed,"תשלום קבוע "+label):`<span class="num">${ils(u.fixed)}</span>`}</span></div>
    ${u.n?`<div class="summary">
      <div><div class="label">${MONTHS[u.last.i][0]} (אחרון שהוזן)</div><div class="value">${diffText(u.last.diff)}</div><div class="hint">חשבון <span class="num">${ils(u.last.b)}</span> מול <span class="num">${ils(u.fixed)}</span></div></div>
      <div><div class="label">מתחילת השנה</div><div class="value">${diffText(u.pay-u.bill)}</div><div class="hint">שילמנו <span class="num">${ils(u.pay)}</span> · חשבונות <span class="num">${ils(u.bill)}</span></div></div>
      <div><div class="label">ממוצע חודשי בפועל</div><div class="value num">${ils(u.avg)}</div><div class="hint">אם ימשיך כך, בסוף השנה: ${diffText((u.fixed-u.avg)*12)}</div></div>
    </div>`:`<p class="muted">עדיין לא הוזנו חשבונות.</p>`}
    <div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>חודש</th><th class="n">שילמנו</th><th class="n">חשבון בפועל</th><th class="n">החודש</th><th class="n">מצטבר</th></tr></thead><tbody>
    ${u.rows.map(r=>`<tr><td>${MONTHS[r.i][0]}</td><td class="n num">${ils(u.fixed)}</td>
      <td class="n">${ed?`<input class="small num" data-bill="${r.i}:${k}" type="number" value="${r.b??""}" placeholder="להזין" aria-label="חשבון ${label} ${MONTHS[r.i][0]}">`:(r.b!=null?`<span class="num">${ils(r.b)}</span>`:'<span class="muted">—</span>')}</td>
      <td class="n" style="font-size:.85rem">${r.diff!=null?diffText(r.diff):""}</td><td class="n" style="font-size:.85rem">${r.cum!=null?diffText(r.cum):""}</td></tr>`).join("")}
    </tbody></table></div></section>`};
  return `<div class="sepnote"><b>ארנק נפרד מול המשכיר.</b> שכירות, וכספים שהמשכיר מקבל עבורנו (כמו דתות), נספרים בהכנסות ובהוצאות אבל נרשמים רק כאן.</div>
  <section class="sheet"><div class="sheet-head"><h2>מאזן מול המשכיר</h2>
    ${ed?`<span class="hint">שכירות חודשית ${inp("data-rent",S.meorot.rent,"שכירות חודשית")}</span>`:""}</div>
    <div class="summary">
      <div><div class="label">קיבלו עבורנו מתחילת השנה</div><div class="value num">${ils(received)}</div></div>
      <div><div class="label">שכירות וחיובים מתחילת השנה</div><div class="value num">${ils(rent)}</div></div>
      <div><div class="label">${L.bal>=0?"המשכיר חייב לנו":"אנחנו חייבים למשכיר"}</div><div class="value num" style="color:${L.bal<0?"var(--bad)":"var(--good)"}">${ils(Math.abs(L.bal))}</div></div>
    </div></section>
  <section class="sheet"><div class="sheet-head"><h2>תנועות בארנק המשכיר</h2><span class="hint">השכירות נרשמת לבד כל חודש</span></div>
  ${ed?`<form class="form" id="mForm">
    <label for="mDate">תאריך<input id="mDate" type="date" value="${iso(TODAY)}" required></label>
    <label for="mType">סוג<select id="mType"><option value="received">המשכיר קיבל עבורנו (הכנסה)</option><option value="charge">חיוב נוסף מהמשכיר (הוצאה)</option><option value="paid_to">שילמנו למשכיר</option><option value="paid_from">המשכיר העביר לנו</option></select></label>
    <label for="mDesc">תיאור<input id="mDesc" required placeholder="לדוגמה: דתות חודש נובמבר"></label>
    <label for="mAmt">סכום<input id="mAmt" type="number" min="1" required></label>
    <label for="mCat">סעיף בתקציב<select id="mCat">${catOptions("i_dat_b","income",true)}</select></label>
    <button class="btn" type="submit">הוספה</button></form>`:""}
  <div class="tbl-wrap"><table><thead><tr><th>תאריך</th><th>תיאור</th><th>סוג</th><th>סעיף</th><th class="n">השפעה</th><th class="n">מאזן</th>${ed?"<th></th>":""}</tr></thead><tbody>
  ${[...L.rows].reverse().map(r=>`<tr><td><span class="num">${grDate(r.date)}</span><div class="muted" style="font-size:.78rem">${heDate(r.date)}</div></td>
    <td><div class="namerow">${esc(r.desc)}${r.src?` <span class="src">${esc(r.src)}</span>`:""}${r.id?noteBtn("meo",r.id,r.note):""}</div>${r.id?noteUI("meo",r.id,r.note):""}</td>
    <td><span class="chip ${M_TYPES[r.kind][1]}">${M_TYPES[r.kind][0]}</span></td><td class="muted">${r.kind==="rent"?"שכירות מבנה":esc(r.cat?catName(r.cat,items):"—")}</td>
    <td class="n num">${r.eff>0?"+":""}${ils(r.eff)}</td><td class="n num" style="color:${r.bal<0?"var(--bad)":"var(--good)"}">${ils(r.bal)}</td>
    ${ed?`<td>${r.id?ico("del",`data-delm="${r.id}"`,"מחיקה"):""}</td>`:""}</tr>`).join("")}
  </tbody></table></div>
  <p class="hint">מאזן חיובי = המשכיר חייב לנו. מאזן שלילי = אנחנו חייבים להם.</p></section>
  <h2 style="font-size:1.3rem;color:var(--brown);margin:26px 0 12px">חשמל ומים</h2>
  <div class="two">${util("elec","חשמל")}${util("water","מים")}</div>`;
}

// ---------- building fund ----------
function viewBuilding(){
  const ed=can().edit,b=S.building,all=buildingEntries(),inn=all.filter(e=>e.amount>0).reduce((s,e)=>s+e.amount,0),out=all.filter(e=>e.amount<0).reduce((s,e)=>s-e.amount,0);
  return `<div class="sepnote"><b>קופה נפרדת.</b> קרן הבניין לא נספרת בתקציב השוטף. תנועה שמסווגים בתנועות כ״קרן הבניין״ מופיעה כאן לבד.</div>
  <section class="sheet"><div class="sheet-head"><h2>קרן הבניין</h2></div>
  <div class="summary"><div><div class="label">נאסף</div><div class="value num">${ils(inn)}</div></div><div><div class="label">הוצאות</div><div class="value num">${ils(out)}</div></div><div><div class="label">יתרה בקרן</div><div class="value num">${ils(inn-out)}</div></div></div>
  <div style="margin-top:14px"><div class="hint" style="margin-bottom:6px">יעד הקרן: ${ed?`<input class="small num inline" data-goal type="number" min="0" value="${b.goal||""}" placeholder="להזין" aria-label="יעד קרן הבניין">`:`<span class="num">${ils(b.goal)}</span>`}</div>
    ${b.goal?`<div class="prog" style="height:12px"><i style="width:${Math.min(100,inn/b.goal*100).toFixed(1)}%;background:var(--gold)"></i></div>`:""}</div></section>
  <section class="sheet">${ed?`<form class="form" id="bForm">
    <label for="bDate">תאריך<input id="bDate" type="date" value="${iso(TODAY)}" required></label>
    <label for="bDesc">תיאור<input id="bDesc" required></label>
    <label for="bKind">סוג<select id="bKind"><option value="in">תרומה לקרן</option><option value="out">הוצאה (תכנון / בנייה)</option></select></label>
    <label for="bAmt">סכום<input id="bAmt" type="number" min="1" required></label>
    <button class="btn" type="submit">הוספה</button></form>`:""}
  <div class="tbl-wrap"><table><thead><tr><th>תאריך</th><th>תיאור</th><th class="n">סכום</th>${ed?"<th></th>":""}</tr></thead><tbody>
  ${[...all].sort((a,c)=>a.date<c.date?1:-1).map(e=>`<tr><td><span class="num">${grDate(e.date)}</span> <span class="muted" style="font-size:.8rem">${heDate(e.date)}</span></td>
    <td><div class="namerow">${esc(e.desc)}${e.fromTx?` <span class="src">${esc(e.src)}</span>`:noteBtn("bld",e.id,e.note)}</div>${e.fromTx?"":noteUI("bld",e.id,e.note)}</td><td class="n num">${e.amount>0?"+":""}${ils(e.amount)}</td>
    ${ed?`<td>${e.fromTx?"":ico("del",`data-delb="${e.id}"`,"מחיקה")}</td>`:""}</tr>`).join("")||`<tr><td colspan="4" class="muted">עדיין אין תנועות בקרן</td></tr>`}
  </tbody></table></div></section>`;
}

// ---------- tuition ----------
const SHIURIM=[["","ללא שיעור"],["א׳","שיעור א׳"],["ב׳","שיעור ב׳"],["ג׳","שיעור ג׳"]];
function viewStudents(){
  const ed=can().edit,all=stuRows();
  const due=all.reduce((s,r)=>s+r.due,0),paid=all.reduce((s,r)=>s+r.paid,0),behind=all.filter(r=>r.bal>0);
  const q=SF.q.trim();
  const list=all.filter(r=>(!q||r.s.name.includes(q))&&(SF.shiur==="all"||(r.s.shiur||"")===SF.shiur)&&(SF.f==="all"||(SF.f==="late"?r.bal>0:r.bal<=0))).sort((a,b)=>b.bal-a.bal||a.s.name.localeCompare(b.s.name,"he"));
  const unlinked=S.tx.filter(x=>isTuition(x)&&!x.studentId&&monthIndex(x.date)>=0).sort((a,b)=>a.date<b.date?1:-1);
  const cols=ed?9:8;
  const status=r=>r.bal<=0?`<span class="chip good">✓ משולם${r.bal<0?` (עודף <span class="num">${ils(-r.bal)}</span>)`:""}</span>`:r.late>=2?`<span class="chip bad">פיגור ${r.late} חודשים</span>`:`<span class="chip warn">חסר <span class="num">${ils(r.bal)}</span></span>`;
  const stuOpts=sel=>`<option value="">— לבחור בחור —</option>${[...S.students].sort((a,b)=>a.name.localeCompare(b.name,"he")).map(s=>`<option value="${s.id}"${sel===s.id?" selected":""}>${esc(s.name)}</option>`).join("")}`;
  const panel=r=>{const pays=[...r.s.payments.map(p=>({...p,kind:"manual"})),...stuTx(r.s).map(x=>({id:x.id,date:x.date,amount:x.amount,method:x.source,note:x.desc,kind:"tx"}))].sort((a,b)=>a.date<b.date?1:-1);
    return `<tr class="panel"><td colspan="${cols}"><h3>תשלומים של ${esc(r.s.name)}</h3>
    ${(r.s.payers||[]).length?`<p class="hint" style="margin:0 0 8px">משלמים שמשויכים אוטומטית: ${r.s.payers.map(p=>`<span class="tag">${esc(p)}${ed?ico("del",`data-delpayer="${r.s.id}:${esc(p)}"`,"הסרת המשלם"):""}</span>`).join(" ")}</p>`:""}
    <table><thead><tr><th>תאריך</th><th class="n">סכום</th><th>איך שולם</th><th>פרטים</th>${ed?"<th></th>":""}</tr></thead><tbody>
    ${pays.map(p=>`<tr><td><span class="num">${grDate(p.date)}</span> <span class="muted" style="font-size:.8rem">${heDate(p.date)}</span></td><td class="n num">${ils(p.amount)}</td><td>${esc(p.method)}</td><td class="muted">${esc(p.note)}</td>${ed?`<td>${p.kind==="manual"?ico("del",`data-delsp="${r.s.id}:${p.id}"`,"מחיקת התשלום"):ico("del",`data-unlinkstu="${p.id}"`,"ניתוק מהבחור")}</td>`:""}</tr>`).join("")||`<tr><td colspan="5" class="muted">עדיין לא נרשמו תשלומים</td></tr>`}
    </tbody></table>
    ${ed?`<form class="form" data-addsp="${r.s.id}">
      <label for="spDate-${r.s.id}">תאריך<input id="spDate-${r.s.id}" type="date" value="${iso(TODAY)}" required></label>
      <label for="spAmt-${r.s.id}">סכום<input id="spAmt-${r.s.id}" type="number" min="1" value="${r.s.fee}" required></label>
      <label for="spMeth-${r.s.id}">איך שולם<select id="spMeth-${r.s.id}">${METHODS.map(m=>`<option>${m}</option>`).join("")}</select></label>
      <label for="spNote-${r.s.id}">הערה<input id="spNote-${r.s.id}"></label>
      <button class="btn" type="submit">הוספת תשלום ידני</button>
      <button class="btn danger" type="button" data-delstu="${r.s.id}">הסרת הבחור מהרשימה</button></form>
      <p class="hint">תשלום שנכנס בנדרים או בבנק לא צריך להזין כאן – משייכים אותו לבחור, והוא מופיע לבד.</p>`:""}
  </td></tr>`};
  return `${ed?"":`<div class="readonly-banner">צפייה בלבד.</div>`}
  <section class="sheet"><div class="sheet-head"><h2>שכר לימוד ${YEAR}</h2><span class="hint">התשלום ב־${DUE_DAY} לכל חודש · עד היום: ${DUE_MONTHS} חודשים</span></div>
    <div class="summary"><div><div class="label">צריך היה להיכנס עד היום</div><div class="value num">${ils(due)}</div></div><div><div class="label">שולם</div><div class="value num">${ils(paid)}</div></div><div><div class="label">חסר · ${behind.length} בחורים</div><div class="value num" style="color:var(--bad)">${ils(behind.reduce((s,r)=>s+r.bal,0))}</div></div></div></section>
  ${unlinked.length?`<section class="sheet"><div class="sheet-head"><h2>תשלומי שכר לימוד שעוד לא שויכו</h2><span class="chip warn">${unlinked.length}</span>
      <button class="linkbtn" data-togunlinked>${showUnlinked?"הסתרה":"הצגה"}</button></div>
    ${showUnlinked?(S.students.length?`<p class="hint" style="margin-top:0">בוחרים לכל תשלום של איזה בחור הוא. המערכת זוכרת את המשלם, ומשייכת לבד גם את שאר התשלומים שלו – עכשיו ובעתיד.</p>
    <div class="tbl-wrap"><table><thead><tr><th>תאריך</th><th>משלם</th><th class="n">סכום</th><th>של איזה בחור</th></tr></thead><tbody>
    ${unlinked.slice(0,60).map(x=>`<tr><td><span class="num">${grDate(x.date)}</span></td><td>${esc(payerOf(x)||x.desc)}</td><td class="n num">${ils(x.amount)}</td><td>${ed?`<select data-linkstu="${x.id}" aria-label="של איזה בחור">${stuOpts("")}</select>`:""}</td></tr>`).join("")}
    </tbody></table></div>${unlinked.length>60?`<p class="hint">מוצגים 60 הראשונים. אחרי השיוך יופיעו הבאים.</p>`:""}`:'<p class="muted">קודם מוסיפים את הבחורים למטה, ואז משייכים כאן את התשלומים.</p>'):""}</section>`:""}
  <section class="sheet">
  ${ed?`<details class="addbox inner" data-open="stu"${openAdd.has("stu")?" open":""}><summary><span class="plus">+</span> הוספת בחור</summary><form class="form" id="stuForm">
    <label for="sName">שם הבחור<input id="sName" required></label>
    <label for="sShiur">שיעור<select id="sShiur">${SHIURIM.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select></label>
    <label for="sFee">תשלום חודשי<input id="sFee" type="number" min="0" value="800" required></label>
    <button class="btn" type="submit">הוספת בחור</button></form></details>`:""}
  <div class="filters"><input type="search" id="sq" placeholder="חיפוש לפי שם" value="${esc(SF.q)}" aria-label="חיפוש בחור">
    <select id="sfShiur" aria-label="שיעור"><option value="all">כל השיעורים</option>${SHIURIM.map(([v,l])=>`<option value="${v}"${SF.shiur===v?" selected":""}>${l}</option>`).join("")}</select>
    ${[["all","כולם"],["late","חייבים"],["ok","משולם"]].map(([k,l])=>`<button data-sf="${k}" aria-pressed="${SF.f===k}">${l}</button>`).join("")}</div>
  <div class="tbl-wrap"><table><thead><tr><th></th><th>שם</th><th>שיעור</th><th class="n">חודשי</th><th class="n">צריך עד היום</th><th class="n">שולם</th><th class="n">יתרה</th><th>מצב</th>${ed?"<th></th>":""}</tr></thead><tbody>
  ${list.map(r=>{const open=openStu.has(r.s.id);return `<tr><td><button class="tog" data-togs="${r.s.id}" aria-expanded="${open}" aria-label="הצגת תשלומים"><span>◀</span></button></td>
    <td><div class="namerow">${esc(r.s.name)}${noteBtn("stu",r.s.id,r.s.note)}</div>${noteUI("stu",r.s.id,r.s.note)}</td>
    <td>${ed?`<select data-sshiur="${r.s.id}" aria-label="שיעור">${SHIURIM.map(([v,l])=>`<option value="${v}"${(r.s.shiur||"")===v?" selected":""}>${l}</option>`).join("")}</select>`:esc(r.s.shiur||"—")}</td>
    <td class="n">${ed?`<input class="small num" data-sfee="${r.s.id}" type="number" min="0" value="${r.s.fee}" aria-label="תשלום חודשי ${esc(r.s.name)}">`:`<span class="num">${ils(r.s.fee)}</span>`}</td>
    <td class="n num">${ils(r.due)}</td><td class="n num">${ils(r.paid)}</td><td class="n num">${ils(r.bal)}</td><td>${status(r)}</td>${ed?"<td></td>":""}</tr>${open?panel(r):""}`}).join("")||`<tr><td colspan="${cols}" class="muted">${S.students.length?"לא נמצאו בחורים":"עדיין לא הוגדרו בחורים"}</td></tr>`}
  </tbody></table></div></section>`;
}

// ---------- donors ----------
const D_STATUS={active:["הוראת קבע פעילה","good"],failed:["נכשלה","bad"],ended:["הסתיימה","neutral"],once:["חד פעמי","neutral"]};
function donorTx(d){
  const [k,...rest]=d.id.split("_"),key=rest.join("_");
  return S.tx.filter(x=>{const n=x.nedarim;if(!n)return false;
    if(k==="k")return n.type==="credit"&&n.kevaId===key;
    if(k==="m")return n.type==="masav"&&n.kevaId===key;
    return !n.kevaId&&n.client===d.name}).sort((a,b)=>a.date<b.date?1:-1);
}
function viewDonors(){
  const ed=can().edit,q=DF.q.trim();
  if(!S.donors.length)return `<section class="sheet"><div class="sheet-head"><h2>תורמים</h2><span class="chip warn">ממתין לסנכרון מנדרים פלוס</span></div>
    <p class="muted">הרשימה מתמלאת אוטומטית מנדרים פלוס.</p></section>`;
  const act=S.donors.filter(d=>d.status==="active"),failed=S.donors.filter(d=>d.status==="failed");
  const list=S.donors.filter(d=>(!q||d.name.includes(q)||(d.city||"").includes(q))&&(DF.f==="all"||d.status===DF.f)).sort((a,b)=>b.ytd-a.ytd);
  const shown=list.slice(0,150);
  return `<section class="sheet"><div class="sheet-head"><h2>תורמים</h2><span class="hint">מתעדכן אוטומטית מנדרים פלוס</span></div>
    <div class="summary"><div><div class="label">הוראות קבע פעילות · ${act.length}</div><div class="value num">${ils(act.reduce((s,d)=>s+(d.monthly||0),0))} לחודש</div></div>
    <div><div class="label">הוראות קבע שנכשלו</div><div class="value num" style="color:${failed.length?"var(--bad)":"var(--good)"}">${failed.length}</div><div class="hint">${failed.length?`הכנסה חודשית שנעצרה: <span class="num">${ils(failed.reduce((s,d)=>s+(d.monthly||0),0))}</span>`:"הכול תקין"}</div></div>
    <div><div class="label">נתרם השנה (הוראות קבע ו־30 התורמים הגדולים)</div><div class="value num">${ils(S.donors.reduce((s,d)=>s+(d.ytd||0),0))}</div></div></div></section>
  <section class="sheet">
  <div class="filters"><input type="search" id="dq" placeholder="חיפוש לפי שם או עיר" value="${esc(DF.q)}" aria-label="חיפוש תורם">
    ${[["all","כולם"],["active","קבע פעיל"],["failed","נכשלו"],["ended","הסתיימו"],["once","חד פעמי"]].map(([k,l])=>`<button data-df="${k}" aria-pressed="${DF.f===k}">${l}</button>`).join("")}</div>
  ${ed&&selDonors.size?`<div class="bulkbar"><b>${selDonors.size} נבחרו</b><button class="btn small" data-bulkdonor="handled">סימון שטופל</button><button class="linkbtn" data-bulkdonor="none">ביטול הבחירה</button></div>`:""}
  <div class="tbl-wrap"><table><thead><tr><th class="c-chk">${ed?`<input type="checkbox" data-selalldonors${list.length&&list.every(d=>selDonors.has(d.id))?" checked":""} aria-label="בחירת כולם">`:""}</th><th></th><th>תורם</th><th>סוג</th><th class="n">חודשי</th><th class="n">השנה</th><th>תרומה אחרונה</th><th>מה לעשות</th></tr></thead><tbody>
  ${shown.map(d=>{const open=openDonor.has(d.id);return `<tr class="${selDonors.has(d.id)?"picked":""}"><td class="c-chk">${ed?`<input type="checkbox" data-seldonor="${d.id}"${selDonors.has(d.id)?" checked":""} aria-label="בחירה">`:""}</td>
    <td><button class="tog" data-togd="${esc(d.id)}" aria-expanded="${open}" aria-label="הצגת התרומות"><span>◀</span></button></td>
    <td><div class="namerow">${esc(d.name)}${noteBtn("donor",d.id,d.myNote)}</div><div class="muted" style="font-size:.8rem">${esc([d.city,d.via,d.groupe].filter(Boolean).join(" · "))}</div>${noteUI("donor",d.id,d.myNote)}</td>
    <td><span class="chip ${D_STATUS[d.status][1]}">${D_STATUS[d.status][0]}</span></td>
    <td class="n num">${d.monthly?ils(d.monthly):"—"}</td><td class="n num">${ils(d.ytd||0)}</td>
    <td><span class="num">${grDate(d.last)}</span></td>
    <td>${d.note?`<div style="font-size:.85rem">${esc(d.note)}</div>`:""}${d.status==="failed"||d.status==="ended"?(d.handled?'<span class="chip good">✓ טופל</span>':(ed?`<button class="btn ghost small" data-handled="${esc(d.id)}">סימון שטופל</button>`:'<span class="chip warn">ממתין לטיפול</span>')):""}</td></tr>
    ${open?`<tr class="panel"><td colspan="8"><h3>התרומות של ${esc(d.name)} השנה</h3><table><thead><tr><th>תאריך</th><th>תיאור</th><th class="n">סכום</th></tr></thead><tbody>${donorTx(d).map(x=>`<tr><td><span class="num">${grDate(x.date)}</span></td><td>${esc(x.desc)}</td><td class="n num">${ils(x.amount)}</td></tr>`).join("")||'<tr><td colspan="3" class="muted">אין תרומות השנה</td></tr>'}</tbody></table></td></tr>`:""}`}).join("")||`<tr><td colspan="8" class="muted">לא נמצאו תורמים</td></tr>`}
  </tbody></table></div>${list.length>shown.length?`<p class="hint">מוצגים 150 מתוך ${list.length}. אפשר לחפש לפי שם.</p>`:""}</section>`;
}

// ---------- reports: any date range ----------
let RL={key:"",tx:[],meo:[],loading:false}; // transactions of other years, loaded when the range reaches them
function rangeLists(from,to){
  const inYear=d=>d>=`${YEAR}-01-01`&&d<=`${YEAR}-12-31`,key=from+"|"+to;
  const needOther=from<`${YEAR}-01-01`||to>`${YEAR}-12-31`;
  if(needOther&&RL.key!==key&&!RL.loading){RL={key,tx:[],meo:[],loading:true};
    W.loadRange(from,to).then(r=>{RL={key,tx:r.tx.filter(x=>!inYear(x.date)),meo:r.meo.filter(e=>!inYear(e.date)),loading:false};render()},()=>{RL.loading=false;render()})}
  const extra=needOther&&RL.key===key?RL:{tx:[],meo:[]};
  return {tx:[...S.tx,...extra.tx].filter(x=>x.date>=from&&x.date<=to),meo:[...S.meorot.entries,...extra.meo].filter(e=>e.date>=from&&e.date<=to),loading:needOther&&RL.loading};
}
function reportData(from,to){
  const L=rangeLists(from,to),items=allItems(),byCat={};let inc=0,exp=0,unc=0;
  L.tx.forEach(x=>{if(OUTSIDE.has(x.cat))return;if(!x.cat)unc++;const k=kindOf(x,items),v=k==="income"?x.amount:-x.amount;if(k==="income")inc+=v;else exp+=v;if(x.cat)byCat[x.cat]=(byCat[x.cat]||0)+v});
  for(let d=new Date(from.slice(0,7)+"-01T12:00:00");iso(d)<=to;d.setMonth(d.getMonth()+1)){const s=iso(d);if(s>=from&&s<=iso(TODAY)){exp+=S.meorot.rent;byCat.c_rent=(byCat.c_rent||0)+S.meorot.rent}}
  L.meo.forEach(e=>{if(e.type==="received"){inc+=e.amount;byCat[e.cat]=(byCat[e.cat]||0)+e.amount}else if(e.type==="charge"){exp+=e.amount;byCat[e.cat]=(byCat[e.cat]||0)+e.amount}});
  const days=Math.max(1,Math.round((new Date(to)-new Date(from))/864e5)+1);
  const line=i=>({name:i.name,bud:annual(i)*days/365,act:byCat[i.id]||0});
  return {A:{inc,exp,unc,byCat},tx:L.tx.sort((a,b)=>a.date<b.date?-1:1),meo:L.meo,loading:L.loading,days,
    income:S.budget.income.map(line),groups:S.budget.expenses.map(g=>({group:g.group,items:g.items.map(line)})),
    noRcpt:L.tx.filter(x=>x.amount<0&&!OUTSIDE.has(x.cat)&&!x.rcpt&&!x.rcptPaper).length,
    debtPaidP:S.debts.reduce((s,d)=>s+d.repayments.filter(r=>r.date>=from&&r.date<=to).reduce((a,r)=>a+r.amount,0)+debtTx(d).filter(x=>x.date>=from&&x.date<=to).reduce((a,x)=>a-x.amount,0),0),
    debtLeft:S.debts.reduce((s,d)=>s+Math.max(0,d.amount-debtPaid(d)),0),
    building:buildingEntries().reduce((s,e)=>s+e.amount,0),meorot:meorotLedger().bal};
}
// inside claude.ai files go through the viewer's save prompt; anywhere else, a plain browser download
let DL=null;try{if(window.claude&&window.claude.use)window.claude.use("downloads").then(x=>DL=x,()=>{})}catch(e){}
async function saveFile(name,blob){
  if(DL){try{await DL.save({filename:name,data:blob})}catch(e){if(!e||e.code!=="declined")alert("לא ניתן להוריד את הקובץ בתצוגה הזו.")}return}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
}
function csvDownload(name,rows){
  const csv="﻿"+rows.map(r=>r.map(c=>{c=String(c??"");return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(",")).join("\r\n");
  saveFile(name,new Blob([csv],{type:"text/csv;charset=utf-8"}));
}
const rangeName=()=>`${grDate(RF.from)} עד ${grDate(RF.to)}`;
function exportTx(){
  const R=reportData(RF.from,RF.to),items=allItems();
  const rows=[["תאריך","תאריך עברי","תיאור","מקור","סעיף","קבוצה","הכנסה","הוצאה","הערה","קבלה"]];
  R.tx.forEach(x=>{const k=kindOf(x,items),i=items[x.cat]||{};rows.push([grDate(x.date),heDate(x.date,true),x.desc,x.source,catName(x.cat,items)||"לא מסווג",OUTSIDE.has(x.cat)?"קופה נפרדת":i.group||"",k==="income"?x.amount:"",k==="income"?"":-x.amount,x.note,x.rcpt?"צורפה":x.rcptPaper?"בנייר":""])});
  R.meo.filter(e=>e.type==="received"||e.type==="charge").forEach(e=>rows.push([grDate(e.date),heDate(e.date,true),e.desc,"ארנק המשכיר",catName(e.cat,items),(items[e.cat]||{}).group||"",e.type==="received"?e.amount:"",e.type==="charge"?e.amount:"",e.note||"",""]));
  csvDownload(`תנועות ${rangeName()}.csv`,rows);
}
function exportSummary(){
  const R=reportData(RF.from,RF.to),rows=[["קבוצה","סעיף","תקציב לתקופה","בפועל","הפרש"]];
  R.income.forEach(l=>rows.push(["הכנסות",l.name,Math.round(l.bud),Math.round(l.act),Math.round(l.act-l.bud)]));
  R.groups.forEach(g=>g.items.forEach(l=>rows.push([g.group,l.name,Math.round(l.bud),Math.round(l.act),Math.round(l.act-l.bud)])));
  rows.push([],["סה״כ הכנסות","","",Math.round(R.A.inc)],["סה״כ הוצאות","","",Math.round(R.A.exp)],["תוצאה","","",Math.round(R.A.inc-R.A.exp)]);
  csvDownload(`סיכום לפי סעיפים ${rangeName()}.csv`,rows);
}
function viewReports(){
  const R=reportData(RF.from,RF.to),A=R.A;
  const diff=(l,isInc)=>{const d=l.act-l.bud,good=isInc?d>=0:d<=0;return `<span class="num" style="color:${Math.abs(d)<1?"var(--muted)":good?"var(--good)":"var(--bad)"}">${d>0?"+":""}${ils(d)}</span>`};
  const rows=(ls,isInc)=>ls.map(l=>`<tr><td>${esc(l.name)}</td><td class="n num">${ils(l.bud)}</td><td class="n num">${ils(l.act)}</td><td class="n">${diff(l,isInc)}</td></tr>`).join("");
  const sumL=ls=>ls.reduce((s,l)=>({bud:s.bud+l.bud,act:s.act+l.act}),{bud:0,act:0});
  const tot=(label,ls,isInc)=>{const t=sumL(ls);return `<tr class="total"><td>${label}</td><td class="n num">${ils(t.bud)}</td><td class="n num">${ils(t.act)}</td><td class="n">${diff(t,isInc)}</td></tr>`};
  const q=(f,t)=>`<button data-range="${f}|${t}">`;
  const y=YEAR,qs=[[`${y}-01-01`,`${y}-03-31`,"רבעון 1"],[`${y}-04-01`,`${y}-06-30`,"רבעון 2"],[`${y}-07-01`,`${y}-09-30`,"רבעון 3"],[`${y}-10-01`,`${y}-12-31`,"רבעון 4"],[`${y}-01-01`,`${y}-12-31`,"כל השנה"],[`${y-1}-01-01`,`${y-1}-12-31`,`שנת ${y-1}`]];
  return `<section class="sheet no-print"><div class="sheet-head"><h2>דוח לרואה חשבון</h2></div>
    <div class="filters">
      <label class="rng">מתאריך <input type="date" id="rFrom" value="${RF.from}"></label><label class="rng">עד תאריך <input type="date" id="rTo" value="${RF.to}"></label>
      ${qs.map(([f,t,l])=>`${q(f,t)}${l}</button>`).join("")}</div>
    <div class="filters"><button data-rep="print">🖨 הדפסה / שמירה כ־PDF</button><button data-rep="tx">⬇ אקסל: כל התנועות</button><button data-rep="sum">⬇ אקסל: סיכום לפי סעיפים</button></div>
    ${R.loading?'<p class="hint">טוען את התנועות של התקופה…</p>':""}</section>
  <section class="sheet" id="report">
    <div class="report-head"><img src="${BRAND.logo}" alt=""><div><h2 style="color:var(--brown)">${esc(BRAND.name)} – דוח כספי</h2><div class="hint">${esc(BRAND.org)} · ${rangeName()} · הופק ב־${grDate(iso(TODAY))}</div></div></div>
    ${miniDash(R.tx.filter(x=>!OUTSIDE.has(x.cat)),false)}
    <div class="tbl-wrap" style="margin-top:14px"><table><thead><tr><th>סעיף</th><th class="n">תקציב לתקופה</th><th class="n">בפועל</th><th class="n">הפרש</th></tr></thead><tbody>
      ${[["הכנסות",R.income,true],...R.groups.map(g=>[g.group,g.items,false])].map(([name,ls,isInc])=>{const k="r:"+name,body=rows(ls,isInc)+tot("סה״כ "+name,ls,isInc);
        // a closed group is only hidden on screen – the printed report always has every line
        return grpHead(k,name,sumL(ls).act,ls.length,4)+(closed.has(k)?body.replace(/<tr(?=[ >])/g,"<tr data-fold"):body)}).join("")}
    </tbody></table></div>
    <p class="hint">התקציב לתקופה = התקציב השנתי × ${R.days} ימים / 365. הסיכום בראש הדוח כולל רק תנועות בנק ונדרים; בטבלה נכללים גם שכירות ודתות של המשכיר.</p>
    <h3 style="font-size:1.05rem;color:var(--brown);margin:18px 0 8px">קופות נפרדות (לא נכללות למעלה)</h3>
    <div class="tbl-wrap"><table><tbody>
      <tr><td>החזרי חובות וגמ״חים בתקופה</td><td class="n num">${ils(R.debtPaidP)}</td></tr>
      <tr><td>חובות שנשארו להחזיר</td><td class="n num">${ils(R.debtLeft)}</td></tr>
      <tr><td>יתרה בקרן הבניין</td><td class="n num">${ils(R.building)}</td></tr>
      <tr><td>מאזן מול המשכיר (${R.meorot>=0?"הם חייבים לנו":"אנחנו חייבים להם"})</td><td class="n num">${ils(Math.abs(R.meorot))}</td></tr>
    </tbody></table></div>
    <p class="hint">${R.tx.length} תנועות בתקופה · ${R.noRcpt?`<b>${R.noRcpt} הוצאות בלי קבלה</b>`:"לכל ההוצאות יש קבלה"} · ${A.unc?`${A.unc} תנועות לא מסווגות`:"כל התנועות מסווגות"}</p>
  </section>
  ${viewCompare()}`;
}
// every year is kept; compare any of them, with their average
function viewCompare(){
  const ed=can().edit,past=pastYears(),sel=CMP.sel?past.filter(y=>CMP.sel.has(y)):past,mode=CMP.mode;
  const cur=actuals(),curVal=c=>mode==="same"?(cur.byCM[c]||[]).slice(0,DONE||1).reduce((s,x)=>s+x,0):(cur.byCat[c]||0);
  const avg=c=>{const v=sel.map(y=>yearValue(y,c,mode)).filter(v=>v!=null);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
  const chg=(a,b,goodUp)=>{if(!a)return'<span class="muted">—</span>';const p=(b-a)/a*100,up=p>=0,good=goodUp?up:!up;return `<span class="chip ${Math.abs(p)<3?"neutral":good?"good":"warn"}">${up?"▲":"▼"} ${Math.abs(p).toFixed(0)}%</span>`};
  const manual=y=>!!((S.years||{})[y]||{}).manual;
  const cell=(y,c)=>{const v=yearValue(y,c,mode);
    if(manual(y)&&ed&&mode==="full")return `<td class="n"><input class="small num" data-yv="${y}:${c}" type="number" value="${v??""}" placeholder="להזין" aria-label="${y}"></td>`;
    return `<td class="n num">${v!=null?ils(v):"—"}</td>`};
  const cols=sel.length+4;
  const sumOf=(ids,fn)=>{let any=false,s=0;ids.forEach(c=>{const v=fn(c);if(v!=null){any=true;s+=v}});return any?s:null};
  const row=(label,ids,goodUp,cls)=>{const a=sumOf(ids,avg),b=ids.reduce((s,c)=>s+curVal(c),0);
    return `<tr${cls?` class="${cls}"`:""}><td>${esc(label)}</td>${sel.map(y=>{if(ids.length===1)return cell(y,ids[0]);const v=sumOf(ids,c=>yearValue(y,c,mode));return `<td class="n num">${v!=null?ils(v):"—"}</td>`}).join("")}
      <td class="n num"><b>${a!=null?ils(a):"—"}</b></td><td class="n num">${ils(b)}</td><td>${a!=null?chg(a,b,goodUp):""}</td></tr>`};
  const body=[["הכנסות",S.budget.income,true],...S.budget.expenses.map(g=>[g.group,g.items,false])].map(([name,items,goodUp])=>{const k="c:"+name,ids=items.map(i=>i.id);
    return grpHead(k,name,ids.reduce((s,c)=>s+curVal(c),0),items.length,cols)+(closed.has(k)?"":items.map(i=>row(i.name,[i.id],goodUp)).join("")+row("סה״כ "+name,ids,goodUp,"total"))}).join("");
  return `<section class="sheet no-print"><div class="sheet-head"><h2>השוואה בין שנים</h2></div>
    ${past.length?`<div class="filters"><span class="hint">שנים להשוואה:</span>${past.map(y=>`<button data-cmpy="${y}" aria-pressed="${sel.includes(y)}">${y}${manual(y)?" (ידני)":""}</button>`).join("")}
      <span class="sep"></span><button data-cmpmode="same" aria-pressed="${mode==="same"}">אותה תקופה (ינואר–${MONTHS[Math.max(0,(DONE||1)-1)][0]})</button><button data-cmpmode="full" aria-pressed="${mode==="full"}">שנה מלאה</button></div>
    <div class="tbl-wrap"><table class="cmp"><thead><tr><th>סעיף</th>${sel.map(y=>`<th class="n">${y}</th>`).join("")}<th class="n">ממוצע ${sel.length>1?sel.length+" השנים":""}</th><th class="n">${YEAR}${mode==="full"&&TODAY<YEAR_END?" (עד היום)":""}</th><th></th></tr></thead><tbody>${body}</tbody></table></div>
    <p class="hint">ירוק = שינוי לטובה מול הממוצע, כתום = שינוי לרעה. בשנה שהוזנה ידנית (סכום שנתי בלבד), "אותה תקופה" מחושבת לפי חלק יחסי מהשנה.</p>`
    :`<p class="muted" style="margin-top:0">המערכת שומרת לבד את הנתונים של כל שנה. מהשנה הבאה תופיע כאן השוואה ל־${YEAR}, וממוצע של כל השנים.</p>`}
    ${ed?`<div class="filters" style="margin-top:10px"><span class="hint">שנה שלפני המערכת? אפשר להזין את הסכומים השנתיים שלה מהדוח של רואה החשבון:</span>
      <input type="number" id="addYear" min="2000" max="${YEAR-1}" placeholder="${YEAR-1}" aria-label="שנה" style="width:90px"><button data-act="addyear">הוספת שנה</button></div>`:""}
  </section>`;
}

// ---------- settings ----------
let syncBusy=false,syncMsg="";
function nedarimBox(ed,fmtTs){
  const s=S.sync,r=s&&s.lastResult,errs=r&&r.errors&&r.errors.length?r.errors:null;
  const chip=!s?'<span class="chip warn">ממתין להפעלה</span>':errs?'<span class="chip bad">יש בעיה</span>':'<span class="chip good">מחובר</span>';
  const ruled=new Set(S.rules.map(x=>x.kw.replace(/^·\s*/,""))),groups=(s&&s.groups||[]).filter(g=>!ruled.has(g));
  return `<section class="sheet"><div class="sheet-head"><h2>נדרים פלוס</h2>${chip}</div>
    <p class="muted" style="margin-top:0">${esc(BRAND.nedarim)} · סנכרון אוטומטי כל 3 שעות</p>
    ${s?`<p style="margin:0 0 6px">סנכרון אחרון: <span class="num">${fmtTs(s.lastRun)}</span>${r?` · ${r.newTx} תנועות חדשות`:""}</p>`:""}
    ${errs?`<div class="note" style="margin-bottom:8px">${errs.map(esc).join("<br>")}</div>`:""}
    ${ed?`<button class="btn ghost small" data-act="syncnow"${syncBusy?" disabled":""}>${syncBusy?"מסנכרן… (עד כמה דקות)":"⟳ סנכרון עכשיו"}</button> <span class="hint">${esc(syncMsg)}</span>`:""}
    <div class="form" style="margin-top:12px"><label>תרומות שהקטגוריה שלהן בנדרים היא שם של בחור או רב (קמפיין)<select data-namescat ${ed?"":"disabled"}>${catOptions(S.nedarimNamesCat||"","income",true)}</select></label></div>
    ${ed&&groups.length?`<p class="hint" style="margin-bottom:4px">קטגוריות בנדרים שעוד אין להן כלל סיווג:</p><div class="filters">${groups.map(g=>`<button data-rulekw="· ${esc(g)}">+ ${esc(g)}</button>`).join("")}</div>`:""}
  </section>`;
}
function viewSettings(){
  const ed=can().edit,items=allItems();
  const fmtTs=ts=>{const d=new Date(ts);return isNaN(d)?"":`${grDate(iso(d))} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};
  const qs=S.questions||[];
  return `<div class="conn">
  <section class="sheet"><div class="sheet-head"><h2>יתרות בנק</h2><span class="hint">עודכן ב־${grDate(S.bankAsOf)}</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>בנק</th><th>שימוש</th><th class="n">יתרה</th></tr></thead><tbody>
    ${S.accounts.map(a=>`<tr><td>${esc(a.name)}</td><td class="muted">${esc(a.note)}</td><td class="n">${ed?`<input class="small num" data-bal="${a.id}" type="number" value="${a.balance}" aria-label="יתרה ב${esc(a.name)}">`:`<span class="num">${ils(a.balance)}</span>`}</td></tr>`).join("")}</tbody></table></div>
    <p class="hint">היתרה משמשת לתחזית התזרים.</p></section>
  ${nedarimBox(ed,fmtTs)}
  </div>
  <section class="sheet"><div class="sheet-head"><h2>כללי סיווג אוטומטיים</h2><span class="hint">אם התיאור מכיל את המילה, התנועה משויכת לסעיף</span></div>
    ${ed?`<form class="form" id="ruleForm"><label for="rKw">מילה בתיאור<input id="rKw" required placeholder="לדוגמה: סופר"></label><label for="rCat">סעיף<select id="rCat" required>${catOptions("")}</select></label><button class="btn" type="submit">הוספת כלל</button></form>`:""}
    <div class="tbl-wrap"><table><thead><tr><th>כשהתיאור מכיל</th><th>שייך לסעיף</th>${ed?"<th></th>":""}</tr></thead><tbody>
    ${S.rules.map((r,i)=>`<tr><td>״${esc(r.kw)}״</td><td>${esc(catName(r.cat,items)||r.cat)}</td>${ed?`<td>${ico("del",`data-delrule="${i}"`,"מחיקת הכלל")}</td>`:""}</tr>`).join("")}
    </tbody></table></div></section>
  <section class="sheet"><div class="sheet-head"><h2>משתמשים והרשאות</h2><span class="hint">ראש הישיבה, מנהל הישיבה, המזכיר והמתכנת יכולים הכול · רואה חשבון רק צופה</span></div>
    ${ed?`<form class="form" id="userForm">
      <label for="uName">שם<input id="uName" required></label>
      <label for="uEmail">כתובת מייל<input id="uEmail" type="email" required dir="ltr"></label>
      <label for="uRole">תפקיד<select id="uRole">${Object.entries(ROLE_NAMES).map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select></label>
      <button class="btn" type="submit">הוספת משתמש</button></form>`:""}
    <div class="tbl-wrap"><table><thead><tr><th>שם</th><th>מייל</th><th>תפקיד</th>${ed?"<th></th>":""}</tr></thead><tbody>
    <tr><td>חשבון הישיבה</td><td dir="ltr" style="text-align:right">${esc(BRAND.owner)}</td><td>מנהל ראשי (קבוע)</td>${ed?"<td></td>":""}</tr>
    ${S.users.map(u=>`<tr><td>${esc(u.name)}</td><td dir="ltr" style="text-align:right">${esc(u.id)}</td><td>${ed&&u.id!==me.email?`<select data-urole="${esc(u.id)}" aria-label="תפקיד">${Object.entries(ROLE_NAMES).map(([k,l])=>`<option value="${k}"${u.role===k?" selected":""}>${l}</option>`).join("")}</select>`:esc(ROLE_NAMES[u.role]||u.role)}</td>
      ${ed?`<td>${u.id!==me.email?ico("del",`data-deluser="${esc(u.id)}"`,"הסרת המשתמש"):""}</td>`:""}</tr>`).join("")}
    </tbody></table></div></section>
  ${qs.length&&(role==="dev"||me.email===OWNER)?`<section class="sheet"><div class="sheet-head"><h2>שאלות למתכנת</h2></div>
    <div class="tbl-wrap"><table><thead><tr><th>מתי</th><th>מי</th><th>מסך</th><th>שאלה</th><th>קבצים</th><th>מייל</th></tr></thead><tbody>
    ${qs.map(x=>`<tr><td><span class="num">${fmtTs(x.ts)}</span></td><td>${esc(x.name||x.email)}</td><td>${esc(x.page)}</td><td style="white-space:pre-wrap">${esc(x.text)}</td><td>${(x.files||[]).length}</td><td>${x.emailed?'<span class="chip good">נשלח</span>':x.emailError?`<span class="chip warn" title="${esc(x.emailError)}">לא נשלח</span>`:'<span class="chip neutral">ממתין</span>'}</td></tr>`).join("")}
    </tbody></table></div></section>`:""}
  <section class="sheet"><div class="sheet-head"><h2>יומן שינויים</h2><span class="hint">כל שינוי נרשם: מי, מה ומתי</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>מתי</th><th>מי</th><th>מה השתנה</th></tr></thead><tbody>
    ${S.log.map(l=>`<tr><td><span class="num">${fmtTs(l.ts)}</span></td><td>${esc(l.name||l.email)}</td><td>${esc(l.msg)}</td></tr>`).join("")||`<tr><td colspan="3" class="muted">עדיין לא בוצעו שינויים.</td></tr>`}
    </tbody></table></div>
    ${S.logMore?`<p style="text-align:center"><button class="btn ghost" data-act="morelog">טעינת עוד 50</button></p>`:""}</section>`;
}

// ---------- question to the developer: text, the screen it's about, screenshots and screen recordings ----------
let askFiles=[],rec=null;
export function openAsk(){
  askFiles=[];
  const page=(VIEWS.find(v=>v[0]===current().v)||[])[1]||"";
  const canRec=!!(navigator.mediaDevices&&navigator.mediaDevices.getDisplayMedia&&window.MediaRecorder);
  showViewer(`<form id="askForm" class="askform"><h2 style="color:var(--brown);margin:0 0 4px">שאלה למתכנת</h2>
    <p class="hint" style="margin:0 0 8px">המסך שאת/ה נמצא/ת בו יצורף לבד: <b>${esc(page)}</b></p>
    <label for="askText">מה השאלה או מה לא עובד?<textarea id="askText" rows="5" required></textarea></label>
    <div class="filters">
      <label class="btn ghost small">📷 צילומי מסך / סרטון<input type="file" id="askFile" accept="image/*,video/*" multiple hidden></label>
      ${canRec?`<button type="button" class="btn ghost small" id="askShot">🖼 צילום המסך עכשיו</button><button type="button" class="btn ghost small" id="askRec">⏺ הקלטת מסך</button>`:""}
    </div>
    <div id="askList" class="hint"></div>
    <div class="err" id="askErr" role="alert"></div>
    <button class="btn" type="submit" id="askSend">שליחה</button></form>`);
  const list=()=>{document.getElementById("askList").innerHTML=askFiles.map((f,i)=>`<span class="tag">${esc(f.name)} · ${(f.size/1048576).toFixed(1)}MB <button type="button" class="linkbtn" data-rmask="${i}">הסרה</button></span>`).join(" ")};
  const add=f=>{if(f.size>200*1048576){document.getElementById("askErr").textContent=`${f.name} גדול מ־200MB`;return}askFiles.push(f);list()};
  document.getElementById("askFile").onchange=e=>{[...e.target.files].forEach(add);e.target.value=""};
  document.getElementById("askList").onclick=e=>{const b=e.target.closest("[data-rmask]");if(b){askFiles.splice(+b.dataset.rmask,1);list()}};
  const grab=async()=>{const st=await navigator.mediaDevices.getDisplayMedia({video:true});const v=document.createElement("video");v.srcObject=st;v.muted=true;await v.play();await new Promise(r=>setTimeout(r,300));
    const c=document.createElement("canvas");c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d").drawImage(v,0,0);st.getTracks().forEach(t=>t.stop());
    c.toBlob(b=>add(new File([b],`צילום מסך ${askFiles.length+1}.png`,{type:"image/png"})),"image/png")};
  const shot=document.getElementById("askShot");if(shot)shot.onclick=()=>grab().catch(()=>{});
  const rb=document.getElementById("askRec");
  if(rb)rb.onclick=async()=>{
    if(rec){rec.stop();return}
    try{const st=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true}),chunks=[];
      rec=new MediaRecorder(st);rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
      rec.onstop=()=>{st.getTracks().forEach(t=>t.stop());rec=null;rb.textContent="⏺ הקלטת מסך";add(new File([new Blob(chunks,{type:"video/webm"})],`הקלטת מסך ${askFiles.length+1}.webm`,{type:"video/webm"}))};
      st.getVideoTracks()[0].onended=()=>rec&&rec.state!=="inactive"&&rec.stop();
      rec.start(1000);rb.textContent="⏹ עצירת ההקלטה"}catch(e){}};
  document.getElementById("askForm").onsubmit=e=>{e.preventDefault();const btn=document.getElementById("askSend");btn.disabled=true;btn.textContent="שולח…";
    W.sendQuestion({text:document.getElementById("askText").value.trim(),page,hash:location.hash,year:YEAR,files:askFiles})
      .then(()=>showViewer('<h2 style="color:var(--brown)">נשלח ✓</h2><p>השאלה נשלחה למתכנת, יחד עם הקבצים.</p>'),
        err=>{btn.disabled=false;btn.textContent="שליחה";document.getElementById("askErr").textContent="השליחה נכשלה: "+(err.message||err)})};
}

// ---------- render & events ----------
const app=document.getElementById("app"),nav=document.getElementById("nav"),tip=document.getElementById("tip"),bnav=document.getElementById("bnav"),more=document.getElementById("more");
const BOTTOM=["dashboard","transactions","budget","debts"],SHORT={dashboard:"ראשי",debts:"חובות"};
const ICONS={
  dashboard:"M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z",
  transactions:"M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3 5 6.99h3V14h2V6.99h3L9 3z",
  budget:"M11 2v20c-5.07-.5-9-4.79-9-10s3.93-9.5 9-10zm2.03 0v8.99H22c-.47-4.74-4.24-8.52-8.97-8.99zm0 11.01V22c4.74-.47 8.5-4.25 8.97-8.99h-8.97z",
  debts:"M4 10h3v7H4zm6.5 0h3v7h-3zM2 19h20v3H2zm15-9h3v7h-3zm-5-9L2 6v2h20V6z",
  more:"M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
};
// each cell remembers its column heading, so on a phone a table row can be shown as a labelled card
function cardLabels(){
  if(!app.querySelectorAll)return;
  app.querySelectorAll("table").forEach(t=>{
    const hs=[...t.querySelectorAll(":scope>thead th")].map(th=>th.textContent.trim());if(!hs.length)return;
    t.classList.add("cards");
    t.querySelectorAll(":scope>tbody>tr").forEach(tr=>{let i=0;[...tr.children].forEach(td=>{const span=+td.getAttribute("colspan")||1;if(span===1&&hs[i])td.dataset.label=hs[i];i+=span})});
  });
}
bnav&&bnav.addEventListener("click",e=>{if(e.target.closest("#moreBtn")){more.hidden=false;e.target.closest("#moreBtn").setAttribute("aria-expanded","true")}});
more&&more.addEventListener("click",e=>{if(e.target===more||e.target.closest("a"))more.hidden=true});
let wasPhone=isPhone();addEventListener("resize",()=>{if(isPhone()!==wasPhone){wasPhone=isPhone();render()}});
function current(){let v=(location.hash||"").slice(1);const r=can();const allowed=r.views==="all"?VIEWS.map(x=>x[0]):r.views;if(!allowed.includes(v))v=allowed[0];return {v,allowed}}
export function render(){
  if(!S||!role)return;
  const a=document.activeElement,fid=focusAfter||(a&&a.id),sel=a&&a.id===fid&&"selectionStart" in a?[a.selectionStart,a.selectionEnd]:null;
  const {v,allowed}=current(),unc=S.tx.filter(x=>!x.cat).length;
  nav.innerHTML=VIEWS.filter(x=>allowed.includes(x[0])).map(([k,l])=>`<a href="#${k}"${k===v?' aria-current="page"':""}>${l}${k==="transactions"&&unc&&can().edit?`<span class="count">${unc}</span>`:""}</a>`).join("");
  const ok=k=>allowed.includes(k),inMore=!BOTTOM.includes(v);
  bnav.hidden=false;
  bnav.innerHTML=BOTTOM.filter(ok).map(k=>`<a href="#${k}"${k===v?' aria-current="page"':""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[k]}"/></svg>${SHORT[k]||VIEWS.find(x=>x[0]===k)[1]}${k==="transactions"&&unc&&can().edit?`<span class="count">${unc}</span>`:""}</a>`).join("")
    +`<button type="button" id="moreBtn"${inMore?' aria-current="page"':""} aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS.more}"/></svg>${inMore?esc(VIEWS.find(x=>x[0]===v)[1]):"עוד"}</button>`;
  document.getElementById("moreList").innerHTML=VIEWS.filter(x=>ok(x[0])&&!BOTTOM.includes(x[0])).map(([k,l])=>`<a href="#${k}"${k===v?' aria-current="page"':""}>${l}<span aria-hidden="true">‹</span></a>`).join("");
  const banner=YEAR!==THIS_YEAR?`<div class="readonly-banner">את/ה צופה בשנת <b>${YEAR}</b>. <a href="?" style="color:var(--gold)">חזרה ל־${THIS_YEAR}</a></div>`:"";
  app.innerHTML=banner+({dashboard:viewDashboard,budget:viewBudget,transactions:viewTransactions,students:viewStudents,donors:viewDonors,debts:viewDebts,meorot:viewMeorot,building:viewBuilding,reports:viewReports,settings:viewSettings}[v])();
  cardLabels();
  const f=fid&&document.getElementById(fid);
  if(f){f.focus();if(sel)try{f.setSelectionRange(...sel)}catch(e){}else if(focusAfter&&f.select)f.select()}
  focusAfter=null;
}
// main.js hands over the live data and the writer once someone is signed in
export function boot(ctx){({S,role,me,W}=ctx)}
export let OWNER="";
document.getElementById("today").textContent=grDate(iso(TODAY))+(heFmt?" · "+heDate(TODAY,true):"");
addEventListener("hashchange",()=>{render();scrollTo(0,0)});
const findList=k=>k==="inc"?S.budget.income:S.budget.expenses[+k.slice(1)].items;
const findItem=id=>{for(const g of [...S.budget.expenses.map(g=>g.items),S.budget.income])for(const i of g)if(i.id===id)return i};
const groupOf=id=>S.budget.expenses.find(g=>g.items.some(i=>i.id===id));
// every change goes to the database and to the change log.
// changes: "meta" (budget/settings of the year), [collection, object] to save, [collection, id, "del"] to delete
const commit=(msg,...changes)=>{
  if(!can().edit)return;
  const seen=new Set();
  changes.forEach(c=>{const k=c==="meta"?"meta":c[0]+"/"+(c[2]==="del"?c[1]:c[1].id);if(seen.has(k))return;seen.add(k);c==="meta"?W.meta():c[2]==="del"?W.del(c[0],c[1]):W.put(c[0],c[1])});
  if(msg)W.log(msg);
  render();
};
const UTIL={elec:"חשמל",water:"מים"},FIELD={monthly:"חודשי",months:"חודשים",annual:"שנתי",unit:"לאברך"};
const showViewer=html=>{document.getElementById("vbody").innerHTML=html;document.getElementById("viewer").hidden=false;const f=document.querySelector("#vbody textarea,#vclose");if(f)f.focus()};
document.getElementById("vclose").addEventListener("click",()=>{if(rec)rec.stop();document.getElementById("viewer").hidden=true});
document.getElementById("viewer").addEventListener("click",e=>{if(e.target.id==="viewer"&&!rec)e.target.hidden=true});
addEventListener("keydown",e=>{if(e.key==="Escape"&&!rec)document.getElementById("viewer").hidden=true});
// photos are shrunk before saving; a database document holds up to about 1MB
function readReceipt(file){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{
  if(!file.type.startsWith("image/"))return file.size>700000?rej("big"):res({name:file.name,type:file.type,data:r.result});
  const img=new Image();img.onerror=rej;img.onload=()=>{const k=Math.min(1,1400/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext("2d").drawImage(img,0,0,c.width,c.height);res({name:file.name,type:"image/jpeg",data:c.toDataURL("image/jpeg",.7)})};img.src=r.result};r.readAsDataURL(file)})}
// classification: the yeshiva's rules, then donations named after a bachur / rav (the Purim campaign)
function classify(x){
  const r=S.rules.find(r=>r.kw&&(x.desc||"").includes(r.kw));if(r)return r.cat;
  const g=x.nedarim&&x.nedarim.groupe,known=new Set((S.sync&&S.sync.groups)||[]);
  if(g&&known.size&&!known.has(g)&&S.nedarimNamesCat)return S.nedarimNamesCat;
  return "";
}
// link a tuition payment to a student; the payer is remembered so the rest of their payments follow
function linkStudent(x,sid){
  const ch=[];x.studentId=sid||null;ch.push(["tx",x]);
  const s=S.students.find(s=>s.id===sid),payer=payerOf(x);
  if(s&&payer){if(!(s.payers||[]).includes(payer)){s.payers=[...(s.payers||[]),payer];ch.push(["students",s])}
    S.tx.forEach(y=>{if(y!==x&&!y.studentId&&isTuition(y)&&payerOf(y)===payer){y.studentId=sid;ch.push(["tx",y])}})}
  return ch;
}

app.addEventListener("click",e=>{
  const t=e.target.closest("button,a");if(!t)return;const d=t.dataset;
  if(d.act==="syncnow"){syncBusy=true;syncMsg="";render();
    W.syncNow().then(r=>{syncMsg=`הסתיים: ${r.newTx} תנועות חדשות`},e=>{syncMsg=e.code==="functions/resource-exhausted"?"הסנכרון האחרון היה לפני פחות מ־10 דקות":"הסנכרון נכשל: "+(e.message||"")}).finally(()=>{syncBusy=false;render()})}
  else if(d.act==="morelog"){W.moreLog()}
  else if(d.act==="addyear"){const y=+document.getElementById("addYear").value;if(!(y>=2000&&y<YEAR)){alert("שנה לא תקינה");return}
    if((S.years||{})[y]){alert("כבר יש נתונים לשנה הזו");return}const doc={id:String(y),year:y,manual:true,byCat:{}};S.years[y]=doc;CMP.mode="full";commit(`השוואה: נוספה שנת ${y} להזנה ידנית`,["years",doc])}
  else if(d.cmpy){const y=+d.cmpy,past=pastYears();CMP.sel=CMP.sel||new Set(past);CMP.sel.has(y)?CMP.sel.delete(y):CMP.sel.add(y);render()}
  else if(d.cmpmode){CMP.mode=d.cmpmode;render()}
  else if(d.range){[RF.from,RF.to]=d.range.split("|");render()}
  else if(d.rulekw){const kw=document.getElementById("rKw");if(kw){kw.value=d.rulekw;document.getElementById("rCat").focus();kw.scrollIntoView({block:"center"})}}
  else if(d.grp){closed.has(d.grp)?closed.delete(d.grp):closed.add(d.grp);saveClosed();render()}
  else if(d.grpall){d.keys.split("|").forEach(k=>d.grpall==="close"?closed.add(k):closed.delete(k));saveClosed();render()}
  else if(d.src){TF.src=d.src;txShown=100;render()}
  else if(d.delm){if(!confirm("למחוק את התנועה?"))return;const m=S.meorot.entries.find(x=>x.id===d.delm);S.meorot.entries=S.meorot.entries.filter(x=>x.id!==d.delm);commit(`המשכיר: נמחקה התנועה "${m.desc}" (${ils(m.amount)})`,["meorot",m.id,"del"])}
  else if(d.delb){if(!confirm("למחוק את התנועה?"))return;const b=S.building.entries.find(x=>x.id===d.delb);S.building.entries=S.building.entries.filter(x=>x.id!==d.delb);commit(`קרן הבניין: נמחק "${b.desc}"`,["building",b.id,"del"])}
  else if(d.jump){Object.assign(TF,{month:"all",src:"all",type:"all",cat:"all",q:""});if(d.jump==="unc")TF.src="unc";else TF.cat=d.jump}
  else if(d.act==="rules"){const ch=[];S.tx.forEach(x=>{if(x.cat)return;const c=classify(x);if(c){x.cat=c;ch.push(["tx",x])}});commit(`תנועות: סיווג אוטומטי – ${ch.length} תנועות סווגו`,...ch)}
  else if(d.editnote){noteEdit=d.editnote;focusAfter="note-edit";render()}
  else if(d.delnote){const T=noteTarget(d.delnote);if(T){T.o[T.f]="";commit(`הערה נמחקה: "${T.label}"`,T.ch)}}
  else if(d.additem){const i=it(uid(),"סעיף חדש",0,12),g=d.additem!=="inc"&&S.budget.expenses[+d.additem.slice(1)];if(g&&g.heads!=null){i.per=true;i.unit=0}findList(d.additem).push(i);focusAfter="nm-"+i.id;commit("תקציב: נוסף סעיף חדש","meta")}
  else if(d.delitem){const l=findList(d.list),n=l.findIndex(i=>i.id===d.delitem),name=l[n].name;if(!confirm(`למחוק את הסעיף "${name}"?`))return;l.splice(n,1);commit(`תקציב: נמחק הסעיף "${name}"`,"meta")}
  else if(d.applysug){const i=findItem(d.applysug),s=suggestion(i.id);if(!s)return;applySug(i,s.avg);commit(`תקציב: "${i.name}" – הוחלה ההצעה ${ils(s.avg)} לשנה`,"meta")}
  else if(t.hasAttribute("data-applyall")){if(!confirm("להחליף את כל הסכומים בתקציב בהצעות לפי השנים הקודמות?"))return;let n=0;[...S.budget.expenses.flatMap(g=>g.items),...S.budget.income].forEach(i=>{const s=suggestion(i.id);if(s){applySug(i,s.avg);n++}});commit(`תקציב: הוחלו ${n} הצעות לפי השנים הקודמות`,"meta")}
  else if(d.urg){debtUrg=d.urg;render()}
  else if(d.tog){openDebts.has(d.tog)?openDebts.delete(d.tog):openDebts.add(d.tog);if(editDebt===d.tog&&!openDebts.has(d.tog))editDebt=null;render()}
  else if(d.edit){editDebt=d.edit;openDebts.add(d.edit);focusAfter="eName";render()}
  else if(t.hasAttribute("data-canceledit")){editDebt=null;render()}
  else if(d.deldebt){if(!confirm("למחוק את החוב?"))return;const db=S.debts.find(x=>x.id===d.deldebt);S.debts=S.debts.filter(x=>x.id!==d.deldebt);editDebt=null;commit(`חובות: נמחק החוב "${db.name}"`,["debts",db.id,"del"])}
  else if(d.delrp){const[did,rid]=d.delrp.split(":"),db=S.debts.find(x=>x.id===did),r=db.repayments.find(r=>r.id===rid);if(!confirm("למחוק את ההחזר?"))return;db.repayments=db.repayments.filter(r=>r.id!==rid);commit(`חובות: נמחק החזר של ${ils(r.amount)} מ"${db.name}"`,["debts",db])}
  else if(d.unlinkdebt){const x=S.tx.find(x=>x.id===d.unlinkdebt);x.debtId=null;commit(`חובות: התנועה "${x.desc}" נותקה מהחוב`,["tx",x])}
  else if(d.delrule!=null){const r=S.rules.splice(+d.delrule,1)[0];commit(`כללי סיווג: נמחק הכלל "${r.kw}"`,"meta")}
  else if(d.viewrc){const x=S.tx.find(x=>x.id===d.viewrc);showViewer(`<b>${esc(x.desc)}</b> · <span class="num">${ils(x.amount)}</span><p class="muted">טוען…</p>`);
    W.getReceipt(x.id).then(rc=>{if(!rc){showViewer('<p class="muted">הקובץ לא נמצא.</p>');return}
      showViewer(`<b>${esc(x.desc)}</b> · <span class="num">${ils(x.amount)}</span>`+(rc.type.startsWith("image/")?`<img src="${rc.data}" alt="קבלה: ${esc(x.desc)}">`:`<p><button class="btn ghost" id="vdl">⬇ הורדת הקובץ ${esc(rc.name)}</button></p>`));
      const b=document.getElementById("vdl");if(b)b.onclick=()=>fetch(rc.data).then(r=>r.blob()).then(bl=>saveFile(rc.name,bl))})}
  else if(d.delrc){if(!confirm("להסיר את הקבלה?"))return;const x=S.tx.find(x=>x.id===d.delrc);delete x.rcpt;W.delReceipt(x.id);commit(`תנועות: הוסרה הקבלה מ"${x.desc}"`,["tx",x])}
  else if(d.paper){const x=S.tx.find(x=>x.id===d.paper);x.rcptPaper=!x.rcptPaper;commit(`תנועות: "${x.desc}" – ${x.rcptPaper?"סומן שיש קבלה":"בוטל הסימון של קבלה"}`,["tx",x])}
  else if(d.edittx){editTx=d.edittx;focusAfter="etAmt";render()}
  else if(t.hasAttribute("data-canceltx")){editTx=null;render()}
  else if(d.deltx){const x=S.tx.find(x=>x.id===d.deltx);if(!confirm(`למחוק את התנועה "${x.desc}" (${ils(x.amount)})?`))return;S.tx=S.tx.filter(y=>y!==x);selTx.delete(x.id);if(x.rcpt)W.delReceipt(x.id);commit(`תנועות: נמחקה "${x.desc}" (${ils(x.amount)})`,["tx",x.id,"del"])}
  else if(t.hasAttribute("data-moretx")){txShown+=100;render()}
  else if(d.bulk){const xs=S.tx.filter(x=>selTx.has(x.id));
    if(d.bulk==="none"){selTx.clear();render()}
    else if(d.bulk==="cat"){const c=document.getElementById("bulkCat").value;xs.forEach(x=>x.cat=c);selTx.clear();commit(`תנועות: ${xs.length} תנועות סווגו ל"${catName(c)||"לא מסווג"}"`,...xs.map(x=>["tx",x]))}
    else if(d.bulk==="paper"){xs.forEach(x=>x.rcptPaper=true);selTx.clear();commit(`תנועות: ${xs.length} תנועות סומנו שיש קבלה`,...xs.map(x=>["tx",x]))}
    else if(d.bulk==="del"){if(!confirm(`למחוק ${xs.length} תנועות?`))return;S.tx=S.tx.filter(x=>!selTx.has(x.id));selTx.clear();commit(`תנועות: נמחקו ${xs.length} תנועות`,...xs.map(x=>["tx",x.id,"del"]))}}
  else if(d.sf){SF.f=d.sf;render()}
  else if(d.df){DF.f=d.df;render()}
  else if(t.hasAttribute("data-togunlinked")){showUnlinked=!showUnlinked;render()}
  else if(d.togs){openStu.has(d.togs)?openStu.delete(d.togs):openStu.add(d.togs);render()}
  else if(d.togd){openDonor.has(d.togd)?openDonor.delete(d.togd):openDonor.add(d.togd);render()}
  else if(d.delsp){const[sid,pid]=d.delsp.split(":"),s=S.students.find(x=>x.id===sid),p=s.payments.find(p=>p.id===pid);if(!confirm("למחוק את התשלום?"))return;s.payments=s.payments.filter(p=>p.id!==pid);commit(`שכר לימוד: נמחק תשלום של ${ils(p.amount)} של ${s.name}`,["students",s])}
  else if(d.unlinkstu){const x=S.tx.find(x=>x.id===d.unlinkstu);x.studentId=null;commit(`שכר לימוד: התשלום "${x.desc}" נותק מהבחור`,["tx",x])}
  else if(d.delpayer){const i=d.delpayer.indexOf(":"),s=S.students.find(x=>x.id===d.delpayer.slice(0,i)),p=d.delpayer.slice(i+1);s.payers=(s.payers||[]).filter(x=>x!==p);commit(`שכר לימוד: ${p} כבר לא משויך אוטומטית ל${s.name}`,["students",s])}
  else if(d.delstu){if(!confirm("להסיר את הבחור מהרשימה?"))return;const s=S.students.find(x=>x.id===d.delstu);S.students=S.students.filter(x=>x.id!==d.delstu);const ch=S.tx.filter(x=>x.studentId===s.id).map(x=>{x.studentId=null;return ["tx",x]});commit(`שכר לימוד: ${s.name} הוסר מהרשימה`,["students",s.id,"del"],...ch)}
  else if(d.handled){const dn=S.donors.find(x=>x.id===d.handled);dn.handled=true;commit(`תורמים: ${dn.name} – סומן שטופל`,["donors",dn])}
  else if(d.bulkdonor){if(d.bulkdonor==="none"){selDonors.clear();render();return}const ds=S.donors.filter(x=>selDonors.has(x.id));ds.forEach(x=>x.handled=true);selDonors.clear();commit(`תורמים: ${ds.length} סומנו שטופלו`,...ds.map(x=>["donors",x]))}
  else if(d.rep){if(d.rep==="print")print();else if(d.rep==="tx")exportTx();else exportSummary()}
  else if(d.deluser){const u=S.users.find(x=>x.id===d.deluser);if(!confirm(`להסיר את ${u.name}?`))return;S.users=S.users.filter(x=>x.id!==u.id);commit(`משתמשים: ${u.name} (${u.id}) הוסר`,["roles",u.id,"del"])}
});
function applySug(i,avg){const g=groupOf(i.id);
  if(i.per&&g&&g.heads){i.unit=Math.round(avg/((i.monthly!=null?(+i.months||12):1)*g.heads));applyHeads(g)}
  else if(i.monthly!=null)i.monthly=Math.round(avg/(+i.months||12));else i.annual=Math.round(avg)}
app.addEventListener("input",e=>{const id=e.target.id;if(id==="bq")BF.q=e.target.value;else if(id==="sq")SF.q=e.target.value;else if(id==="dq")DF.q=e.target.value;else if(id==="tq"){TF.q=e.target.value;txShown=100}else return;render()});
// the arrows of a number field fire a change on every click: wait until the clicking stops,
// then save once and log "first value ← last value"
const settling={};
function settle(key,old,done){const p=settling[key]||(settling[key]={old});clearTimeout(p.t);p.t=setTimeout(()=>{delete settling[key];done(p.old)},900)}
app.addEventListener("change",e=>{
  const t=e.target,d=t.dataset;
  if(d.item){const i=findItem(d.item),old=i[d.f];
    if(d.f==="name"){i.name=t.value.trim()||i.name;commit(`תקציב: שם הסעיף "${old}" שונה ל"${i.name}"`,"meta");return}
    if(d.f==="unit"){i.unit=+t.value||0;applyHeads(groupOf(i.id))}else{i[d.f]=t.value===""?(d.f==="monthly"?null:0):+t.value;if(d.f==="monthly"&&i.monthly!=null&&!i.months)i.months=12}
    settle(d.item+d.f,old,first=>commit(`תקציב: "${i.name}" – ${FIELD[d.f]} ${first??"ריק"} ← ${i[d.f]??"ריק"}`,"meta"))}
  else if(d.heads){const g=S.budget.expenses[+d.heads],old=g.heads;g.heads=+t.value||0;applyHeads(g);settle("heads"+d.heads,old,first=>commit(`תקציב: מספר האברכים ב${g.group} – ${first} ← ${g.heads}`,"meta"))}
  else if(d.cat){const x=S.tx.find(x=>x.id===d.cat);x.cat=t.value;if(x.cat!==DEBT)x.debtId=null;commit(`תנועות: "${x.desc}" (${ils(x.amount)}) סווגה ל"${catName(x.cat)||"לא מסווג"}"`,["tx",x])}
  else if(d.txdebt){const x=S.tx.find(x=>x.id===d.txdebt),db=S.debts.find(y=>y.id===t.value);x.debtId=t.value||null;commit(`חובות: "${x.desc}" ${db?`שויכה לחוב "${db.name}"`:"נותקה מהחוב"}`,["tx",x])}
  else if(d.txstu||d.linkstu){const x=S.tx.find(x=>x.id===(d.txstu||d.linkstu)),s=S.students.find(y=>y.id===t.value);commit(`שכר לימוד: "${x.desc}" ${s?`שויך ל${s.name}`:"נותק מהבחור"}`,...linkStudent(x,t.value))}
  else if(d.seltx){t.checked?selTx.add(d.seltx):selTx.delete(d.seltx);render()}
  else if(t.hasAttribute("data-selall")){const items=allItems(),list=S.tx.filter(x=>txMatches(x,items));list.forEach(x=>t.checked?selTx.add(x.id):selTx.delete(x.id));render()}
  else if(d.seldonor){t.checked?selDonors.add(d.seldonor):selDonors.delete(d.seldonor);render()}
  else if(t.hasAttribute("data-selalldonors")){S.donors.filter(x=>DF.f==="all"||x.status===DF.f).forEach(x=>t.checked?selDonors.add(x.id):selDonors.delete(x.id));render()}
  else if(d.bill){const[i,k]=d.bill.split(":");(S.meorot.bills[i]=S.meorot.bills[i]||{})[k]=t.value===""?null:+t.value;commit(`המשכיר: חשבון ${UTIL[k]} ל${MONTHS[i][0]} – ${t.value===""?"נמחק":ils(+t.value)}`,"meta")}
  else if(d.fixed){S.meorot.fixed[d.fixed]=+t.value||0;commit(`המשכיר: תשלום קבוע ל${UTIL[d.fixed]} – ${ils(+t.value||0)}`,"meta")}
  else if(t.hasAttribute("data-rent")){S.meorot.rent=+t.value||0;commit(`המשכיר: שכירות חודשית – ${ils(S.meorot.rent)}`,"meta")}
  else if(t.hasAttribute("data-namescat")){S.nedarimNamesCat=t.value;commit(`נדרים: תרומות על שם בחור / רב – "${catName(t.value)||"לא מסווג"}"`,"meta")}
  else if(d.bal){const a=S.accounts.find(x=>x.id===d.bal);a.balance=+t.value||0;S.bankAsOf=iso(TODAY);commit(`בנקים: יתרה ב${a.name} – ${ils(a.balance)}`,"meta")}
  else if(d.goal!=null){S.building.goal=+t.value||0;commit(`קרן הבניין: יעד – ${ils(S.building.goal)}`,"meta")}
  else if(d.yv){const[y,c]=d.yv.split(":"),Y=S.years[y];Y.byCat=Y.byCat||{};Y.byCat[c]=t.value===""?null:+t.value;commit(`השוואה: ${y} – ${catName(c)} – ${t.value===""?"נמחק":ils(+t.value)}`,["years",{...Y,id:String(y)}])}
  else if(d.sfee){const s=S.students.find(x=>x.id===d.sfee),old=s.fee;s.fee=+t.value||0;commit(`שכר לימוד: ${s.name} – תשלום חודשי ${ils(old)} ← ${ils(s.fee)}`,["students",s])}
  else if(d.sshiur){const s=S.students.find(x=>x.id===d.sshiur);s.shiur=t.value;commit(`שכר לימוד: ${s.name} – ${t.value?"שיעור "+t.value:"ללא שיעור"}`,["students",s])}
  else if(d.urole){const u=S.users.find(x=>x.id===d.urole);u.role=t.value;commit(`משתמשים: ${u.name} – תפקיד ${ROLE_NAMES[u.role]}`,["roles",u])}
  else if(d.rcpt&&t.files[0]){const x=S.tx.find(x=>x.id===d.rcpt);readReceipt(t.files[0])
    .then(rc=>W.putReceipt(x.id,rc).then(()=>{x.rcpt={name:rc.name,type:rc.type};commit(`תנועות: צורפה קבלה ל"${x.desc}"`,["tx",x])}))
    .catch(()=>alert("לא הצלחתי לצרף את הקובץ. אפשר לצרף תמונה, או PDF קטן מ־700KB."))}
  else if(t.id==="rFrom"||t.id==="rTo"){RF[t.id==="rFrom"?"from":"to"]=t.value;if(RF.from>RF.to)[RF.from,RF.to]=[RF.to,RF.from];render()}
  else if(t.id==="mType"){const ty=t.value,c=document.getElementById("mCat");c.disabled=ty==="paid_to"||ty==="paid_from";c.innerHTML=c.disabled?'<option value="">לא נספר בתקציב</option>':catOptions("",ty==="received"?"income":"expense",true)}
  else if(t.id==="bgroup"){BF.group=t.value;render()}
  else if(t.id==="tfMonth"){TF.month=t.value;if(t.value==="range"&&!TF.from){TF.from=`${YEAR}-${String(CUR+1).padStart(2,"0")}-01`;TF.to=iso(TODAY<YEAR_END?TODAY:new Date(YEAR,11,31))}txShown=100;render()}
  else if(t.id==="tfFrom"||t.id==="tfTo"){TF[t.id==="tfFrom"?"from":"to"]=t.value;if(TF.from&&TF.to&&TF.from>TF.to)[TF.from,TF.to]=[TF.to,TF.from];txShown=100;render()}
  else if(t.id==="tfType"){TF.type=t.value;const items=allItems();
    // a budget line of the other kind no longer fits the filter
    if(TF.cat!=="all"&&!OUTSIDE.has(TF.cat)){const k=TF.cat==="inc"?"income":TF.cat.startsWith("g:")?"expense":(items[TF.cat]||{}).kind;if((TF.type==="in"&&k!=="income")||((TF.type==="out"||TF.type==="norc")&&k!=="expense"))TF.cat="all"}
    txShown=100;render()}
  else if(t.id==="tfCat"){TF.cat=t.value;txShown=100;render()}
  else if(t.id==="sfShiur"){SF.shiur=t.value;render()}
  else if(t.id==="fKind"){document.getElementById("fCat").innerHTML=catOptions("",t.value==="in"?"income":"expense")}
});
function saveNote(t){const T=noteTarget(t.dataset.notekey);noteEdit=null;if(!T){render();return}const nv=t.value.trim();if(nv===(T.o[T.f]||"")){setTimeout(render);return}
  T.o[T.f]=nv;setTimeout(()=>commit(`הערה ל"${T.label}" – ${nv||"נמחקה"}`,T.ch))}
app.addEventListener("focusout",e=>{const t=e.target;if(t.id==="note-edit"&&noteEdit)saveNote(t)});
app.addEventListener("keydown",e=>{if(e.target.id==="note-edit"){if(e.key==="Enter"){e.preventDefault();e.target.blur()}else if(e.key==="Escape"){noteEdit=null;render()}}});
app.addEventListener("submit",e=>{
  e.preventDefault();const f=e.target,v=id=>document.getElementById(id).value;let msg="",ch=[];
  if(f.id==="txForm"){const a=+v("fAmt"),desc=v("fDesc"),x={id:uid(),date:v("fDate"),desc,amount:v("fKind")==="in"?a:-a,source:v("fSrc"),cat:v("fCat"),note:v("fNote").trim()};S.tx.push(x);ch=[["tx",x]];msg=`תנועות: נוספה ${v("fKind")==="in"?"הכנסה":"הוצאה"} "${desc}" – ${ils(a)}`}
  else if(f.dataset.edittx){const x=S.tx.find(x=>x.id===f.dataset.edittx),old=`${grDate(x.date)} ${x.desc} ${ils(x.amount)}`,a=+v("etAmt");
    Object.assign(x,{date:v("etDate"),desc:v("etDesc"),amount:v("etKind")==="in"?a:-a,source:v("etSrc")});editTx=null;ch=[["tx",x]];msg=`תנועות: עודכנה "${old}" ← ${grDate(x.date)} ${x.desc} ${ils(x.amount)}`}
  else if(f.id==="mForm"){const ty=v("mType"),m={id:uid(),date:v("mDate"),type:ty,desc:v("mDesc"),amount:+v("mAmt"),cat:ty==="received"||ty==="charge"?v("mCat"):"",note:""};S.meorot.entries.push(m);ch=[["meorot",m]];msg=`המשכיר: נוסף "${m.desc}" – ${ils(m.amount)}`}
  else if(f.id==="debtForm"){const db={id:uid(),name:v("dName"),amount:+v("dAmt"),payments:+v("dPay"),urgency:v("dUrg"),next:v("dNext"),repayments:[],note:""};S.debts.push(db);ch=[["debts",db]];msg=`חובות: נוסף החוב "${db.name}" – ${ils(db.amount)}`}
  else if(f.dataset.editdebt){const db=S.debts.find(x=>x.id===f.dataset.editdebt);Object.assign(db,{name:v("eName"),amount:+v("eAmt"),payments:+v("ePay"),urgency:v("eUrg"),next:v("eNext")});editDebt=null;ch=[["debts",db]];msg=`חובות: עודכנו פרטי "${db.name}"`}
  else if(f.dataset.addrp){const id=f.dataset.addrp,db=S.debts.find(x=>x.id===id);db.repayments.push({id:uid(),date:v("rpDate-"+id),amount:+v("rpAmt-"+id),method:v("rpMeth-"+id),note:v("rpNote-"+id).trim()});
    const nd=new Date(db.next+"T12:00:00");nd.setMonth(nd.getMonth()+1);db.next=iso(nd);ch=[["debts",db]];msg=`חובות: נרשם החזר של ${ils(+v("rpAmt-"+id))} ל"${db.name}"`}
  else if(f.id==="bForm"){const a=+v("bAmt"),b={id:uid(),date:v("bDate"),desc:v("bDesc"),amount:v("bKind")==="in"?a:-a,note:""};S.building.entries.push(b);ch=[["building",b]];msg=`קרן הבניין: נוסף "${b.desc}" – ${ils(a)}`}
  else if(f.id==="ruleForm"){S.rules.push({kw:v("rKw"),cat:v("rCat")});ch=["meta"];msg=`כללי סיווג: נוסף הכלל "${v("rKw")}"`}
  else if(f.id==="stuForm"){const s={id:uid(),name:v("sName").trim(),shiur:v("sShiur"),fee:+v("sFee"),note:"",payments:[],payers:[]};S.students.push(s);ch=[["students",s]];msg=`שכר לימוד: נוסף הבחור ${s.name}`}
  else if(f.dataset.addsp){const id=f.dataset.addsp,s=S.students.find(x=>x.id===id);s.payments.push({id:uid(),date:v("spDate-"+id),amount:+v("spAmt-"+id),method:v("spMeth-"+id),note:v("spNote-"+id).trim()});ch=[["students",s]];msg=`שכר לימוד: נרשם תשלום של ${ils(+v("spAmt-"+id))} מ${s.name}`}
  else if(f.id==="userForm"){const email=v("uEmail").trim().toLowerCase();if(email===OWNER||S.users.some(u=>u.id===email)){alert("המשתמש הזה כבר קיים.");return}
    const u={id:email,name:v("uName").trim(),role:v("uRole")};S.users.push(u);ch=[["roles",u]];msg=`משתמשים: נוסף ${u.name} (${email}) – ${ROLE_NAMES[u.role]}`}
  commit(msg,...ch);
});
// chart tooltip
app.addEventListener("pointermove",e=>{
  const h=e.target.closest&&e.target.closest(".hit");if(!h){tip.hidden=true;return}
  const i=+h.dataset.m,B=totals(),inc=+h.dataset.inc,exp=+h.dataset.exp;
  tip.innerHTML=i<=CUR?`<b>${MONTHS[i][0]}${i===CUR&&TODAY<YEAR_END?" (עד היום)":""}</b>הכנסות: <span class="num">${ils(inc)}</span><br>הוצאות: <span class="num">${ils(exp)}</span><br>הפרש: <span class="num">${ils(inc-exp)}</span>`
    :`<b>${MONTHS[i][0]} – תקציב</b>הכנסות: <span class="num">${ils(B.inc/NM)}</span><br>הוצאות: <span class="num">${ils(B.exp/NM)}</span>`;
  tip.hidden=false;
  const x=Math.min(innerWidth-tip.offsetWidth-8,Math.max(8,e.clientX-tip.offsetWidth/2));
  tip.style.left=x+scrollX+"px";tip.style.top=(e.clientY+scrollY-tip.offsetHeight-14)+"px";
});
app.addEventListener("pointerleave",()=>tip.hidden=true);
app.addEventListener("toggle",e=>{const k=e.target.dataset&&e.target.dataset.open;if(k)e.target.open?openAdd.add(k):openAdd.delete(k)},true);
export {YEAR,THIS_YEAR,newYearMeta,migrateMeta,yearSummary};
