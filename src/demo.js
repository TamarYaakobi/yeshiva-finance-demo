// Demo build: the real screens with made-up data that lives only in the browser.
// Nothing here talks to a server – a refresh starts over.
import "./style.css";
import {boot,render,openAsk,YEAR,THIS_YEAR,newYearMeta,setBrand} from "./app.js";

setBrand({name:"ישיבת דמו",org:"עמותה לדוגמה ע״ר",logo:"/demo-logo.svg",nedarim:"מוסד 0000000 · חשבון הדגמה",owner:"admin@demo.example"});

// ---------- a repeatable random, so the demo looks the same on every visit ----------
let seed=20260;
const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
const pick=a=>a[Math.floor(rnd()*a.length)];
const vary=(n,p=.08)=>Math.round(n*(1+(rnd()*2-1)*p)/10)*10;
const uid=()=>Math.random().toString(36).slice(2,9);
const D=(y,m,d)=>`${y}-${String(m+1).padStart(2,"0")}-${String(Math.min(d,28)).padStart(2,"0")}`;
const TODAY=new Date(),CUR=YEAR===TODAY.getFullYear()?TODAY.getMonth():11,DAY=YEAR===TODAY.getFullYear()?TODAY.getDate():31;
const past=(m,d)=>m<CUR||(m===CUR&&d<=DAY);

const FIRST=["אברהם","יצחק","יעקב","משה","אהרן","דוד","שלמה","יוסף","בנימין","שמואל","מנחם","אליהו","חיים","מרדכי","נתן","ישראל","מאיר","שמעון","ראובן","אפרים","נחום","זאב","עזרא","יהודה"];
const LAST=["כהן","לוי","מזרחי","פרץ","ביטון","אברהמי","פרידמן","גולדברג","רוזן","שפירא","קליין","וייס","אדלר","ברגר","אלמוג","שטרן","הלוי","דהן","עזרא","טל","נגר","סופר","חזן","ארז"];
const CITY=["ירושלים","בני ברק","אלעד","מודיעין עילית","בית שמש","חיפה","אשדוד","פתח תקווה","ביתר עילית","צפת"];
const person=()=>`${pick(LAST)} ${pick(FIRST)}`;

// ---------- budget: same structure as the real one, invented lines and amounts ----------
const it=(id,name,monthly,months,annualAmt)=>({id,name,monthly,months,annual:annualAmt??null,note:""});
const budget={
  expenses:[
    {group:"משכורות",items:[it("s_rosh","ראש הישיבה",11500,12),it("s_ram1","ר״מ שיעור א׳",8200,12),it("s_ram2","ר״מ שיעור ב׳",8200,12),it("s_mash","משגיח",7000,12),it("s_sec","מזכיר",5200,12),it("s_cook","טבח",6200,12),it("s_clean","ניקיון ותחזוקה",3800,12),it("s_emp","עלות מעביד",8500,12)]},
    {group:"מזון",items:[it("f_bake","מאפייה",3200,12),it("f_dairy","מוצרי חלב",3800,12),it("f_meat","בשר ועופות",8500,12),it("f_dry","יבשים",4200,12),it("f_veg","פירות וירקות",4600,12),it("f_shabbat","תוספות לשבת",2800,12),it("f_disp","חד פעמי",1400,12)]},
    {group:"הוצאות קבועות",items:[it("c_rent","שכירות מבנה",14000,12),it("c_car","רכב",2300,12),it("c_ins","ביטוחים",900,12)]},
    {group:"אחזקה",items:[it("m_gas","גז",180,12),it("m_water","מים",4200,12),it("m_elec","חשמל",4800,12),it("m_fix","תיקונים",600,12),it("m_equip","רכישת ציוד",null,0,9000)]},
    {group:"נוספים",items:[it("x_siyum","סיומים",null,0,7000),it("x_trip","טיול שנתי",null,0,22000),it("x_purim","פורים",null,0,11000),it("x_bein","בין הזמנים",null,0,9000),it("x_milga","מלגות",null,0,18000),it("x_mtrip","טיולים חודשיים",1400,10),it("x_canteen","קנטינה",900,10)]},
    {group:"כולל",heads:8,items:[it("k_milga","מלגות אברכים",9600,12),it("k_erev","כולל ערב",3200,10),it("k_pesach","מענק פסח",null,0,4000),it("k_sukkot","מענק סוכות",null,0,4000)]},
    {group:"משרד",items:[it("o_bank","עמלות בנק",220,12),it("o_reg","רישום עמותה",null,0,1700),it("o_hok","סליקת אשראי והו״ק",380,12),it("o_phone","טלפון ואינטרנט",150,12),it("o_cpa","רואה חשבון",1500,6)]}
  ],
  income:[
    it("i_parents","תשלומי הורים (שכר לימוד)",42000,12),
    it("i_fund","קרן מלגות לדוגמה",18000,12),
    it("i_purim","פורים – מגבית המונים",null,0,320000),
    it("i_dat_b","דתות בחורים (דרך המשכיר)",10000,12),
    it("i_dat_k","דתות כולל (דרך המשכיר)",4500,12),
    it("i_olam","קרן עולם התורה",12000,12),
    it("i_abroad","תרומות מחו״ל",3000,12),
    it("i_don","תרומות שוטפות",9000,12)
  ]
};
const meta=newYearMeta(null,{budget,rules:[{kw:"קרן מלגות",cat:"i_fund"},{kw:"עולם התורה",cat:"i_olam"}]});
meta.budget.expenses.forEach(g=>{if(g.heads)g.items.forEach(i=>{i.per=true;i.unit=Math.round((i.monthly??i.annual)/g.heads)})});
meta.accounts=[{id:"main",name:"בנק לדוגמה",note:"חשבון עיקרי",balance:86420},{id:"second",name:"בנק שני",note:"חשבון משני",balance:11850}];
meta.meorot={rent:14000,fixed:{elec:4800,water:4200},bills:{}};
meta.buildingGoal=1500000;

const S={...meta,meorot:{...meta.meorot,entries:[]},building:{goal:meta.buildingGoal,entries:[]},
  tx:[],debts:[],students:[],donors:[],log:[],logMore:false,users:[],sync:null,years:{},questions:[]};
const tx=(m,d,desc,amount,cat,extra)=>{if(past(m,d))S.tx.push({id:uid(),date:D(YEAR,m,d),desc,amount,source:"בנק לדוגמה",cat,note:"",...extra})};
const ned=(m,d,who,grp,amount,cat,extra)=>{if(past(m,d))S.tx.push({id:"n_"+uid(),date:D(YEAR,m,d),desc:`נדרים פלוס – ${who}${grp?" · "+grp:""}`,amount,source:"נדרים פלוס",cat,note:"",nedarim:{type:"credit",groupe:grp,client:who},...extra})};

// ---------- students and their tuition ----------
const SH=["א׳","ב׳","ג׳"];
for(let i=0;i<52;i++){const name=`${pick(FIRST)} ${pick(LAST)}`,fee=pick([700,800,800,900,1000,1200]),shiur=i<49?SH[i%3]:"";
  const s={id:"st"+i,name,shiur,fee,note:"",payments:[],payers:[]};S.students.push(s);
  const payer=`${name.split(" ")[1]} ${pick(FIRST)}`;s.payers.push(payer);
  const late=i%7===3?2:i%11===5?1:0; // a few families behind
  for(let m=0;m<=CUR-late;m++)ned(m,14,payer,"שכר לימוד",fee,"i_parents",{studentId:s.id});
}

// ---------- monthly activity ----------
const exp=meta.budget.expenses.flatMap(g=>g.items.map(i=>({...i,group:g.group})));
const SUPPLIER={f_bake:"מאפיית הדגמה",f_dairy:"מחלבה לדוגמה",f_meat:"ספק בשר",f_dry:"סיטונאות מזון",f_veg:"ירקן השוק",f_shabbat:"קייטרינג לשבת",f_disp:"חד פעמי בע״מ",m_gas:"חברת גז",m_water:"תאגיד המים",m_elec:"חברת החשמל",m_fix:"שיפוצים כללי",c_car:"ליסינג רכב",c_ins:"חברת ביטוח",o_bank:"עמלות בנק",o_hok:"סליקה",o_phone:"חברת תקשורת",o_cpa:"משרד רו״ח"};
for(let m=0;m<=CUR;m++){
  exp.forEach(i=>{if(i.monthly==null||i.id==="c_rent"||m>=i.months&&i.months<12)return;
    const amt=i.per?i.unit*8:i.monthly;
    tx(m,i.id[0]==="s"||i.id[0]==="k"?1:5+Math.floor(rnd()*20),i.id[0]==="s"?`משכורת – ${i.name}`:i.id[0]==="k"?i.name:SUPPLIER[i.id]||i.name,-vary(amt,i.id[0]==="s"?0:.12),i.id)});
  tx(m,10,"קרן מלגות לדוגמה – העברה",vary(18000,.05),"i_fund");
  tx(m,20,"קרן עולם התורה",12000,"i_olam");
  if(m%2===0)tx(m,18,"העברה מחו״ל – Friends of Demo",vary(6200,.3),"i_abroad");
  for(let k=0;k<6;k++)ned(m,1+Math.floor(rnd()*27),person(),"תרומה",pick([50,100,180,250,360,500,1000,1800]),"i_don");
  // utilities: the real bills, entered in the landlord screen
  if(past(m,25))S.meorot.bills[m]={elec:vary(m<3||m>5&&m<9?5600:4300,.1),water:vary(4100,.12)};
  // דתות collected by the landlord for us
  if(past(m,3)){S.meorot.entries.push({id:uid(),date:D(YEAR,m,3),type:"received",desc:"דתות בחורים",amount:10000,cat:"i_dat_b",note:""},{id:uid(),date:D(YEAR,m,3),type:"received",desc:"דתות כולל",amount:4500,cat:"i_dat_k",note:""})}
}
// one-off expenses
[[1,12,"ציוד למטבח",-4200,"m_equip"],[2,20,"סעודת פורים",-11600,"x_purim"],[3,25,"בין הזמנים – מענקים",-8600,"x_bein"],[3,2,"מענק פסח לאברכים",-4000,"k_pesach"],[5,15,"טיול שנתי",-23400,"x_trip"],[6,9,"סיום מסכת",-3300,"x_siyum"],[8,28,"מענק סוכות לאברכים",-4000,"k_sukkot"],[9,6,"מלגות לבחורים",-9000,"x_milga"],[1,3,"רישום עמותה",-1700,"o_reg"]].forEach(a=>tx(...a));
// the Purim campaign: a couple of hundred donations in a few days
for(let k=0;k<430;k++)ned(2,10+Math.floor(rnd()*6),person(),pick(["הבחור "+pick(FIRST),"הרב "+pick(LAST),"קמפיין פורים"]),pick([36,52,100,100,180,180,250,360,500,770,1000,1800,2600]),"i_purim");
// a few transactions still waiting to be classified
[[CUR,2,"העברה מ- י. שטרן",1500],[CUR,3,"הפקדת מזומן",2400],[CUR>0?CUR-1:0,22,"הוראת קבע – ח. פרידמן",-650]].forEach(([m,d,desc,a])=>tx(m,Math.min(d,DAY),desc,a,""));

// ---------- separate funds ----------
S.debts.push(
  {id:"d1",name:"גמ״ח השכונה",amount:80000,payments:20,urgency:"mid",next:D(YEAR,CUR+1>11?11:CUR+1,7),note:"",repayments:Array.from({length:CUR+1},(_,m)=>({id:uid(),date:D(YEAR,m,7),amount:4000,method:"הוראת קבע",note:""})).filter(r=>r.date<=D(YEAR,CUR,DAY))},
  {id:"d2",name:"הלוואה מספק בשר",amount:18000,payments:6,urgency:"high",next:D(YEAR,CUR,DAY+3>28?28:DAY+3),note:"סוכם בעל פה",repayments:[{id:uid(),date:D(YEAR,Math.max(0,CUR-1),15),amount:3000,method:"העברה בנקאית",note:""}]},
  {id:"d3",name:"גמ״ח משפחת לוי",amount:25000,payments:10,urgency:"low",next:D(YEAR,11,1),note:"",repayments:[]});
[[0,8,"תרומה לבניין – משפחת רוזן",120000],[2,14,"מגבית בניין",64000],[4,3,"תשלום לאדריכל",-18000],[6,19,"תרומה לבניין – קרן לדוגמה",90000],[8,11,"היתר בנייה – אגרות",-12500]].forEach(([m,d,desc,a])=>{if(past(m,d))S.building.entries.push({id:uid(),date:D(YEAR,m,d),desc,amount:a,note:""})});

// ---------- donors (as if from Nedarim Plus) ----------
for(let i=0;i<60;i++){const monthly=pick([50,100,100,180,180,250,360,500]),st=i%13===4?"failed":i%9===7?"ended":"active",months=st==="ended"?Math.floor(CUR/2):CUR+1;
  S.donors.push({id:"k_"+i,name:person(),city:pick(CITY),kind:"keva",monthly,status:st,ytd:monthly*months,last:D(YEAR,st==="ended"?Math.floor(CUR/2):CUR,10),note:st==="failed"?"הכרטיס נדחה: תוקף פג":"",groupe:pick(["תרומה","תרומה","החזקת תורה"]),via:pick(["אשראי","הו״ק בנקאית"])})}
for(let i=0;i<15;i++)S.donors.push({id:"o_"+i,name:person(),city:"",kind:"once",monthly:null,status:"once",ytd:pick([1800,2600,3600,5000,10000,18000]),last:D(YEAR,Math.floor(rnd()*(CUR+1)),12),note:"",via:"חד פעמי"});
S.donors.filter(d=>d.kind==="keva").forEach(d=>{const n=d.status==="ended"?Math.floor(CUR/2):d.status==="failed"?CUR-1:CUR;for(let m=0;m<=n;m++)ned(m,10,d.name,d.groupe,d.monthly,"i_don",{nedarim:{type:"credit",groupe:d.groupe,client:d.name,kevaId:d.id.slice(2)}})});
S.tx.sort((a,b)=>b.date.localeCompare(a.date));
S.sync={lastRun:new Date(Date.now()-47*60000).toISOString(),lastResult:{newTx:12,errors:[]},groups:["שכר לימוד","תרומה","החזקת תורה","קמפיין פורים"]};

// ---------- the two previous years, for the comparison and budget suggestions ----------
const items=[...meta.budget.expenses.flatMap(g=>g.items.map(i=>[i,g.group])),...meta.budget.income.map(i=>[i,"הכנסות"])];
const ann=i=>i.monthly!=null?(+i.monthly||0)*(+i.months||0):(+i.annual||0);
for(const [y,f] of [[YEAR-1,.93],[YEAR-2,.86]]){const byCatMonth={},bud={},names={},groups={},byMonth=Array.from({length:12},()=>({inc:0,exp:0}));let inc=0,ex=0;
  items.forEach(([i,g])=>{const a=ann(i)*f,isInc=g==="הכנסות",arr=Array(12).fill(0);
    if(i.monthly!=null)for(let m=0;m<12;m++)arr[m]=m<i.months?vary(a/i.months,.1):0;else arr[i.id==="i_purim"||i.id==="x_purim"?2:i.id==="x_trip"?5:8]=vary(a,.1);
    byCatMonth[i.id]=arr;bud[i.id]=Math.round(a/1000)*1000;names[i.id]=i.name;groups[i.id]=g;
    arr.forEach((v,m)=>{if(isInc){inc+=v;byMonth[m].inc+=v}else{ex+=v;byMonth[m].exp+=v}})});
  S.years[y]={id:String(y),year:y,byCatMonth,budget:bud,names,groups,inc,exp:ex,byMonth}}

// ---------- users, log ----------
S.users=[{id:"rosh@demo.example",name:"ראש הישיבה",role:"rosh"},{id:"secretary@demo.example",name:"המזכיר",role:"mazkir"},{id:"cpa@demo.example",name:"רואה החשבון",role:"roeh"}];
const LOG=["תנועות: נוספה הוצאה \"ספק בשר\" – ₪8,640","תקציב: מאפייה – חודשי ₪3,200","שכר לימוד: נרשם תשלום של ₪800","חובות: נרשם החזר של ₪4,000 ל\"גמ״ח השכונה\"","המשכיר: חשבון חשמל עודכן","קרן הבניין: נוסף \"תרומה לבניין\""];
for(let k=0;k<14;k++)S.log.push({ts:new Date(Date.now()-k*5.3*3600000).toISOString(),email:"secretary@demo.example",name:k%3?"המזכיר":"ראש הישיבה",msg:LOG[k%LOG.length]});
S.tx.sort((a,b)=>b.date.localeCompare(a.date));

// ---------- the write layer: changes stay in memory ----------
const receipts={};
const W={
  meta(){},put(){},del(){},
  log(msg){S.log.unshift({ts:new Date().toISOString(),email:me.email,name:me.name,msg})},
  putReceipt:(id,rc)=>{receipts[id]=rc;return Promise.resolve()},
  getReceipt:id=>Promise.resolve(receipts[id]||null),
  delReceipt:id=>{delete receipts[id];return Promise.resolve()},
  syncNow:()=>new Promise(r=>setTimeout(()=>{S.sync={...S.sync,lastRun:new Date().toISOString()};r({newTx:0})},1200)),
  moreLog(){},
  loadRange:async(from,to)=>({tx:S.tx.filter(x=>x.date>=from&&x.date<=to),meo:S.meorot.entries.filter(x=>x.date>=from&&x.date<=to)}),
  sendQuestion:async()=>{alert("זו גרסת הדגמה – השאלה לא נשלחה. במערכת האמיתית היא נשלחת במייל למתכנת, עם צילומי המסך וההקלטה.")}
};

// ---------- the page: a role switcher instead of a sign-in ----------
const $=id=>document.getElementById(id);
const ROLE_NAMES={menahel:"מנהל הישיבה",roeh:"רואה חשבון (צפייה בלבד)"};
let role=new URLSearchParams(location.search).get("role")==="roeh"?"roeh":"menahel";
const me={email:"admin@demo.example",name:"משתמש הדגמה"};
function userBox(){
  $("userbox").hidden=false;
  $("userbox").innerHTML=`<label class="demo-role"><span class="lbl">צפייה בתור </span><select id="roleSel" aria-label="צפייה בתור">${Object.entries(ROLE_NAMES).map(([k,l])=>`<option value="${k}"${k===role?" selected":""}>${l}</option>`).join("")}</select></label>
    <button class="btn ghost small" id="askBtn" title="שאלה למתכנת">❓<span class="lbl"> שאלה למתכנת</span></button>
    <button class="btn ghost small" id="resetBtn" title="חזרה לנתונים המקוריים">↺<span class="lbl"> איפוס</span></button>`;
  $("roleSel").onchange=e=>{role=e.target.value;boot({S,role,me,W});render()};
  $("askBtn").onclick=()=>openAsk();
  $("resetBtn").onclick=()=>location.reload();
}
const today=$("today");if(today)today.textContent=new Date().toLocaleDateString("he-IL");
boot({S,role,me,W});userBox();
$("gate").hidden=true;$("app").hidden=$("tabs").hidden=$("bnav").hidden=false;
render();
if(YEAR!==THIS_YEAR)console.info("demo year",YEAR);
