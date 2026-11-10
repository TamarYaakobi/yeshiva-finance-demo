// Pulls donations, standing orders and manual income from נדרים פלוס into the yeshiva's database.
// Runs every 3 hours, and on demand from the settings screen ("סנכרון עכשיו").
// Nedarim allows ~20 calls an hour per action, so every run makes only a handful of calls.
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onCall,HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {setGlobalOptions} from "firebase-functions/v2/options";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getFirestore,FieldValue} from "firebase-admin/firestore";

setGlobalOptions({region:"europe-west1",maxInstances:1});
initializeApp();
const db=getFirestore();
const API_KEY=defineSecret("NEDARIM_API_KEY"); // entered by the yeshiva, never in the code
const MOSAD=process.env.NEDARIM_MOSAD||"0000000"; // your Nedarim Plus institution number
const OWNER=process.env.OWNER_EMAIL||"admin@example.com";
const SOURCE="נדרים פלוס";
const MAX_HISTORY_CALLS=6; // up to 12,000 transactions a run, well under the hourly limit

// ---------- talking to Nedarim ----------
async function nedarim(page,params){
  const body=new URLSearchParams({MosadId:MOSAD,ApiPassword:API_KEY.value(),...params});
  const r=await fetch(`https://matara.pro/nedarimplus/Reports/${page}.aspx`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
  const text=await r.text();
  let j;try{j=JSON.parse(text)}catch(e){throw new Error(`${params.Action}: ${text.slice(0,200)}`)}
  if(j&&!Array.isArray(j)&&(j.Result==="Error"||j.Status==="Error"))throw new Error(`${params.Action}: ${j.Message||"Error"}`);
  return j;
}
const rowsOf=j=>Array.isArray(j)?j:(j&&Array.isArray(j.data)?j.data:[]);
// dd/MM/yyyy[ HH:mm[:ss]] → yyyy-MM-dd
const isoDate=s=>{const m=String(s||"").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!m)return "";const y=m[3].length===2?"20"+m[3]:m[3];return `${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`};
const num=v=>{const n=parseFloat(String(v??"").replace(/[^\d.\-]/g,""));return isNaN(n)?0:n};
const ddmmyyyy=d=>`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
const clean=s=>String(s??"").trim();

// the yeshiva's own classification rules: "if the description contains X, it belongs to budget line Y";
// then donations whose Nedarim category is a person's name (the Purim campaign pages of bachurim and rabbis)
function classifier(meta,knownGroups){
  const rules=(meta&&meta.rules)||[],namesCat=(meta&&meta.nedarimNamesCat)||"";
  return t=>{const r=rules.find(r=>r.kw&&t.desc.includes(r.kw));if(r)return r.cat;
    const g=t.nedarim&&t.nedarim.groupe;return g&&knownGroups.size&&!knownGroups.has(g)&&namesCat?namesCat:""};
}

// ---------- one sync run ----------
async function sync(){
  const year=new Date().getFullYear(),from=`${year}-01-01`;
  const stateRef=db.doc("sync/nedarim");
  const state=(await stateRef.get()).data()||{};
  const meta=(await db.doc(`meta/${year}`).get()).data();
  const out={newTx:0,errors:[]};
  // the Nedarim categories – anything else in that field is a person's name
  try{state.groups=rowsOf(await nedarim("Manage3",{Action:"GetNewGroupe"})).map(g=>clean(g.Name)).filter(n=>n&&!n.startsWith("*"))}catch(e){out.errors.push(String(e.message||e))}
  const classify=classifier(meta,new Set(state.groups||[]));
  // tuition from a payer the yeshiva already linked to a bachur goes straight to him
  const payerOf={};(await db.collection("students").get()).forEach(d=>((d.data().payers)||[]).forEach(p=>{payerOf[p]=d.id}));
  const studentFor=t=>t.nedarim&&t.nedarim.groupe==="שכר לימוד"&&t.amount>0&&payerOf[t.nedarim.client]||null;
  const batchWrite=async docs=>{for(let i=0;i<docs.length;i+=400){const b=db.batch();docs.slice(i,i+400).forEach(([ref,data,merge])=>merge?b.set(ref,data,{merge:true}):b.set(ref,data));await b.commit()}};
  const existing=async ids=>{const s=new Set();for(let i=0;i<ids.length;i+=100){const snaps=await db.getAll(...ids.slice(i,i+100).map(id=>db.doc("tx/"+id)));snaps.forEach(x=>{if(x.exists)s.add(x.id)})}return s};
  // a transaction someone already classified or noted keeps what they did; only new ones are written
  const addTx=async list=>{const have=await existing(list.map(t=>t.id));const fresh=list.filter(t=>!have.has(t.id));
    await batchWrite(fresh.map(({id,...t})=>[db.doc("tx/"+id),{...t,cat:t.cat||classify(t),studentId:studentFor(t),note:t.note||"",source:SOURCE,auto:true}]));out.newTx+=fresh.length};

  // credit card donations (one-time, instalments and credit standing orders)
  const kevaPaid={};
  try{
    let last=state.lastTxId||"";
    for(let call=0;call<MAX_HISTORY_CALLS;call++){
      const rows=rowsOf(await nedarim("Manage3",{Action:"GetHistoryJson",LastId:last,MaxId:"2000"}));
      if(!rows.length)break;
      const list=[];
      for(const r of rows){
        last=String(r.TransactionId||last);
        const date=isoDate(r.TransactionTime),amount=num(r.Amount);
        if(date<from||!amount)continue; // earlier years, and cancelled transactions (Amount 0)
        const who=clean(r.ClientName),grp=clean(r.Groupe),usd=String(r.Currency)==="2";
        list.push({id:"n_"+r.TransactionId,date,amount,desc:`נדרים פלוס – ${who||"תורם"}${grp?" · "+grp:""}`,
          note:[usd?"סכום בדולר":"",clean(r.Comments),clean(r.TransactionType)].filter(Boolean).join(" · "),nedarim:{type:"credit",kevaId:clean(r.KevaId),groupe:grp,client:who,zeout:clean(r.Zeout)}});
      }
      await addTx(list);
      if(rows.length<2000)break;
    }
    state.lastTxId=last;
  }catch(e){out.errors.push(String(e.message||e))}

  // money Nedarim recorded by hand: cash, cheques, bank transfers
  try{
    const rows=rowsOf(await nedarim("Manage3",{Action:"GetAchnasotJson",From:`01/01/${year}`,To:ddmmyyyy(new Date()),MaxId:"2000"}));
    await addTx(rows.map(r=>({id:"na_"+r.ID,date:isoDate(r.Date),amount:num(r.Amount),
      desc:`נדרים פלוס – ${clean(r.TypeName)||"הכנסה"} – ${clean(r.ClientName)||"תורם"}${clean(r.Groupe)?" · "+clean(r.Groupe):""}`,
      note:[String(r.Currency)==="2"?"סכום בדולר":"",clean(r.Comments)].filter(Boolean).join(" · "),nedarim:{type:"manual",groupe:clean(r.Groupe),client:clean(r.ClientName)}})).filter(t=>t.date>=from&&t.amount));
  }catch(e){out.errors.push(String(e.message||e))}

  // bank standing orders (מס"ב): charges this year
  const masavPaid={};
  try{
    const j=await nedarim("Masav3",{Action:"GetMasavHistoryNew",From:`01/01/${year}`,To:ddmmyyyy(new Date())});
    const list=[];
    for(const r of rowsOf(j)){
      const id=String(r.DT_RowId||"");if(!/^\d+$/.test(id))continue; // pending files and single charges are not money yet
      const amount=num(r["5"]),date=isoDate(r["4"]);if(!amount||date<from)continue;
      const kid=clean(r["2"]);masavPaid[kid]=(masavPaid[kid]||0)+amount;
      list.push({id:"nm_"+id,date,amount,desc:`נדרים פלוס – הו״ק בנקאית – ${clean(r["3"])||"תורם"}${clean(r["8"])?" · "+clean(r["8"]):""}`,note:clean(r["6"]),nedarim:{type:"masav",kevaId:kid,groupe:clean(r["8"]),client:clean(r["3"])}});
    }
    await addTx(list);
  }catch(e){out.errors.push(String(e.message||e))}

  // donors: every credit and bank standing order, with this year's total from the transactions
  try{
    const ytd=await db.collection("tx").where("date",">=",from).get(); // filtered here, so no extra index is needed
    const byKeva={},byName={};
    ytd.forEach(d=>{const t=d.data(),n=t.nedarim||{};if(t.source!==SOURCE)return;
      if(n.kevaId){const k=(n.type==="masav"?"m_":"k_")+n.kevaId;byKeva[k]=(byKeva[k]||0)+t.amount;Object.assign(kevaPaid,{[k]:t.date>(kevaPaid[k]||"")?t.date:kevaPaid[k]})}
      else if(n.client){const k=n.zeout||n.client;const o=byName[k]||(byName[k]={name:n.client,ytd:0,last:""});o.ytd+=t.amount;if(t.date>o.last)o.last=t.date}});
    const docs=[];
    for(const r of rowsOf(await nedarim("Manage3",{Action:"GetKevaJson",MaxId:"2000"}))){
      const id="k_"+r.KevaId,enabled=String(r.Enabled)==="1",err=clean(r.ErrorText);
      docs.push([db.doc("donors/"+id),{name:clean(r.ClientName)||"תורם",city:clean(r.City),kind:"keva",monthly:num(r.Amount),
        status:!enabled||num(r.Itra)===0&&r.Itra!==""&&r.Itra!=null?"ended":err?"failed":"active",ytd:byKeva[id]||0,last:kevaPaid[id]||isoDate(r.CreationDate),
        note:err?`הכרטיס נדחה: ${err}`:clean(r.Comments),groupe:clean(r.Groupe),via:"אשראי",updated:FieldValue.serverTimestamp()},true]);
    }
    for(const r of rowsOf(await nedarim("Masav3",{Action:"GetMasavKevaNew"}))){
      const id="m_"+r.DT_RowId;
      docs.push([db.doc("donors/"+id),{name:clean(r["2"])||"תורם",city:"",kind:"keva",monthly:num(r["6"]),status:String(r.IsActive)==="1"?"active":"ended",
        ytd:byKeva[id]||masavPaid[String(r.DT_RowId)]||0,last:kevaPaid[id]||isoDate(r.CreatedDate),note:clean(r["8"]),groupe:clean(r["7"]),via:"הו״ק בנקאית",updated:FieldValue.serverTimestamp()},true]);
    }
    // the 30 biggest one-time donors of the year
    Object.entries(byName).sort((a,b)=>b[1].ytd-a[1].ytd).slice(0,30).forEach(([k,o])=>
      docs.push([db.doc("donors/o_"+k.replace(/[\/.#$\[\]\s]/g,"_").slice(0,80)),{name:o.name,city:"",kind:"once",monthly:null,status:"once",ytd:o.ytd,last:o.last,note:"",via:"חד פעמי",updated:FieldValue.serverTimestamp()},true]));
    await batchWrite(docs);
    out.donors=docs.length;
  }catch(e){out.errors.push(String(e.message||e))}

  await stateRef.set({...state,lastRun:FieldValue.serverTimestamp(),lastResult:out},{merge:true});
  logger.info("nedarim sync",out);
  return out;
}

export const nedarimScheduled=onSchedule({schedule:"every 3 hours",timeZone:"Asia/Jerusalem",secrets:[API_KEY],timeoutSeconds:300},async()=>{await sync()});

// "סנכרון עכשיו" – for signed-in staff who may change data, at most once every 10 minutes
export const nedarimSyncNow=onCall({secrets:[API_KEY],timeoutSeconds:300},async req=>{
  const t=req.auth&&req.auth.token;
  if(!t||!t.email_verified)throw new HttpsError("unauthenticated","יש להתחבר");
  const email=String(t.email).toLowerCase();
  if(email!==OWNER){const r=(await db.doc("roles/"+email).get()).data();if(!r||!["rosh","menahel","mazkir","dev"].includes(r.role))throw new HttpsError("permission-denied","אין הרשאה")}
  const s=(await db.doc("sync/nedarim").get()).data();
  if(s&&s.lastRun&&Date.now()-s.lastRun.toMillis()<10*60e3)throw new HttpsError("resource-exhausted","הסנכרון האחרון היה לפני פחות מ־10 דקות");
  return await sync();
});

// ---------- a question to the developer → an email with the screenshots / recordings ----------
// Sent from the yeshiva's Gmail with an app password (secret GMAIL_APP_PASSWORD).
// Until that secret exists the questions are still saved and shown in the settings screen.
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {getStorage} from "firebase-admin/storage";
import nodemailer from "nodemailer";
const MAIL_TO=process.env.DEVELOPER_EMAIL||"developer@example.com";
const MAIL_ON=process.env.MAIL_ENABLED==="1";
const GMAIL=MAIL_ON?defineSecret("GMAIL_APP_PASSWORD"):null;
const ROLE_NAMES={rosh:"ראש הישיבה",menahel:"מנהל הישיבה",mazkir:"מזכיר",dev:"מתכנת",roeh:"רואה חשבון"};
const escH=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
export const questionMail=MAIL_ON?onDocumentCreated({document:"questions/{id}",secrets:[GMAIL],timeoutSeconds:300,memory:"512MiB"},async ev=>{
  const q=ev.data&&ev.data.data();if(!q)return;
  try{
    const bucket=getStorage().bucket("YOUR-PROJECT.firebasestorage.app"),attachments=[],big=[];let total=0;
    for(const f of q.files||[]){
      if(total+f.size<=20*1048576){const [buf]=await bucket.file(f.path).download();attachments.push({filename:f.name,content:buf,contentType:f.type||undefined});total+=f.size}
      else big.push(f);
    }
    const consoleLink=`https://console.firebase.google.com/project/YOUR-PROJECT/storage/YOUR-PROJECT.firebasestorage.app/files/~2Fquestions~2F${ev.params.id}`;
    const html=`<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px">
      <p><b>${escH(q.name)}</b> (${escH(ROLE_NAMES[q.role]||q.role)}, ${escH(q.email)}) שאל/ה:</p>
      <div style="white-space:pre-wrap;background:#f6f5f1;border-radius:8px;padding:10px">${escH(q.text)}</div>
      <p>מסך: <b>${escH(q.page)}</b> · שנה ${escH(q.year)} · <a href="https://YOUR-PROJECT.web.app/${q.year&&q.year!==new Date().getFullYear()?"?year="+q.year:""}${escH(q.hash||"")}">פתיחת המסך</a></p>
      ${attachments.length?`<p>מצורפים: ${attachments.map(a=>escH(a.filename)).join(", ")}</p>`:""}
      ${big.length?`<p>קבצים גדולים מדי למייל (${big.map(f=>escH(f.name)).join(", ")}) – <a href="${consoleLink}">נמצאים כאן</a></p>`:""}
      <p style="color:#888;font-size:12px">${escH(q.ua)}</p></div>`;
    const t=nodemailer.createTransport({service:"gmail",auth:{user:OWNER,pass:GMAIL.value().replace(/\s/g,"")}});
    await t.sendMail({from:`"מערכת כספים – הישיבה" <${OWNER}>`,to:MAIL_TO,replyTo:q.email,subject:`שאלה מ${q.name}: ${String(q.text).slice(0,60)}`,html,attachments});
    await ev.data.ref.update({emailed:true});
  }catch(e){logger.error("question mail",e);await ev.data.ref.update({emailError:String(e.message||e).slice(0,300)})}
}):null;
