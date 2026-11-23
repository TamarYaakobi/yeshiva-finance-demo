// Any table in the system can go out as Excel or PDF, and any Excel can come in with its columns matched by hand.
// A table: {title, cols:[{label, num, width}], rows:[[...values]], total:[...]}. A report: {title, subtitle, logo, sheets:[table,...]}.
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const safeName=s=>String(s).replace(/[\\/:*?"<>|]/g,"-").slice(0,90);

// ---------- Excel: a real .xlsx, right to left, bold header, frozen first row ----------
export async function toExcel(rep){
  const {default:writeXlsxFile}=await import("write-excel-file/browser");
  const sheets=rep.sheets.map((t,i)=>{
    const head=t.cols.map(c=>({value:c.label,fontWeight:"bold",backgroundColor:"#EFE7DA"}));
    const cell=(v,c)=>v==null||v===""?null:c&&c.num&&typeof v==="number"?{value:Math.round(v*100)/100,type:Number,format:"#,##0"}:{value:String(v),type:String};
    const body=t.rows.map(r=>r.map((v,k)=>cell(v,t.cols[k])));
    const total=t.total?[t.total.map((v,k)=>{const c=cell(v,t.cols[k]);return c?{...c,fontWeight:"bold"}:null})]:[];
    const name=safeName(t.sheet||t.title||`גיליון ${i+1}`).slice(0,31)||`גיליון ${i+1}`;
    return {data:[head,...body,...total],sheet:name,rightToLeft:true,stickyRowsCount:1,
      columns:t.cols.map((c,k)=>({width:c.width||Math.min(45,Math.max(8,c.label.length+2,...t.rows.slice(0,200).map(r=>String(r[k]??"").length+2)))}))};
  });
  // two sheets may not share a name
  const seen={};sheets.forEach(s=>{let n=s.sheet,k=2;while(seen[n])n=s.sheet.slice(0,28)+" "+k++;seen[n]=1;s.sheet=n});
  return writeXlsxFile(sheets).toBlob();
}

// ---------- PDF: a print-ready page; the browser's print dialog saves it as PDF ----------
export function toPDF(rep){
  const fmt=(v,c)=>v==null?"":c&&c.num&&typeof v==="number"?(v<0?"−":"")+"₪"+Math.abs(Math.round(v)).toLocaleString("he-IL"):esc(v);
  const table=t=>`${rep.sheets.length>1||t.title!==rep.title?`<h2>${esc(t.title)}</h2>`:""}
    <table><thead><tr>${t.cols.map(c=>`<th${c.num?' class="n"':""}>${esc(c.label)}</th>`).join("")}</tr></thead>
    <tbody>${t.rows.map(r=>`<tr>${r.map((v,k)=>`<td${t.cols[k]&&t.cols[k].num?' class="n"':""}>${fmt(v,t.cols[k])}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${t.cols.length}">אין נתונים</td></tr>`}</tbody>
    ${t.total?`<tfoot><tr>${t.total.map((v,k)=>`<td${t.cols[k]&&t.cols[k].num?' class="n"':""}>${fmt(v,t.cols[k])}</td>`).join("")}</tr></tfoot>`:""}</table>`;
  const html=`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(rep.title)}</title><style>
    @page{size:A4 ${rep.landscape?"landscape":"portrait"};margin:12mm}
    body{font-family:Arial,"Segoe UI",sans-serif;color:#222;font-size:10.5pt;margin:0}
    .head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #5a4632;padding-bottom:8px;margin-bottom:12px}
    .head img{width:46px;height:46px;object-fit:contain}
    h1{font-size:16pt;margin:0;color:#5a4632} .sub{color:#666;font-size:9.5pt}
    h2{font-size:12pt;color:#5a4632;margin:16px 0 6px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px;page-break-inside:auto}
    th,td{border-bottom:1px solid #ddd;padding:4px 6px;text-align:right;vertical-align:top}
    th{background:#efe7da;font-weight:700} tr{page-break-inside:avoid}
    .n{text-align:left;white-space:nowrap;direction:ltr} tfoot td{font-weight:700;border-top:2px solid #999}
    .foot{color:#888;font-size:8.5pt;margin-top:10px}
  </style></head><body>
    <div class="head">${rep.logo?`<img src="${esc(rep.logo)}" alt="">`:""}<div><h1>${esc(rep.title)}</h1>${rep.subtitle?`<div class="sub">${esc(rep.subtitle)}</div>`:""}</div></div>
    ${rep.sheets.map(table).join("")}
    <div class="foot">הופק ב־${new Date().toLocaleDateString("he-IL")}</div>
    <script>addEventListener("load",()=>setTimeout(()=>{print()},250))<\/script></body></html>`;
  const w=open("","_blank");
  if(!w){alert("הדפדפן חסם את החלון. צריך לאשר חלונות קופצים לאתר הזה.");return}
  w.document.open();w.document.write(html);w.document.close();
}

// ---------- reading an Excel file: every sheet as rows, plus a guess of where the header is ----------
export async function readSheets(file){
  const {default:readXlsxFile}=await import("read-excel-file/browser");
  return (await readXlsxFile(file)).map(s=>({name:s.sheet,rows:s.data.filter(r=>r.some(c=>c!=null&&String(c).trim()!==""))})).filter(s=>s.rows.length);
}
export const cellText=c=>c==null?"":c instanceof Date?c.toISOString().slice(0,10):String(c).trim();
const norm=s=>String(s||"").replace(/["'״׳.\s_\-]/g,"").toLowerCase();
// the header row: among the first rows, the one whose cells match the most expected column names
export function findHeader(rows,fields){
  let best=0,score=-1;
  rows.slice(0,15).forEach((r,i)=>{const cells=r.map(c=>norm(cellText(c)));
    const s=fields.reduce((a,f)=>a+(cells.some(c=>c&&(f.hints||[]).some(h=>c.includes(norm(h))))?1:0),0)+r.filter(c=>typeof c==="string").length/100;
    if(s>score){score=s;best=i}});
  return best;
}
export function guessMap(head,fields){
  const used=new Set(),map={};
  fields.forEach(f=>{const i=head.findIndex((h,k)=>!used.has(k)&&h&&(f.hints||[]).some(x=>norm(h)===norm(x)));if(i>=0){map[f.k]=i;used.add(i)}});
  fields.forEach(f=>{if(map[f.k]!=null)return;const i=head.findIndex((h,k)=>!used.has(k)&&h&&(f.hints||[]).some(x=>norm(h).includes(norm(x))));if(i>=0){map[f.k]=i;used.add(i)}});
  return map;
}
// numbers as banks write them: "1,234.50", "-1,234", "1,234-", "(1,234)", "₪ 1,234"
export function parseAmount(v){
  if(typeof v==="number")return v;
  let s=String(v??"").trim();if(!s)return null;
  const neg=/^\(.*\)$/.test(s)||/-\s*$/.test(s)||/^-/.test(s.replace(/[₪\s]/g,""));
  s=s.replace(/[^\d.,]/g,"");if(!s)return null;
  if(/,\d{1,2}$/.test(s)&&!/\.\d/.test(s))s=s.replace(/\./g,"").replace(",",".");else s=s.replace(/,/g,"");
  const n=parseFloat(s);return isNaN(n)?null:neg?-n:n;
}
// dates: real Excel dates, 31/12/2026, 31.12.26, 2026-12-31, or an Excel day number
export function parseDate(v){
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  if(v instanceof Date)return `${v.getUTCFullYear()}-${String(v.getUTCMonth()+1).padStart(2,"0")}-${String(v.getUTCDate()).padStart(2,"0")}`;
  if(typeof v==="number"&&v>20000&&v<80000){const d=new Date(Date.UTC(1899,11,30)+v*864e5);return d.toISOString().slice(0,10)}
  const s=String(v??"").trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);if(m){const y=m[3].length===2?"20"+m[3]:m[3];if(+m[2]>=1&&+m[2]<=12&&+m[1]>=1&&+m[1]<=31)return `${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`}
  return null;
}
